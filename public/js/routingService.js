/**
 * routingService.js
 * * Service pour interroger le backend local (proxy) afin d'obtenir un itinéraire.
 *
 * VERSION CORRIGÉE :
 * 1. Corrige les erreurs de syntaxe (le '||' mal formaté).
 * 2. Utilise le bon endpoint '/api/calculer-itineraire'.
 * 3. Accepte un objet 'options' complet (de main.js) pour plus de clarté.
 * 4. Formate les coordonnées {lat, lon} en chaînes "lat,lon" que le backend attend.
 * 5. Envoie TOUTES les données (y compris l'heure) dans le corps JSON du POST,
 * ce qui correspond au backend corrigé.
 */

// Le bon endpoint qui correspond au nom du fichier backend
const API_PROXY_ENDPOINT = '/api/calculer-itineraire';

/**
 * Demande un itinéraire au backend.
 * * @param {object} options - L'objet d'options de main.js
 * @param {{lat: number, lon: number}} options.fromCoords - Coordonnées du point de départ.
 * @param {{lat: number, lon: number}} options.toCoords - Coordonnées du point d'arrivée.
 * @param {string} options.isoDateTime - Heure au format ISO (ex: "2025-11-09T22:10:00")
 * @param {'DEPARTURE' | 'ARRIVAL'} options.timeMode - Mode de calcul du temps.
 * @returns {Promise<object>} Une promesse qui se résout avec les données de l'itinéraire.
 */
async function getItinerary(options) {
  
  const { fromCoords, toCoords, isoDateTime, timeMode } = options;

  // 1. Formate les coordonnées en chaînes, comme le backend les attend
  const from = `${fromCoords.lat},${fromCoords.lon}`;
  const to = `${toCoords.lat},${toCoords.lon}`;

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
      method: 'POST', // Reste en POST
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody), // Envoie toutes les données
    });

    const responseData = await response.json();

    if (!response.ok) {
      // CORRECTION SYNTAXE : L'opérateur '||' est sur la même ligne.
      const errorPayload = responseData.error || `Erreur ${response.status}`;
      const status = responseData.status || 'UNKNOWN_ERROR';
      
      throw new Error(`Erreur de l'API d'itinéraire: ${errorPayload}`, { cause: { status } });
    }

    return responseData;

  } catch (error) {
    console.error(`Erreur dans RoutingService.getItinerary:`, error.message);
    throw error; // Propage l'erreur pour que main.js l'attrape
  }
}

// Exporte le service
export const RoutingService = {
  getItinerary,
};
