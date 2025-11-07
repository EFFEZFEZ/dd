/**
 * mapRenderer.js
 * * Gère l'affichage de la carte Leaflet et le rendu des bus et routes
 */

export class MapRenderer {
    constructor(mapElementId) {
        this.mapElementId = mapElementId;
        this.map = null;
        this.busMarkers = {}; // Garde la trace de nos marqueurs
        this.routeLayer = null;
        this.routeLayersById = {};
        this.selectedRoute = null;
        this.centerCoordinates = [45.1833, 0.7167]; // Périgueux
        this.zoomLevel = 13;
        this.tempStopMarker = null;

        /* MODIFICATION: Initialisation du groupe de clusters */
        this.clusterGroup = L.markerClusterGroup({
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: 16 
        });
    }

    /**
     * Initialise la carte Leaflet
     */
    initializeMap() {
        // ... (code inchangé)
        this.map = L.map(this.mapElementId).setView(this.centerCoordinates, this.zoomLevel);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
        this.map.addLayer(this.clusterGroup);
        console.log('🗺️ Carte initialisée');
        this.map.on('click', () => {
            if (this.tempStopMarker) {
                this.map.removeLayer(this.tempStopMarker);
                this.tempStopMarker = null;
            }
        });
    }

    // ... (offsetPoint, offsetLineString, displayMultiColorRoutes, addRoutePopup sont inchangés) ...
    offsetPoint(lat1, lon1, lat2, lon2, offsetMeters, index, total) {
        const earthRadius = 6371000;
        const lat1Rad = lat1 * Math.PI / 180;
        const lon1Rad = lon1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        const lon2Rad = lon2 * Math.PI / 180;
        const bearing = Math.atan2(
            Math.sin(lon2Rad - lon1Rad) * Math.cos(lat2Rad),
            Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lon2Rad - lon1Rad)
        );
        const perpBearing = bearing + Math.PI / 2;
        const offsetDistance = offsetMeters * (index - (total - 1) / 2);
        const angularDistance = offsetDistance / earthRadius;
        const newLat = Math.asin(
            Math.sin(lat1Rad) * Math.cos(angularDistance) +
            Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(perpBearing)
        );
        const newLon = lon1Rad + Math.atan2(
            Math.sin(perpBearing) * Math.sin(angularDistance) * Math.cos(lat1Rad),
            Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(newLat)
        );
        return [newLat * 180 / Math.PI, newLon * 180 / Math.PI];
    }
    offsetLineString(coordinates, offsetMeters, index, total) {
        const offsetCoords = [];
        for (let i = 0; i < coordinates.length; i++) {
            const [lon, lat] = coordinates[i];
            let lon2, lat2;
            if (i < coordinates.length - 1) {
                [lon2, lat2] = coordinates[i + 1];
            } else {
                [lon2, lat2] = coordinates[i - 1];
            }
            const [newLat, newLon] = this.offsetPoint(lat, lon, lat2, lon2, offsetMeters, index, total);
            offsetCoords.push([newLon, newLat]);
        }
        return offsetCoords;
    }
    displayMultiColorRoutes(geoJsonData, dataManager, visibleRoutes) {
        if (!geoJsonData) {
            console.warn('Aucune donnée GeoJSON à afficher');
            return;
        }
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }
        this.routeLayer = L.layerGroup().addTo(this.map);
        this.routeLayersById = {};
        const geometryMap = new Map();
        geoJsonData.features.forEach(feature => {
            if (feature.geometry && feature.geometry.type === 'LineString') {
                const routeId = feature.properties?.route_id;
                if (!visibleRoutes.has(routeId)) {
                    return;
                }
                const geomKey = JSON.stringify(feature.geometry.coordinates);
                if (!geometryMap.has(geomKey)) {
                    geometryMap.set(geomKey, []);
                }
                geometryMap.get(geomKey).push(feature);
            }
        });
        geometryMap.forEach((features, geomKey) => {
            const numRoutes = features.length;
            const baseWidth = 4;
            const offsetMeters = 3;
            if (numRoutes === 1) {
                const feature = features[0];
                const routeColor = feature.properties?.route_color || '#3388ff';
                const routeId = feature.properties?.route_id;
                const layer = L.geoJSON(feature, {
                    style: {
                        color: routeColor,
                        weight: baseWidth,
                        opacity: 0.85,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }
                });
                if (routeId) {
                    if (!this.routeLayersById[routeId]) this.routeLayersById[routeId] = [];
                    this.routeLayersById[routeId].push(layer);
                }
                this.addRoutePopup(layer, features, dataManager);
                layer.addTo(this.routeLayer);
            } else {
                features.forEach((feature, index) => {
                    const routeColor = feature.properties?.route_color || '#3388ff';
                    const routeId = feature.properties?.route_id;
                    const offsetCoords = this.offsetLineString(
                        feature.geometry.coordinates,
                        offsetMeters,
                        index,
                        numRoutes
                    );
                    const offsetFeature = {
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: offsetCoords
                        },
                        properties: feature.properties
                    };
                    const layer = L.geoJSON(offsetFeature, {
                        style: {
                            color: routeColor,
                            weight: baseWidth,
                            opacity: 0.85,
                            lineCap: 'round',
                            lineJoin: 'round'
                        }
                    });
                    if (routeId) {
                        if (!this.routeLayersById[routeId]) this.routeLayersById[routeId] = [];
                        this.routeLayersById[routeId].push(layer);
                    }
                    layer.addTo(this.routeLayer);
                    this.addRoutePopup(layer, features, dataManager);
                });
            }
        });
        console.log(`✓ ${geometryMap.size} segments de routes affichées (lignes décalées pour visibilité)`);
    }
    addRoutePopup(layer, features, dataManager) {
        // ... (code inchangé)
    }

    /**
     * Met à jour l'affichage des bus sur la carte
     */
    updateBusMarkers(busesWithPositions, tripScheduler, currentSeconds) {
        const currentBusIds = new Set();
        const markersToAdd = [];
        const markersToRemove = [];

        busesWithPositions.forEach(bus => {
            const busId = bus.tripId;
            currentBusIds.add(busId);

            const { lat, lon } = bus.position;
            
            if (this.busMarkers[busId]) {
                const markerData = this.busMarkers[busId];
                markerData.marker.setLatLng([lat, lon]); 
                
                /* MODIFICATION: Logique de rotation SUPPRIMÉE */
                
                if (markerData.marker.isPopupOpen()) {
                    const newPopupContent = this.createBusPopupContent(bus, tripScheduler);
                    markerData.marker.getPopup().setContent(newPopupContent);
                }
            } 
            else {
                const markerData = this.createBusMarker(bus, tripScheduler);
                this.busMarkers[busId] = markerData;
                markersToAdd.push(markerData.marker); 
            }
        });

        // Supprimer les marqueurs des bus qui ne sont plus actifs
        Object.keys(this.busMarkers).forEach(busId => {
            if (!currentBusIds.has(busId)) {
                markersToRemove.push(this.busMarkers[busId].marker);
                delete this.busMarkers[busId];
            }
        });

        if (markersToRemove.length > 0) {
            this.clusterGroup.removeLayers(markersToRemove);
        }
        if (markersToAdd.length > 0) {
            this.clusterGroup.addLayers(markersToAdd);
        }
    }

    /**
     * Crée le contenu HTML du popup pour un bus
     */
    createBusPopupContent(bus, tripScheduler) {
        // ... (code inchangé)
        const route = bus.route;
        const routeShortName = route?.route_short_name || route?.route_id || '?';
        const routeColor = route?.route_color ? `#${route.route_color}` : '#3B82F6';
        const textColor = route?.route_text_color ? `#${route.route_text_color}` : '#ffffff';
        const stopTimes = tripScheduler.dataManager.stopTimesByTrip[bus.tripId];
        const destination = tripScheduler.getTripDestination(stopTimes);
        const nextStopName = bus.segment?.toStopInfo?.stop_name || 'Inconnu';
        const nextStopETA = tripScheduler.getNextStopETA(bus.segment, bus.currentSeconds);
        const lineName = route?.route_long_name || route?.route_short_name || 'Ligne inconnue';

        return `
            <div class="bus-popup">
                <div style="background: ${routeColor}; color: ${textColor}; padding: 0.625rem 0.875rem; border-radius: var(--radius-md); margin-bottom: 0.75rem; font-weight: 600; text-align: center;">
                    Ligne ${routeShortName}
                </div>
                <p style="margin: 0.5rem 0; font-size: 0.875rem;"><strong>Nom:</strong> ${lineName}</p>
                <p style="margin: 0.5rem 0; font-size: 0.875rem;"><strong>Direction:</strong> ${destination}</p>
                <p style="margin: 0.5rem 0; font-size: 0.875rem;"><strong>Prochain arrêt:</strong> ${nextStopName}</p>
                ${nextStopETA ? `<p style="margin: 0.5rem 0; font-size: 0.875rem;"><strong>Arrivée:</strong> ${nextStopETA.formatted}</p>` : ''}
                <p style="margin: 0.625rem 0 0 0; font-size: 0.75rem; color: #64748b;"><em>Mise à jour en temps réel</em></p>
            </div>
        `;
    }

    /**
     * MODIFICATION: Crée un marqueur rectangulaire (RETOUR à l'ancienne version)
     */
    createBusMarker(bus, tripScheduler) {
        const { lat, lon } = bus.position;
        const route = bus.route;
        const routeShortName = route?.route_short_name || route?.route_id || '?';
        const routeColor = route?.route_color ? `#${route.route_color}` : '#FFC107';
        const textColor = route?.route_text_color ? `#${route.route_text_color}` : '#ffffff'; // Ajout pour le texte

        // Créer une icône rectangulaire arrondie avec la couleur de la ligne
        const icon = L.divIcon({
            className: 'bus-icon-rect',
            html: `<div style="background-color: ${routeColor}; color: ${textColor}; width: 40px; height: 24px; border-radius: 6px; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem; box-shadow: 0 2px 10px rgba(0,0,0,0.4); text-shadow: 0 1px 2px rgba(0,0,0,0.3);">${routeShortName}</div>`,
            iconSize: [40, 24],
            iconAnchor: [20, 12],
            popupAnchor: [0, -12] // Ajusté pour le popup
        });

        const marker = L.marker([lat, lon], { icon });

        // Créer le contenu du popup
        const popupContent = this.createBusPopupContent(bus, tripScheduler);
        marker.bindPopup(popupContent);

        // Retourner le marqueur avec les données du bus pour mise à jour temps réel
        return {
            marker: marker,
            bus: bus
        };
    }

    /**
     * Surligne un tracé sur la carte
     */
    highlightRoute(routeId, state) {
        // ... (code inchangé)
        if (!this.routeLayersById || !this.routeLayersById[routeId]) return;
        const weight = state ? 6 : 4; 
        const opacity = state ? 1 : 0.85;
        this.routeLayersById[routeId].forEach(layer => {
            layer.setStyle({ weight: weight, opacity: opacity });
            if (state) {
                layer.bringToFront(); 
            }
        });
    }

    /**
     * Zoome sur un tracé de ligne
     */
    zoomToRoute(routeId) {
        // ... (code inchangé)
        if (!this.routeLayersById || !this.routeLayersById[routeId] || this.routeLayersById[routeId].length === 0) {
            console.warn(`Aucune couche trouvée pour zoomer sur la route ${routeId}`);
            return;
        }
        const routeGroup = L.featureGroup(this.routeLayersById[routeId]);
        const bounds = routeGroup.getBounds();
        if (bounds && bounds.isValid()) {
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }

    /**
     * Zoome sur un arrêt
     */
    zoomToStop(stop) {
        // ... (code inchangé)
        const lat = parseFloat(stop.stop_lat);
        const lon = parseFloat(stop.stop_lon);
        if (isNaN(lat) || isNaN(lon)) return;
        this.map.setView([lat, lon], 17);
        if (this.tempStopMarker) {
            this.map.removeLayer(this.tempStopMarker);
        }
        const stopIcon = L.divIcon({
            className: 'stop-search-marker',
            html: `<div></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
        this.tempStopMarker = L.marker([lat, lon], { icon: stopIcon }).addTo(this.map);
        this.tempStopMarker.bindPopup(`<b>${stop.stop_name}</b>`).openPopup();
    }
}
