/**
 * Fichier : /js/plannerPanel.js
 * VERSION OPTIMISÉE POUR WEB COMPONENTS (gmp-place-autocomplete)
 */

export class PlannerPanel {
    constructor(panelId, dataManager, mapRenderer, searchCallback) {
        this.panel = document.getElementById(panelId);
        this.dataManager = dataManager;
        this.mapRenderer = mapRenderer;
        this.searchCallback = searchCallback;

        // Récupération des Web Components
        this.fromAutocompleteElement = document.getElementById('planner-from-autocomplete');
        this.toAutocompleteElement = document.getElementById('planner-to-autocomplete');

        // Récupération des inputs natifs pour lecture/écriture de la valeur
        this.fromInput = document.getElementById('planner-from');
        this.toInput = document.getElementById('planner-to');

        this.searchButton = document.getElementById('btn-search-itinerary');
        this.locateButton = document.getElementById('btn-use-location');
        this.loadingSpinner = document.getElementById('planner-loading');

        this.summaryContainer = document.getElementById('itinerary-summary-container');
        this.stepsContainer = document.getElementById('itinerary-steps-container');
        
        // Nouveaux éléments pour l'heure/date (à ajouter dans l'HTML)
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
        this.waitForGoogleMaps();
    }
    
    // --- Initialisation des APIs ---
    
    waitForGoogleMaps() {
        const init = async () => {
            console.log("✅ Google Maps chargé, initialisation de l'autocomplétion");
            try {
                await customElements.whenDefined('gmp-place-autocomplete'); // Attente du Web Component
                this.setupPlaceChangeListeners(); // Capture des coordonnées
            } catch (error) {
                console.error("❌ Erreur lors du chargement des bibliothèques Google Maps", error);
                this.showError("Impossible de charger le service d'adresses.");
            }
        };

        if (window.googleMapsReady) {
            init();
        } else {
            window.addEventListener('google-maps-ready', init, { once: true });
        }
    }
    
    setDefaultDateTime() {
        const now = new Date();
        const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
        this.dateInput.value = localNow.toISOString().split('T')[0];
        this.timeInput.value = localNow.toTimeString().split(' ')[0].substring(0, 5);
    }
    
    /**
     * NOUVEAU : Capture l'événement de sélection du Web Component et stocke les coordonnées.
     */
    setupPlaceChangeListeners() {
        
        const updateCoords = (event, isFrom) => {
            const place = event.detail.place;
            
            if (place && place.geometry && place.geometry.location) {
                const location = place.geometry.location;
                const coords = `${location.lat()},${location.lng()}`;
                
                if (isFrom) {
                    this.fromCoords = coords;
                    console.log("✅ Coords DÉPART via Placechange:", coords);
                } else {
                    this.toCoords = coords;
                    console.log("✅ Coords ARRIVÉE via Placechange:", coords);
                }
                this.showError(null);
                
            } else {
                console.warn("❌ Place sélectionnée invalide ou sans géométrie.");
                if (isFrom) {
                    this.fromCoords = null;
                } else {
                    this.toCoords = null;
                }
            }
        };

        // Événement DÉPART: La source fiable de coordonnées pour la sélection
        this.fromAutocompleteElement.addEventListener('gmp-places-autocomplete:placechange', (e) => updateCoords(e, true));

        // Événement ARRIVÉE: La source fiable de coordonnées pour la sélection
        this.toAutocompleteElement.addEventListener('gmp-places-autocomplete:placechange', (e) => updateCoords(e, false));
        
        // Reset des coordonnées si l'utilisateur vide les champs manuellement
        if (this.fromInput) {
            this.fromInput.addEventListener('input', (e) => {
                if (e.target.value === '') {
                    this.fromCoords = null;
                }
            });
        }
        
        if (this.toInput) {
            this.toInput.addEventListener('input', (e) => {
                if (e.target.value === '') {
                    this.toCoords = null;
                }
            });
        }
    }
    // --- Fin de la gestion des APIs ---
    
