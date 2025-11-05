/**
 * busPositionCalculator.js
 * 
 * Calcule les positions géographiques interpolées des bus entre deux arrêts
 */

export class BusPositionCalculator {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    /**
     * Calcule la position interpolée d'un bus entre deux arrêts
     * Utilise une interpolation linéaire simple
     */
    calculatePosition(segment) {
        if (!segment || !segment.fromStopInfo || !segment.toStopInfo) {
            return null;
        }

        const fromLat = parseFloat(segment.fromStopInfo.stop_lat);
        const fromLon = parseFloat(segment.fromStopInfo.stop_lon);
        const toLat = parseFloat(segment.toStopInfo.stop_lat);
        const toLon = parseFloat(segment.toStopInfo.stop_lon);

        // Vérifier que les coordonnées sont valides
        if (isNaN(fromLat) || isNaN(fromLon) || isNaN(toLat) || isNaN(toLon)) {
            console.warn('Coordonnées invalides pour les arrêts:', segment);
            return null;
        }

        // Interpolation linéaire basée sur la progression
        const progress = segment.progress;
        const lat = fromLat + (toLat - fromLat) * progress;
        const lon = fromLon + (toLon - fromLon) * progress;

        return {
            lat,
            lon,
            progress
        };
    }

    /**
     * Calcule l'angle de déplacement du bus (pour orienter l'icône)
     */
    calculateBearing(segment) {
        if (!segment || !segment.fromStopInfo || !segment.toStopInfo) {
            return 0;
        }

        const fromLat = parseFloat(segment.fromStopInfo.stop_lat);
        const fromLon = parseFloat(segment.fromStopInfo.stop_lon);
        const toLat = parseFloat(segment.toStopInfo.stop_lat);
        const toLon = parseFloat(segment.toStopInfo.stop_lon);

        // Convertir les coordonnées en radians pour les calculs trigonométriques
        const fromLatRad = this.toRad(fromLat);
        const fromLonRad = this.toRad(fromLon);
        const toLatRad = this.toRad(toLat);
        const toLonRad = this.toRad(toLon);

        // Calcul de l'angle en degrés
        const dLon = toLonRad - fromLonRad;
        const y = Math.sin(dLon) * Math.cos(toLatRad);
        const x = Math.cos(fromLatRad) * Math.sin(toLatRad) -
                  Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(dLon);
        
        const bearing = Math.atan2(y, x);
        const degrees = (bearing * 180 / Math.PI + 360) % 360;
        
        return degrees;
    }

    /**
     * Calcule toutes les positions pour les bus actifs
     */
    calculateAllPositions(activeBuses) {
        return activeBuses.map(bus => {
            const position = this.calculatePosition(bus.segment);
            const bearing = this.calculateBearing(bus.segment);

            if (!position) {
                return null;
            }

            return {
                ...bus,
                position,
                bearing
            };
        }).filter(bus => bus !== null);
    }

    /**
     * Calcule la distance entre deux points (formule de Haversine)
     * Utile pour des optimisations futures
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Rayon de la Terre en km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        
        return distance;
    }

    /**
     * Convertit des degrés en radians
     */
    toRad(degrees) {
        return degrees * Math.PI / 180;
    }
}
