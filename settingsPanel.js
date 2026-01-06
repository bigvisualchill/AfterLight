export class SettingsPanel {
    constructor(onChangeCallback) {
        this.onChangeCallback = onChangeCallback;
        this.settings = {
            particlesPerClick: 10000,
            fadeDuration: 3.0,
            curlNoiseStrength: 0.5,
            noiseScale: 1.0,
            particleSpeed: 1.0,
            auxiliaryRatio: 0.3,
            particleSize: 0.01,
        };
        
        this.container = document.getElementById('settings-panel');
        this.createUI();
    }

    createUI() {
        if (!this.container) {
            console.error('Settings panel container not found!');
            return;
        }
        console.log('Creating settings UI...');
        this.container.innerHTML = `
            <div class="settings-content">
                <h2>Settings</h2>
                
                <div class="setting-group">
                    <label for="particles-per-click">
                        Particles per Click
                        <span class="value-display" id="particles-per-click-value">${this.settings.particlesPerClick}</span>
                    </label>
                    <input type="range" id="particles-per-click" min="1000" max="50000" step="1000" value="${this.settings.particlesPerClick}">
                </div>
                
                <div class="setting-group">
                    <label for="fade-duration">
                        Fade Duration (s)
                        <span class="value-display" id="fade-duration-value">${this.settings.fadeDuration.toFixed(1)}</span>
                    </label>
                    <input type="range" id="fade-duration" min="0.5" max="10" step="0.1" value="${this.settings.fadeDuration}">
                </div>
                
                <div class="setting-group">
                    <label for="curl-noise-strength">
                        Curl Noise Strength
                        <span class="value-display" id="curl-noise-strength-value">${this.settings.curlNoiseStrength.toFixed(2)}</span>
                    </label>
                    <input type="range" id="curl-noise-strength" min="0" max="2" step="0.01" value="${this.settings.curlNoiseStrength}">
                </div>
                
                <div class="setting-group">
                    <label for="noise-scale">
                        Noise Scale
                        <span class="value-display" id="noise-scale-value">${this.settings.noiseScale.toFixed(2)}</span>
                    </label>
                    <input type="range" id="noise-scale" min="0.1" max="5" step="0.1" value="${this.settings.noiseScale}">
                </div>
                
                <div class="setting-group">
                    <label for="particle-speed">
                        Particle Speed
                        <span class="value-display" id="particle-speed-value">${this.settings.particleSpeed.toFixed(2)}</span>
                    </label>
                    <input type="range" id="particle-speed" min="0.1" max="3" step="0.1" value="${this.settings.particleSpeed}">
                </div>
                
                <div class="setting-group">
                    <label for="particle-size">
                        Particle Size
                        <span class="value-display" id="particle-size-value">${this.settings.particleSize.toFixed(3)}</span>
                    </label>
                    <input type="range" id="particle-size" min="0.001" max="0.05" step="0.001" value="${this.settings.particleSize}">
                </div>
            </div>
        `;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        const inputs = this.container.querySelectorAll('input[type="range"]');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const id = e.target.id;
                let value = parseFloat(e.target.value);
                
                // Update setting
                switch(id) {
                    case 'particles-per-click':
                        this.settings.particlesPerClick = value;
                        this.updateValueDisplay('particles-per-click-value', Math.round(value));
                        break;
                    case 'fade-duration':
                        this.settings.fadeDuration = value;
                        this.updateValueDisplay('fade-duration-value', value.toFixed(1));
                        break;
                    case 'curl-noise-strength':
                        this.settings.curlNoiseStrength = value;
                        this.updateValueDisplay('curl-noise-strength-value', value.toFixed(2));
                        break;
                    case 'noise-scale':
                        this.settings.noiseScale = value;
                        this.updateValueDisplay('noise-scale-value', value.toFixed(2));
                        break;
                    case 'particle-speed':
                        this.settings.particleSpeed = value;
                        this.updateValueDisplay('particle-speed-value', value.toFixed(2));
                        break;
                    case 'particle-size':
                        this.settings.particleSize = value;
                        this.updateValueDisplay('particle-size-value', value.toFixed(3));
                        break;
                }
                
                // Notify callback
                if (this.onChangeCallback) {
                    this.onChangeCallback();
                }
            });
        });
    }

    updateValueDisplay(id, value) {
        const display = document.getElementById(id);
        if (display) {
            display.textContent = value;
        }
    }

    getValue(key) {
        return this.settings[key];
    }

    getAllValues() {
        return { ...this.settings };
    }
}