    bindEvents() {
        // Logique des tabs Départ/Arrivée
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
            const from = this.fromCoords; // Utilise uniquement les coordonnées capturées
            const to = this.toCoords;
            const timeMode = this.timeMode;
            const date = this.dateInput.value;
            const time = this.timeInput.value;

            if (!from || !to) {
                console.error("❌ Coordonnées manquantes!");
                this.showError("Veuillez **sélectionner** une adresse dans la liste de suggestions.");
                return;
            }
            if (!date || !time) {
                this.showError("Veuillez remplir la date et l'heure.");
                return;
            }
            
            const isoDateTime = `${date}T${time}:00Z`;
            const options = {
                fromPlace: from,
                toPlace: to,
                timeMode: timeMode, 
                dateTime: isoDateTime
            };
            
            this.showLoading("Calcul de l'itinéraire...");
            this.searchCallback(options); 
        });

        this.locateButton.addEventListener('click', () => {
            this.mapRenderer.map.locate({ setView: true, maxZoom: 16 })
                .on('locationfound', (e) => {
                    if (this.fromInput) {
                        this.fromInput.value = "Ma position actuelle";
                    }
                    this.fromCoords = `${e.latlng.lat.toFixed(5)},${e.latlng.lng.toFixed(5)}`;
                })
                .on('locationerror', () => {
                    alert("Impossible de vous localiser. Vérifiez les permissions de votre navigateur.");
                });
        });
    }
    
    // --- Logique d'affichage (Inchangée) ---

    showLoading(message = "Recherche en cours...") {
        this.loadingSpinner.querySelector('p').textContent = message;
        this.loadingSpinner.classList.remove('hidden');
        this.summaryContainer.innerHTML = '';
        this.stepsContainer.innerHTML = '';
    }

    hideLoading() {
        this.loadingSpinner.classList.add('hidden');
    }

    showError(message) {
        this.hideLoading();
        this.summaryContainer.innerHTML = message ? `<p style="color: #dc2626; padding: 0 1.5rem;">${message}</p>` : '';
        this.stepsContainer.innerHTML = '';
    }

    groupSteps(steps) {
        const groupedSteps = [];
        let currentWalkStep = null;

        for (const step of steps) {
            if (!step) continue; 

            if (step.travelMode === 'WALK') {
                if (!currentWalkStep) {
                    currentWalkStep = {
                        ...step,
                        navigationInstruction: step.navigationInstruction || { instructions: "Marcher" }, 
                        distanceMeters: 0,
                        staticDuration: "0s"
                    };
                }
                const currentDurationSeconds = parseInt(currentWalkStep.staticDuration.slice(0, -1)) || 0;
                const stepDurationSeconds = parseInt(step.staticDuration.slice(0, -1) || 0);

                currentWalkStep.distanceMeters += step.distanceMeters || 0; 
                currentWalkStep.staticDuration = (currentDurationSeconds + stepDurationSeconds) + "s";
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

    displayItinerary(itineraryData) {
        this.hideLoading();
        this.summaryContainer.innerHTML = '';
        this.stepsContainer.innerHTML = '';
        this.currentRoutes = [];

        if (!itineraryData.routes || itineraryData.routes.length === 0) { 
            this.showError("Aucun itinéraire trouvé.");
            return;
        }

        this.currentRoutes = itineraryData.routes.slice(0, 3);

        this.currentRoutes.forEach((route, index) => {
            const leg = route.legs[0]; 
            const duration = this.dataManager.formatDuration(parseInt(route.duration.slice(0, -1)));
            const departureTime = leg.departureTime ? new Date(leg.departureTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
            const arrivalTime = leg.arrivalTime ? new Date(leg.arrivalTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

            let modesHtml = '';
            const groupedSteps = this.groupSteps(leg.steps);
            groupedSteps.forEach(step => {
                const icon = step.travelMode === 'WALK' ? 'directions_walk' : 'directions_bus';
                modesHtml += `<span class="material-icons">${icon}</span>`;
            });

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

            const stepsContent = document.createElement('div');
            stepsContent.className = 'itinerary-steps-content';
            stepsContent.id = `steps-content-${index}`;
            
            groupedSteps.forEach(step => {
                const stepElement = this.createLegStep(step);
                if (stepElement) { 
                    stepsContent.appendChild(stepElement);
                }
            });
            this.stepsContainer.appendChild(stepsContent);
        });

        this.activateRouteTab(0);
    }

    activateRouteTab(index) {
        this.summaryContainer.querySelectorAll('.itinerary-summary-tab').forEach((tab, i) => {
            tab.classList.toggle('active', i === index);
        });
        
        this.stepsContainer.querySelectorAll('.itinerary-steps-content').forEach((content, i) => {
            content.classList.toggle('active', i === index);
        });
    }

    createLegStep(step) {
        const instruction = (step.navigationInstruction ? step.navigationInstruction.instructions : null) || 
                            (step.travelMode === 'WALK' ? 'Marcher' : 'Continuer'); 

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
            
            if (transit && transit.line) {
                const line = transit.line;
                const routeColor = `#${line.color}` || '#3388ff';
                const textColor = `#${line.textColor}` || this.getContrastColor(routeColor);
                
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
            else {
                iconStyle = `style="background-color: #6c757d;"`; 
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
