/**
 * routingService.js
 * 
 * Service pour interroger le backend local (proxy) afin d'obtenir un itinéraire.
 * Remarque : Ce fichier est basé sur les erreurs vues dans la console (ex: routingService.js:45).
 */

// L'URL du point de terminaison du backend (proxy) qui appelle l'API de routage externe.
// L'ID "10T07M3A39X3400Z:1" de l'erreur originale est supposé être dynamique.
// Nous utilisons un chemin plus générique.
const API_PROXY_ENDPOINT = '/api/calculer-itiner'; 

/**
 * MODIFICATION CLÉ :
 * La fonction accepte maintenant des objets de coordonnées, et non des chaînes.
 * 
 * @param {{lat: number, lon: number}} originCoords - Coordonnées du point de départ.
 * @param {{lat: number, lon: number}} destinationCoords - Coordonnées du point d'arrivée.
 * @returns {Promise<object>} Une promesse qui se résout avec les données de l'itinéraire.
 */
async function getItinerary(originCoords, destinationCoords) {
  
  // MODIFICATION CLÉ : Le corps de la requête envoie les objets de coordonnées.
  // Le backend (proxy) doit être mis à jour pour gérer ce format
  // et le transmettre à l'API de routage externe (par ex. Google, Mapbox, OSRM).
  const requestBody = {
    origin: originCoords,
    destination: destinationCoords,
    // (Ajoutez ici d'autres paramètres si nécessaire, par ex. 'mode', 'travelTime', etc.)
  };

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
      // Si le serveur renvoie une erreur (4xx, 5xx), extrayez le message
      // C'est ce qui se passait avant (à la ligne 45)
      const errorPayload = responseData.error |

| `Erreur ${response.status}`;
      const status = responseData.status |

| 'UNKNOWN_ERROR';
      
      // Lève une erreur pour que le `catch` de main.js l'intercepte
      throw new Error(`Erreur de l'API d'itinéraire: ${errorPayload}`, { cause: { status } });
    }

    // L'itinéraire a été calculé avec succès
    return responseData;

  } catch (error) {
    // Logue l'erreur au niveau du service
    console.error(`Erreur dans RoutingService.getItinerary (routingService.js:46):`, error.message);
    // Propage l'erreur pour que main.js puisse l'afficher à l'utilisateur
    throw error;
  }
}

// Exporte le service
export const RoutingService = {
  getItinerary,
};
