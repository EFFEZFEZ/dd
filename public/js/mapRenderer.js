/**
 * mapRenderer.js
 * 
 * Gère l'affichage de la carte Leaflet et le rendu des bus et routes
 */

export class MapRenderer {
    constructor(mapElementId) {
        this.mapElementId = mapElementId;
        this.map = null;
        this.busMarkers = {};
        this.routeLayer = null;
        this.selectedRoute = null;
        this.centerCoordinates = [45.1833, 0.7167]; // Périgueux
        this.zoomLevel = 13;
    }

    /**
     * Initialise la carte Leaflet
     */
    initializeMap() {
        // Créer la carte
        this.map = L.map(this.mapElementId).setView(this.centerCoordinates, this.zoomLevel);

        // Ajouter la couche OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        console.log('🗺️ Carte initialisée');
    }

    /**
     * Affiche les routes GeoJSON sur la carte
     */
    displayRoutes(geoJsonData) {
        if (!geoJsonData) {
            console.warn('Aucune donnée GeoJSON à afficher');
            return;
        }

        // Supprimer l'ancienne couche si elle existe
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }

        // Créer la nouvelle couche GeoJSON
        this.routeLayer = L.geoJSON(geoJsonData, {
            style: (feature) => {
                return {
                    color: feature.properties?.color || '#3388ff',
                    weight: 3,
                    opacity: 0.7
                };
            },
            onEachFeature: (feature, layer) => {
                // Ajouter un popup avec les informations de la route
                if (feature.properties) {
                    const props = feature.properties;
                    const popupContent = `
                        <div class="route-popup">
                            <h4>${props.name || 'Route'}</h4>
                            ${props.route_id ? `<p><strong>ID:</strong> ${props.route_id}</p>` : ''}
                            ${props.description ? `<p>${props.description}</p>` : ''}
                        </div>
                    `;
                    layer.bindPopup(popupContent);
                }

                // Ajouter l'interaction pour surligner la route
                layer.on('click', () => {
                    this.highlightRoute(layer);
                });
            }
        }).addTo(this.map);

        // Ajuster la vue pour afficher toutes les routes
        const bounds = this.routeLayer.getBounds();
        if (bounds.isValid()) {
            this.map.fitBounds(bounds);
        }

        console.log('✓ Routes GeoJSON affichées');
    }

    /**
     * Surligne une route sélectionnée
     */
    highlightRoute(layer) {
        // Réinitialiser la route précédemment sélectionnée
        if (this.selectedRoute) {
            this.selectedRoute.setStyle({
                weight: 3,
                opacity: 0.7
            });
        }

        // Surligner la nouvelle route
        layer.setStyle({
            weight: 5,
            opacity: 1
        });

        this.selectedRoute = layer;
    }

    /**
     * Met à jour l'affichage des bus sur la carte
     */
    updateBusMarkers(busesWithPositions, tripScheduler) {
        const currentBusIds = new Set();

        busesWithPositions.forEach(bus => {
            const busId = bus.tripId;
            currentBusIds.add(busId);

            const { lat, lon } = bus.position;
            
            // Créer ou mettre à jour le marqueur
            if (this.busMarkers[busId]) {
                // Mettre à jour la position existante avec animation fluide
                this.busMarkers[busId].setLatLng([lat, lon]);
            } else {
                // Créer un nouveau marqueur
                this.busMarkers[busId] = this.createBusMarker(bus, tripScheduler);
                this.busMarkers[busId].addTo(this.map);
            }
        });

        // Supprimer les marqueurs des bus qui ne sont plus actifs
        Object.keys(this.busMarkers).forEach(busId => {
            if (!currentBusIds.has(busId)) {
                this.map.removeLayer(this.busMarkers[busId]);
                delete this.busMarkers[busId];
            }
        });
    }

    /**
     * Crée un marqueur pour un bus (rectangle arrondi)
     */
    createBusMarker(bus, tripScheduler) {
        const { lat, lon } = bus.position;
        const route = bus.route;
        const routeShortName = route?.route_short_name || route?.route_id || '?';
        const routeColor = route?.route_color ? `#${route.route_color}` : '#FFC107';

        // Créer une icône rectangulaire arrondie avec la couleur de la ligne
        const icon = L.divIcon({
            className: 'bus-icon-rect',
            html: `<div style="background-color: ${routeColor}; width: 40px; height: 24px; border-radius: 6px; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 0.85rem; box-shadow: 0 2px 10px rgba(0,0,0,0.4); text-shadow: 0 1px 2px rgba(0,0,0,0.3);">${routeShortName}</div>`,
            iconSize: [40, 24],
            iconAnchor: [20, 12]
        });

        const marker = L.marker([lat, lon], { icon });

        // Récupérer les informations pour le popup
        const stopTimes = tripScheduler.dataManager.stopTimesByTrip[bus.tripId];
        const destination = tripScheduler.getTripDestination(stopTimes);
        const nextStopName = bus.segment?.toStopInfo?.stop_name || 'Inconnu';
        const nextStopETA = tripScheduler.getNextStopETA(bus.segment, bus.currentSeconds);
        
        // Nom de la ligne
        const lineName = route?.route_long_name || route?.route_short_name || 'Ligne inconnue';

        const popupContent = `
            <div class="bus-popup">
                <h4 style="color: ${routeColor}; margin: 0 0 10px 0;">🚌 Ligne ${routeShortName}</h4>
                <p style="margin: 5px 0;"><strong>Nom:</strong> ${lineName}</p>
                <p style="margin: 5px 0;"><strong>Direction:</strong> ${destination}</p>
                <p style="margin: 5px 0;"><strong>Prochain arrêt:</strong> ${nextStopName}</p>
                ${nextStopETA ? `<p style="margin: 5px 0;"><strong>Arrivée dans:</strong> ${nextStopETA.formatted}</p>` : ''}
            </div>
        `;

        marker.bindPopup(popupContent);

        return marker;
    }

    /**
     * Centre la carte sur une position spécifique
     */
    centerMap(lat, lon, zoom = null) {
        if (zoom) {
            this.map.setView([lat, lon], zoom);
        } else {
            this.map.setView([lat, lon]);
        }
    }

    /**
     * Récupère le nombre de bus actuellement affichés
     */
    getBusCount() {
        return Object.keys(this.busMarkers).length;
    }

    /**
     * Nettoie tous les marqueurs
     */
    clearAllMarkers() {
        Object.values(this.busMarkers).forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.busMarkers = {};
    }
}
