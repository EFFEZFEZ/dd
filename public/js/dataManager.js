/**
 * dataManager.js
 * 
 * Gère le chargement et le parsing des données GTFS et GeoJSON
 * 
 * IMPORTANT: Placez vos fichiers GTFS dans /public/data/gtfs/
 * - routes.txt
 * - trips.txt
 * - stop_times.txt
 * - stops.txt
 * - calendar.txt (optionnel)
 * 
 * Placez votre fichier GeoJSON dans /public/data/map.geojson
 */

export class DataManager {
    constructor() {
        this.routes = [];
        this.trips = [];
        this.stopTimes = [];
        this.stops = [];
        this.geoJson = null;
        this.isLoaded = false;
    }

    /**
     * Charge tous les fichiers GTFS et GeoJSON
     */
    async loadAllData() {
        try {
            console.log('📦 Chargement des données GTFS et GeoJSON...');
            
            // Charger les fichiers GTFS en parallèle
            const [routes, trips, stopTimes, stops, geoJson] = await Promise.all([
                this.loadGTFSFile('routes.txt'),
                this.loadGTFSFile('trips.txt'),
                this.loadGTFSFile('stop_times.txt'),
                this.loadGTFSFile('stops.txt'),
                this.loadGeoJSON()
            ]);

            this.routes = routes;
            this.trips = trips;
            this.stopTimes = stopTimes;
            this.stops = stops;
            this.geoJson = geoJson;

            // Créer des index pour un accès rapide
            this.indexData();

            this.isLoaded = true;
            console.log('✅ Données chargées avec succès!');
            console.log(`   - ${this.routes.length} routes`);
            console.log(`   - ${this.trips.length} trips`);
            console.log(`   - ${this.stopTimes.length} stop_times`);
            console.log(`   - ${this.stops.length} stops`);
            
            return true;
        } catch (error) {
            console.error('❌ Erreur lors du chargement des données:', error);
            throw error;
        }
    }

    /**
     * Charge un fichier GTFS CSV
     */
    async loadGTFSFile(filename) {
        const path = `data/gtfs/${filename}`;
        
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Impossible de charger ${filename} (${response.status})`);
            }
            
            const csvText = await response.text();
            
            return new Promise((resolve, reject) => {
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        console.log(`✓ ${filename}: ${results.data.length} lignes`);
                        resolve(results.data);
                    },
                    error: (error) => {
                        reject(error);
                    }
                });
            });
        } catch (error) {
            console.warn(`⚠️ ${filename} non trouvé ou erreur:`, error.message);
            return [];
        }
    }

    /**
     * Charge le fichier GeoJSON
     */
    async loadGeoJSON() {
        try {
            const response = await fetch('data/map.geojson');
            if (!response.ok) {
                throw new Error(`Impossible de charger map.geojson (${response.status})`);
            }
            
            const data = await response.json();
            console.log('✓ GeoJSON chargé');
            return data;
        } catch (error) {
            console.warn('⚠️ map.geojson non trouvé:', error.message);
            return null;
        }
    }

    /**
     * Crée des index pour un accès rapide aux données
     */
    indexData() {
        // Index des routes par route_id
        this.routesById = {};
        this.routes.forEach(route => {
            this.routesById[route.route_id] = route;
        });

        // Index des trips par trip_id et par route_id
        this.tripsById = {};
        this.tripsByRoute = {};
        this.trips.forEach(trip => {
            this.tripsById[trip.trip_id] = trip;
            
            const routeId = trip.route_id;
            if (!this.tripsByRoute[routeId]) {
                this.tripsByRoute[routeId] = [];
            }
            this.tripsByRoute[routeId].push(trip);
        });

        // Index des stop_times par trip_id (triés par stop_sequence)
        this.stopTimesByTrip = {};
        this.stopTimes.forEach(stopTime => {
            const tripId = stopTime.trip_id;
            if (!this.stopTimesByTrip[tripId]) {
                this.stopTimesByTrip[tripId] = [];
            }
            this.stopTimesByTrip[tripId].push(stopTime);
        });

        // Trier les stop_times par stop_sequence
        Object.keys(this.stopTimesByTrip).forEach(tripId => {
            this.stopTimesByTrip[tripId].sort((a, b) => {
                return parseInt(a.stop_sequence) - parseInt(b.stop_sequence);
            });
        });

        // Index des stops par stop_id
        this.stopsById = {};
        this.stops.forEach(stop => {
            this.stopsById[stop.stop_id] = stop;
        });

        console.log('✓ Index créés');
    }

    /**
     * Convertit une heure GTFS (HH:MM:SS) en secondes depuis minuit
     */
    timeToSeconds(timeString) {
        if (!timeString) return 0;
        
        const parts = timeString.split(':');
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const seconds = parseInt(parts[2] || 0);
        
        return hours * 3600 + minutes * 60 + seconds;
    }

    /**
     * Convertit des secondes en format HH:MM:SS
     */
    secondsToTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    /**
     * Récupère tous les trips actifs à un moment donné
     */
    getActiveTrips(currentSeconds) {
        const activeTrips = [];

        Object.keys(this.stopTimesByTrip).forEach(tripId => {
            const stopTimes = this.stopTimesByTrip[tripId];
            if (stopTimes.length < 2) return;

            const firstStop = stopTimes[0];
            const lastStop = stopTimes[stopTimes.length - 1];

            const startTime = this.timeToSeconds(firstStop.departure_time || firstStop.arrival_time);
            const endTime = this.timeToSeconds(lastStop.arrival_time || lastStop.departure_time);

            // Vérifier si le trip est actif à ce moment
            if (currentSeconds >= startTime && currentSeconds <= endTime) {
                const trip = this.tripsById[tripId];
                if (trip) {
                    activeTrips.push({
                        tripId,
                        trip,
                        stopTimes,
                        route: this.routesById[trip.route_id]
                    });
                }
            }
        });

        return activeTrips;
    }

    /**
     * Récupère les informations d'un arrêt par son ID
     */
    getStop(stopId) {
        return this.stopsById[stopId];
    }

    /**
     * Récupère les informations d'une route par son ID
     */
    getRoute(routeId) {
        return this.routesById[routeId];
    }
}
