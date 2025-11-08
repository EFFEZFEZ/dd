/**
 * Fichier : /js/main.js
 *
 * Point d'entrée principal de l'application.
 * Gère l'initialisation de la carte, les panneaux et les interactions.
 *
 * NOUVEAU : Amélioration du rendu visuel de l'itinéraire sur la carte.
 */

import { MapRenderer } from './mapRenderer.js';
import { DataManager } from './dataManager.js';
import { RouteFilterPanel } from './routeFilterPanel.js';
import { PlannerPanel } from './plannerPanel.js';
import { SearchPanel } from './searchPanel.js';
import { RoutingService } from './routingService.js';

class App {
    constructor() {
        this.dataManager = new DataManager();
        this.mapRenderer = new MapRenderer('map', this.dataManager);
        this.routingService = new RoutingService();

        this.routeFilterPanel = new RouteFilterPanel('route-filter-panel', this.dataManager, (activeRoutes) => {
            this.mapRenderer.toggleRouteVisibility(activeRoutes);
        });

        this.plannerPanel = new PlannerPanel('planner-panel', this.dataManager, this.mapRenderer, this.handleSearchItinerary.bind(this));
        
        this.searchPanel = new SearchPanel('search-bar', 'search-results', this.mapRenderer, this.dataManager);

        this.initDOM();
        this.bindEvents();
        this.loadInitialData();
        this.updateClock(); // Pour lancer l'horloge
        setInterval(() => this.updateClock(), 1000); // Mettre à jour toutes les secondes
        setInterval(() => this.dataManager.updateBusPositions(), 15000); // Toutes les 15 secondes
    }

    initDOM() {
        this.topBar = document.getElementById('top-bar');
        this.btnToggleFilter = document.getElementById('btn-toggle-filter');
        this.btnCloseFilter = document.getElementById('close-filter');
        this.btnTogglePlanner = document.getElementById('btn-toggle-planner');
        this.btnClosePlanner = document.getElementById('close-planner');
        this.clockElement = document.getElementById('current-time');
        this.dateIndicator = document.getElementById('date-indicator');
        this.busCountElement = document.getElementById('bus-count');
        this.dataStatusElement = document.getElementById('data-status');
        this.modeBanner = document.getElementById('mode-banner');
        this.instructionsPanel = document.getElementById('instructions');
        this.closeInstructionsBtn = document.getElementById('close-instructions');

        // Afficher les instructions si c'est la première visite
        if (!localStorage.getItem('instructionsShown')) {
            this.instructionsPanel.classList.remove('hidden');
        }
    }

    bindEvents() {
        this.btnToggleFilter.addEventListener('click', () => {
            this.routeFilterPanel.togglePanel();
        });
        this.btnCloseFilter.addEventListener('click', () => {
            this.routeFilterPanel.hidePanel();
        });
        this.btnTogglePlanner.addEventListener('click', () => {
            this.plannerPanel.togglePanel();
        });
        this.btnClosePlanner.addEventListener('click', () => {
            this.plannerPanel.hidePanel();
        });
        this.closeInstructionsBtn.addEventListener('click', () => {
            this.instructionsPanel.classList.add('hidden');
            localStorage.setItem('instructionsShown', 'true');
        });

        // Écouteur pour les clics sur les arrêts
        this.mapRenderer.map.on('click', (e) => {
            const feature = this.mapRenderer.getFeatureAtLatLng(e.latlng);
            if (feature && feature.properties && feature.properties.type === 'stop') {
                this.searchPanel.selectStop(feature.properties.id);
            }
        });

        // Écouteur pour la mise à jour des positions (à définir dans dataManager)
        document.addEventListener('busPositionsUpdated', (e) => {
            this.mapRenderer.updateBusMarkers(e.detail.busPositions);
            this.updateBusCount(e.detail.busPositions.length);
            this.updateDataStatus(true); // Indique que les données sont à jour
        });
        document.addEventListener('busPositionsError', () => {
            this.updateDataStatus(false); // Indique une erreur
        });
    }

