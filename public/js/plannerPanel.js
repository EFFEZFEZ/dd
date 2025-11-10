// Fichier : plannerPanel.js
// (Ceci est une reconstruction basée sur l'analyse du fichier )

class PlannerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }); // Supposant l'utilisation d'un Shadow DOM

    // États internes
    this.fromCoords = null;
    this.toCoords = null;
    this.onItineraryRequest = null; // Callback pour main.js

    // Le HTML du composant (simplifié)
    this.shadowRoot.innerHTML = `
      <style>
        /* Styles spécifiques au composant */
       .planner-inputs {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
      </style>
      <div class="planner-inputs">
        <gmp-place-autocomplete
          id="from-autocomplete"
          placeholder="Point de départ">
        </gmp-place-autocomplete>
        
        <gmp-place-autocomplete
          id="to-autocomplete"
          placeholder="Point d'arrivée">
        </gmp-place-autocomplete>
      </div>
      <button id="calculate-route-btn">Rechercher</button>
    `;
  }

  // AJOUT : La fonction est maintenant 'async' pour permettre 'await'
  async connectedCallback() {
    // AJOUTÉ : Étape 1 - Importer la bibliothèque Google Maps 'core' 
    const { LatLngBounds } = await google.maps.importLibrary("core");

    // AJOUTÉ : Étape 2 - Définir la zone de délimitation de la Dordogne
    // Coordonnées basées sur les données géographiques 
    const dordogneBounds = new LatLngBounds(
      { lat: 44.53, lng: -0.13 }, // Sud-Ouest
      { lat: 45.75, lng: 1.50 }  // Nord-Est
    );

    // Sélection des composants d'autocomplétion
    const fromAutocomplete = this.shadowRoot.querySelector('#from-autocomplete');
    const toAutocomplete = this.shadowRoot.querySelector('#to-autocomplete');

    // AJOUTÉ : Étape 3 - Appliquer les restrictions géographiques
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

    // Logique existante (inférée de )
    fromAutocomplete.addEventListener('gmp-placechange', async (event) => {
      const place = event.place;
      await place.fetchFields({ fields: ['geometry', 'formattedAddress'] });
      if (place.geometry) {
        this.fromCoords = `${place.geometry.location.lat()},${place.geometry.location.lng()}`;
        console.log('Départ défini:', this.fromCoords, place.formattedAddress);
      }
    });

    toAutocomplete.addEventListener('gmp-placechange', async (event) => {
      const place = event.place;
      await place.fetchFields({ fields: ['geometry', 'formattedAddress'] });
      if (place.geometry) {
        this.toCoords = `${place.geometry.location.lat()},${place.geometry.location.lng()}`;
        console.log('Arrivée définie:', this.toCoords, place.formattedAddress);
      }
    });

    // Écouteur pour le bouton de calcul
    this.shadowRoot.querySelector('#calculate-route-btn').addEventListener('click', () => {
      if (this.fromCoords && this.toCoords && this.onItineraryRequest) {
        // Appelle le callback de main.js
        this.onItineraryRequest({
          fromPlace: this.fromCoords,
          toPlace: this.toCoords,
          //... autres options comme l'heure
        });
      } else {
        alert('Veuillez sélectionner un point de départ et d\'arrivée.');
      }
    });
  }

  // Fonction pour lier le callback externe
  setItineraryCallback(callback) {
    this.onItineraryRequest = callback;
  }
}

// Définir le composant personnalisé
window.customElements.define('planner-panel', PlannerPanel);
