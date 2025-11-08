/**
 * Fichier : /api/calculer-itineraire.js
 *
 * ATTENTION : VERSION NON SÉCURISÉE
 * La clé API est écrite en dur dans ce fichier.
 * Elle sera visible publiquement sur GitHub.
 */
export default async function handler(request, response) {
    // Récupère les ?from= et ?to= de l'URL de la requête
    const { from, to } = request.query;

    // !! NON SÉCURISÉ !!
    // Collez votre clé API ici, entre les guillemets
    const apiKey = "AIzaSyBYDN_8hSHSx_irp_fxLw--XyxuLiixaW4";

    if (apiKey === "AIzaSyBYDN_8hSHSx_irp_fxLw--XyxuLiixaW4") {
        return response.status(500).json({ error: "La clé API n'est pas configurée dans le fichier /api/calculer-itineraire.js" });
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
