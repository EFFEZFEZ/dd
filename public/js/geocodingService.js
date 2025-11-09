/**
 * geocodingService.js
 * 
 * Module de service pour le géocodage d'adresses textuelles en coordonnées (Latitude, Longitude).
 * Utilise l'API publique Nominatim d'OpenStreetMap pour éviter la nécessité de clés API.
 * @see https://nominatim.org/release-docs/latest/api/Search/
 */

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

/**
 * Géocode une adresse textuelle en coordonnées {lat, lon}.
 * Lève une erreur si l'adresse n'est pas trouvée ou si l'API échoue.
 * 
 * @param {string} addressString L'adresse textuelle à rechercher (par ex. "FLUNCH PERIGUEUX").
 * @returns {Promise<{lat: number, lon: number}>} Une promesse qui se résout avec un objet de coordonnées.
 */
async function geocodeAddress(addressString) {
  // Construit l'URL pour l'API Nominatim
  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.append('q', addressString);
  url.searchParams.append('format', 'json');
  url.searchParams.append('limit', '1');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Échec de l'API Nominatim: ${response.status} ${response.statusText}`);
    }

    const results = await response.json();

    // Vérifie si l'API a renvoyé un résultat
    if (!results |

| results.length === 0) {
      // Lève une erreur spécifique que main.js pourra attraper
      throw new Error(`Adresse non trouvée pour: "${addressString}"`);
    }

    const firstResult = results;
    const coords = {
      lat: parseFloat(firstResult.lat),
      lon: parseFloat(firstResult.lon) // Nominatim utilise 'lon'
    };

    console.log(`Géocodage réussi pour "${addressString}":`, coords);
    return coords;

  } catch (error) {
    console.error(`Erreur lors du géocodage de "${addressString}":`, error);
    // Propage l'erreur pour que le `catch` de main.js puisse l'intercepter
    throw error;
  }
}

// Exporte la fonction pour qu'elle puisse être importée dans main.js
export const GeocodingService = {
  geocodeAddress,
};
