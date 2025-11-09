/**
 * Fichier : /api/calculer-itineraire.js
 *
 * VERSION CORRIGÉE ET COMPLÈTE
 *
 * 1. Lit l'heure de départ/arrivée envoyée par le frontend.
 * 2. Demande des trajets alternatifs (computeAlternativeRoutes: true).
 * 3. Demande moins de marche (LESS_WALKING) tout en forçant le BUS.
 * 4. Utilise le FieldMask COMPLET pour obtenir les couleurs et détails de la ligne.
 */

// Fonction pour vérifier si c'est des coordonnées
function isCoordinates(input) {
    if (typeof input !== 'string') return false; 
    const parts = input.split(',');
    if (parts.length !== 2) return false;
    return !isNaN(parts[0]) && !isNaN(parts[1]);
}

// Fonction pour créer l'objet "Place" pour la nouvelle API
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
    // Si c'est du texte, on ajoute le contexte
    if (input && input.trim() !== '') {
        return {
            address: `${input}, Dordogne`
        };
    }
    return null;
}

// Handler Netlify (utilise 'request' seulement)
export default async function handler(request) {
    
    try {
        const url = new URL(request.url);
        // RÉCUPÈRE TOUS LES PARAMÈTRES DU FRONTEND
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        const departureTime = url.searchParams.get('departure_time');
        const arrivalTime = url.searchParams.get('arrival_time');

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
            
            // --- CORRECTION N°2 et N°3 : Demander alternatives et moins de marche ---
            computeAlternativeRoutes: true,
            transitPreferences: {
                allowedTravelModes: ["BUS"], // Garde votre filtre pour BUS
                transitRoutingPreference: "LESS_WALKING" // Ajoute la préférence Moins de Marche
            }
        };

        // --- CORRECTION N°4 : Utiliser l'heure du frontend ---
        if (departureTime) {
            requestBody.departureTime = departureTime;
        } else if (arrivalTime) {
            requestBody.arrivalTime = arrivalTime;
        } else {
            // Fallback si aucune heure n'est fournie
            requestBody.departureTime = new Date().toISOString();
        }

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                
                // --- CORRECTION N°1 : Le FieldMask COMPLET ---
                'X-Goog-FieldMask': 'routes.legs.steps.transitDetails.line.color,routes.legs.steps.transitDetails.line.shortName,routes.legs.steps.transitDetails.line.textColor,routes.legs.steps.transitDetails.headsign,routes.legs.steps.transitDetails.stopDetails.departureStop.name,routes.legs.steps.transitDetails.stopDetails.arrivalStop.name,routes.legs.steps.transitDetails.stopCount,routes.duration,routes.legs.departureTime,routes.legs.arrivalTime,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.travelMode,routes.legs.steps.navigationInstruction,routes.legs.startLocation,routes.legs.endLocation,routes.legs.startAddress,routes.legs.endAddress'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await res.json();

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
                status: 404, // "Non trouvé"
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Erreur interne (crash) dans la fonction API:", error);
        return new Response(JSON.stringify({ error: 'Erreur serveur interne. Vérifiez les logs Netlify.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
