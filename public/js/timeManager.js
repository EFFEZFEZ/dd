/**
 * timeManager.js
 * 
 * Gère le temps simulé avec contrôles de lecture, pause et accélération
 */

export class TimeManager {
    constructor(startTimeString = '08:00:00') {
        this.isRunning = false;
        this.speed = 1;
        this.currentSeconds = this.parseTime(startTimeString);
        this.startSeconds = this.currentSeconds;
        this.lastUpdateTime = null;
        this.listeners = [];
    }

    /**
     * Parse une heure HH:MM ou HH:MM:SS en secondes
     */
    parseTime(timeString) {
        const parts = timeString.split(':');
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const seconds = parseInt(parts[2] || 0);
        
        return hours * 3600 + minutes * 60 + seconds;
    }

    /**
     * Démarre la simulation
     */
    play() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastUpdateTime = Date.now();
            this.tick();
            console.log('▶️ Simulation démarrée');
        }
    }

    /**
     * Met en pause la simulation
     */
    pause() {
        this.isRunning = false;
        console.log('⏸️ Simulation en pause');
    }

    /**
     * Reset la simulation à l'heure de départ
     */
    reset(startTimeString = null) {
        this.pause();
        if (startTimeString) {
            this.startSeconds = this.parseTime(startTimeString);
        }
        this.currentSeconds = this.startSeconds;
        this.notifyListeners();
        console.log('🔄 Simulation réinitialisée');
    }

    /**
     * Change la vitesse de simulation
     */
    setSpeed(newSpeed) {
        this.speed = newSpeed;
        console.log(`⚡ Vitesse: x${newSpeed}`);
        this.notifyListeners();
    }

    /**
     * Boucle principale de mise à jour du temps
     */
    tick() {
        if (!this.isRunning) return;

        const now = Date.now();
        const deltaMs = now - this.lastUpdateTime;
        this.lastUpdateTime = now;

        // Convertir le delta en secondes simulées
        const deltaSeconds = (deltaMs / 1000) * this.speed;
        this.currentSeconds += deltaSeconds;

        // Boucler à minuit (24h = 86400 secondes)
        if (this.currentSeconds >= 86400) {
            this.currentSeconds = 0;
        }

        // Notifier les listeners
        this.notifyListeners();

        // Continuer la boucle
        requestAnimationFrame(() => this.tick());
    }

    /**
     * Ajoute un listener pour les changements de temps
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * Notifie tous les listeners
     */
    notifyListeners() {
        const timeInfo = {
            seconds: this.currentSeconds,
            timeString: this.formatTime(this.currentSeconds),
            speed: this.speed,
            isRunning: this.isRunning
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
     * Récupère le temps actuel en secondes
     */
    getCurrentSeconds() {
        return this.currentSeconds;
    }

    /**
     * Récupère le temps actuel en format HH:MM:SS
     */
    getCurrentTimeString() {
        return this.formatTime(this.currentSeconds);
    }

    /**
     * Vérifie si la simulation est en cours
     */
    getIsRunning() {
        return this.isRunning;
    }

    /**
     * Récupère la vitesse actuelle
     */
    getSpeed() {
        return this.speed;
    }
}
