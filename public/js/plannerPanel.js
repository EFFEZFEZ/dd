/**
 * Fichier : /js/plannerPanel.js
 *
 * MIS À JOUR :
 * 1. Utilise la nouvelle API "Place Autocomplete" de Google.
 * 2. Lit le nouveau format de réponse de "Routes API" (corrige "Invalid Date").
 * 3. Utilise les nouveaux onglets "Partir"/"Arriver" au lieu du <select>.
 * 4. Affiche un message d'erreur clair (pour l'erreur 503).
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
        this.summaryContainer = document.getElementById('itinerary-summary');
        this.stepsContainer = document.getElementById('itinerary-steps');

        // === NOUVEAUX CHAMPS (Onglets) ===
        this.departureTab = document.getElementById('planner-mode-departure');
        this.arrivalTab = document.getElementById('planner-mode-arrival');
        this.dateInput = document.getElementById('planner-date');
        this.timeInput = document.getElementById('planner-time');
        this.timeMode = 'DEPARTURE'; // État par défaut
        // ==============================

        this.fromCoords = null;
        this.toCoords = null;

        this.setDefaultDateTime(); // Pré-remplir la date et l'heure
        this.bindEvents();
        
        // Initialiser l'autocomplétion
        window.initMap = () => {
            console.log("Google Maps JS est prêt, initialisation de l'autocomplete.");
            this.initAutocomplete(); 
        };
        if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
            this.initAutocomplete();
        }
    }
    
    /**
     * NOUVEAU: Pré-remplit les champs date/heure avec la date/heure actuelles
     */
    setDefaultDateTime() {
        const now = new Date();
        
        // Ajuste pour le fuseau horaire local
        const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
        
        this.dateInput.value = localNow.toISOString().split('T')[0];
        this.timeInput.value = localNow.toTimeString().split(' ')[0].substring(0, 5);
    }
    
    async initAutocomplete() {
        if (typeof google === 'undefined' || !google.maps.places) {
            console.warn("Google Places API n'est pas chargée. Les suggestions ne fonctionneront pas.");
            return;
        }

        const { Autocomplete } = await google.maps.importLibrary("places");

        const center = { lat: 45.1833, lng: 0.7167 }; // Périgueux
        const defaultBounds = {
            north: center.lat + 0.3,
            south: center.lat - 0.3,
            east: center.lng + 0.3,
            west: center.lng - 0.3,
        };
        
        const options = {
            bounds: defaultBounds,
            componentRestrictions: { country: "fr" },
            strictBounds: true, 
            fields: ["name", "formatted_address", "geometry"],
        };
        
        const fromAutocomplete = new Autocomplete(this.fromInput, options);
        const toAutocomplete = new Autocomplete(this.toInput, options);

        fromAutocomplete.addListener('place_changed', () => {
            const place = fromAutocomplete.getPlace();
            if (place.geometry) {
                const loc = place.geometry.location;
                this.fromCoords = `${loc.lat()},${loc.lng()}`;
                this.fromInput.value = place.name;
            }
        });
        
        toAutocomplete.addListener('place_changed', () => {
             const place = toAutocomplete.getPlace();
             if (place.geometry) {
                const loc = place.geometry.location;
                this.toCoords = `${loc.lat()},${loc.lng()}`;
                this.toInput.value = place.name;
            }
        });

        this.fromInput.addEventListener('input', () => { this.fromCoords = null; });
        this.toInput.addEventListener('input', () => { this.toCoords = null; });
    }

    bindEvents() {
        // === GESTION DES ONGLETS ===
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
        // =========================

        this.searchButton.addEventListener('click', () => {
            const from = this.fromCoords || this.fromInput.value;
            const to = this.toCoords || this.toInput.value;

            // === LECTURE DES NOUVEAUX CHAMPS ===
            const timeMode = this.timeMode; // Lit depuis l'état du panneau
            const date = this.dateInput.value;
            const time = this.timeInput.value;

            if (!from || !to || !date || !time) {
                alert("Veuillez remplir le départ, l'arrivée, la date et l'heure.");
                return;
            }
            
            // Combine date et time en ISO string (UTC)
            const isoDateTime = `${date}T${time}:00Z`;
            
            const options = {
                fromPlace: from,
                toPlace: to,
                timeMode: timeMode,
                dateTime: isoDateTime
            };
            // ===================================
            
            this.showLoading();
            this.searchCallback(options); // Envoyer l'objet options
            
            this.fromCoords = null;
            this.toCoords = null;
        });

        this.locateButton.addEventListener('click', () => {
            this.mapRenderer.map.locate({ setView: true, maxZoom: 16 })
                .on('locationfound', (e) => {
                    const coords = `${e.latlng.lat.toFixed(5)},${e.latlng.lng.toFixed(5)}`;
                    this.fromInput.value = "Ma position"; 
                    this.fromCoords = coords; 
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
        // Affiche le message d'erreur géré (grâce au fix du routingService)
        this.summaryContainer.innerHTML = `<p style="color: #dc2626; padding: 0 1.5rem;">${message}</p>`;
    }

    /**
     * Affiche l'itinéraire (format "Routes API")
     */
    displayItinerary(itineraryData) {
        this.hideLoading();
        this.stepsContainer.innerHTML = '';

        if (!itineraryData.routes || itineraryData.routes.length === 0) {
            this.showError("Aucun itinéraire trouvé.");
            return;
        }

        const route = itineraryData.routes[0]; 
        const leg = route.legs[0]; 

        // 1. Résumé
        // CORRECTION: 'leg.duration.value' -> 'route.duration' (string "3600s")
        const durationInSeconds = parseInt(route.duration.slice(0, -1)); // Enlève le "s"
        const duration = this.dataManager.formatDuration(durationInSeconds);
        
        // CORRECTION: Format d'heure ISO (string)
        // On vérifie si les heures existent (un trajet à pied n'en a pas)
        const departureText = leg.departureTime ? new Date(leg.departureTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
        const arrivalText = leg.arrivalTime ? new Date(leg.arrivalTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;

        this.summaryContainer.innerHTML = `
            <h4>Le plus rapide : ${duration}</h4>
            ${ (departureText && arrivalText) ?
                `<p>${departureText} &ndash; ${arrivalText}</p>` :
                '' 
            }
        `;

        // 2. Étapes (Steps)
        leg.steps.forEach(step => {
            if (step) {
                this.stepsContainer.appendChild(this.createLegStep(step));
            }
        });
    }

    /** Crée une étape de trajet (format "Routes API") */
    createLegStep(step) {
        const el = document.createElement('div');
        el.className = 'itinerary-leg';
        el.dataset.mode = step.travelMode;

        const legDuration = this.dataManager.formatDuration(parseInt(step.staticDuration.slice(0, -1)));
        const startTime = step.departureTime ? new Date(step.departureTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

        let icon, details;
        const instruction = step.navigationInstruction ? step.navigationInstruction.instructions : 'Marcher';

        if (step.travelMode === 'WALK') {
            icon = 'directions_walk';
            const distanceKm = (step.distanceMeters / 1000).toFixed(1);
            details = `
                <strong>${instruction}</strong>
                <div class="leg-time-info">${legDuration} (${distanceKm} km)</div>
            `;
        } else if (step.travelMode === 'TRANSIT') {
            icon = 'directions_bus';
            const transit = step.transitDetails;
            
            if (transit && transit.line) {
                const line = transit.line;
                const routeColor = line.color || '#333';
                const textColor = line.textColor || this.getContrastColor(routeColor);

                details = `
                    <div class="leg-time-info">${startTime} - Prendre à <strong>${transit.stopDetails.departureStop.name}</strong></div>
                    <div class="leg-route">
                        <span class="leg-badge" style="background-color: ${routeColor}; color: ${textColor};">
                            ${line.shortName || line.name}
                        </span>
                        <strong>Direction ${transit.headsign}</strong>
                    </div>
                    <div class="leg-time-info">
                        ${transit.stopCount} arrêt(s) (${legDuration})
                    </div>
                    <div class="leg-time-info" style="margin-top: 5px;">
                        Descendre à <strong>${transit.stopDetails.arrivalStop.name}</strong>
                    </div>
                `;
            } else {
                details = `
                    <strong>${instruction}</strong>
                    <div class="leg-time-info">${legDuration}</div>
                `;
            }
        } else {
            icon = 'help';
            details = `<strong>${instruction}</strong>`;
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
