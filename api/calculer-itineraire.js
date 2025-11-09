/**
 * Fichier : /api/calculer-itineraire.js
 *
 * VERSION FINALE (NETLIFY + API ROUTES)
 *
 * Utilise la nouvelle API Routes et "TransitPreferences"
 * pour forcer UNIQUEMENT les trajets en bus ("BUS").
 * Supprime le FieldMask qui causait l'erreur "invalid argument".
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

        if (!fromPlace || !toPlace) {
             return new Response(JSON.stringify({ error: "Adresses de départ ou d'arrivée invalides." }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const now = new Date();
        const apiUrl = "https://routes.googleapis.com/directions/v2:computeRoutes";

        const requestBody = {
            origin: fromPlace,
            destination: toPlace,
            travelMode: "TRANSIT",
            departureTime: now.toISOString(),
            languageCode: "fr",
            transitPreferences: {
                allowedTravelModes: ["BUS"] // Force les bus, exclut les trains
            }
        };

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                // On demande juste les routes, sans masque de champ compliqué
                'X-Goog-FieldMask': 'routes'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await res.json();

        if (!data.routes || data.routes.length === 0) {
            console.error("Erreur API Routes:", data.error || "Aucun trajet trouvé");
            let errorMsg = "Aucun itinéraire en bus trouvé.";
            if (data.error) errorMsg = data.error.message;
            
            return new Response(JSON.stringify({ error: errorMsg, status: 'ZERO_RESULTS' }), {
                status: 404, // "Non trouvé" est plus clair
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
