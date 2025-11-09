/**
 * Fichier : /js/routingService.js
 *
 * MODIFIÉ: Gestion des erreurs 503 et non-JSON
 */
export class RoutingService {

    /**
     * Demande un itinéraire à notre fonction serverless Vercel
     */
    async getItinerary(options) {
        
        let url = `/api/calculer-itineraire?from=${encodeURIComponent(options.fromPlace)}&to=${encodeURIComponent(options.toPlace)}`;
        
        if (options.dateTime) {
            if (options.timeMode === 'DEPARTURE') {
                url += `&departure_time=${encodeURIComponent(options.dateTime)}`;
            } else if (options.timeMode === 'ARRIVAL') {
                url += `&arrival_time=${encodeURIComponent(options.dateTime)}`;
            }
        }
        
        const response = await fetch(url);

        if (!response.ok) {
            // GESTION D'ERREUR AMÉLIORÉE
            const errorText = await response.text();
            let errorMessage = `Erreur ${response.status}: ${response.statusText}`;

            if (response.status === 503) {
                errorMessage = "Le service d'itinéraire est momentanément indisponible (Erreur 503). Vérifiez le serveur API.";
            } else {
                try {
                    // Tente de parser, au cas où ce serait un JSON d'erreur
                    const err = JSON.parse(errorText);
                    errorMessage = err.error || errorMessage;
                } catch (e) {
                    // Ce n'était pas du JSON, l'erreur est peut-être le texte lui-même
                    if (errorText.length < 100) { // Évite d'afficher une page HTML
                        errorMessage = errorText;
                    }
                }
            }
            
            console.error("Erreur de l'API d'itinéraire:", errorText);
            throw new Error(errorMessage);
        }
        
        // Si tout va bien, on assume que c'est du JSON
        return await response.json();
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
