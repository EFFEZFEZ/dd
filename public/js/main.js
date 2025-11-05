/**
 * mapRenderer.js
 * Gère toutes les interactions avec Leaflet.
 */

export class MapRenderer {
    constructor(mapContainerId) {
        this.map = null;
        this.mapContainerId = mapContainerId;
        this.busMarkers = new Map(); // Stocke les marqueurs par trip_id
        this.markerLayer = new L.LayerGroup();
        this.geoJsonLayer = null;
        this.popupChangeCallback = () => {}; // Fonction pour notifier l'App
    }

    initializeMap() {
        this.map = L.map(this.mapContainerId).setView([45.18, 0.72], 13); // Centré sur Périgueux
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        this.map.addLayer(this.markerLayer);
    }

    setPopupChangeListener(callback) {
        this.popupChangeCallback = callback;
    }

    // ... (Fonctions utilitaires : createBusIcon, createPopupContent)

    /**
     * Crée l'icône de bus personnalisée.
     */
    createBusIcon(shortName) {
        return L.divIcon({
            className: 'bus-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            html: `<span>${shortName}</span>` // Optionnel : utiliser le shortName si l'icône est trop petite
        });
    }

    /**
     * Crée le contenu HTML du popup du bus.
     */
    createPopupContent(bus, tripScheduler, currentSeconds) {
        const route = bus.route;
        const stopInfo = tripScheduler.getNextStopInfo(bus.trip.trip_id, currentSeconds);

        let nextStopHtml = 'N/A';
        if (stopInfo) {
            const timeDiff = stopInfo.nextDepartureTime - currentSeconds;
            const minutes = Math.floor(timeDiff / 60);
            nextStopHtml = `Prochain arrêt : <strong>${stopInfo.nextStopName}</strong> (dans ${minutes} min)`;
        }

        return `
            <div class="bus-popup">
                <h4>Ligne ${route.route_short_name}</h4>
                <p>Destination : <strong>${bus.trip.trip_headsign}</strong></p>
                <p>${nextStopHtml}</p>
            </div>
        `;
    }

    /**
     * Affiche les routes GeoJSON filtrées.
     */
    displayMultiColorRoutes(geoJson, dataManager, visibleRoutes) {
        if (this.geoJsonLayer) {
            this.map.removeLayer(this.geoJsonLayer);
        }

        this.geoJsonLayer = L.geoJSON(geoJson, {
            filter: function(feature) {
                // Filtrer les routes non visibles
                return visibleRoutes.has(feature.properties.route_id);
            },
            style: function(feature) {
                const routeId = feature.properties.route_id;
                const route = dataManager.getRoute(routeId);
                const color = route ? `#${route.route_color}` : '#3388ff';

                return {
                    color: color,
                    weight: 4,
                    opacity: 0.7
                };
            }
        }).addTo(this.map);
    }

    /**
     * Met à jour les marqueurs de bus sur la carte.
     */
    updateBusMarkers(busesWithPositions, tripScheduler, currentSeconds, openTripId) {
        const activeTripIds = new Set();

        busesWithPositions.forEach(bus => {
            const tripId = bus.trip.trip_id;
            activeTripIds.add(tripId);
            let marker = this.busMarkers.get(tripId);

            // Créer ou mettre à jour le marqueur
            if (!marker) {
                // Création du marqueur
                marker = L.marker([bus.lat, bus.lon], {
                    icon: this.createBusIcon(bus.route.route_short_name)
                });

                // Attacher les listeners de popup à la création pour suivre l'état global
                marker.on('popupopen', () => this.popupChangeCallback(tripId));
                marker.on('popupclose', () => this.popupChangeCallback(null));

                marker.addTo(this.markerLayer);
                this.busMarkers.set(tripId, marker);
            } else {
                // Mise à jour de la position
                marker.setLatLng([bus.lat, bus.lon]);
            }

            // Mettre à jour le contenu du popup (important pour le temps réel)
            const popupContent = this.createPopupContent(bus, tripScheduler, currentSeconds);
            marker.bindPopup(popupContent, { 
                className: 'bus-popup',
                autoClose: false // Permet de garder le popup ouvert sans avoir à cliquer sur le marqueur
            });

            // Forcer la réouverture si cet ID est celui qui doit rester ouvert
            if (openTripId === tripId) {
                if (!marker.getPopup().isOpen()) {
                    marker.openPopup();
                }
            }
        });

        // Supprimer les marqueurs des bus qui ne sont plus actifs
        const markersToRemove = [];
        this.busMarkers.forEach((marker, tripId) => {
            if (!activeTripIds.has(tripId)) {
                markersToRemove.push(marker);
                this.busMarkers.delete(tripId);

                // Si on retire le bus dont le popup était ouvert, on le notifie
                if (tripId === openTripId) {
                    this.popupChangeCallback(null);
                }
            }
        });

        markersToRemove.forEach(marker => {
            this.markerLayer.removeLayer(marker);
        });
    }

    /**
     * Retourne le nombre de bus affichés
     */
    getBusCount() {
        return this.busMarkers.size;
    }
}