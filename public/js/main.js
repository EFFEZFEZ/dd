/**
 * main.js
 *
 * Fichier principal de l'application.
 *
 * CORRECTION FINALE (v3) :
 * 1. L'appel à 'initializeApp()' est enveloppé dans un écouteur
 * 'DOMContentLoaded'.
 * 2. Cela garantit que le script attend que le HTML (ex: les boutons)
 * soit entièrement chargé avant d'essayer de leur attacher
 * des 'EventListeners', ce qui corrige l'erreur 'cannot read... of null'.
 */

// Imports des modules de logique
import { DataManager } from './dataManager.js';
import { TimeManager } from './timeManager.js';
import { TripScheduler } from './tripScheduler.js';
import { BusPositionCalculator } from './busPositionCalculator.js';
import { MapRenderer } from './mapRenderer.js';

// Imports des modules UI et Services
import { RoutingService } from './routingService.js';
import { PlannerPanel } from './plannerPanel.js'; 

// Variables globales de l'application
let dataManager;
let timeManager;
let tripScheduler;
let busPositionCalculator;
let mapRenderer;
let visibleRoutes = new Set();
let routingService; 
let plannerPanel;
let isPlannerMode = false;

// (Toute la section LINE_CATEGORIES et getCategoryForRoute reste identique)
const LINE_CATEGORIES = {
    'majeures': { name: 'Lignes majeures', lines: ['A', 'B', 'C', 'D'], color: '#2563eb' },
    'express': { name: 'Lignes express', lines: ['e1', 'e2', 'e4', 'e5', 'e6', 'e7'], color: '#dc2626' },
    'quartier': { name: 'Lignes de quartier', lines: ['K1A', 'K1B', 'K2', 'K3A', 'K3B', 'K4A', 'K4B', 'K5', 'K6'], color: '#059669' },
    'rabattement': { name: 'Lignes de rabattement', lines: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15'], color: '#7c3aed' },
    'navettes': { name: 'Navettes', lines: ['N', 'N1'], color: '#f59e0b' }
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
        
        timeManager = new TimeManager();
        
        mapRenderer = new MapRenderer('map', dataManager, timeManager);
        mapRenderer.initializeMap();
        
        tripScheduler = new TripScheduler(dataManager);
        busPositionCalculator = new BusPositionCalculator(dataManager);
        
        // Assigne l'objet importé
        routingService = RoutingService; 

        // Initialise le panneau de planification
        plannerPanel = new PlannerPanel(
            'planner-panel', 
            dataManager, 
            mapRenderer, 
            handleItineraryRequest // Fonction 'callback'
        );

        initializeRouteFilter();
        showDefaultMap();
        mapRenderer.displayStops();
        
        // CETTE LIGNE NE PLANTERA PLUS
        setupEventListeners(); 
        
        if (localStorage.getItem('gtfsInstructionsShown') !== 'true') {
            document.getElementById('instructions').classList.remove('hidden');
        }
        
        updateDataStatus('Données chargées', 'loaded');
        checkAndSetupTimeMode();
        updateData(); 
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        updateDataStatus('Erreur de chargement', 'error');
    }
}

// (checkAndSetupTimeMode reste identique)
function checkAndSetupTimeMode() {
    timeManager.setMode('real');
    timeManager.play();
    console.log('⏰ Mode TEMPS RÉEL activé.');
}

