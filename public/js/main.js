/**
 * main.js
 * 
 * Ce fichier contient la classe PlannerPanel qui gère la logique de l'interface
 * de recherche d'itinéraire.
 * 
 * MODIFICATIONS :
 * - Ajout de l'import GeocodingService.
 * - Modification de l'écouteur d'événement 'searchButton' dans bindEvents()
 *   pour implémenter la logique "Geocoding-First" et corriger 
 *   l'erreur INVALID_ARGUMENT.
 */

// AJOUT : Importation du service de géocodage (suppose que geocodingService.js existe)
import { GeocodingService } from './geocodingService.js';

/**
 * Classe PlannerPanel
 * Gère le panneau de recherche d'itinéraire et l'affichage des résultats.
 */
class PlannerPanel {
    constructor(dependencies) {
        // Dépendances injectées [8]
        this.panel = dependencies.panel;
        this.dataManager = dependencies.dataManager;
        this.mapRenderer = dependencies.mapRenderer;
        this.searchCallback = dependencies.searchCallback; // La fonction qui appelle l'API de routage

        // Champs de saisie
        this.fromInput = document.getElementById('planner-from');
        this.toInput = document.getElementById('planner-to');

        // Boutons
        this.searchButton = document.getElementById('btn-search-itinerary');
        this.locateButton = document.getElementById('btn-use-location');

        // Éléments d'UI
        this.loadingSpinner = document.getElementById('planner-loading');
        this.summaryContainer = document.getElementById('itinerary-summary-container');
        this.stepsContainer = document.getElementById('itinerary-steps-container');

        // Contrôles de temps
        this.departureTab = document.getElementById('planner-mode-departure');
        this.arrivalTab = document.getElementById('planner-mode-arrival');
        this.dateInput = document.getElementById('planner-date');
        this.timeInput = document.getElementById('planner-time');

        // État interne
        this.timeMode = 'DEPARTURE';
        this.fromCoords = null; // Coordonnées (si sélectionnées par Autocomplete)
        this.toCoords = null;   // Coordonnées (si sélectionnées par Autocomplete)
        this.currentRoutes =;

        // Initialisation
        this.setDefaultDateTime();
        this.bindEvents();

        // Gestion de l'initialisation de Google Maps Autocomplete
        if (window.google && window.google.maps) {
            this.initAutocomplete();
        } else {
            // Si le script Google Maps est chargé de manière asynchrone
            window.initMap = this.initAutocomplete.bind(this);
        }
    }

    /**
     * Définit la date et l'heure actuelles dans les champs de saisie.
     */
    setDefaultDateTime() {
        const now = new Date();
        // Formate la date en YYYY-MM-DD
        const date = now.toISOString().split('T');
        // Formate l'heure en HH:MM (heure locale)
        const time = now.toTimeString().split(' ').substring(0, 5);

        this.dateInput.value = date;
        this.timeInput.value = time;
    }

    /**
     * Initialise Google Maps Autocomplete pour les champs d'origine et de destination.
     */
    initAutocomplete() {
        const autocompleteLib = google.maps.places.Autocomplete;

        // Centre sur Périgueux pour la pertinence de la recherche
        const center = { lat: 45.1833, lng: 0.7167 };
        const defaultBounds = {
            north: center.lat + 0.1,
            south: center.lat - 0.1,
            east: center.lng + 0.1,
            west: center.lng - 0.1,
        };

        const options = {
            bounds: defaultBounds,
            componentRestrictions: { country: "fr" },
            fields: ["geometry.location", "name"],
            strictBounds: false,
        };

        // Autocomplete pour l'origine
        const fromAutocomplete = new autocompleteLib(this.fromInput, options);
        fromAutocomplete.addListener('place_changed', () => {
            const place = fromAutocomplete.getPlace();
            if (place.geometry && place.geometry.location) {
                this.fromCoords = {
                    lat: place.geometry.location.lat(),
                    lon: place.geometry.location.lng() // Normalisé en lon
                };
                this.fromInput.value = place.name;
            }
        });

        // Autocomplete pour la destination
        const toAutocomplete = new autocompleteLib(this.toInput, options);
        toAutocomplete.addListener('place_changed', () => {
            const place = toAutocomplete.getPlace();
            if (place.geometry && place.geometry.location) {
                this.toCoords = {
                    lat: place.geometry.location.lat(),
                    lon: place.geometry.location.lng() // Normalisé en lon
                };
                this.toInput.value = place.name;
            }
        });

        // Efface les coordonnées si l'utilisateur modifie manuellement le texte
        this.fromInput.addEventListener('input', () => { this.fromCoords = null; });
        this.toInput.addEventListener('input', () => { this.toCoords = null; });
    }

