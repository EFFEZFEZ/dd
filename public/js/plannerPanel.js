/**
 * Fichier : /js/plannerPanel.js
 * VERSION CORRIGÉE - Syntaxe réparée + API Google (v=beta)
 */

export class PlannerPanel {
    constructor(panelId, dataManager, mapRenderer, searchCallback) {
        this.panel = document.getElementById(panelId);
        this.dataManager = dataManager;
        this.mapRenderer = mapRenderer;
        this.searchCallback = searchCallback; 

        this.fromAutocompleteElement = document.getElementById('planner-from-autocomplete');
        this.toAutocompleteElement = document.getElementById('planner-to-autocomplete');
        
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
        this.currentRoutes = []; // ✅ CORRECTION

        this.setDefaultDateTime();
        this.bindEvents();
        this.waitForGoogleMaps();
    }
    
    waitForGoogleMaps() {
        const init = async () => {
            console.log("✅ Google Maps chargé, initialisation de l'autocomplétion");
            
            try {
                await google.maps.importLibrary("core");
                await google.maps.importLibrary("places");
                this.initAutocomplete();
            } catch (error) {
                console.error("❌ Erreur lors du chargement des bibliothèques Google Maps", error);
                this.showError("Impossible de charger le service d'adresses.");
            }
        };

        if (window.googleMapsReady) {
            init();
        } else {
            console.log("⏳ Attente du chargement de Google Maps...");
            window.addEventListener('google-maps-ready', init, { once: true });
        }
    }
    
    setDefaultDateTime() {
        const now = new Date();
        const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
        this.dateInput.value = localNow.toISOString().split('T')[0]; // ✅ CORRECTION
        this.timeInput.value = localNow.toTimeString().split(' ')[0].substring(0, 5); // ✅ CORRECTION
    }
    
