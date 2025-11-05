/**
 * tripScheduler.js
 * 
 * Calcule les trajets actifs à un instant T donné
 */

export class TripScheduler {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    /**
     * Récupère tous les bus actifs au temps donné
     * Retourne un tableau d'objets avec les informations de position
     */
    getActiveBuses(currentSeconds) {
        if (!this.dataManager.isLoaded) {
            return [];
        }

        const activeTrips = this.dataManager.getActiveTrips(currentSeconds);
        const activeBuses = [];

        activeTrips.forEach(({ tripId, trip, stopTimes, route }) => {
            // Trouver entre quels arrêts se trouve le bus
            const segment = this.findCurrentSegment(stopTimes, currentSeconds);
            
            if (segment) {
                activeBuses.push({
                    tripId,
                    trip,
                    route,
                    segment,
                    currentSeconds
                });
            }
        });

        return activeBuses;
    }

    /**
     * Trouve le segment (paire d'arrêts) où se trouve le bus actuellement
     */
    findCurrentSegment(stopTimes, currentSeconds) {
        for (let i = 0; i < stopTimes.length - 1; i++) {
            const currentStop = stopTimes[i];
            const nextStop = stopTimes[i + 1];

            const departureTime = this.dataManager.timeToSeconds(
                currentStop.departure_time || currentStop.arrival_time
            );
            const arrivalTime = this.dataManager.timeToSeconds(
                nextStop.arrival_time || nextStop.departure_time
            );

            // Le bus est entre ces deux arrêts
            if (currentSeconds >= departureTime && currentSeconds <= arrivalTime) {
                return {
                    fromStop: currentStop,
                    toStop: nextStop,
                    fromStopInfo: this.dataManager.getStop(currentStop.stop_id),
                    toStopInfo: this.dataManager.getStop(nextStop.stop_id),
                    departureTime,
                    arrivalTime,
                    progress: this.calculateProgress(departureTime, arrivalTime, currentSeconds)
                };
            }
        }

        return null;
    }

    /**
     * Calcule la progression entre deux arrêts (0 à 1)
     */
    calculateProgress(departureTime, arrivalTime, currentTime) {
        const totalDuration = arrivalTime - departureTime;
        if (totalDuration === 0) return 0;

        const elapsed = currentTime - departureTime;
        return Math.max(0, Math.min(1, elapsed / totalDuration));
    }

    /**
     * Estime le temps d'arrivée au prochain arrêt
     */
    getNextStopETA(segment, currentSeconds) {
        if (!segment) return null;

        const remainingSeconds = segment.arrivalTime - currentSeconds;
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = Math.floor(remainingSeconds % 60);

        return {
            seconds: remainingSeconds,
            formatted: `${minutes}m ${seconds}s`
        };
    }

    /**
     * Récupère la destination finale d'un trip
     */
    getTripDestination(stopTimes) {
        if (!stopTimes || stopTimes.length === 0) {
            return 'Destination inconnue';
        }

        const lastStop = stopTimes[stopTimes.length - 1];
        const stopInfo = this.dataManager.getStop(lastStop.stop_id);
        
        return stopInfo ? stopInfo.stop_name : lastStop.stop_id;
    }
}