    /**
     * Lie tous les gestionnaires d'événements pour les éléments du panneau.
     */
    bindEvents() {
        // Clic sur les onglets Départ/Arrivée
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

        // Clic sur le bouton de géolocalisation
        this.locateButton.addEventListener('click', () => {
            if (this.mapRenderer && this.mapRenderer.map) {
                this.mapRenderer.map.locate({ setView: true, maxZoom: 16 });
                this.mapRenderer.map.once('locationfound', (e) => {
                    this.fromInput.value = "Ma position";
                    this.fromCoords = { lat: e.latlng.lat, lon: e.latlng.lng };
                });
                this.mapRenderer.map.once('locationerror', (e) => {
                    alert(e.message);
                });
            }
        });

        // --- CORRECTION PRINCIPALE ICI ---
        // Clic sur le bouton "Rechercher"
        // La fonction est rendue `async` pour `await` le géocodage.
        this.searchButton.addEventListener('click', async () => {
            const fromText = this.fromInput.value;
            const toText = this.toInput.value;

            // Validation simple
            if (!fromText ||!toText ||!this.dateInput.value ||!this.timeInput.value) {
                this.showError("Veuillez remplir tous les champs.");
                return;
            }

            this.showLoading(); // Affiche le spinner

            try {
                // --- DÉBUT DE LA LOGIQUE DE CORRECTION ---

                // 1. Tente d'utiliser les coordonnées de l'auto-complétion
                let finalFromCoords = this.fromCoords;
                let finalToCoords = this.toCoords;

                // 2. Si l'origine n'a pas de coordonnées (saisie manuelle), géocode le texte
                if (!finalFromCoords && fromText) {
                    console.log(`Géocodage requis pour l'origine: "${fromText}"`);
                    this.showLoading("Géocodage de l'origine...");
                    // Appelle le service de géocodage (ex: Nominatim)
                    finalFromCoords = await GeocodingService.geocodeAddress(fromText); // [6, 7]
                }
                
                // 3. OPTIMISATION : Utilise les coordonnées statiques pour la destination
                // La destination "Campus Périgord" est fixe.
                // Inutile de la géocoder à chaque fois.
                // Coordonnées GPS vérifiées : 45°11'47.39" N, 0°43'03.61" E 
                if (toText.toLowerCase().includes("campus périgord")) {
                     finalToCoords = { 
                        lat: 45.196497, 
                        lon: 0.717669 
                    };
                }
                // (Alternative) Si la destination doit aussi être dynamique :
                // else if (!finalToCoords && toText) {
                //     console.log(`Géocodage requis pour la destination: "${toText}"`);
                //     this.showLoading("Géocodage de la destination...");
                //     finalToCoords = await GeocodingService.geocodeAddress(toText);
                // }


                // 4. Vérifie que nous avons bien toutes les coordonnées
                if (!finalFromCoords ||!finalToCoords) {
                    throw new Error("Impossible de trouver les coordonnées pour l'adresse fournie.");
                }
                
                // 5. Prépare les options pour le callback (temps, etc.)
                const date = this.dateInput.value;
                const time = this.timeInput.value;
                const isoDateTime = `${date}T${time}:00`;

                const options = {
                    from: fromText, // Garde le texte pour info
                    to: toText,     // Garde le texte pour info
                    fromCoords: finalFromCoords, // Coordonnées fiables
                    toCoords: finalToCoords,     // Coordonnées fiables
                    timeMode: this.timeMode,
                    date: date,
                    time: time,
                    isoDateTime: isoDateTime
                };

                this.showLoading("Calcul de l'itinéraire...");

                // 6. Appelle le searchCallback injecté AVEC les coordonnées
                // C'est cette fonction (externe) qui appelle RoutingService
                await this.searchCallback(options);
                
                // --- FIN DE LA LOGIQUE DE CORRECTION ---

            } catch (error) {
                // (main.js:403 dans le log d'erreur)
                console.error("Erreur finale lors de la recherche d'itinéraire:", error);
                this.showError(error.message);
            }

            this.hideLoading(); // Masque le spinner
            
            // Réinitialise l'état pour la prochaine recherche
            this.fromCoords = null;
            this.toCoords = null;
        });
    }

