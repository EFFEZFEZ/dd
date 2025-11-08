/**
 * Fichier : /api/calculer-itineraire.js
 *
 * C'est une Fonction Serverless Vercel. Elle seule s'exécute "côté serveur".
 * Elle récupère la clé API secrète depuis les variables d'environnement
 * de Vercel (process.env) et appelle Google en toute sécurité.
 */
export default async function handler(request, response) {
    // Récupère les ?from= et ?to= de l'URL de la requête
    const { from, to } = request.query;

    // !! SÉCURITÉ !!
    // Récupère la clé API stockée sur Vercel, pas dans le code.
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        return response.status(500).json({ error: "Clé API non configurée sur le serveur." });
    }
    
    if (!from || !to) {
        return response.status(400).json({ error: "Coordonnées de départ et d'arrivée requises." });
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${from}&destination=${to}&mode=transit&key=${apiKey}&language=fr`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== 'OK') {
            console.error("Erreur API Google:", data.status, data.error_message);
            return response.status(500).json({ error: data.error_message || data.status, status: data.status });
        }

        // Renvoie la réponse de Google au client
        response.status(200).json(data);
    } catch (error) {
        console.error("Erreur interne du proxy:", error);
        response.status(500).json({ error: 'Erreur serveur interne' });
    }
}