// (initializeRouteFilter, handleCategoryAction, handleRouteFilterChange restent identiques)
function initializeRouteFilter() {
    const routeCheckboxesContainer = document.getElementById('route-checkboxes');
    routeCheckboxesContainer.innerHTML = '';
    visibleRoutes.clear();
    const routesByCategory = {};
    Object.keys(LINE_CATEGORIES).forEach(cat => routesByCategory[cat] = []);
    routesByCategory['autres'] = [];
    dataManager.routes.forEach(route => {
        visibleRoutes.add(route.route_id);
        const category = getCategoryForRoute(route.route_short_name);
        routesByCategory[category].push(route);
    });
    Object.values(routesByCategory).forEach(routes => {
        routes.sort((a, b) => {
            const nameA = a.route_short_name;
            const nameB = b.route_short_name;
            const isRLineA = nameA.startsWith('R') && !isNaN(parseInt(nameA.substring(1)));
            const isRLineB = nameB.startsWith('R') && !isNaN(parseInt(nameB.substring(1)));
            if (isRLineA && isRLineB) return parseInt(nameA.substring(1)) - parseInt(nameB.substring(1));
            return nameA.localeCompare(nameB);
        });
    });
    Object.entries(LINE_CATEGORIES).forEach(([categoryId, categoryInfo]) => {
        const routes = routesByCategory[categoryId];
        if (routes.length === 0) return;
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <div class="category-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${categoryInfo.color}"><circle cx="12" cy="12" r="10"/></svg>
                <strong>${categoryInfo.name}</strong>
                <span class="category-count">(${routes.length})</span>
            </div>
            <div class="category-actions">
                <button class="btn-category-action" data-category="${categoryId}" data-action="select">Tous</button>
                <button class="btn-category-action" data-category="${categoryId}" data-action="deselect">Aucun</button>
            </div>
        `;
        routeCheckboxesContainer.appendChild(categoryHeader);
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
            itemDiv.addEventListener('mouseenter', () => mapRenderer.highlightRoute(route.route_id, true));
            itemDiv.addEventListener('mouseleave', () => mapRenderer.highlightRoute(route.route_id, false));
            itemDiv.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') return;
                mapRenderer.zoomToRoute(route.route_id);
            });
        });
        routeCheckboxesContainer.appendChild(categoryContainer);
    });
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
    if (isPlannerMode) {
        exitPlannerMode();
    } else if (dataManager.geoJson) {
        mapRenderer.displayMultiColorRoutes(dataManager.geoJson, dataManager, visibleRoutes);
    }
    updateData();
}

// (setupEventListeners reste identique)
function setupEventListeners() {
    document.getElementById('close-instructions').addEventListener('click', () => {
        document.getElementById('instructions').classList.add('hidden');
        localStorage.setItem('gtfsInstructionsShown', 'true');
    });
    document.getElementById('btn-toggle-filter').addEventListener('click', () => {
        document.getElementById('route-filter-panel').classList.toggle('hidden');
        document.getElementById('planner-panel').classList.add('hidden');
        if (isPlannerMode) exitPlannerMode();
    });
    document.getElementById('close-filter').addEventListener('click', () => {
        document.getElementById('route-filter-panel').classList.add('hidden');
    });
    document.getElementById('btn-toggle-planner').addEventListener('click', () => {
        document.getElementById('planner-panel').classList.toggle('hidden');
        document.getElementById('route-filter-panel').classList.add('hidden');
    });
    document.getElementById('close-planner').addEventListener('click', () => {
        document.getElementById('planner-panel').classList.add('hidden');
        if (isPlannerMode) {
            exitPlannerMode();
        }
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
    timeManager.addListener(updateData);
    const searchBar = document.getElementById('search-bar');
    const searchResultsContainer = document.getElementById('search-results');
    searchBar.addEventListener('input', handleSearchInput);
    searchBar.addEventListener('focus', handleSearchInput); 
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResultsContainer.classList.add('hidden');
        }
    });
    if (mapRenderer && mapRenderer.map) {
        mapRenderer.map.on('zoomend', () => {
            if (dataManager && !isPlannerMode) { 
                mapRenderer.displayStops();
            }
        });
    }
}

// (handleSearchInput, displaySearchResults, onSearchResultClick restent identiques)
function handleSearchInput(e) {
    const query = e.target.value.toLowerCase();
    const searchResultsContainer = document.getElementById('search-results');
    if (query.length < 2) {
        searchResultsContainer.classList.add('hidden');
        searchResultsContainer.innerHTML = '';
        return;
    }
    const matches = dataManager.masterStops
        .filter(stop => stop.stop_name.toLowerCase().includes(query))
        .slice(0, 10); 
    displaySearchResults(matches, query);
}
function displaySearchResults(stops, query) {
    const searchResultsContainer = document.getElementById('search-results');
    searchResultsContainer.innerHTML = '';
    if (stops.length === 0) {
        searchResultsContainer.innerHTML = `<div class="search-result-item">Aucun arrêt trouvé.</div>`;
        searchResultsContainer.classList.remove('hidden');
        return;
    }
    stops.forEach(stop => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        const regex = new RegExp(`(${query})`, 'gi');
        item.innerHTML = stop.stop_name.replace(regex, '<strong>$1</strong>');
        item.addEventListener('click', () => onSearchResultClick(stop));
        searchResultsContainer.appendChild(item);
    });
    searchResultsContainer.classList.remove('hidden');
}
function onSearchResultClick(stop) {
    mapRenderer.zoomToStop(stop);
    document.getElementById('search-bar').value = stop.stop_name;
    document.getElementById('search-results').classList.add('hidden');
}

// (showDefaultMap et exitPlannerMode restent identiques)
function showDefaultMap() {
    isPlannerMode = false;
    if (dataManager.geoJson) {
        mapRenderer.displayMultiColorRoutes(dataManager.geoJson, dataManager, visibleRoutes);
    }
    mapRenderer.showBusMarkers();
    mapRenderer.displayStops();
}
function exitPlannerMode() {
    isPlannerMode = false;
    mapRenderer.clearItinerary(); 
    showDefaultMap(); 
    document.getElementById('planner-panel').classList.add('hidden');
}

/**
 * ===================================================================
 * FONCTION CALLBACK pour le PlannerPanel
 * ===================================================================
 */
async function handleItineraryRequest(options) {
    console.log(`Demande d'itinéraire...`);
    isPlannerMode = true;
    
    try {
        const itineraryData = await routingService.getItinerary(options);

        if (itineraryData.error) {
            plannerPanel.showError(itineraryData.error);
            isPlannerMode = false;
            return;
        }

        const route = itineraryData.routes[0];
        const leg = route.legs[0]; 

        mapRenderer.clearAllRoutes(); 
        mapRenderer.hideBusMarkers(); 
        mapRenderer.clearStops();     
        mapRenderer.clearItinerary(); 
        
        const allCoords = []; 

        leg.steps.forEach(step => {
            if (!step || !step.polyline || !step.polyline.encodedPolyline) {
                console.warn("Étape d'itinéraire ignorée (manque polyligne):", step);
                return;
            }

            const stepCoords = routingService.decodePolyline(step.polyline.encodedPolyline);
            allCoords.push(...stepCoords);

            let style = {};

            if (step.travelMode === 'WALK') {
                style = { color: '#6c757d', weight: 4, opacity: 0.8, dashArray: '5, 10' };
            } else if (step.travelMode === 'TRANSIT') {
                let transitColor = '#2563eb'; 
                if (step.transitDetails && step.transitDetails.line && step.transitDetails.line.color) {
                    transitColor = step.transitDetails.line.color;
                }
                style = { color: transitColor, weight: 6, opacity: 0.9 };
            } else {
                style = { color: '#6c757d', weight: 4 };
            }
            
            L.polyline(stepCoords, style).addTo(mapRenderer.itineraryLayer);
        });

        const startPoint = [leg.startLocation.latLng.latitude, leg.startLocation.latLng.longitude];
        L.marker(startPoint, { 
            icon: L.divIcon({ className: 'stop-search-marker', html: '<div></div>', iconSize: [12, 12] })
        })
        .addTo(mapRenderer.itineraryLayer)
        .bindPopup(`<b>Départ:</b> ${leg.startAddress}`);

        const endPoint = [leg.endLocation.latLng.latitude, leg.endLocation.latLng.longitude];
         L.marker(endPoint, { 
            icon: L.divIcon({ className: 'stop-search-marker', html: '<div></div>', iconSize: [12, 12] })
        })
        .addTo(mapRenderer.itineraryLayer)
        .bindPopup(`<b>Arrivée:</b> ${leg.endAddress}`);

        if (allCoords.length > 0) {
            const bounds = L.latLngBounds(allCoords);
            mapRenderer.map.fitBounds(bounds, { padding: [50, 50] });
        }

        plannerPanel.displayItinerary(itineraryData);

    } catch (error) {
        console.error("Erreur lors de la recherche d'itinéraire:", error);
        plannerPanel.showError(error.message || "Erreur de connexion au service d'itinéraire.");
        isPlannerMode = false;
    }
}

// (updateData reste identique)
function updateData(timeInfo) {
    if (isPlannerMode) {
        const currentSeconds = timeInfo ? timeInfo.seconds : timeManager.getCurrentSeconds();
        updateClock(currentSeconds);
        return; 
    }

    const currentSeconds = timeInfo ? timeInfo.seconds : timeManager.getCurrentSeconds();
    const currentDate = timeInfo ? timeInfo.date : timeManager.getCurrentDate(); 
    
    updateClock(currentSeconds);
    
    const activeBuses = tripScheduler.getActiveTrips(currentSeconds, currentDate);
    
    const busesWithPositions = busPositionCalculator.calculateAllPositions(activeBuses)
        .filter(bus => bus !== null)
        .filter(bus => bus.route && visibleRoutes.has(bus.route.route_id)); 
    
    mapRenderer.updateBusMarkers(busesWithPositions, tripScheduler, currentSeconds);
    
    const visibleBusCount = busesWithPositions.length;
    const totalBusCount = visibleBusCount;
    updateBusCount(visibleBusCount, totalBusCount);
}

// (updateClock, updateBusCount, updateDataStatus restent identiques)
function updateClock(seconds) {
    const hours = Math.floor(seconds / 3600) % 24;
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById('current-time').textContent = timeString;
    
    const now = timeManager.getCurrentDate(); 
    const dateString = now.toLocaleDateString('fr-FR', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
    });
    document.getElementById('date-indicator').textContent = dateString;
}
function updateBusCount(visible, total) {
    const busCountElement = document.getElementById('bus-count');
    busCountElement.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10"/>
        </svg>
        ${visible} bus
    `;
}
function updateDataStatus(message, status = '') {
    const statusElement = document.getElementById('data-status');
    statusElement.className = status;
    statusElement.textContent = message;
}


// --- CORRECTION FINALE ---
// Attend que le HTML soit chargé avant de lancer l'application.
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
