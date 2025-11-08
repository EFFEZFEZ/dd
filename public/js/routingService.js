/**
 * Fichier : /js/routingService.js
 *
 * S'exécute dans le navigateur.
 * Il appelle notre propre fonction serverless /api/calculer-itineraire
 * pour obtenir un itinéraire. Il n'a aucune connaissance de la clé API.
 */
export class RoutingService {

    /**
     * Demande un itinéraire à notre fonction serverless Vercel
     */
    async getItinerary(fromPlace, toPlace) {
        
        // Appelle NOTRE propre API, pas Google
        const url = `/api/calculer-itineraire?from=${encodeURIComponent(fromPlace)}&to=${encodeURIComponent(toPlace)}`;
        
        const response = await fetch(url);

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "La recherche d'itinéraire a échoué");
        }
        
        const data = await response.json();
        
        // Renvoie la réponse (format Google Directions)
        return data;
    }

    /**
     * Décode une "Encoded Polyline" (format Google)
     * en un tableau de [lat, lon]
     */
    decodePolyline(encoded) {
        let len = encoded.length;
        let index = 0;
        let lat = 0;
        let lng = 0;
        let array = [];

        while (index < len) {
            let b;
            let shift = 0;
            let result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lat += dlat;

            shift = 0;
            result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lng += dlng;

            array.push([lat * 1e-5, lng * 1e-5]);
        }
        return array;
    }
}
