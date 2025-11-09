/**
 * routingService.js
 * * Service pour interroger le backend et décoder les itinéraires.
 *
 * VERSION MISE À JOUR :
 * 1. Ajout de la fonction `decodePolyline` (requise par main.js)
 * 2. Conserve la logique `getItinerary` (POST) que nous avons corrigée.
 */

// Le bon endpoint qui correspond au nom du fichier backend
const API_PROXY_ENDPOINT = '/api/calculer-itineraire';

/**
 * Demande un itinéraire au backend.
 * @param {object} options - L'objet d'options de main.js
 * @returns {Promise<object>} Une promesse qui se résout avec les données de l'itinéraire.
 */
async function getItinerary(options) {
  
  const { fromCoords, toCoords, isoDateTime, timeMode } = options;

  // 1. Formate les coordonnées en chaînes, comme le backend les attend
  // (Note: main.js envoie des {lat, lon}, mais routingService les formate)
  const from = `${options.fromPlace.lat},${options.fromPlace.lon}`;
  const to = `${options.toPlace.lat},${options.toPlace.lon}`;

  // 2. Prépare le corps de la requête
  const requestBody = {
    from: from,
    to: to,
  };

  // 3. Ajoute les bonnes clés de temps que le backend lira
  if (timeMode === 'DEPARTURE') {
    requestBody.departure_time = isoDateTime;
  } else {
    requestBody.arrival_time = isoDateTime;
  }

  try {
    const response = await fetch(API_PROXY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorPayload = responseData.error || `Erreur ${response.status}`;
      const status = responseData.status || 'UNKNOWN_ERROR';
      throw new Error(`Erreur de l'API d'itinéraire: ${errorPayload}`, { cause: { status } });
    }

    return responseData;

  } catch (error) {
    console.error(`Erreur dans RoutingService.getItinerary:`, error.message);
    throw error;
  }
}

/**
 * NOUVELLE FONCTION (Requise par main.js)
 * Décode une polyligne encodée (Google) en un tableau de [lat, lng].
 * @param {string} encoded - La chaîne de polyligne.
 * @returns {Array<[number, number]>} Un tableau de [lat, lng].
 */
function decodePolyline(encoded) {
    let points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
        let b, shift = 0, result = 0;
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

        // Note: Google renvoie [lat, lng], ce que Leaflet attend.
        points.push([lat * 1e-5, lng * 1e-5]);
    }
    return points;
}

// Exporte le service (AVEC la nouvelle fonction)
export const RoutingService = {
  getItinerary,
  decodePolyline, // <-- Exporte la nouvelle fonction
};
