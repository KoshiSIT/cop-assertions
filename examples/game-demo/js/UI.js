/**
 * UI class
 * Manages game UI elements
 */
export default class UI {
    constructor() {
        this.scoreElement = document.getElementById('score');
        this.hpElement = document.getElementById('hp');
        this.hintElement = document.getElementById('hint');
        this.layerStatusElement = document.getElementById('layer-status');
        this.consoleLogElement = document.getElementById('console-log');
        this.showHints = true;
    }

    updateScore(score) {
        this.scoreElement.textContent = `Score: ${score}`;
    }

    updateHP(hp, maxHP) {
        this.hpElement.textContent = `HP: ${hp}/${maxHP}`;
        // Change color based on HP percentage
        const percentage = (hp / maxHP) * 100;
        if (percentage > 50) {
            this.hpElement.style.color = '#4ade80';
        } else if (percentage > 25) {
            this.hpElement.style.color = '#fbbf24';
        } else {
            this.hpElement.style.color = '#f87171';
        }
    }

    updateLayerStatus(layerName) {
        this.layerStatusElement.textContent = `Layer: ${layerName}`;
    }

    setHintVisibility(visible) {
        this.showHints = visible;
        if (visible) {
            this.hintElement.classList.remove('hidden');
        } else {
            this.hintElement.classList.add('hidden');
        }
    }

    log(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        this.consoleLogElement.appendChild(entry);
        this.consoleLogElement.scrollTop = this.consoleLogElement.scrollHeight;

        // Keep only last 20 entries
        while (this.consoleLogElement.children.length > 20) {
            this.consoleLogElement.removeChild(this.consoleLogElement.firstChild);
        }
    }

    showGameOver(score) {
        this.log(`Game Over! Final Score: ${score}`, 'info');
    }

    showTutorialMessage(message, duration = 3000) {
        const tutorialElement = document.getElementById('tutorial-message');
        if (!tutorialElement) return;
        
        tutorialElement.textContent = message;
        tutorialElement.classList.remove('hidden');
        
        // Auto-hide after duration
        setTimeout(() => {
            tutorialElement.classList.add('hidden');
        }, duration);
    }

    hideTutorialMessage() {
        const tutorialElement = document.getElementById('tutorial-message');
        if (tutorialElement) {
            tutorialElement.classList.add('hidden');
        }
    }
}
