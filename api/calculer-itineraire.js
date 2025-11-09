/**
 * Fichier : /api/calculer-itineraire.js
 *
 * VERSION SÉCURISÉE & ROBUSTE (pour Netlify)
 *
 * CORRECTION : L'erreur "response.status is not a function"
 * signifie que Netlify n'utilise pas le même objet 'response' que Vercel.
 * On doit 'return new Response(...)' au lieu d'appeler response.status().
 */

// Fonction pour vérifier si c'est des coordonnées
function isCoordinates(input) {
    if (typeof input !== 'string') return false; 
    const parts = input.split(',');
    if (parts.length !== 2) return false;
    return !isNaN(parts[0]) && !isNaN(parts[1]);
}

// Fonction pour formater l'adresse
function formatPlace(input) {
    if (isCoordinates(input)) {
        return input;
    }
    if (input && input.trim() !== '') {
        return `${input}, Dordogne`;
    }
    return null;
}

// CORRECTION : La signature du handler Netlify est (request, context)
// On n'a besoin que de 'request'.
export default async function handler(request) {
    
    try {
        // CORRECTION : On lit l'URL depuis l'objet 'request'
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

        const fromPlace = formatPlace(from);
        const toPlace = formatPlace(to);

        if (!fromPlace || !toPlace) {
             return new Response(JSON.stringify({ error: "Adresses de départ ou d'arrivée invalides." }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const nowInSeconds = Math.floor(Date.now() / 1000);

        const apiUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${fromPlace}&destination=${toPlace}&mode=transit&transit_mode=bus&departure_time=${nowInSeconds}&key=${apiKey}&language=fr`;

        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data.status !== 'OK') {
            console.error("Erreur API Google:", data.status, data.error_message);
            return new Response(JSON.stringify({ error: data.error_message || data.status, status: data.status }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Succès : on retourne la réponse de Google
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        // Erreur interne (crash)
        console.error("Erreur interne non gérée dans la fonction API:", error);
        return new Response(JSON.stringify({ error: 'Erreur serveur interne. Vérifiez les logs Netlify.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
