/**
 * Fichier : /js/plannerPanel.js
 *
 * CETTE VERSION CORRIGE :
 * 1. LIMITE l'affichage à 3 trajets maximum (avec .slice(0, 3)).
 * 2. REGROUPE les étapes de marche (corrige "trop dans la marche").
 * 3. FILTRE les étapes "undefined" ou vides.
 * 4. AFFICHE la couleur et les détails du bus (si le backend les envoie).
 */
export class PlannerPanel {
    constructor(panelId, dataManager, mapRenderer, searchCallback) {
        this.panel = document.getElementById(panelId);
        this.dataManager = dataManager;
        this.mapRenderer = mapRenderer;
        this.searchCallback = searchCallback; 

        this.fromInput = document.getElementById('planner-from');
        this.toInput = document.getElementById('planner-to');
        this.searchButton = document.getElementById('btn-search-itinerary');
        this.locateButton = document.getElementById('btn-use-location');
        this.loadingSpinner = document.getElementById('planner-loading');

        this.summaryContainer = document.getElementById('itinerary-summary-container');
        this.stepsContainer = document.getElementById('itinerary-steps-container');

        this.departureTab = document.getElementById('planner-mode-departure');
        this.arrivalTab = document.getElementById('planner-mode-arrival');
        this.dateInput = document.getElementById('planner-date');
        this.timeInput = document.getElementById('planner-time');
        this.timeMode = 'DEPARTURE'; 

        this.fromCoords = null;
        this.toCoords = null;
        this.currentRoutes = []; 

        this.setDefaultDateTime();
        this.bindEvents();
        
        window.initMap = () => {
            console.log("Google Maps JS est prêt, initialisation de l'autocomplete.");
            this.initAutocomplete(); 
        };
        if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
            this.initAutocomplete();
        }
    }
    
    setDefaultDateTime() {
        const now = new Date();
        const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
        this.dateInput.value = localNow.toISOString().split('T')[0];
        this.timeInput.value = localNow.toTimeString().split(' ')[0].substring(0, 5);
    }
    
    async initAutocomplete() {
        if (typeof google === 'undefined' || !google.maps.places) return;
        const { Autocomplete } = await google.maps.importLibrary("places");
        const center = { lat: 45.1833, lng: 0.7167 };
        const defaultBounds = {
            north: center.lat + 0.3, south: center.lat - 0.3,
            east: center.lng + 0.3, west: center.lng - 0.3,
        };
        const options = {
            bounds: defaultBounds, componentRestrictions: { country: "fr" },
            strictBounds: true, fields: ["name", "formatted_address", "geometry"],
        };
        
        const fromAutocomplete = new Autocomplete(this.fromInput, options);
        const toAutocomplete = new Autocomplete(this.toInput, options);

        fromAutocomplete.addListener('place_changed', () => {
            const place = fromAutocomplete.getPlace();
            if (place.geometry) {
                this.fromCoords = `${place.geometry.location.lat()},${place.geometry.location.lng()}`;
                this.fromInput.value = place.name;
            }
        });
        
        toAutocomplete.addListener('place_changed', () => {
             const place = toAutocomplete.getPlace();
             if (place.geometry) {
                this.toCoords = `${place.geometry.location.lat()},${place.geometry.location.lng()}`;
                this.toInput.value = place.name;
            }
        });

        this.fromInput.addEventListener('input', () => { this.fromCoords = null; });
        this.toInput.addEventListener('input', () => { this.toCoords = null; });
    }

    bindEvents() {
        this.departureTab.addEventListener('click', () => {
            this.timeMode = 'DEPARTURE';
            this.departureTab.classList.add('active');
            this.arrivalTab.classList.remove('active');
        });
        
        this.arrivalTab.addEventListener('click', () => {
            this.timeMode = 'ARRIVAL';
            this.arrivalTab.classList.add('active');
            this.departureTab.classList.remove('active');
        });

        this.searchButton.addEventListener('click', () => {
            const from = this.fromCoords || this.fromInput.value;
            const to = this.toCoords || this.toInput.value;
            const timeMode = this.timeMode;
            const date = this.dateInput.value;
            const time = this.timeInput.value;

            if (!from || !to || !date || !time) {
                alert("Veuillez remplir le départ, l'arrivée, la date et l'heure.");
                return;
            }
            
            const isoDateTime = `${date}T${time}:00Z`;
            const options = {
                fromPlace: from, toPlace: to,
                timeMode: timeMode, dateTime: isoDateTime
            };
            
            this.showLoading();
            this.searchCallback(options); 
            
            this.fromCoords = null;
            this.toCoords = null;
        });

        this.locateButton.addEventListener('click
