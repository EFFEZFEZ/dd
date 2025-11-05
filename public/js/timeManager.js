/**
 * timeManager.js
 * 
 * Gère le temps réel pour l'affichage des bus en circulation
 */

export class TimeManager {
    constructor() {
        this.isRunning = false;
        this.listeners = [];
    }

    /**
     * Récupère l'heure réelle actuelle
     */
    getRealTime() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        
        return hours * 3600 + minutes * 60 + seconds;
    }

    /**
     * Démarre le mode temps réel
     */
    play() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.tick();
            console.log('▶️ Mode temps réel démarré');
        }
    }

    /**
     * Met en pause la mise à jour
     */
    pause() {
        this.isRunning = false;
        console.log('⏸️ Mode temps réel en pause');
    }

    /**
     * Redémarre le mode temps réel
     */
    reset() {
        console.log('🔄 Rechargement du temps réel');
        this.notifyListeners();
    }

    /**
     * Boucle principale de mise à jour du temps réel
     */
    tick() {
        if (!this.isRunning) return;

        // Mettre à jour avec l'heure réelle
        this.notifyListeners();

        // Continuer la boucle (mise à jour toutes les secondes)
        setTimeout(() => this.tick(), 1000);
    }

    /**
     * Ajoute un listener pour les changements de temps
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * Notifie tous les listeners avec l'heure réelle
     */
    notifyListeners() {
        const currentSeconds = this.getRealTime();
        const timeInfo = {
            seconds: currentSeconds,
            timeString: this.formatTime(currentSeconds),
            isRunning: this.isRunning,
            date: new Date()
        };

        this.listeners.forEach(callback => {
            callback(timeInfo);
        });
    }

    /**
     * Formate les secondes en HH:MM:SS
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    /**
     * Récupère le temps actuel en secondes (heure réelle)
     */
    getCurrentSeconds() {
        return this.getRealTime();
    }

    /**
     * Récupère le temps actuel en format HH:MM:SS (heure réelle)
     */
    getCurrentTimeString() {
        return this.formatTime(this.getRealTime());
    }

    /**
     * Vérifie si le mode temps réel est actif
     */
    getIsRunning() {
        return this.isRunning;
    }
}
