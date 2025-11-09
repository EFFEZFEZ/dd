/**
 * Fichier : /api/calculer-itineraire.js
 *
 * VERSION FINALE SÉCURISÉE (pour Netlify)
 *
 * CORRECTION : Utilise 'return new Response' (compatible Netlify)
 * et force '&transit_mode=bus' & '&departure_time=now'
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

export default async function handler(request) {
    
    // Message pour prouver que le NOUVEAU code s'exécute
    console.log("Exécution de la fonction API v3 (Netlify) !");

    try {
        const url = new URL(request.url);
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');

        const apiKey = process.env.BACKEND_API_KEY;

        if (!apiKey) {
            console.error("Erreur 500 : BACKEND_API_KEY non trouvée.");
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

        // L'URL FINALE qui résout tous tes problèmes
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
