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

// Catégories de lignes selon la structure officielle de Péribus
const LINE_CATEGORIES = {
    'majeures': {
        name: 'Lignes majeures',
        lines: ['A', 'B', 'C', 'D'],
        color: '#2563eb'
    },
    'express': {
        name: 'Lignes express',
        lines: ['e1', 'e4', 'e5', 'e6', 'e7'],
        color: '#dc2626'
    },
    'quartier': {
        name: 'Lignes de quartier',
        lines: ['K1A', 'K1B', 'K2', 'K3A', 'K3B', 'K4A', 'K4B', 'K5', 'K6'],
        color: '#059669'
    },
    'rabattement': {
        name: 'Lignes de rabattement',
        lines: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14'],
        color: '#7c3aed'
    },
    'navettes': {
        name: 'Navettes',
        lines: ['N', 'N1'],
        color: '#f59e0b'
    }
};

function getCategoryForRoute(routeShortName) {
    for (const [categoryId, category] of Object.entries(LINE_CATEGORIES)) {
        if (category.lines.includes(routeShortName)) {
            return categoryId;
        }
    }
    return 'autres';
}

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
    
    // Organiser les routes par catégorie
    const routesByCategory = {};
    Object.keys(LINE_CATEGORIES).forEach(cat => {
        routesByCategory[cat] = [];
    });
    routesByCategory['autres'] = [];
    
    dataManager.routes.forEach(route => {
        visibleRoutes.add(route.route_id);
        const category = getCategoryForRoute(route.route_short_name);
        routesByCategory[category].push(route);
    });
    
    // Créer l'interface par catégorie
    Object.entries(LINE_CATEGORIES).forEach(([categoryId, categoryInfo]) => {
        const routes = routesByCategory[categoryId];
        if (routes.length === 0) return;
        
        // En-tête de catégorie
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <div class="category-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${categoryInfo.color}">
                    <circle cx="12" cy="12" r="10"/>
                </svg>
                <strong>${categoryInfo.name}</strong>
                <span class="category-count">(${routes.length})</span>
            </div>
            <div class="category-actions">
                <button class="btn-category-action" data-category="${categoryId}" data-action="select">Tous</button>
                <button class="btn-category-action" data-category="${categoryId}" data-action="deselect">Aucun</button>
            </div>
        `;
        routeCheckboxesContainer.appendChild(categoryHeader);
        
        // Container des routes de cette catégorie
        const categoryContainer = document.createElement('div');
        categoryContainer.className = 'category-routes';
        categoryContainer.id = `category-${categoryId}`;
        
        routes.forEach(route => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'route-checkbox-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `route-${route.route_id}`;
            checkbox.checked = true;
            checkbox.dataset.category = categoryId;
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
            categoryContainer.appendChild(itemDiv);
        });
        
        routeCheckboxesContainer.appendChild(categoryContainer);
    });
    
    // Ajouter les routes "autres" s'il y en a
    if (routesByCategory['autres'].length > 0) {
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <div class="category-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#64748b">
                    <circle cx="12" cy="12" r="10"/>
                </svg>
                <strong>Autres lignes</strong>
                <span class="category-count">(${routesByCategory['autres'].length})</span>
            </div>
            <div class="category-actions">
                <button class="btn-category-action" data-category="autres" data-action="select">Tous</button>
                <button class="btn-category-action" data-category="autres" data-action="deselect">Aucun</button>
            </div>
        `;
        routeCheckboxesContainer.appendChild(categoryHeader);
        
        const categoryContainer = document.createElement('div');
        categoryContainer.className = 'category-routes';
        categoryContainer.id = 'category-autres';
        
        routesByCategory['autres'].forEach(route => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'route-checkbox-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `route-${route.route_id}`;
            checkbox.checked = true;
            checkbox.dataset.category = 'autres';
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
            categoryContainer.appendChild(itemDiv);
        });
        
        routeCheckboxesContainer.appendChild(categoryContainer);
    }
    
    // Ajouter les événements pour les boutons de catégorie
    document.querySelectorAll('.btn-category-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            const action = e.target.dataset.action;
            handleCategoryAction(category, action);
        });
    });
}

function handleCategoryAction(category, action) {
    const checkboxes = document.querySelectorAll(`input[data-category="${category}"]`);
    checkboxes.forEach(checkbox => {
        checkbox.checked = (action === 'select');
    });
    handleRouteFilterChange();
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
    
    timeManager.addListener(updateData);
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
