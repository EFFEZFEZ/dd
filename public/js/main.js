/**
 * main.js
 * 
 * Orchestre l'application complète - point d'entrée principal
 */

import { DataManager } from './dataManager.js';
import { TimeManager } from './timeManager.js';
import { TripScheduler } from './tripScheduler.js';
import { BusPositionCalculator } from './busPositionCalculator.js';
import { MapRenderer } from './mapRenderer.js';

class GTFSVisualizationApp {
    constructor() {
        // Initialiser les modules
        this.dataManager = new DataManager();
        this.timeManager = new TimeManager();
        this.tripScheduler = null;
        this.positionCalculator = null;
        this.mapRenderer = new MapRenderer('map');
        
        // État de l'application
        this.isInitialized = false;
        
        // État du filtrage des lignes
        this.visibleRoutes = new Set(); // Ensemble des route_id visibles
        this.allRoutes = []; // Liste de toutes les routes disponibles
    }

    /**
     * Initialise l'application
     */
    async initialize() {
        console.log('🚀 Démarrage de l\'application GTFS Visualization...');

        // Initialiser la carte
        this.mapRenderer.initializeMap();

        // Configurer les contrôles UI
        this.setupUIControls();

        // Charger les données GTFS et GeoJSON
        try {
            await this.loadData();
        } catch (error) {
            this.showError('Erreur lors du chargement des données. Vérifiez que vos fichiers GTFS et GeoJSON sont bien placés dans /public/data/');
            return;
        }

        // Initialiser les autres modules
        this.tripScheduler = new TripScheduler(this.dataManager);
        this.positionCalculator = new BusPositionCalculator(this.dataManager);

        // Configurer le listener de temps
        this.timeManager.addListener((timeInfo) => {
            this.onTimeUpdate(timeInfo);
        });

        this.isInitialized = true;
        this.hideInstructions();
        this.updateStatus('Prêt - Cliquez sur Démarrer pour voir les bus en temps réel', true);
        
        console.log('✅ Application initialisée avec succès!');
    }

    /**
     * Charge les données GTFS et GeoJSON
     */
    async loadData() {
        this.updateStatus('Chargement des données...', false);
        
        await this.dataManager.loadAllData();
        
        // Initialiser toutes les routes comme visibles
        this.allRoutes = this.dataManager.routes;
        this.allRoutes.forEach(route => {
            this.visibleRoutes.add(route.route_id);
        });
        
        // Créer le panneau de filtrage
        this.createRouteFilterPanel();
        
        // Afficher les routes GeoJSON avec multi-couleurs
        if (this.dataManager.geoJson) {
            this.mapRenderer.displayMultiColorRoutes(this.dataManager.geoJson, this.dataManager, this.visibleRoutes);
        }
        
        this.updateStatus('Données chargées', true);
    }

    /**
     * Configure les contrôles de l'interface utilisateur
     */
    setupUIControls() {
        // Bouton Démarrer
        document.getElementById('btn-play').addEventListener('click', () => {
            if (this.isInitialized) {
                this.timeManager.play();
            }
        });

        // Bouton Pause
        document.getElementById('btn-pause').addEventListener('click', () => {
            this.timeManager.pause();
        });

        // Bouton Actualiser
        document.getElementById('btn-refresh').addEventListener('click', () => {
            this.timeManager.reset();
            this.updateBusDisplay();
        });

        // Bouton fermer les instructions
        document.getElementById('close-instructions').addEventListener('click', () => {
            this.hideInstructions();
        });

        // Bouton toggle panneau de filtrage
        document.getElementById('btn-toggle-filter').addEventListener('click', () => {
            this.toggleFilterPanel();
        });

        // Bouton fermer le panneau de filtrage
        document.getElementById('close-filter').addEventListener('click', () => {
            this.toggleFilterPanel();
        });

        // Boutons sélectionner toutes/aucune
        document.getElementById('select-all-routes').addEventListener('click', () => {
            this.selectAllRoutes(true);
        });

        document.getElementById('deselect-all-routes').addEventListener('click', () => {
            this.selectAllRoutes(false);
        });
    }

    /**
     * Toggle le panneau de filtrage des lignes
     */
    toggleFilterPanel() {
        const panel = document.getElementById('route-filter-panel');
        panel.classList.toggle('hidden');
    }

