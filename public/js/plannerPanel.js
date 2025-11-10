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

        // Initialiser le Geocoder pour convertir adresses → coordonnées
        this.geocoder = new google.maps.Geocoder();

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

        // ✅ SOLUTION : Géocoder l'adresse quand l'utilisateur appuie sur Entrée ou clique sur une suggestion
        
        // Fonction pour géocoder une adresse
        const geocodeAddress = async (address, isFrom = true) => {
            console.log(`🌍 Géocodage de "${address}"...`);
            
            try {
                const result = await this.geocoder.geocode({ 
                    address: address,
                    componentRestrictions: { country: 'FR' },
                    bounds: new google.maps.LatLngBounds(
                        { lat: 44.53, lng: -0.13 },
                        { lat: 45.75, lng: 1.50 }
                    )
                });
                
                if (result.results && result.results.length > 0) {
                    const location = result.results[0].geometry.location;
                    const coords = `${location.lat()},${location.lng()}`;
                    
                    if (isFrom) {
                        this.fromCoords = coords;
                        console.log("✅ Coordonnées DÉPART:", coords);
                    } else {
                        this.toCoords = coords;
                        console.log("✅ Coordonnées ARRIVÉE:", coords);
                    }
                    
                    return coords;
                } else {
                    console.error("❌ Aucun résultat trouvé pour:", address);
                    return null;
                }
            } catch (error) {
                console.error("❌ Erreur de géocodage:", error);
                return null;
            }
        };
        
        // Écouteurs pour le champ DÉPART
        let fromDebounceTimer;
        
        if (this.fromAutocompleteElement.input) {
            // Quand l'utilisateur tape ou sélectionne
            this.fromAutocompleteElement.input.addEventListener('change', async (e) => {
                const address = e.target.value;
                if (address && address.trim().length > 3) {
                    clearTimeout(fromDebounceTimer);
                    fromDebounceTimer = setTimeout(async () => {
                        await geocodeAddress(address, true);
                    }, 500);
                }
            });
            
            // Quand l'utilisateur appuie sur Entrée
            this.fromAutocompleteElement.input.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const address = e.target.value;
                    if (address && address.trim().length > 3) {
                        await geocodeAddress(address, true);
                    }
                }
            });
        }
        
        // Écouteurs pour le champ ARRIVÉE
        let toDebounceTimer;
        
        if (this.toAutocompleteElement.input) {
            // Quand l'utilisateur tape ou sélectionne
            this.toAutocompleteElement.input.addEventListener('change', async (e) => {
                const address = e.target.value;
                if (address && address.trim().length > 3) {
                    clearTimeout(toDebounceTimer);
                    toDebounceTimer = setTimeout(async () => {
                        await geocodeAddress(address, false);
                    }, 500);
                }
            });
            
            // Quand l'utilisateur appuie sur Entrée
            this.toAutocompleteElement.input.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const address = e.target.value;
                    if (address && address.trim().length > 3) {
                        await geocodeAddress(address, false);
                    }
                }
            });
        }
        
        // Reset des coordonnées si l'utilisateur efface les champs
        if (this.fromAutocompleteElement.input) {
            this.fromAutocompleteElement.input.addEventListener('input', (e) => {
                if (e.target.value === '') {
                    this.fromCoords = null;
                    console.log("🗑️ Coordonnées DÉPART effacées");
                }
            });
        }
        
        if (this.toAutocompleteElement.input) {
            this.toAutocompleteElement.input.addEventListener('input', (e) => {
                if (e.target.value === '') {
                    this.toCoords = null;
                    console.log("🗑️ Coordonnées ARRIVÉE effacées");
                }
            });
        }

        console.log("✅ Autocomplétion Google Places initialisée avec Geocoding.");
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
