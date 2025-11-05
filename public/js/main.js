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
        
        // Afficher les routes GeoJSON
        if (this.dataManager.geoJson) {
            this.mapRenderer.displayRoutes(this.dataManager.geoJson);
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
        
        // Calculer les positions
        const busesWithPositions = this.positionCalculator.calculateAllPositions(activeBuses);
        
        // Mettre à jour la carte
        this.mapRenderer.updateBusMarkers(busesWithPositions, this.tripScheduler);
        
        // Mettre à jour le compteur
        const busCount = this.mapRenderer.getBusCount();
        document.getElementById('bus-count').textContent = `${busCount} bus en circulation`;
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
