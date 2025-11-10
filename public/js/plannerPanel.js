/**
 * Fichier : plannerPanel.js
 * Composant Web (Web Component) pour le panneau de planification d'itinéraire.
 */

class PlannerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }); // Utilisation d'un Shadow DOM

    // États internes
    this.fromCoords = null;
    this.toCoords = null;
    this.onItineraryRequest = null; // Callback pour main.js

    // Le HTML du composant, basé sur la capture d'écran
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 1rem;
          background-color: #ffffff;
        }
       .planner-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
       .time-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
       .time-inputs label {
          font-size: 0.75rem;
          color: #64748b;
        }
       .time-inputs input {
          width: 100%;
          padding: 8px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-sizing: border-box; /* Assure que le padding ne casse pas la largeur */
        }
        #calculate-route-btn {
          background-color: #3b82f6; /* Bleu */
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
        }
        #calculate-route-btn:hover {
          background-color: #2563eb;
        }
        /* Style pour les composants Google (qui seront stylisés par les correctifs) */
        gmp-place-autocomplete {
          width: 100%;
          box-sizing: border-box;
        }
      </style>
      
      <div class="planner-container">
        <gmp-place-autocomplete
          id="from-autocomplete"
          placeholder="Point de départ">
        </gmp-place-autocomplete>
        
        <gmp-place-autocomplete
          id="to-autocomplete"
          placeholder="Point d'arrivée">
        </gmp-place-autocomplete>

        <div class="time-inputs">
          <div>
            <label for="date-picker">Date du trajet</label>
            <input type="date" id="date-picker">
          </div>
          <div>
            <label for="time-picker">Heure</label>
            <input type="time" id="time-picker">
          </div>
        </div>
        
        <button id="calculate-route-btn">Rechercher</button>
      </div>
    `;
  }

  /**
   * Fonction de cycle de vie appelée lorsque le composant est connecté au DOM.
   */
  async connectedCallback() {
    // Étape 1 : Importer la bibliothèque Google Maps 'core' 
    const { LatLngBounds } = await google.maps.importLibrary("core");

    // Étape 2 : Définir la zone de délimitation de la Dordogne [3]
    const dordogneBounds = new LatLngBounds(
      { lat: 44.53, lng: -0.13 }, // Sud-Ouest
      { lat: 45.75, lng: 1.50 }  // Nord-Est
    );

    // Sélection des éléments du Shadow DOM
    const fromAutocomplete = this.shadowRoot.querySelector('#from-autocomplete');
    const toAutocomplete = this.shadowRoot.querySelector('#to-autocomplete');
    const datePicker = this.shadowRoot.querySelector('#date-picker');
    const timePicker = this.shadowRoot.querySelector('#time-picker');
    const calculateBtn = this.shadowRoot.querySelector('#calculate-route-btn');

    // Initialiser la date et l'heure par défaut
    this.initializeDateTime(datePicker, timePicker);

    // Étape 3 : Appliquer les restrictions géographiques [2, 5, 4]
    if (fromAutocomplete) {
      fromAutocomplete.locationRestriction = dordogneBounds;
      fromAutocomplete.strictBounds = true;
      fromAutocomplete.componentRestrictions = { country: 'fr' };
    }
    if (toAutocomplete) {
      toAutocomplete.locationRestriction = dordogneBounds;
      toAutocomplete.strictBounds = true;
      toAutocomplete.componentRestrictions = { country: 'fr' };
    }

    // Étape 4 : Ajouter les écouteurs d'événements 
    fromAutocomplete.addEventListener('gmp-placechange', async (event) => {
      const place = event.place;
      await place.fetchFields({ fields: ['geometry', 'formattedAddress'] });
      if (place.geometry) {
        this.fromCoords = `${place.geometry.location.lat()},${place.geometry.location.lng()}`;
      } else {
        this.fromCoords = null;
      }
    });

    toAutocomplete.addEventListener('gmp-placechange', async (event) => {
      const place = event.place;
      await place.fetchFields({ fields: ['geometry', 'formattedAddress'] });
      if (place.geometry) {
        this.toCoords = `${place.geometry.location.lat()},${place.geometry.location.lng()}`;
      } else {
        this.toCoords = null;
      }
    });

    // Écouteur pour le bouton de calcul
    calculateBtn.addEventListener('click', () => {
      if (this.fromCoords && this.toCoords && this.onItineraryRequest) {
        
        // Formater l'heure de départ
        const departureDateTime = this.getDepartureTime(datePicker, timePicker);

        // Appelle le callback de main.js 
        this.onItineraryRequest({
          from: this.fromCoords,
          to: this.toCoords,
          departure_time: departureDateTime
        });
      } else {
        alert('Veuillez sélectionner un point de départ et d\'arrivée valides.');
      }
    });
  }

  /**
   * Initialise les champs de date et d'heure à la date et l'heure actuelles.
   */
  initializeDateTime(dateEl, timeEl) {
    const now = new Date();
    // Formater la date en YYYY-MM-DD
    dateEl.value = now.toISOString().split('T');
    // Formater l'heure en HH:MM
    timeEl.value = now.toTimeString().split(' ').substring(0, 5);
  }

  /**
   * Combine la date et l'heure en une chaîne ISO 8601.
   * @returns {string} Chaîne ISO (ex: "2025-11-10T01:01:00.000Z")
   */
  getDepartureTime(dateEl, timeEl) {
    try {
      const date = dateEl.value;
      const time = timeEl.value;
      if (!date ||!time) {
        return new Date().toISOString(); // Fallback
      }
      const dateTimeString = `${date}T${time}:00`;
      return new Date(dateTimeString).toISOString();
    } catch (e) {
      console.error("Erreur de formatage de date:", e);
      return new Date().toISOString(); // Fallback en cas d'erreur
    }
  }

  /**
   * Permet à main.js de définir un callback pour la demande d'itinéraire.
   * @param {function} callback 
   */
  setItineraryCallback(callback) {
    this.onItineraryRequest = callback;
  }
}

// Définir le composant personnalisé
window.customElements.define('planner-panel', PlannerPanel);
