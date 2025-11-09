/**
 * Fichier : /js/plannerPanel.js
 *
 * VERSION MIGRÉE (CORRECTION FINALE v2)
 *
 * 1. SUPPRIME les lignes qui plantaient dans 'initAutocomplete'
 * (ex: .locationBias) car elles sont maintenant dans le HTML.
 * 2. CORRIGE l'écouteur d'événement 'gmp-placechange' pour
 * utiliser 'place.fetchFields()', ce qui est la nouvelle
 * façon correcte de récupérer la géométrie.
 */

export class PlannerPanel {
    constructor(panelId, dataManager, mapRenderer, searchCallback) {
        this.panel = document.getElementById(panelId);
        this.dataManager = dataManager;
        this.mapRenderer = mapRenderer;
        this.searchCallback = searchCallback; 

        // Référence aux ÉLÉMENTS d'autocomplétion (les nouveaux)
        this.fromAutocompleteElement = document.getElementById('planner-from-autocomplete');
        this.toAutocompleteElement = document.getElementById('planner-to-autocomplete');
        
        // Référence aux INPUTS
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
        
        // Définit la fonction 'initMap' globale que Google appellera
        window.initMap = () => {
            console.log("Google Maps JS est prêt, initialisation de PlaceAutocompleteElement.");
            this.initAutocomplete(); 
        };
        // Au cas où le script serait déjà chargé
        if (typeof google !== 'undefined' && typeof google.maps !== 'undefined' && google.maps.places) {
            this.initAutocomplete();
        }
    }
    
    setDefaultDateTime() {
        const now = new Date();
        const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
        this.dateInput.value = localNow.toISOString().split('T')[0];
        this.timeInput.value = localNow.toTimeString().split(' ')[0].substring(0, 5);
    }
    
    /**
     * NOUVELLE MÉTHODE initAutocomplete (CORRIGÉE)
     * Supprime les lignes qui plantent.
     * Ajoute 'fetchFields' dans les listeners.
     */
    initAutocomplete() {
        if (typeof google === 'undefined' || !google.maps.places || !this.fromAutocompleteElement) {
            console.error("Échec de l'initialisation de l'autocomplétion. L'élément HTML ou l'API Google est manquant.");
            return;
        }

        // --- SECTION SUPPRIMÉE ---
        // Les lignes qui définissaient .locationBias, .componentRestrictions, etc.
        // ont été supprimées car elles provoquaient le crash.
        // Ces options sont maintenant DANS 'index.html'.

        // Écoute l'événement 'gmp-placechange' (le NOUVEL événement)
        this.fromAutocompleteElement.addEventListener('gmp-placechange', async (event) => {
            // 'place' est une promesse
            const place = this.fromAutocompleteElement.place;
            
            if (!place) {
                this.fromCoords = null;
                return;
            }

            // CORRECTION : On doit demander les champs ('fetchFields')
            await place.fetchFields({ fields: ['name', 'geometry'] });

            if (place.geometry) {
                this.fromCoords = `${place.geometry.location.lat()},${place.geometry.location.lng()}`;
                this.fromInput.value = place.name;
            } else {
                this.fromCoords = null;
            }
        });
        
        this.toAutocompleteElement.addEventListener('gmp-placechange', async (event) => {
             const place = this.toAutocompleteElement.place;

             if (!place) {
                this.toCoords = null;
                return;
            }

            // CORRECTION : On doit demander les champs ('fetchFields')
            await place.fetchFields({ fields: ['name', 'geometry'] });
             
             if (place.geometry) {
                this.toCoords = `${place.geometry.location.lat()},${place.geometry.location.lng()}`;
                this.toInput.value = place.name;
            } else {
                this.toCoords = null;
            }
        });

        // Si l'utilisateur efface le texte, on efface les coordonnées
        this.fromInput.addEventListener('input', () => {
            if (this.fromInput.value === '') this.fromCoords = null;
        });
        this.toInput.addEventListener('input', () => {
            if (this.toInput.value === '') this.toCoords = null;
        });
    }

    /**
     * bindEvents (simplifié)
     */
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
            
            const from = this.fromCoords;
            const to = this.toCoords;
            const timeMode = this.timeMode;
            const date = this.dateInput.value;
            const time = this.timeInput.value;

            if (!from || !to) {
                this.showError("Veuillez sélectionner un lieu de départ et d'arrivée valides dans les suggestions.");
                return;
            }
            if (!date || !time) {
                this.showError("Veuillez remplir la date et l'heure.");
                return;
            }
            
            const isoDateTime = `${date}T${time}:00Z`;
            const options = {
                fromPlace: from, // Garanti d'être "lat,lon"
                toPlace: to,     // Garanti d'être "lat,lon"
                timeMode: timeMode, 
                dateTime: isoDateTime
            };
            
            this.showLoading("Calcul de l'itinéraire...");
            
            // Appelle 'handleItineraryRequest' dans main.js
            this.searchCallback(options); 
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

    // (Le reste du fichier est identique à votre 'plannerPanel.js' précédent)
    
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
        this.summaryContainer.innerHTML = `<p style="color: #dc2626; padding: 0 1.5rem;">${message}</p>`;
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
