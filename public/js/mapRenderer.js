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
     * Calcule un point décalé perpendiculairement à un segment de ligne
     */
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

    /**
     * Crée une géométrie décalée pour une LineString
     */
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

    /**
     * Affiche les routes GeoJSON avec rendu multi-couleurs
     * Décale visuellement les routes quand plusieurs lignes partagent le même segment
     */
    displayMultiColorRoutes(geoJsonData, dataManager, visibleRoutes) {
        if (!geoJsonData) {
            console.warn('Aucune donnée GeoJSON à afficher');
            return;
        }

        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }

        this.routeLayer = L.layerGroup().addTo(this.map);

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
                const layer = L.geoJSON(feature, {
                    style: {
                        color: routeColor,
                        weight: baseWidth,
                        opacity: 0.85,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }
                });
                this.addRoutePopup(layer, features, dataManager);
                layer.addTo(this.routeLayer);
            } else {
                features.forEach((feature, index) => {
                    const routeColor = feature.properties?.route_color || '#3388ff';
                    
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

                    layer.addTo(this.routeLayer);
                    this.addRoutePopup(layer, features, dataManager);
                });
            }
        });

        try {
            const bounds = this.routeLayer.getBounds();
            if (bounds && bounds.isValid()) {
                this.map.fitBounds(bounds);
            }
        } catch (e) {
            console.log('✓ Routes affichées (zoom non ajusté)');
        }

        console.log(`✓ ${geometryMap.size} segments de routes affichées (lignes décalées pour visibilité)`);
    }

    /**
     * Ajoute un popup aux routes
     */
    addRoutePopup(layer, features, dataManager) {
        layer.eachLayer(sublayer => {
            if (features.length === 1) {
                const props = features[0].properties;
                const routeId = props?.route_id;
                const route = dataManager.getRoute(routeId);
                const routeColor = route?.route_color ? `#${route.route_color}` : props?.route_color || '#3388ff';
                const textColor = route?.route_text_color ? `#${route.route_text_color}` : '#ffffff';
                const routeName = route?.route_short_name || props?.route_short_name || props?.name || 'Route';
                const routeLongName = route?.route_long_name || props?.route_long_name || '';
                
                const popupContent = `
                    <div class="route-popup">
                        <div style="background-color: ${routeColor}; color: ${textColor}; padding: 8px; border-radius: 4px; margin-bottom: 8px; text-align: center; font-weight: bold; font-size: 1.1em;">
                            Ligne ${routeName}
                        </div>
                        ${routeLongName ? `<p style="margin: 5px 0;"><strong>${routeLongName}</strong></p>` : ''}
                    </div>
                `;
                sublayer.bindPopup(popupContent);
            } else {
                // Plusieurs lignes - afficher toutes dans le popup
                let popupContent = '<div class="route-popup"><h4>Lignes sur ce segment:</h4>';
                features.forEach(feature => {
                    const props = feature.properties;
                    const routeId = props?.route_id;
                    const route = dataManager.getRoute(routeId);
                    const routeColor = route?.route_color ? `#${route.route_color}` : '#3388ff';
                    const textColor = route?.route_text_color ? `#${route.route_text_color}` : '#ffffff';
                    const routeName = route?.route_short_name || props?.route_short_name || 'Route';
                    
                    popupContent += `
                        <div style="background-color: ${routeColor}; color: ${textColor}; padding: 4px 8px; border-radius: 3px; margin: 4px 0; text-align: center; font-weight: bold;">
                            Ligne ${routeName}
                        </div>
                    `;
                });
                popupContent += '</div>';
                sublayer.bindPopup(popupContent);
            }
        });
    }

    /**
     * Affiche les routes GeoJSON sur la carte (ancienne méthode, gardée pour compatibilité)
     */
    displayRoutes(geoJsonData) {
        console.warn('displayRoutes() est déprécié, utilisez displayMultiColorRoutes() à la place');
        if (!geoJsonData) return;

        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }

        this.routeLayer = L.geoJSON(geoJsonData, {
            filter: (feature) => {
                return feature.geometry && feature.geometry.type === 'LineString';
            },
            style: (feature) => {
                const routeColor = feature.properties?.route_color || '#3388ff';
                return {
                    color: routeColor,
                    weight: 3,
                    opacity: 0.7
                };
            }
        }).addTo(this.map);

        const bounds = this.routeLayer.getBounds();
        if (bounds.isValid()) {
            this.map.fitBounds(bounds);
        }
    }

    /**
     * Surligne une route sélectionnée
     */
    highlightRoute(layer) {
        // Vérifier que le layer a une méthode setStyle
        if (!layer || typeof layer.setStyle !== 'function') {
            return;
        }

        // Réinitialiser la route précédemment sélectionnée
        if (this.selectedRoute && typeof this.selectedRoute.setStyle === 'function') {
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
     * Met à jour l'affichage des bus sur la carte avec mise à jour temps réel des popups
     */
    updateBusMarkers(busesWithPositions, tripScheduler, currentSeconds) {
        const currentBusIds = new Set();

        busesWithPositions.forEach(bus => {
            const busId = bus.tripId;
            currentBusIds.add(busId);

            const { lat, lon } = bus.position;
            
            // Créer ou mettre à jour le marqueur
            if (this.busMarkers[busId]) {
                // Mettre à jour la position existante avec animation fluide
                this.busMarkers[busId].marker.setLatLng([lat, lon]);
                
                // Mettre à jour le popup en temps réel si ouvert
                if (this.busMarkers[busId].marker.isPopupOpen()) {
                    const newPopupContent = this.createBusPopupContent(bus, tripScheduler);
                    this.busMarkers[busId].marker.getPopup().setContent(newPopupContent);
                }
            } else {
                // Créer un nouveau marqueur
                const markerData = this.createBusMarker(bus, tripScheduler);
                this.busMarkers[busId] = markerData;
                markerData.marker.addTo(this.map);
            }
        });

        // Supprimer les marqueurs des bus qui ne sont plus actifs
        Object.keys(this.busMarkers).forEach(busId => {
            if (!currentBusIds.has(busId)) {
                this.map.removeLayer(this.busMarkers[busId].marker);
                delete this.busMarkers[busId];
            }
        });
    }

    /**
     * Crée le contenu HTML du popup pour un bus
     */
    createBusPopupContent(bus, tripScheduler) {
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
                <div style="background: ${routeColor}; color: ${textColor}; padding: 0.625rem 0.875rem; border-radius: 6px; margin-bottom: 0.75rem; font-weight: 600; text-align: center;">
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
        Object.values(this.busMarkers).forEach(markerData => {
            this.map.removeLayer(markerData.marker);
        });
        this.busMarkers = {};
    }
}