    async initAutocomplete() {
        if (!this.fromAutocompleteElement || !this.toAutocompleteElement) {
            console.error("❌ Éléments d'autocomplétion introuvables dans le HTML");
            return;
        }

        // ✅ CORRECTION : Attendre que les composants soient complètement initialisés
        await customElements.whenDefined('gmp-place-autocomplete');
        
        // Petit délai supplémentaire pour s'assurer que .input est disponible
        await new Promise(resolve => setTimeout(resolve, 100));

        // Zone de délimitation de la Dordogne
        const dordogneBounds = new google.maps.LatLngBounds(
            { lat: 44.53, lng: -0.13 },
            { lat: 45.75, lng: 1.50 }
        );

        // Restrictions géographiques
        this.fromAutocompleteElement.locationRestriction = dordogneBounds;
        this.fromAutocompleteElement.strictBounds = true;
        this.fromAutocompleteElement.componentRestrictions = { country: 'fr' };
        
        this.toAutocompleteElement.locationRestriction = dordogneBounds;
        this.toAutocompleteElement.strictBounds = true;
        this.toAutocompleteElement.componentRestrictions = { country: 'fr' };

        // ✅ NOUVELLE APPROCHE : Utiliser un observateur pour détecter les changements
        const setupPlaceListener = (element, coordsProperty) => {
            // Observer les changements sur l'élément
            const observer = new MutationObserver(() => {
                // Vérifier si un lieu a été sélectionné
                const inputValue = element.input?.value;
                if (inputValue && inputValue.trim() !== '') {
                    console.log(`📝 Valeur détectée dans ${coordsProperty}:`, inputValue);
                }
            });
            
            // Observer l'élément et ses enfants
            observer.observe(element, {
                attributes: true,
                childList: true,
                subtree: true
            });
        };
        
        // Méthode alternative : Polling pour vérifier si un lieu est sélectionné
        let lastFromValue = '';
        let lastToValue = '';
        
        const checkPlaceSelection = () => {
            // Vérifier le champ DÉPART
            if (this.fromAutocompleteElement.input) {
                const currentFromValue = this.fromAutocompleteElement.input.value;
                
                // Si la valeur a changé et qu'elle n'est pas vide
                if (currentFromValue !== lastFromValue && currentFromValue.trim() !== '') {
                    lastFromValue = currentFromValue;
                    
                    // Essayer d'obtenir le lieu via l'API
                    const place = this.fromAutocompleteElement.value;
                    console.log("🔍 Tentative de récupération du lieu DÉPART:", place);
                    
                    if (place && place.location) {
                        this.fromCoords = `${place.location.lat()},${place.location.lng()}`;
                        console.log("✅ Coordonnées DÉPART capturées:", this.fromCoords);
                    }
                }
            }
            
            // Vérifier le champ ARRIVÉE
            if (this.toAutocompleteElement.input) {
                const currentToValue = this.toAutocompleteElement.input.value;
                
                if (currentToValue !== lastToValue && currentToValue.trim() !== '') {
                    lastToValue = currentToValue;
                    
                    const place = this.toAutocompleteElement.value;
                    console.log("🔍 Tentative de récupération du lieu ARRIVÉE:", place);
                    
                    if (place && place.location) {
                        this.toCoords = `${place.location.lat()},${place.location.lng()}`;
                        console.log("✅ Coordonnées ARRIVÉE capturées:", this.toCoords);
                    }
                }
            }
        };
        
        // Vérifier toutes les 500ms
        setInterval(checkPlaceSelection, 500);
        
        // Écouteur pour le champ DÉPART - Essayer tous les événements possibles
        ['gmp-placeselect', 'place_changed', 'change', 'input'].forEach(eventName => {
            this.fromAutocompleteElement.addEventListener(eventName, (event) => {
                console.log(`🎯 Événement DÉPART: ${eventName}`, event);
                
                // Essayer différentes façons d'obtenir le lieu
                const place = event.place || 
                             event.detail?.place || 
                             this.fromAutocompleteElement.value ||
                             this.fromAutocompleteElement.place;
                
                console.log("📍 Place DÉPART:", place);
                
                if (place && place.location) {
                    this.fromCoords = `${place.location.lat()},${place.location.lng()}`;
                    console.log("✅ Départ sauvegardé:", this.fromCoords);
                } else if (place && typeof place.fetchFields === 'function') {
                    place.fetchFields({ fields: ['location'] }).then(() => {
                        if (place.location) {
                            this.fromCoords = `${place.location.lat()},${place.location.lng()}`;
                            console.log("✅ Départ sauvegardé (async):", this.fromCoords);
                        }
                    });
                }
            });
        });
        
        // Écouteur pour le champ ARRIVÉE - Multiple événements pour compatibilité
        const handleToPlaceSelect = async (event) => {
            console.log("🎯 Événement arrivée détecté:", event.type);
            
            // Essayer d'obtenir le lieu depuis différentes sources
            let place = event.place || event.detail?.place || this.toAutocompleteElement.place;
            
            console.log("📍 Place objet:", place);

            if (!place) {
                console.warn("⚠️ Aucun lieu trouvé dans l'événement");
                this.toCoords = null;
                return;
            }

            try {
                // Vérifier si on a déjà la location
                if (place.location) {
                    this.toCoords = `${place.location.lat()},${place.location.lng()}`;
                    console.log("✅ Arrivée sauvegardée (direct):", this.toCoords);
                } else {
                    // Sinon, récupérer les détails
                    await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress'] });
                    
                    if (place.location) {
                        this.toCoords = `${place.location.lat()},${place.location.lng()}`;
                        console.log("✅ Arrivée sauvegardée (après fetch):", this.toCoords);
                    } else {
                        console.error("❌ Pas de location trouvée après fetch");
                        this.toCoords = null;
                    }
                }
            } catch (error) {
                console.error("❌ Erreur lors de la récupération du lieu d'arrivée:", error);
                this.toCoords = null;
            }
        };
        
        // Écouter plusieurs événements possibles
        this.toAutocompleteElement.addEventListener('gmp-placeselect', handleToPlaceSelect);
        this.toAutocompleteElement.addEventListener('place_changed', handleToPlaceSelect);
        this.toAutocompleteElement.addEventListener('gmpplaceselect', handleToPlaceSelect);

        // Reset des coordonnées si l'utilisateur efface les champs
        // ✅ CORRECTION : Vérifier que .input existe avant d'ajouter l'écouteur
        if (this.fromAutocompleteElement.input) {
            this.fromAutocompleteElement.input.addEventListener('input', () => {
                if (this.fromAutocompleteElement.input.value === '') {
                    this.fromCoords = null;
                }
            });
        }
        
        if (this.toAutocompleteElement.input) {
            this.toAutocompleteElement.input.addEventListener('input', () => {
                if (this.toAutocompleteElement.input.value === '') {
                    this.toCoords = null;
                }
            });
        }

        console.log("✅ Autocomplétion Google Places initialisée et restreinte à la Dordogne.");
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
            const from = this.fromCoords;
            const to = this.toCoords;
            const timeMode = this.timeMode;
            const date = this.dateInput.value;
            const time = this.timeInput.value;

            // ✅ AJOUT : Logs de debug
            console.log("🔍 Recherche d'itinéraire:");
            console.log("  - Départ (fromCoords):", from);
            console.log("  - Arrivée (toCoords):", to);
            console.log("  - Date:", date);
            console.log("  - Heure:", time);

            if (!from || !to) {
                console.error("❌ Coordonnées manquantes!");
                this.showError("Veuillez sélectionner un lieu de départ et d'arrivée valides dans les suggestions.");
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
            
            console.log("✅ Options envoyées:", options);
            this.showLoading("Calcul de l'itinéraire...");
            this.searchCallback(options); 
        });

