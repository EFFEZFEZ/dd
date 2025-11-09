/**
 * routingService.js
 * * Service pour interroger le backend et décoder les itinéraires.
 *
 * VERSION CORRIGÉE (TRÈS IMPORTANT) :
 * 1. L'erreur "reading 'lat'" venait d'ici.
 * 2. 'getItinerary' reçoit 'options' de plannerPanel
 * (ex: { fromPlace: "...", toPlace: "...", dateTime: "..." }).
 * 3. Il adapte cet objet pour le backend (qui attend 'from', 'to', 'departure_time').
 * 4. Il NE TENTE PLUS de lire '.lat' ou '.lon' des options.
 */

// Le bon endpoint qui correspond au nom du fichier backend
const API_PROXY_ENDPOINT = '/api/calculer-itineraire';

/**
 * Demande un itinéraire au backend.
 * @param {object} options - L'objet d'options de plannerPanel.js
 * (contient fromPlace, toPlace, dateTime, timeMode)
 * @returns {Promise<object>} Une promesse qui se résout avec les données de l'itinéraire.
 */
async function getItinerary(options) {
  
  // 'options' vient de plannerPanel et ressemble à :
  // { fromPlace: "FLUNCH PERIGUEUX", toPlace: "Champcevinel", ... }
  // ou { fromPlace: "lat,lng", toPlace: "lat,lng", ... }

  // 1. Prépare le corps de la requête pour le backend
  const requestBody = {
    // Renomme 'fromPlace' en 'from' (ce que le backend attend)
    from: options.fromPlace,
    
    // Renomme 'toPlace' en 'to' (ce que le backend attend)
    to: options.toPlace,
  };

  // 2. Ajoute les bonnes clés de temps que le backend lira
  if (options.timeMode === 'DEPARTURE') {
    requestBody.departure_time = options.dateTime;
  } else {
    requestBody.arrival_time = options.dateTime;
  }

  try {
    const response = await fetch(API_PROXY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Envoie le corps adapté
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
 * Décode une polyligne encodée (Google) en un tableau de [lat, lng].
 * (Cette fonction est correcte et reste inchangée)
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

        points.push([lat * 1e-5, lng * 1e-5]);
    }
    return points;
}

// Exporte le service
export const RoutingService = {
  getItinerary,
  decodePolyline,
};
