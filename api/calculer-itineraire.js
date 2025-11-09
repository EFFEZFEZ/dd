/**
 * Fichier : /api/calculer-itineraire.js
 *
 * VERSION CORRIGÉE :
 * 1. Transformé en un VRAI handler POST.
 * 2. Vérifie la méthode 'POST' au début.
 * 3. Lit les données (from, to, time) depuis le `request.json()` (le body)
 * au lieu des `url.searchParams` (le GET).
 * 4. La logique existante (createPlace, fetch Google) est conservée
 * car elle était déjà correcte.
 */

// Fonction pour vérifier si c'est des coordonnées (inchangée)
function isCoordinates(input) {
    if (typeof input !== 'string') return false; 
    const parts = input.split(',');
    if (parts.length !== 2) return false;
    return !isNaN(parts[0]) && !isNaN(parts[1]);
}

// Fonction pour créer l'objet "Place" (inchangée)
function createPlace(input) {
    if (isCoordinates(input)) {
        const parts = input.split(',');
        return {
            location: {
                latLng: {
                    latitude: parseFloat(parts[0]),
                    longitude: parseFloat(parts[1])
                }
            }
        };
    }
    if (input && input.trim() !== '') {
        return {
            address: `${input}, Dordogne`
        };
    }
    return null;
}

// Handler Netlify (modifié pour POST)
export default async function handler(request) {

    // --- CORRECTION 1 : Accepter UNIQUEMENT POST ---
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: "Méthode non autorisée. Utilisez POST." }), {
            status: 405, // Method Not Allowed
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    try {
        // --- CORRECTION 2 : Lire le BODY JSON ---
        const body = await request.json();
        
        // Extrait les variables du body (envoyées par routingService)
        const { from, to, departure_time, arrival_time } = body;

        const apiKey = process.env.BACKEND_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Clé API Backend non configurée sur le serveur Netlify." }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        if (!from || from.trim() === '' || !to || to.trim() === '') {
            return new Response(JSON.stringify({ error: "Les champs 'Départ' et 'Arrivée' sont requis." }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Le reste de la logique est identique, car 'from' et 'to'
        // sont maintenant les chaînes correctes lues depuis le body.
        const fromPlace = createPlace(from);
        const toPlace = createPlace(to);

        if (!fromPlace || !toPlace) {
             return new Response(JSON.stringify({ error: "Adresses de départ ou d'arrivée invalides." }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const apiUrl = "https://routes.googleapis.com/directions/v2:computeRoutes";

        const requestBody = {
            origin: fromPlace,
            destination: toPlace,
            travelMode: "TRANSIT",
            languageCode: "fr",
            computeAlternativeRoutes: true,
            transitPreferences: {
                allowedTravelModes: ["BUS"],
                routingPreference: "LESS_WALKING"
            }
        };

        // --- CORRECTION 3 : Utiliser les variables de temps lues du BODY ---
        if (departure_time) {
            requestBody.departureTime = departure_time;
        } else if (arrival_time) {
            requestBody.arrivalTime = arrival_time;
        } else {
            // Sécurité si aucune heure n'est fournie (main.js devrait le faire)
            requestBody.departureTime = new Date().toISOString();
        }

        // Le fetch vers Google reste inchangé, il était correct
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'routes.duration,routes.legs.departureTime,routes.legs.arrivalTime,routes.legs.startAddress,routes.legs.endAddress,routes.legs.startLocation.latLng,routes.legs.endLocation.latLng,routes.legs.steps.travelMode,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.navigationInstruction.instructions,routes.legs.steps.transitDetails.headsign,routes.legs.steps.transitDetails.stopCount,routes.legs.steps.transitDetails.line.shortName,routes.legs.steps.transitDetails.line.color,routes.legs.steps.transitDetails.line.textColor,routes.legs.steps.transitDetails.stopDetails.departureStop.name,routes.legs.steps.transitDetails.stopDetails.arrivalStop.name'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await res.json();

        // La gestion des erreurs Google reste inchangée
        if (data.error) {
             console.error("Erreur API Routes (après fetch):", data.error);
             return new Response(JSON.stringify({ error: data.error.message, status: data.error.status }), {
                status: data.error.code || 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!data.routes || data.routes.length === 0) {
            console.error("Erreur API Routes: Aucun trajet trouvé", data);
            let errorMsg = "Aucun itinéraire en bus trouvé pour cette recherche.";
            
            return new Response(JSON.stringify({ error: errorMsg, status: 'ZERO_RESULTS' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        // Gère les erreurs de parsing JSON ou autres crashs
        console.error("Erreur interne (crash) dans la fonction API:", error);
        return new Response(JSON.stringify({ error: 'Erreur serveur interne. Vérifiez les logs Netlify.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
