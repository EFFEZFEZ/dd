/**
 * Fichier : /js/plannerPanel.js
 *
 * Gère le panneau latéral et affiche les résultats
 * de l'API Google Directions.
 *
 * NOUVEAU : Ajout de l'autocomplétion Google Places
 */
export class PlannerPanel {
    constructor(panelId, dataManager, mapRenderer, searchCallback) {
        this.panel = document.getElementById(panelId);
        this.dataManager = dataManager;
        this.mapRenderer = mapRenderer;
        this.searchCallback = searchCallback; // La fonction de main.js

        // Éléments...
        this.fromInput = document.getElementById('planner-from');
        this.toInput = document.getElementById('planner-to');
        this.searchButton = document.getElementById('btn-search-itinerary');
        this.locateButton = document.getElementById('btn-use-location');
        this.loadingSpinner = document.getElementById('planner-loading');
        this.summaryContainer = document.getElementById('itinerary-summary');
        this.stepsContainer = document.getElementById('itinerary-steps');

        this.bindEvents();
        
        // NOUVEAU: Initialiser l'autocomplétion
        this.initAutocomplete(); 
    }
    
    // =============================================
    // NOUVEAU: Fonction pour les suggestions
    // =============================================
    initAutocomplete() {
        // Coordonnées de Périgueux pour centrer la recherche
        const center = { lat: 45.1833, lng: 0.7167 };
        // Un rayon de 30km autour du centre
        const defaultBounds = {
            north: center.lat + 0.3,
            south: center.lat - 0.3,
            east: center.lng + 0.3,
            west: center.lng - 0.3,
        };
        
        const options = {
            bounds: defaultBounds,
            componentRestrictions: { country: "fr" }, // Limite à la France
            strictBounds: false, // Permet de chercher en dehors, mais favorise la zone
            fields: ["name", "formatted_address", "geometry"],
        };
        
        // Attache l'autocomplétion au champ "Départ"
        const fromAutocomplete = new google.maps.places.Autocomplete(this.fromInput, options);
        
        // Attache l'autocomplétion au champ "Arrivée"
        const toAutocomplete = new google.maps.places.Autocomplete(this.toInput, options);

        // Astuce : Quand on clique sur une suggestion, on veut garder
        // le nom simple (ex: "Mairie de Marsac") et pas l'adresse complète.
        fromAutocomplete.addListener('place_changed', () => {
            const place = fromAutocomplete.getPlace();
            if (place.geometry) {
                // Si l'utilisateur choisit une suggestion, on utilise
                // les coordonnées précises, c'est mieux.
                const loc = place.geometry.location;
                this.fromInput.value = `${loc.lat()},${loc.lng()}`;
            }
        });
        
        toAutocomplete.addListener('place_changed', () => {
             const place = toAutocomplete.getPlace();
             if (place.geometry) {
                const loc = place.geometry.location;
                this.toInput.value = `${loc.lat()},${loc.lng()}`;
            }
        });
    }

    bindEvents() {
        this.searchButton.addEventListener('click', () => {
            const from = this.fromInput.value;
            const to = this.toInput.value;
            if (from && to) {
                this.showLoading();
                this.searchCallback(from, to); // Appelle main.js
            }
        });

        this.locateButton.addEventListener('click', () => {
            this.mapRenderer.map.locate({ setView: true, maxZoom: 16 })
                .on('locationfound', (e) => {
                    const coords = `${e.latlng.lat.toFixed(5)},${e.latlng.lng.toFixed(5)}`;
                    this.fromInput.value = coords;
                })
                .on('locationerror', (e) => {
                    alert("Impossible de vous localiser.");
                });
        });
    }

    showLoading() {
        this.loadingSpinner.classList.remove('hidden');
        this.summaryContainer.innerHTML = '';
        this.stepsContainer.innerHTML = '';
    }

    hideLoading() {
        this.loadingSpinner.classList.add('hidden');
    }

    showError(message) {
        this.hideLoading();
        this.summaryContainer.innerHTML = `<p style="color: red; padding: 0 1.5rem;">${message}</p>`;
    }

    /**
     * Affiche l'itinéraire (réponse Google) dans le panneau
     */
    displayItinerary(itineraryData) {
        this.hideLoading();
        this.stepsContainer.innerHTML = '';

        if (!itineraryData.routes || itineraryData.routes.length === 0) {
            this.showError("Aucun itinéraire trouvé.");
            return;
        }

        const route = itineraryData.routes[0]; // On prend la première option
        const leg = route.legs[0]; // Le trajet A->B

        // 1. Résumé
        const duration = this.dataManager.formatDuration(leg.duration.value);
        
        const departureText = leg.departure_time?.text;
        const arrivalText = leg.arrival_time?.text;

        this.summaryContainer.innerHTML = `
            <h4>Le plus rapide : ${duration}</h4>
            ${ (departureText && arrivalText) ?
                `<p>${departureText} &ndash; ${arrivalText}</p>` :
                '' 
            }
        `;

        // 2. Étapes (Steps)
        leg.steps.forEach(step => {
            this.stepsContainer.appendChild(this.createLegStep(step));
        });
    }

    /** Crée une étape de trajet (Marche ou Bus) */
    createLegStep(step) {
        const el = document.createElement('div');
        el.className = 'itinerary-leg';
        el.dataset.mode = step.travel_mode;

        const legDuration = step.duration.text;
        const startTime = step.departure_time?.text || '';

        let icon, details;

        if (step.travel_mode === 'WALKING') {
            icon = 'directions_walk';
            details = `
                <strong>${step.html_instructions}</strong>
                <div class="leg-time-info">${legDuration} (${step.distance.text})</div>
            `;
        } else if (step.travel_mode === 'TRANSIT') {
            icon = 'directions_bus';
            const transit = step.transit_details;
            const line = transit.line;
            const routeColor = line.color || '#333';
            const textColor = this.getContrastColor(routeColor);

            details = `
                <div class="leg-time-info">${startTime} - Prendre à <strong>${transit.departure_stop.name}</strong></div>
                <div class="leg-route">
                    <span class="leg-badge" style="background-color: ${routeColor}; color: ${textColor};">
                        ${line.short_name || line.name}
                    </span>
                    <strong>Direction ${transit.headsign}</strong>
                </div>
                <div class="leg-time-info">
                    ${transit.num_stops} arrêt(s) (${legDuration})
                </div>
                <div class="leg-time-info" style="margin-top: 5px;">
                    Descendre à <strong>${transit.arrival_stop.name}</strong>
                </div>
            `;
        } else {
            icon = 'help';
            details = `<strong>${step.html_instructions}</strong>`;
        }

        el.innerHTML = `
            <div class="leg-icon">
                <span class="material-icons">${icon}</span>
                <div class="leg-line"></div>
            </div>
            <div class="leg-details">
                ${details}
            </div>
        `;
        return el;
    }

    /** Calcule si le texte doit être blanc ou noir sur une couleur de fond */
    getContrastColor(hexcolor) {
        if (!hexcolor) return '#000000';
        hexcolor = hexcolor.replace("#", "");
        if (hexcolor.length === 3) {
            hexcolor = hexcolor.split('').map(c => c + c).join('');
        }
        if (hexcolor.length !== 6) return '#000000';
        
        const r = parseInt(hexcolor.substr(0, 2), 16);
        const g = parseInt(hexcolor.substr(2, 2), 16);
        const b = parseInt(hexcolor.substr(4, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#FFFFFF';
    }
}