    /**
     * Crée le panneau de filtrage des lignes
     */
    createRouteFilterPanel() {
        const container = document.getElementById('route-checkboxes');
        container.innerHTML = '';

        // Trier les routes par route_short_name
        const sortedRoutes = [...this.allRoutes].sort((a, b) => {
            const nameA = a.route_short_name || a.route_id;
            const nameB = b.route_short_name || b.route_id;
            return nameA.localeCompare(nameB);
        });

        sortedRoutes.forEach(route => {
            const routeId = route.route_id;
            const routeShortName = route.route_short_name || route.route_id;
            const routeLongName = route.route_long_name || '';
            const routeColor = route.route_color ? `#${route.route_color}` : '#3388ff';
            const textColor = route.route_text_color ? `#${route.route_text_color}` : '#ffffff';

            const item = document.createElement('div');
            item.className = 'route-checkbox-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `route-${routeId}`;
            checkbox.checked = this.visibleRoutes.has(routeId);
            checkbox.addEventListener('change', (e) => {
                this.onRouteFilterChange(routeId, e.target.checked);
            });

            const badge = document.createElement('span');
            badge.className = 'route-badge';
            badge.style.backgroundColor = routeColor;
            badge.style.color = textColor;
            badge.textContent = routeShortName;

            const name = document.createElement('span');
            name.className = 'route-name';
            name.textContent = routeLongName;

            item.appendChild(checkbox);
            item.appendChild(badge);
            item.appendChild(name);

            // Cliquer sur l'item toggle le checkbox
            item.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });

            container.appendChild(item);
        });
    }

    /**
     * Gère le changement de filtre de route
     */
    onRouteFilterChange(routeId, isVisible) {
        if (isVisible) {
            this.visibleRoutes.add(routeId);
        } else {
            this.visibleRoutes.delete(routeId);
        }

        // Mettre à jour l'affichage des routes avec multi-couleurs
        if (this.dataManager.geoJson) {
            this.mapRenderer.displayMultiColorRoutes(this.dataManager.geoJson, this.dataManager, this.visibleRoutes);
        }

        // Mettre à jour l'affichage des bus
        this.updateBusDisplay();
    }

    /**
     * Sélectionne toutes les routes ou aucune
     */
    selectAllRoutes(selectAll) {
        this.allRoutes.forEach(route => {
            const checkbox = document.getElementById(`route-${route.route_id}`);
            if (checkbox) {
                checkbox.checked = selectAll;
                if (selectAll) {
                    this.visibleRoutes.add(route.route_id);
                } else {
                    this.visibleRoutes.delete(route.route_id);
                }
            }
        });

        // Mettre à jour l'affichage
        if (this.dataManager.geoJson) {
            this.mapRenderer.displayMultiColorRoutes(this.dataManager.geoJson, this.dataManager, this.visibleRoutes);
        }
        this.updateBusDisplay();
    }

    /**
     * Appelé à chaque mise à jour du temps
     */
    onTimeUpdate(timeInfo) {
        // Mettre à jour l'affichage de l'horloge avec l'heure réelle
        document.getElementById('current-time').textContent = timeInfo.timeString;
        
        // Afficher la date
        const date = timeInfo.date;
        const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
        document.getElementById('date-indicator').textContent = dateStr;
        
        // Mettre à jour les bus si le mode temps réel est actif
        if (timeInfo.isRunning) {
            this.updateBusDisplay();
        }
    }

    /**
     * Met à jour l'affichage des bus sur la carte
     */
    updateBusDisplay() {
        if (!this.isInitialized) return;

        const currentSeconds = this.timeManager.getCurrentSeconds();
        
        // Récupérer les bus actifs
        const activeBuses = this.tripScheduler.getActiveBuses(currentSeconds);
        
        // Filtrer les bus selon les routes visibles
        const filteredBuses = activeBuses.filter(bus => {
            return this.visibleRoutes.has(bus.route?.route_id);
        });
        
        // Calculer les positions
        const busesWithPositions = this.positionCalculator.calculateAllPositions(filteredBuses);
        
        // Mettre à jour la carte avec mise à jour en temps réel des popups
        this.mapRenderer.updateBusMarkers(busesWithPositions, this.tripScheduler, currentSeconds);
        
        // Mettre à jour le compteur
        const busCount = this.mapRenderer.getBusCount();
        const totalBuses = activeBuses.length;
        document.getElementById('bus-count').textContent = `${busCount}/${totalBuses} bus en circulation`;
    }

    /**
     * Met à jour le statut affiché
     */
    updateStatus(message, isLoaded) {
        const statusElement = document.getElementById('data-status');
        statusElement.textContent = message;
        statusElement.className = isLoaded ? 'loaded' : '';
    }

    /**
     * Affiche un message d'erreur
     */
    showError(message) {
        this.updateStatus(message, false);
        document.getElementById('data-status').classList.add('error');
        console.error('❌', message);
    }

    /**
     * Cache le panneau d'instructions
     */
    hideInstructions() {
        document.getElementById('instructions').classList.add('hidden');
    }
}

// Démarrer l'application au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    const app = new GTFSVisualizationApp();
    app.initialize();
});
