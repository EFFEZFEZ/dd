/**
 * main.js
 * Point d'entrée principal de l'application
 * Orchestre tous les modules et gère l'interface utilisateur
 */

import { DataManager } from './dataManager.js';
import { TimeManager } from './timeManager.js';
import { TripScheduler } from './tripScheduler.js';
import { BusPositionCalculator } from './busPositionCalculator.js';
import { MapRenderer } from './mapRenderer.js';

let dataManager;
let timeManager;
let tripScheduler;
let busPositionCalculator;
let mapRenderer;
let visibleRoutes = new Set();

async function initializeApp() {
    dataManager = new DataManager();
    
    try {
        await dataManager.loadAllData();
        
        mapRenderer = new MapRenderer('map');
        mapRenderer.initializeMap();
        
        timeManager = new TimeManager();
        tripScheduler = new TripScheduler(dataManager);
        busPositionCalculator = new BusPositionCalculator(dataManager);
        
        initializeRouteFilter();
        
        if (dataManager.geoJson) {
            mapRenderer.displayMultiColorRoutes(dataManager.geoJson, dataManager, visibleRoutes);
        }
        
        // Afficher les marqueurs d'arrêts
        mapRenderer.displayStopMarkers(dataManager);
        
        setupEventListeners();
        
        document.getElementById('instructions').classList.remove('hidden');
        updateDataStatus('Données chargées', 'loaded');
        
        checkAndSetupTimeMode();
        
        updateData();
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        updateDataStatus('Erreur de chargement', 'error');
    }
}

function checkAndSetupTimeMode() {
    const now = timeManager.getRealTime();
    const activeTripsNow = dataManager.getActiveTrips(now);
    
    if (activeTripsNow.length === 0) {
        const firstActiveTime = dataManager.findFirstActiveSecond();
        timeManager.setMode('simulated');
        timeManager.setTime(firstActiveTime);
        
        const timeStr = timeManager.formatTime(firstActiveTime);
        showModeBanner(`Mode simulation - affichage à ${timeStr}`);
        console.log(`🎭 Aucun bus actif à l'heure actuelle. Passage en mode simulation à ${timeStr}`);
    } else {
        timeManager.setMode('real');
        console.log('⏰ Mode temps réel activé - des bus sont actuellement en service');
    }
    
    timeManager.play();
}

function showModeBanner(message) {
    const banner = document.getElementById('mode-banner');
    if (banner) {
        banner.textContent = message;
        banner.classList.remove('hidden');
    }
}

function hideModeBanner() {
    const banner = document.getElementById('mode-banner');
    if (banner) {
        banner.classList.add('hidden');
    }
}

function initializeRouteFilter() {
    const routeCheckboxesContainer = document.getElementById('route-checkboxes');
    routeCheckboxesContainer.innerHTML = '';
    
    visibleRoutes.clear();
    dataManager.routes.forEach(route => {
        visibleRoutes.add(route.route_id);
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'route-checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `route-${route.route_id}`;
        checkbox.checked = true;
        checkbox.addEventListener('change', () => handleRouteFilterChange());
        
        const routeColor = route.route_color ? `#${route.route_color}` : '#3388ff';
        const textColor = route.route_text_color ? `#${route.route_text_color}` : '#ffffff';
        
        const badge = document.createElement('div');
        badge.className = 'route-badge';
        badge.style.backgroundColor = routeColor;
        badge.style.color = textColor;
        badge.textContent = route.route_short_name || route.route_id;
        
        const label = document.createElement('span');
        label.className = 'route-name';
        label.textContent = route.route_long_name || route.route_short_name || route.route_id;
        
        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(badge);
        itemDiv.appendChild(label);
        routeCheckboxesContainer.appendChild(itemDiv);
    });
}

function handleRouteFilterChange() {
    visibleRoutes.clear();
    
    dataManager.routes.forEach(route => {
        const checkbox = document.getElementById(`route-${route.route_id}`);
        if (checkbox && checkbox.checked) {
            visibleRoutes.add(route.route_id);
        }
    });
    
    if (dataManager.geoJson) {
        mapRenderer.displayMultiColorRoutes(dataManager.geoJson, dataManager, visibleRoutes);
    }
    
    updateData();
}

