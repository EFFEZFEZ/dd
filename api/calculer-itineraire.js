// Fichier : /api/calculer-itineraire.js
// Ce fichier est un handler d'API (par exemple, pour Vercel, Netlify, ou un serveur Node.js)

/**
 * Vérifie si une chaîne est une coordonnée "lat,lng".
 * @param {string} input
 * @returns {boolean}
 */
function isCoordinates(input) {
  if (typeof input!== 'string' ||!input.includes(',')) {
    return false;
  }
  const parts = input.split(',');
  return parts.length === 2 &&!isNaN(parseFloat(parts)) &&!isNaN(parseFloat(parts[1]));
}

/**
 * Crée un objet "Place" pour l'API Google Directions.
 * @param {string} input - Peut être une adresse textuelle ou une coordonnée "lat,lng".
 * @returns {object | null}
 */
function createPlace(input) {
  if (typeof input === 'string' && input.trim()!== '') {
    if (isCoordinates(input)) {
      const [lat, lng] = input.split(',').map(parseFloat);
      return {
        location: {
          latLng: {
            latitude: lat,
            longitude: lng
          }
        }
      };
    } else {
      // MODIFIÉ : Suppression de l'ajout de ", Dordogne".
      // L'API Google est maintenant appelée avec l'adresse textuelle brute
      // que le frontend (restreint) a fournie.
      return { address: input };
    }
  }
  return null;
}

/**
 * Handler principal de la requête API.
 */
export default async function handler(req, res) {
  // 1. Vérifier la clé API Backend
  const BACKEND_API_KEY = process.env.BACKEND_API_KEY;
  if (!BACKEND_API_KEY) {
    console.error('Clé API Backend non configurée.');
    return res.status(500).json({ error: 'Configuration serveur invalide.' });
  }

  // 2. Accepter uniquement les requêtes POST
  if (req.method!== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  try {
    // 3. Parser le corps de la requête
    const { from, to, departure_time, arrival_time } = req.body;

    if (!from ||!to) {
      return res.status(400).json({ error: 'Les champs "from" et "to" sont requis.' });
    }

    // 4. Transformer les entrées en objets Place
    const fromPlace = createPlace(from);
    const toPlace = createPlace(to);

    if (!fromPlace ||!toPlace) {
      return res.status(400).json({ error: 'Adresses de départ ou d\'arrivée invalides.' });
    }

    // 5. Construire le corps de la requête pour l'API Google
    const requestBody = {
      origin: fromPlace,
      destination: toPlace,
      travelMode: "TRANSIT",
      languageCode: "fr",
      computeAlternativeRoutes: true,
      transitPreferences: {
        allowedTravelModes:, // Restreindre aux bus
        routingPreference: "LESS_WALKING"
      }
    };

    // 6. Gérer les temps de départ/arrivée
    if (departure_time) {
      requestBody.departureTime = departure_time;
    } else if (arrival_time) {
      requestBody.arrivalTime = arrival_time;
    } else {
      requestBody.departureTime = new Date().toISOString(); // Par défaut
    }

    // 7. Définir le FieldMask (champs de réponse souhaités)
    const fieldMask = 'routes.legs.steps.transitDetails,routes.legs.steps.distanceMeters,routes.legs.steps.staticMapHandle,routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.localizedValues,routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.travelMode';

    // 8. Appeler l'API Google Directions
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": BACKEND_API_KEY,
        "X-Goog-FieldMask": fieldMask
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    // 9. Gérer les erreurs de Google
    if (!response.ok |

| (data.error)) {
      console.error('Erreur de l\'API Google:', data.error);
      return res.status(data.error?.code |

| 500).json({ error: data.error?.message |
| 'Erreur lors du calcul de l\'itinéraire.' });
    }

    // 10. Gérer l'absence de résultats
    if (!data.routes |

| data.routes.length === 0) {
      return res.status(404).json({ error: 'Aucun itinéraire trouvé.', status: 'ZERO_RESULTS' });
    }

    // 11. Renvoyer la réponse
    return res.status(200).json(data);

  } catch (error) {
    console.error('Erreur interne du serveur:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
}