        this.locateButton.addEventListener('click', () => {
            this.mapRenderer.map.locate({ setView: true, maxZoom: 16 })
                .on('locationfound', (e) => {
                    // ✅ CORRECTION : Vérifier que .input existe
                    if (this.fromAutocompleteElement.input) {
                        this.fromAutocompleteElement.input.value = "Ma position";
                    }
                    this.fromCoords = `${e.latlng.lat.toFixed(5)},${e.latlng.lng.toFixed(5)}`; 
                })
                .on('locationerror', () => {
                    alert("Impossible de vous localiser. Vérifiez les permissions de votre navigateur.");
                });
        });
    }
    
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
                        navigationInstruction: step.navigationInstruction || { instructions: "Marcher" }, // ✅ CORRECTION
                        distanceMeters: 0,
                        staticDuration: "0s"
                    };
                }
                currentWalkStep.distanceMeters += step.distanceMeters || 0; // ✅ CORRECTION
                currentWalkStep.staticDuration = (
                    parseInt(currentWalkStep.staticDuration.slice(0, -1)) + 
                    parseInt(step.staticDuration.slice(0, -1) || 0) // ✅ CORRECTION
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

        if (!itineraryData.routes || itineraryData.routes.length === 0) { // ✅ CORRECTION
            this.showError("Aucun itinéraire trouvé.");
            return;
        }

        this.currentRoutes = itineraryData.routes.slice(0, 3);

        this.currentRoutes.forEach((route, index) => {
            const leg = route.legs[0]; // ✅ CORRECTION
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
                            (step.travelMode === 'WALK' ? 'Marcher' : 'Continuer'); // ✅ CORRECTION

        if (!instruction || instruction === 'undefined') { // ✅ CORRECTION
            return null;
        }
        
        const el = document.createElement('div');
        el.className = 'itinerary-leg';
        el.dataset.mode = step.travelMode;

        const legDuration = this.dataManager.formatDuration(parseInt(step.staticDuration.slice(0, -1) || 0)); // ✅ CORRECTION
        
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
                const routeColor = line.color || '#3388ff'; // ✅ CORRECTION
                const textColor = line.textColor || this.getContrastColor(routeColor); // ✅ CORRECTION
                
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
