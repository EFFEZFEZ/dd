/**
 * Fichier : /api/calculer-itineraire.js
 *
 * VERSION SÉCURISÉE
 *
 * CORRECTION : La fonction formatPlace ajoute seulement ", Dordogne"
 * pour éviter les conflits entre les noms de villes (ex: Boulazac et Périgueux).
 */

// Fonction simple pour vérifier si c'est des coordonnées
function isCoordinates(input) {
    const parts = input.split(',');
    if (parts.length !== 2) return false;
    return !isNaN(parts[0]) && !isNaN(parts[1]);
}

// --- FONCTION CORRIGÉE ---
function formatPlace(input) {
    if (isCoordinates(input)) {
        return input; // C'est déjà des coordonnées, on ne touche pas
    }
    // On ajoute seulement ", Dordogne" pour le contexte, sans "Périgueux"
    return `${input}, Dordogne`;
}

export default async function handler(request, response) {
    let { from, to } = request.query;
    const apiKey = process.env.BACKEND_API_KEY;

    if (!apiKey) {
        return response.status(500).json({ error: "Clé API Backend non configurée sur le serveur Vercel." });
    }
    
    if (!from || !to) {
        return response.status(400).json({ error: "Coordonnées de départ et d'arrivée requises." });
    }

    const fromPlace = formatPlace(from);
    const toPlace = formatPlace(to);

    const nowInSeconds = Math.floor(Date.now() / 1000);

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${fromPlace}&destination=${toPlace}&mode=transit&transit_mode=bus&departure_time=${nowInSeconds}&key=${apiKey}&language=fr`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== 'OK') {
            console.error("Erreur API Google:", data.status, data.error_message);
            return response.status(500).json({ error: data.error_message || data.status, status: data.status });
        }

        response.status(200).json(data);
    } catch (error) {
        console.error("Erreur interne du proxy:", error);
        response.status(500).json({ error: 'Erreur serveur interne' });
    }
}
