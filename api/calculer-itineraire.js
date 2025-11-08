/**
 * Fichier : /api/calculer-itineraire.js
 *
 * VERSION SÉCURISÉE
 * Lit la clé API depuis les variables d'environnement Vercel.
 *
 * CORRECTION : Ajoute "transit_mode=bus" pour forcer
 * l'API à utiliser les bus locaux au lieu des trains (TER).
 */

// Fonction simple pour vérifier si c'est des coordonnées
function isCoordinates(input) {
    const parts = input.split(',');
    if (parts.length !== 2) return false;
    return !isNaN(parts[0]) && !isNaN(parts[1]);
}

// Fonction pour formater l'adresse
function formatPlace(input) {
    if (isCoordinates(input)) {
        return input; // C'est déjà des coordonnées, on ne touche pas
    }
    // Si c'est du texte, on ajoute le contexte
    return `${input}, Périgueux, Dordogne`;
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

    // --- CORRECTION DE LOGIQUE (TER vs BUS) ---
    // On ajoute "&transit_mode=bus" pour ignorer les trains
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${fromPlace}&destination=${toPlace}&mode=transit&transit_mode=bus&key=${apiKey}&language=fr`;

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