    /**
     * Affiche le spinner de chargement et un message optionnel.
     * @param {string} [message] - Le message à afficher sous le spinner.
     */
    showLoading(message = "Recherche en cours...") {
        this.loadingSpinner.style.display = 'block';
        this.loadingSpinner.querySelector('p').textContent = message;
        this.summaryContainer.innerHTML = '';
        this.stepsContainer.innerHTML = '';
        this.summaryContainer.style.display = 'none';
        this.stepsContainer.style.display = 'none';
    }

    /**
     * Masque le spinner de chargement.
     */
    hideLoading() {
        this.loadingSpinner.style.display = 'none';
    }

    /**
     * Affiche un message d'erreur dans le panneau.
     * @param {string} message - L'erreur à afficher.
     */
    showError(message) {
        this.hideLoading();
        this.summaryContainer.style.display = 'block';
        this.summaryContainer.innerHTML = `<div class="itinerary-error">${message}</div>`;
    }

    /**
     * Regroupe les étapes de marche consécutives.
     * @param {Array<object>} steps - La liste des étapes d'un itinéraire.
     * @returns {Array<object>} - La liste des étapes avec la marche regroupée.
     */
    groupSteps(steps) {
        if (!steps |

| steps.length === 0) {
            return;
        }

        const groupedSteps =;
        let currentWalkStep = null;

        steps.forEach((step, index) => {
            if (step.travelMode === 'WALK') {
                if (!currentWalkStep) {
                    // Commence un nouveau segment de marche
                    currentWalkStep = {...step, distanceMeters: 0, staticDuration: 0 };
                }
                // Agrège la distance et la durée
                currentWalkStep.distanceMeters += step.distanceMeters |

| 0;
                currentWalkStep.staticDuration += step.staticDuration |

| 0;
            } else {
                if (currentWalkStep) {
                    // Fin du segment de marche, on l'ajoute
                    groupedSteps.push(currentWalkStep);
                    currentWalkStep = null;
                }
                // Ajoute l'étape de transit
                groupedSteps.push(step);
            }
        });

        // Ajoute le dernier segment de marche s'il existe
        if (currentWalkStep) {
            groupedSteps.push(currentWalkStep);
        }

        return groupedSteps;
    }