function setupEventListeners() {
    document.getElementById('btn-play').addEventListener('click', () => {
        timeManager.play();
    });
    
    document.getElementById('btn-pause').addEventListener('click', () => {
        timeManager.pause();
    });
    
    document.getElementById('btn-refresh').addEventListener('click', () => {
        timeManager.reset();
    });
    
    document.getElementById('close-instructions').addEventListener('click', () => {
        document.getElementById('instructions').classList.add('hidden');
    });
    
    document.getElementById('btn-toggle-filter').addEventListener('click', () => {
        document.getElementById('route-filter-panel').classList.toggle('hidden');
    });
    
    document.getElementById('close-filter').addEventListener('click', () => {
        document.getElementById('route-filter-panel').classList.add('hidden');
    });
    
    document.getElementById('select-all-routes').addEventListener('click', () => {
        dataManager.routes.forEach(route => {
            const checkbox = document.getElementById(`route-${route.route_id}`);
            if (checkbox) checkbox.checked = true;
        });
        handleRouteFilterChange();
    });
    
    document.getElementById('deselect-all-routes').addEventListener('click', () => {
        dataManager.routes.forEach(route => {
            const checkbox = document.getElementById(`route-${route.route_id}`);
            if (checkbox) checkbox.checked = false;
        });
        handleRouteFilterChange();
    });
    
    document.getElementById('btn-real-time').addEventListener('click', () => {
        const now = timeManager.getRealTime();
        const activeTripsNow = dataManager.getActiveTrips(now);
        
        if (activeTripsNow.length > 0) {
            timeManager.setMode('real');
            timeManager.play();
            hideModeBanner();
        } else {
            showModeBanner('Aucun bus en circulation à l\'heure actuelle');
            setTimeout(() => hideModeBanner(), 3000);
        }
    });
    
    document.getElementById('btn-speed-1x').addEventListener('click', () => setSpeed(1));
    document.getElementById('btn-speed-2x').addEventListener('click', () => setSpeed(2));
    document.getElementById('btn-speed-5x').addEventListener('click', () => setSpeed(5));
    document.getElementById('btn-speed-10x').addEventListener('click', () => setSpeed(10));
    
    timeManager.addListener(updateData);
}

function setSpeed(multiplier) {
    timeManager.setSpeed(multiplier);
    
    document.querySelectorAll('.btn-speed').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`btn-speed-${multiplier}x`).classList.add('active');
    
    if (timeManager.getIsSimulated()) {
        const timeStr = timeManager.formatTime(timeManager.getCurrentSeconds());
        showModeBanner(`Mode simulation x${multiplier} - affichage à ${timeStr}`);
    }
}


function updateData(timeInfo) {
    const currentSeconds = timeInfo ? timeInfo.seconds : timeManager.getCurrentSeconds();
    updateClock(currentSeconds);
    
    const activeTrips = tripScheduler.getActiveTrips(currentSeconds);
    
    const busesWithPositions = activeTrips
        .map(tripInfo => {
            const routeId = tripInfo.route?.route_id;
            const position = busPositionCalculator.calculatePosition(tripInfo.segment, routeId);
            if (position) {
                return {
                    tripId: tripInfo.tripId,
                    route: tripInfo.route,
                    position: position,
                    segment: tripInfo.segment,
                    currentSeconds: currentSeconds
                };
            }
            return null;
        })
        .filter(bus => bus !== null)
        .filter(bus => visibleRoutes.has(bus.route.route_id));
    
    mapRenderer.updateBusMarkers(busesWithPositions, tripScheduler, currentSeconds);
    
    const visibleBusCount = busesWithPositions.length;
    const totalBusCount = activeTrips.length;
    updateBusCount(visibleBusCount, totalBusCount);
}

function updateClock(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById('current-time').textContent = timeString;
    
    const now = new Date();
    const dateString = now.toLocaleDateString('fr-FR', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
    });
    document.getElementById('date-indicator').textContent = dateString;
}

function updateBusCount(visible, total) {
    const busCountElement = document.getElementById('bus-count');
    if (total === visible) {
        busCountElement.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10"/>
            </svg>
            ${visible} bus
        `;
    } else {
        busCountElement.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10"/>
            </svg>
            ${visible} / ${total} bus
        `;
    }
}

function updateDataStatus(message, status = '') {
    const statusElement = document.getElementById('data-status');
    statusElement.textContent = message;
    statusElement.className = status;
}

initializeApp();
