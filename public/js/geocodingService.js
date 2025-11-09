/**
 * geocodingService.js
 * * Module de service pour le géocodage d'adresses textuelles en coordonnées (Latitude, Longitude).
 * Utilise l'API publique Nominatim d'OpenStreetMap.
 */

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

/**
 * Géocode une adresse textuelle en coordonnées {lat, lon}.
 * Lève une erreur si l'adresse n'est pas trouvée ou si l'API échoue.
 * * @param {string} addressString L'adresse textuelle à rechercher (par ex. "FLUNCH PERIGUEUX").
 * @returns {Promise<{lat: number, lon: number}>} Une promesse qui se résout avec un objet de coordonnées.
 */
async function geocodeAddress(addressString) {
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

    // Vérifie si l'API a renvoyé un résultat (CORRIGÉ)
    if (!results || results.length === 0) {
      throw new Error(`Adresse non trouvée pour: "${addressString}"`);
    }

    const firstResult = results[0];
    const coords = {
      lat: parseFloat(firstResult.lat),
      lon: parseFloat(firstResult.lon) // Nominatim utilise 'lon'
    };

    console.log(`Géocodage réussi pour "${addressString}":`, coords);
    return coords;

  } catch (error) {
    console.error(`Erreur lors du géocodage de "${addressString}":`, error);
    throw error;
  }
}

// Exporte la fonction pour qu'elle puisse être importée
export const GeocodingService = {
  geocodeAddress,
};