    async loadInitialData() {
        this.dataManager.loadGTFSData().then(() => {
            this.dataManager.loadMapGeoJSON().then(geojson => {
                this.mapRenderer.renderRoutes(geojson.features);
                this.mapRenderer.renderStops(geojson.features);
                this.routeFilterPanel.initCheckboxes(this.dataManager.getAllRoutes());
                this.mapRenderer.centerMapOnRoutes(this.dataManager.getAllRoutes());
                this.dataManager.updateBusPositions(); // Lancer la première mise à jour des bus
            }).catch(error => {
                this.showGlobalError("Erreur de chargement du fichier map.geojson : " + error.message);
            });
        }).catch(error => {
            this.showGlobalError("Erreur de chargement des données GTFS : " + error.message);
        });
    }

    updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateString = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        this.clockElement.textContent = timeString;
        this.dateIndicator.textContent = dateString + '.';
    }

    updateBusCount(count) {
        this.busCountElement.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10"/>
            </svg>
            ${count} bus
        `;
    }

    updateDataStatus(isOk) {
        if (isOk) {
            this.dataStatusElement.textContent = 'Données chargées';
            this.dataStatusElement.style.color = 'green';
        } else {
            this.dataStatusElement.textContent = 'Erreur de chargement';
            this.dataStatusElement.style.color = 'red';
        }
    }

    showGlobalError(message) {
        this.modeBanner.textContent = message;
        this.modeBanner.classList.remove('hidden');
        this.modeBanner.style.backgroundColor = '#f44336'; // Rouge pour erreur
    }

    /**
     * Gère la recherche d'itinéraire et son affichage.
     */
    async handleSearchItinerary(from, to) {
        this.mapRenderer.clearItineraryLayers(); // Nettoie l'ancien itinéraire
        const result = await this.routingService.getDirections(from, to);

        if (result.error) {
            this.plannerPanel.showError(result.error);
            return;
        }

        this.plannerPanel.displayItinerary(result.data);
        this.displayItineraryOnMap(result.data); // Affiche le nouvel itinéraire sur la carte
    }

    /**
     * Affiche visuellement l'itinéraire sur la carte,
     * en distinguant les trajets en bus et à pied.
     */
    displayItineraryOnMap(itineraryData) {
        if (!itineraryData.routes || itineraryData.routes.length === 0) {
            return;
        }

        const route = itineraryData.routes[0];
        const leg = route.legs[0];

        leg.steps.forEach(step => {
            const polylinePoints = [];
            step.lat_lngs.forEach(coord => {
                polylinePoints.push([coord.lat, coord.lng]);
            });

            let polylineStyle = {};

            if (step.travel_mode === 'WALKING') {
                polylineStyle = {
                    color: '#888', // Gris pour la marche
                    weight: 3,
                    opacity: 0.7,
                    dashArray: '5, 10' // Trait en pointillés
                };
            } else if (step.travel_mode === 'TRANSIT') {
                const transit = step.transit_details;
                const lineColor = transit.line.color || '#007bff'; // Couleur de la ligne de bus, ou bleu par défaut
                
                polylineStyle = {
                    color: lineColor,
                    weight: 6, // Plus épais pour le bus
                    opacity: 0.9
                };

                // Optionnel: Ajouter un popup pour le bus
                const popupContent = `
                    <strong>Ligne ${transit.line.short_name || transit.line.name}</strong><br>
                    De ${transit.departure_stop.name} à ${transit.arrival_stop.name}<br>
                    Direction ${transit.headsign}
                `;
                L.polyline(polylinePoints, polylineStyle).addTo(this.mapRenderer.itineraryLayer).bindPopup(popupContent);
                return; // On a déjà ajouté la ligne avec le popup, on passe au suivant
            } else {
                // Autres modes (voiture, vélo, etc.) - bleu par défaut
                polylineStyle = {
                    color: '#007bff', 
                    weight: 5, 
                    opacity: 0.8 
                };
            }
            
            L.polyline(polylinePoints, polylineStyle).addTo(this.mapRenderer.itineraryLayer);
        });

        // Ajuster la vue de la carte pour montrer tout l'itinéraire
        const bounds = new L.LatLngBounds([]);
        leg.steps.forEach(step => {
            step.lat_lngs.forEach(coord => {
                bounds.extend([coord.lat, coord.lng]);
            });
        });
        if (bounds.isValid()) {
            this.mapRenderer.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
}

// Initialisation de l'application une fois que le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