    /**
     * Affiche les itinéraires trouvés dans le panneau.
     * @param {object} itineraryData - Les données complètes de l'itinéraire.
     */
    displayItinerary(itineraryData) {
        this.hideLoading();
        this.summaryContainer.innerHTML = '';
        this.stepsContainer.innerHTML = '';

        if (!itineraryData ||!itineraryData.routes |

| itineraryData.routes.length === 0) {
            this.showError("Aucun itinéraire trouvé.");
            return;
        }

        this.summaryContainer.style.display = 'block';
        this.stepsContainer.style.display = 'block';
        
        // Limite aux 3 premiers itinéraires
        this.currentRoutes = itineraryData.routes.slice(0, 3);

        this.currentRoutes.forEach((route, index) => {
            const duration = route.duration; // ex: "PT1H5M"
            const startTime = route.startTime? new Date(route.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
            const endTime = route.endTime? new Date(route.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

            // REGCorrection : Utilise les étapes regroupées pour les icônes
            const groupedSteps = this.groupSteps(route.legs.flatMap(leg => leg.steps));
            
            // Crée les icônes de mode
            const modesHtml = groupedSteps.map(step => {
                const icon = step.travelMode === 'WALK'? 'directions_walk' : 'directions_bus';
                return `<i class="material-icons">${icon}</i>`;
            }).join(' <i class="material-icons">chevron_right</i> ');

            // Crée l'onglet résumé
            const summaryTab = document.createElement('div');
            summaryTab.className = 'itinerary-summary-tab';
            summaryTab.dataset.index = index;
            summaryTab.innerHTML = `
                <div class="summary-time">
                    <strong>${startTime}</strong> - <strong>${endTime}</strong>
                    <span>(${duration.replace('PT', '').replace('H', 'h').replace('M', 'm')})</span>
                </div>
                <div class="summary-modes">
                    ${modesHtml}
                </div>
            `;
            summaryTab.addEventListener('click', () => this.activateRouteTab(index));
            this.summaryContainer.appendChild(summaryTab);

            // Crée le conteneur d'étapes
            const stepsContent = document.createElement('div');
            stepsContent.className = 'itinerary-steps-content';
            stepsContent.dataset.index = index;

            // REGCorrection : Utilise les étapes regroupées pour l'affichage
            groupedSteps.forEach(step => {
                const stepElement = this.createLegStep(step);
                if (stepElement) { // Filtre les étapes vides/undefined
                    stepsContent.appendChild(stepElement);
                }
            });
            this.stepsContainer.appendChild(stepsContent);
        });

        // Active le premier itinéraire par défaut
        if (this.currentRoutes.length > 0) {
            this.activateRouteTab(0);
        }
    }

    /**
     * Active un onglet d'itinéraire spécifique.
     * @param {number} index - L'index de l'itinéraire à activer.
     */
    activateRouteTab(index) {
        // Gère la classe active pour les onglets résumés
        this.summaryContainer.querySelectorAll('.itinerary-summary-tab').forEach((tab, i) => {
            tab.classList.toggle('active', i === index);
        });

        // Affiche le contenu des étapes correspondant
        this.stepsContainer.querySelectorAll('.itinerary-steps-content').forEach((content, i) => {
            content.style.display = (i === index)? 'block' : 'none';
        });

        // (Optionnel) Informe le mapRenderer pour afficher la bonne polyligne
        if (this.mapRenderer && this.mapRenderer.displayRoutePolyline) {
             this.mapRenderer.displayRoutePolyline(this.currentRoutes[index], index);
        }
    }

    /**
     * Crée l'élément DOM pour une seule étape d'itinéraire.
     * @param {object} step - L'objet étape (peut être de marche ou de transit).
     * @returns {HTMLElement | null} - L'élément DOM ou null si l'étape est invalide.
     */
    createLegStep(step) {
        // REGCorrection : Filtre les étapes vides ou "undefined"
        if (!step ||!step.instruction |

| step.instruction === 'undefined') {
            return null;
        }

        const stepElement = document.createElement('div');
        stepElement.className = 'itinerary-step';

        const startTime = step.startTime? new Date(step.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
        const endTime = step.endTime? new Date(step.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
        const duration = step.staticDuration? Math.round(step.staticDuration / 60) : 0; // en minutes

        let icon, detailsHtml, bgColor, textColor;

        if (step.travelMode === 'WALK') {
            icon = 'directions_walk';
            bgColor = '#FFFFFF'; // Fond blanc pour la marche
            textColor = '#333333'; // Texte sombre
            const distanceKm = (step.distanceMeters / 1000).toFixed(1);
            detailsHtml = `
                <strong>Marcher (${distanceKm} km)</strong>
                <p>${step.instruction}</p>
            `;
        } else if (step.travelMode === 'TRANSIT' && step.transit) {
            icon = 'directions_bus';
            const line = step.transit.line;
            
            // REGCorrection : Gère les données de bus si elles existent
            if (line && line.shortName && line.color) {
                bgColor = line.color |

| '#888888';
                textColor = this.getContrastColor(bgColor);
                detailsHtml = `
                    <div class="step-header" style="background-color: ${bgColor}; color: ${textColor};">
                        <span class="line-badge">${line.shortName}</span>
                        <strong>${line.headsign |

| step.instruction}</strong>
                    </div>
                    <div class="step-details">
                        <p>De: <strong>${step.transit.departureStop}</strong> (${startTime})</p>
                        <p>Vers: <strong>${step.transit.arrivalStop}</strong> (${endTime})</p>
                        <p>${step.transit.stopCount |

| '...'} arrêts (${duration} min)</p>
                    </div>
                `;
            } else {
                // Cas de secours si les détails de transit sont partiels
                bgColor = '#EEEEEE';
                textColor = '#333333';
                 detailsHtml = `
                    <strong>${step.instruction}</strong>
                    <p>De: ${step.transit.departureStop |

| 'Arrêt'} (${startTime})</p>
                    <p>Vers: ${step.transit.arrivalStop |

| 'Arrêt'} (${endTime})</p>
                `;
            }
        } else {
            // Autres modes (peu probable)
            icon = 'help';
            bgColor = '#EEEEEE';
            textColor = '#333333';
            detailsHtml = `<strong>${step.instruction}</strong>`;
        }
        
        stepElement.innerHTML = `
            <div class="step-icon" style="background-color: ${bgColor}; color: ${textColor};">
                <i class="material-icons">${icon}</i>
                <span class="step-time">${startTime}</span>
            </div>
            <div class="step-info">
                ${detailsHtml}
            </div>
        `;

        return stepElement;
    }

    /**
     * Calcule la couleur de texte (noir ou blanc) contrastante pour un fond.
     * @param {string} hexcolor - La couleur de fond (ex: "#FF0000").
     * @returns {string} - "#000000" (noir) ou "#FFFFFF" (blanc).
     */
    getContrastColor(hexcolor) {
        if (!hexcolor) return '#000000';
        hexcolor = hexcolor.replace('#', '');
        const r = parseInt(hexcolor.substr(0, 2), 16);
        const g = parseInt(hexcolor.substr(2, 2), 16);
        const b = parseInt(hexcolor.substr(4, 2), 16);
        // Formule YIQ pour la luminosité perçue
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128)? '#000000' : '#FFFFFF';
    }
}

// NOTE : Ce fichier expose la classe.
// Un autre fichier (ex: app.js ou index.js) doit :
// 1. Importer { RoutingService } from './routingService.js'
// 2. Définir la fonction `handleItineraryRequest` (qui utilise RoutingService)
// 3. Importer et instancier cette classe :
//
//    const appDataManager = new DataManager();
//    const appMapRenderer = new MapRenderer();
//
//    async function handleItineraryRequest(options) {
//        // C'est le VRAI searchCallback
//        // Il reçoit options.fromCoords et options.toCoords (fiables)
//        return await RoutingService.getItinerary(options.fromCoords, options.toCoords, options.isoDateTime, options.timeMode);
//    }
//
//    const planner = new PlannerPanel({
//        panel: document.getElementById('planner-panel'),
//        dataManager: appDataManager,
//        mapRenderer: appMapRenderer,
//        searchCallback: handleItineraryRequest
//    });
//
//    window.plannerPanel = planner; // La rendre globale si nécessaire
