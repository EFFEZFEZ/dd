/**
 * Fichier : /api/calculer-itineraire.js
 *
 * VERSION POST (CORRIGÉE)
 *
 * Ce handler gère la méthode POST envoyée par routingService.js.
 * Il lit le 'body' de la requête.
 */

// Fonction pour vérifier si c'est des coordonnées
function isCoordinates(input) {
    if (typeof input !== 'string') return false; 
    const parts = input.split(',');
    if (parts.length !== 2) return false;
    return !isNaN(parts[0]) && !isNaN(parts[1]);
}

// Fonction pour créer l'objet "Place" pour l'API Google
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
    // Si c'est du texte
    if (input && input.trim() !== '') {
        return {
            address: `${input}, Dordogne`
        };
    }
    return null; // Renvoie null si l'entrée est invalide
}

// Handler Netlify (modifié pour POST)
export default async function handler(request) {

    // 1. Accepter UNIQUEMENT POST
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: "Méthode non autorisée. Utilisez POST." }), {
            status: 405, // Method Not Allowed
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    try {
        // 2. Lire le BODY JSON
        const body = await request.json();
        
        // Extrait les variables du body
        const { from, to, departure_time, arrival_time } = body;

        const apiKey = process.env.BACKEND_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Clé API Backend non configurée." }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 3. Vérifier les variables (qui étaient 'null' avant)
        if (!from || from.trim() === '' || !to || to.trim() === '') {
            return new Response(JSON.stringify({ error: "Les champs 'Départ' et 'Arrivée' sont requis." }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const fromPlace = createPlace(from);
        const toPlace = createPlace(to);

        // C'est ici que l'erreur 'INVALID_ARGUMENT' est générée
        // si fromPlace or toPlace est 'null'
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

        // 4. Utiliser les variables de temps lues du BODY
        if (departure_time) {
            requestBody.departureTime = departure_time;
        } else if (arrival_time) {
            requestBody.arrivalTime = arrival_time;
        } else {
            requestBody.departureTime = new Date().toISOString();
        }

        // Appel à l'API Google
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

        // Si Google renvoie une erreur (ce qui se passe actuellement)
        if (data.error) {
             console.error("Erreur API Routes (après fetch):", data.error);
             return new Response(JSON.stringify({ error: data.error.message, status: data.error.status }), {
                status: data.error.code || 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!data.routes || data.routes.length === 0) {
            let errorMsg = "Aucun itinéraire en bus trouvé pour cette recherche.";
            return new Response(JSON.stringify({ error: errorMsg, status: 'ZERO_RESULTS' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Succès
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        // Gère les erreurs (ex: JSON mal formé)
        console.error("Erreur interne (crash) dans la fonction API:", error);
        return new Response(JSON.stringify({ error: 'Erreur serveur interne. Vérifiez les logs Netlify.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
