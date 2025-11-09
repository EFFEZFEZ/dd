/**
 * Fichier : /api/calculer-itineraire.js
 *
 * VERSION FINALE (NETLIFY + API ROUTES)
 *
 * Utilise la nouvelle API Routes et "TransitPreferences"
 * pour forcer UNIQUEMENT les trajets en bus ("BUS")
 * et exclure les trains ("RAIL", "TER").
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
    return {
        address: `${input}, Dordogne`
    };
}

export default async function handler(request) {
    
    try {
        const url = new URL(request.url);
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');

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

        const now = new Date();

        // --- C'EST ICI QU'ON UTILISE LA NOUVELLE API ---
        
        const apiUrl = "https://routes.googleapis.com/directions/v2:computeRoutes";

        const requestBody = {
            origin: fromPlace,
            destination: toPlace,
            travelMode: "TRANSIT",
            departureTime: now.toISOString(),
            languageCode: "fr",
            // On force le calcul à n'utiliser QUE le bus
            transitPreferences: {
                allowedTravelModes: ["BUS"] // Exclut "TRAIN", "RAIL", etc.
            }
        };

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                // Masque de champ pour ne récupérer que ce dont on a besoin
                'X-Goog-FieldMask': 'routes.legs.steps,routes.legs.duration,routes.legs.departureTime,routes.legs.arrivalTime,routes.legs.startAddress,routes.legs.endAddress'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await res.json();

        // L'API Routes renvoie un objet vide ou une erreur si aucun trajet n'est trouvé
        if (!data.routes || data.routes.length === 0) {
            console.error("Erreur API Routes:", data.error || "Aucun trajet trouvé");
            
            let errorMsg = "Aucun itinéraire en bus trouvé.";
            if (data.error) errorMsg = data.error.message;

            return new Response(JSON.stringify({ error: errorMsg, status: 'ZERO_RESULTS' }), {
                status: 500, // On renvoie 500 mais avec un message clair
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Succès : on retourne la réponse
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
