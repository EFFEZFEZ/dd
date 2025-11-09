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

        this.locateButton.addEventListener('click', () => {
            this.mapRenderer.map.locate({ setView: true, maxZoom: 16 })
                .on('locationfound', (e) => {
                    this.fromInput.value = "Ma position"; 
                    this.fromCoords = `${e.latlng.lat.toFixed(5)},${e.latlng.lng.toFixed(5)}`; 
                })
                .on('locationerror', (e) => alert("Impossible de vous localiser."));
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
        this.summaryContainer.innerHTML = `<p style="color: #dc2626; padding: 0 1.5rem;">${message}</p>`;
    }

    /**
     * NOUVEAU: Regroupe les étapes de marche
     */
    groupSteps(steps) {
        const groupedSteps = [];
        let currentWalkStep = null;

        for (const step of steps) {
            if (!step) continue; // Sécurité

            if (step.travelMode === 'WALK') {
                if (!currentWalkStep) {
                    currentWalkStep = {
                        ...step,
                        navigationInstruction: step.navigationInstruction || { instructions: "Marcher" },
                        distanceMeters: 0,
                        staticDuration: "0s"
                    };
                }
                currentWalkStep.distanceMeters += step.distanceMeters || 0;
                currentWalkStep.staticDuration = (
                    parseInt(currentWalkStep.staticDuration.slice(0, -1)) + 
                    parseInt(step.staticDuration.slice(0, -1) || 0)
                ) + "s";
            } else {
                if (currentWalkStep) {
                    groupedSteps.push(currentWalkStep);
                    currentWalkStep = null;
                }
                groupedSteps.push(step);
            }
        }

        if (currentWalkStep) {
            groupedSteps.push(currentWalkStep);
        }
        return groupedSteps;
    }

    /**
     * Affiche les itinéraires (format "Routes API") sous forme d'onglets
     */
    displayItinerary(itineraryData) {
        this.hideLoading();
        this.summaryContainer.innerHTML = '';
        this.stepsContainer.innerHTML = '';
        this.currentRoutes = [];

        if (!itineraryData.routes || itineraryData.routes.length === 0) {
            this.showError("Aucun itinéraire trouvé.");
            return;
        }

        // --- CORRECTION: Limite à 3 trajets ---
        this.currentRoutes = itineraryData.routes.slice(0, 3);

        // Crée un onglet résumé pour chaque route
        this.currentRoutes.forEach((route, index) => {
            const leg = route.legs[0];
            const duration = this.dataManager.formatDuration(parseInt(route.duration.slice(0, -1)));
            const departureTime = leg.departureTime ? new Date(leg.departureTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
            const arrivalTime = leg.arrivalTime ? new Date(leg.arrivalTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

            let modesHtml = '';
            // ** Utilise les étapes regroupées pour les icônes **
            const groupedSteps = this.groupSteps(leg.steps);
            groupedSteps.forEach(step => {
                const icon = step.travelMode === 'WALK' ? 'directions_walk' : 'directions_bus';
                modesHtml += `<span class="material-icons">${icon}</span>`;
            });

            // Crée l'onglet résumé
            const summaryTab = document.createElement('div');
            summaryTab.className = 'itinerary-summary-tab';
            summaryTab.dataset.index = index;
            summaryTab.innerHTML = `
                <h4>
                    <span>${duration}</span>
                    <span>${departureTime} &ndash; ${arrivalTime}</span>
                </h4>
                <div class="leg-modes">${modesHtml}</div>
            `;
            
            summaryTab.addEventListener('click', () => this.activateRouteTab(index));
            this.summaryContainer.appendChild(summaryTab);

            // Crée le conteneur d'étapes
            const stepsContent = document.createElement('div');
            stepsContent.className = 'itinerary-steps-content';
            stepsContent.id = `steps-content-${index}`;
            
            // ** Crée les éléments d'étape à partir des étapes regroupées **
            groupedSteps.forEach(step => {
                const stepElement = this.createLegStep(step);
                if (stepElement) { 
                    stepsContent.appendChild(stepElement);
                }
            });
            this.stepsContainer.appendChild(stepsContent);
        });

        // Active le premier onglet par défaut
        this.activateRouteTab(0);
    }

    /**
     * Active un onglet d'itinéraire spécifique
     */
    activateRouteTab(index) {
        this.summaryContainer.querySelectorAll('.itinerary-summary-tab').forEach((tab, i) => {
            tab.classList.toggle('active', i === index);
        });
        
        this.stepsContainer.querySelectorAll('.itinerary-steps-content').forEach((content, i) => {
            content.classList.toggle('active', i === index);
        });
    }

    /** Crée une étape de trajet (format "Routes API") avec tous les détails */
    createLegStep(step) {
        const instruction = (step.navigationInstruction ? step.navigationInstruction.instructions : null) || 
                            (step.travelMode === 'WALK' ? 'Marcher' : 'Continuer');

        // ** Ne pas afficher les étapes "undefined" ou vides **
        if (!instruction || instruction === 'undefined') {
            return null;
        }
        
        const el = document.createElement('div');
        el.className = 'itinerary-leg';
        el.dataset.mode = step.travelMode;

        const legDuration = this.dataManager.formatDuration(parseInt(step.staticDuration.slice(0, -1) || 0));
        
        const startTime = step.departureTime ? new Date(step.departureTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
        const endTime = step.arrivalTime ? new Date(step.arrivalTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;

        let icon, details, iconStyle = '';

        if (step.travelMode === 'WALK') {
            icon = 'directions_walk';
            iconStyle = `style="background-color: #f0f0f0;"`;
            const distanceKm = (step.distanceMeters / 1000).toFixed(1);
            
            details = `
                <strong>${instruction}</strong>
                <div class="leg-time-info">${legDuration} (${distanceKm} km)</div>
            `;
        } 
        else if (step.travelMode === 'TRANSIT') {
            icon = 'directions_bus';
            const transit = step.transitDetails;
            
            // Cas 1: L'API a renvoyé les détails (le cas idéal, grâce au FieldMask)
            if (transit && transit.line) {
                const line = transit.line;
                const routeColor = line.color || '#3388ff';
                const textColor = line.textColor || this.getContrastColor(routeColor);
                
                iconStyle = `style="background-color: ${routeColor}; color: ${textColor};"`;

                details = `
                    <div class="leg-route">
                        <span class="leg-badge" style="background-color: ${routeColor}; color: ${textColor};">
                            ${line.shortName || line.name}
                        </span>
                        <strong>Direction ${transit.headsign}</strong>
                    </div>
                    <div class="leg-time-info">
                        Prendre à <strong>${transit.stopDetails.departureStop.name}</strong>
                        ${startTime ? `<span class="time-detail">(Départ: ${startTime})</span>` : ''}
                    </div>
                    <div class="leg-time-info" style="margin-top: 5px;">
                        Descendre à <strong>${transit.stopDetails.arrivalStop.name}</strong>
                        ${endTime ? `<span class="time-detail">(Arrivée: ${endTime})</span>` : ''}
                    </div>
                    <div class="leg-time-info" style="margin-top: 5px;">
                        ${transit.stopCount} arrêt(s) (${legDuration})
                    </div>
                `;
            } 
            // Cas 2: L'API n'a PAS renvoyé les détails (votre cas actuel)
            else {
                iconStyle = `style="background-color: #6c757d;"`; // Gris
                details = `
                    <strong>${instruction}</strong>
                    <div class="leg-time-info">
                        ${startTime ? `Départ: ${startTime}` : ''}
                        ${endTime ? ` - Arrivée: ${endTime}` : ''}
                    </div>
                    <div class="leg-time-info">${legDuration}</div>
                `;
            }
        } 
        else {
            icon = 'help';
            iconStyle = `style="background-color: #6c757d;"`;
            details = `<strong>${instruction}</strong>`;
        }

        el.innerHTML = `
            <div class="leg-icon">
                <span class="material-icons" ${iconStyle}>${icon}</span>
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
