/**
 * Fichier : plannerPanel.js
 * Composant Web (Web Component) pour le panneau de planification d'itinéraire.
 */

class PlannerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }); // Utilisation d'un Shadow DOM

    // États internes
    this.fromPlace = null;
    this.toPlace = null;
    this.onItineraryRequest = null; // Callback pour main.js 
    this.mode = 'departure'; // 'departure' ou 'arrival'

    // Le HTML du composant, basé sur la capture d'écran et la structure de l'application
    this.shadowRoot.innerHTML = `
      <style>
        /* Styles encapsulés pour le panneau de planification */
        :host {
          display: block;
          width: 100%;
          background-color: var(--bg-panel, #f8fafc);
          border-top: 1px solid var(--border, #e2e8f0);
        }
       .planner-wrapper {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
       .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        /* Styles pour les onglets Partir / Arriver */
       .tabs {
          display: flex;
          border-bottom: 1px solid var(--border, #e2e8f0);
        }
       .tab-button {
          flex: 1;
          padding: 0.75rem 0.5rem;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-secondary, #64748b);
        }
       .tab-button.active {
          color: var(--text-primary, #0f172a);
          border-bottom-color: var(--accent-color, #3b82f6);
        }
        
       .time-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
       .time-inputs div {
          display: flex;
          flex-direction: column;
        }
       .time-inputs label {
          font-size: 0.75rem;
          color: var(--text-secondary, #64748b);
          margin-bottom: 0.25rem;
        }
       .time-inputs input[type="date"],
       .time-inputs input[type="time"] {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 6px;
          font-family: inherit;
          font-size: 0.875rem;
          box-sizing: border-box; /* Important */
        }
        
        #calculate-route-btn {
          background-color: var(--accent-color, #3b82f6);
          color: white;
          border: none;
          padding: 0.75rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        #calculate-route-btn:hover {
          background-color: var(--accent-color-dark, #2563eb);
        }

        /* Style pour les composants Google (qui seront stylisés par les correctifs CSS) */
        gmp-place-autocomplete {
          width: 100%;
          box-sizing: border-box;
        }
      </style>
      
      <div class="planner-wrapper">
        <div class="input-group">
          <gmp-place-autocomplete
            id="from-autocomplete"
            placeholder="Point de départ">
          </gmp-place-autocomplete>
          
          <gmp-place-autocomplete
            id="to-autocomplete"
            placeholder="Point d'arrivée">
          </gmp-place-autocomplete>
        </div>

        <div class="tabs">
          <button id="tab-departure" class="tab-button active">Partir</button>
          <button id="tab-arrival" class="tab-button">Arriver</button>
        </div>

        <div class="time-inputs">
          <div>
            <label for="date-picker">Date du trajet</label>
            <input type="date" id="date-picker" aria-label="Date du trajet">
          </div>
          <div>
            <label for="time-picker" id="time-picker-label">Heure</label>
            <input type="time" id="time-picker" aria-label="Heure du trajet">
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
    // MODIFIÉ : Étape 1 - Importer la bibliothèque Google Maps 'core' 
    const { LatLngBounds } = await google.maps.importLibrary("core");

    // MODIFIÉ : Étape 2 - Définir la zone de délimitation de la Dordogne 
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
    const tabDeparture = this.shadowRoot.querySelector('#tab-departure');
    const tabArrival = this.shadowRoot.querySelector('#tab-arrival');
    const timePickerLabel = this.shadowRoot.querySelector('#time-picker-label');

    // Initialiser la date et l'heure par défaut
    this.initializeDateTime(datePicker, timePicker);

    // MODIFIÉ : Étape 3 - Appliquer les restrictions géographiques [3, 5, 4]
    if (fromAutocomplete) {
      fromAutocomplete.locationRestriction = dordogneBounds;
      fromAutocomplete.strictBounds = true; // Ne montrer que les résultats dans la zone 
      fromAutocomplete.componentRestrictions = { country: 'fr' }; // Restreindre à la France 
    }
    if (toAutocomplete) {
      toAutocomplete.locationRestriction = dordogneBounds;
      toAutocomplete.strictBounds = true; // Ne montrer que les résultats dans la zone 
      toAutocomplete.componentRestrictions = { country: 'fr' }; // Restreindre à la France 
    }

    // Étape 4 : Ajouter les écouteurs d'événements 
    fromAutocomplete.addEventListener('gmp-placechange', async (event) => {
      const place = event.place;
      await place.fetchFields({ fields: ['geometry', 'formattedAddress'] });
      if (place.geometry) {
        this.fromPlace = `${place.geometry.location.lat()},${place.geometry.location.lng()}`;
      } else {
        this.fromPlace = null;
      }
    });

    toAutocomplete.addEventListener('gmp-placechange', async (event) => {
      const place = event.place;
      await place.fetchFields({ fields: ['geometry', 'formattedAddress'] });
      if (place.geometry) {
        this.toPlace = `${place.geometry.location.lat()},${place.geometry.location.lng()}`;
      } else {
        this.toPlace = null;
      }
    });

    // Écouteurs pour les onglets (basé sur la capture d'écran)
    tabDeparture.addEventListener('click', () => {
      this.mode = 'departure';
      tabDeparture.classList.add('active');
      tabArrival.classList.remove('active');
      timePickerLabel.textContent = 'Heure de départ';
    });
    
    tabArrival.addEventListener('click', () => {
      this.mode = 'arrival';
      tabArrival.classList.add('active');
      tabDeparture.classList.remove('active');
      timePickerLabel.textContent = 'Heure d\'arrivée';
    });

    // Écouteur pour le bouton de calcul
    calculateBtn.addEventListener('click', () => {
      if (!this.fromPlace ||!this.toPlace) {
        alert('Veuillez sélectionner un point de départ et d\'arrivée valides.');
        return;
      }
      
      if (!this.onItineraryRequest) {
        console.error('Callback onItineraryRequest non défini.');
        return;
      }

      // Formater l'heure
      const isoDateTime = this.getIsoDateTime(datePicker, timePicker);
      const options = {
        from: this.fromPlace,
        to: this.toPlace,
        departure_time: null,
        arrival_time: null
      };
      
      if (this.mode === 'departure') {
        options.departure_time = isoDateTime;
      } else {
        options.arrival_time = isoDateTime;
      }

      // Appelle le callback de main.js 
      this.onItineraryRequest(options);
    });
  }

  /**
   * Initialise les champs de date et d'heure à la date et l'heure actuelles.
   */
  initializeDateTime(dateEl, timeEl) {
    const now = new Date();
    // Ajoute quelques minutes pour un départ réaliste
    now.setMinutes(now.getMinutes() + 5); 

    // Formater la date en YYYY-MM-DD
    const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
                        .toISOString()
                        .split('T');
    dateEl.value = localDate;
    
    // Formater l'heure en HH:MM
    const localTime = now.toTimeString().split(' ').substring(0, 5);
    timeEl.value = localTime;
  }

  /**
   * Combine la date et l'heure en une chaîne ISO 8601 UTC.
   * @returns {string} Chaîne ISO (ex: "2025-11-10T01:01:00.000Z")
   */
  getIsoDateTime(dateEl, timeEl) {
    try {
      const date = dateEl.value;
      const time = timeEl.value;
      if (!date ||!time) {
        return new Date().toISOString(); // Fallback
      }
      // Crée une date en utilisant les valeurs locales et la convertit en ISO UTC
      const dateTimeString = `${date}T${time}:00`;
      const localDateTime = new Date(dateTimeString);
      return localDateTime.toISOString();
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
