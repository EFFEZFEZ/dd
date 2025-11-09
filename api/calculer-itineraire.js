/**
 * Fichier : /api/calculer-itineraire.js
 *
 * VERSION SÉCURISÉE & ROBUSTE (pour Netlify)
 *
 * CORRECTION : Netlify ne comprend pas "request.query".
 * On utilise "new URL(request.url).searchParams" pour lire
 * les paramètres "from" et "to", ce qui corrige le crash 502.
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

export default async function handler(request, response) {
    
    try {
        // --- CORRECTION NETLIFY (pour l'erreur 502) ---
        // On parse l'URL pour trouver les paramètres
        const url = new URL(request.url);
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        // --- FIN DE LA CORRECTION ---

        const apiKey = process.env.BACKEND_API_KEY;

        if (!apiKey) {
            return response.status(500).json({ error: "Clé API Backend non configurée sur le serveur Netlify." });
        }
        
        if (!from || from.trim() === '' || !to || to.trim() === '') {
            return response.status(400).json({ error: "Les champs 'Départ' et 'Arrivée' sont requis." });
        }

        const fromPlace = formatPlace(from);
        const toPlace = formatPlace(to);

        if (!fromPlace || !toPlace) {
             return response.status(400).json({ error: "Adresses de départ ou d'arrivée invalides." });
        }

        const nowInSeconds = Math.floor(Date.now() / 1000);

        const apiUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${fromPlace}&destination=${toPlace}&mode=transit&transit_mode=bus&departure_time=${nowInSeconds}&key=${apiKey}&language=fr`;

        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data.status !== 'OK') {
            console.error("Erreur API Google:", data.status, data.error_message);
            return response.status(500).json({ error: data.error_message || data.status, status: data.status });
        }

        response.status(200).json(data);

    } catch (error) {
        console.error("Erreur interne non gérée dans la fonction API:", error);
        response.status(500).json({ error: 'Erreur serveur interne. Vérifiez les logs Netlify.' });
    }
}
