class UI {
    constructor(game) {
        this.game = game;
        this.elements = this.getUIElements();
        this.mobileControls = this.getMobileControls();
        this.touchData = {
            steering: { active: false, startX: 0, startY: 0, currentAngle: 0 },
            accelerate: false,
            brake: false,
            handbrake: false
        };
        
        this.setupEventListeners();
        // this.setupMobileControls(); // Disabled for now
    }
    
    getUIElements() {
        return {
            // Menus
            mainMenu: document.getElementById('mainMenu'),
            pauseMenu: document.getElementById('pauseMenu'),
            raceComplete: document.getElementById('raceComplete'),
            loadingScreen: document.getElementById('loadingScreen'),
            instructions: document.getElementById('instructions'),
            
            // Game UI
            gameUI: document.getElementById('gameUI'),
            speedValue: document.getElementById('speedValue'),
            currentLap: document.getElementById('currentLap'),
            totalLaps: document.getElementById('totalLaps'),
            currentTime: document.getElementById('currentTime'),
            bestTimeValue: document.getElementById('bestTimeValue'),
            
            // Race complete
            finalTime: document.getElementById('finalTime'),
            newRecord: document.getElementById('newRecord'),
            
            // Buttons
            startRace: document.getElementById('startRace'),
            selectTrack: document.getElementById('selectTrack'),
            bestTimes: document.getElementById('bestTimes'),
            settings: document.getElementById('settings'),
            resume: document.getElementById('resume'),
            restart: document.getElementById('restart'),
            mainMenuBtn: document.getElementById('mainMenuBtn'),
            raceAgain: document.getElementById('raceAgain'),
            backToMenu: document.getElementById('backToMenu'),
            closeInstructions: document.getElementById('closeInstructions')
        };
    }
    
    getMobileControls() {
        return {
            container: document.getElementById('mobileControls'),
            steeringWheel: document.getElementById('steeringWheel'),
            steeringKnob: document.getElementById('steeringKnob'),
            accelerate: document.getElementById('accelerate'),
            brake: document.getElementById('brake'),
            handbrake: document.getElementById('handbrake')
        };
    }
    
    setupEventListeners() {
        // Main menu buttons
        this.elements.startRace.addEventListener('click', () => {
            this.showInstructions();
        });
        
        this.elements.selectTrack.addEventListener('click', () => {
            // Future: Track selection
            alert('Track selection coming soon!');
        });
        
        this.elements.bestTimes.addEventListener('click', () => {
            this.showBestTimes();
        });
        
        this.elements.settings.addEventListener('click', () => {
            this.showSettings();
        });
        
        // Pause menu buttons
        this.elements.resume.addEventListener('click', () => {
            this.game.resumeGame();
        });
        
        this.elements.restart.addEventListener('click', () => {
            this.game.startRace();
        });
        
        this.elements.mainMenuBtn.addEventListener('click', () => {
            this.game.showMainMenu();
        });
        
        // Race complete buttons
        this.elements.raceAgain.addEventListener('click', () => {
            this.game.startRace();
        });
        
        this.elements.backToMenu.addEventListener('click', () => {
            this.game.showMainMenu();
        });
        
        // Instructions
        this.elements.closeInstructions.addEventListener('click', () => {
            this.hideInstructions();
            this.game.startRace();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyC' && this.game.gameState === 'racing') {
                const newMode = this.game.cameraController.cycleCameraMode();
                this.showToast(`Camera: ${newMode}`);
            }
        });
    }
    
    setupMobileControls() {
        // Steering wheel control
        let isDragging = false;
        const wheelCenter = { x: 60, y: 60 }; // Center of the steering wheel
        const maxDistance = 40; // Maximum distance from center
        
        const handleSteeringStart = (clientX, clientY) => {
            isDragging = true;
            this.touchData.steering.active = true;
            this.touchData.steering.startX = clientX;
            this.touchData.steering.startY = clientY;
        };
        
        const handleSteeringMove = (clientX, clientY) => {
            if (!isDragging) return;
            
            const rect = this.mobileControls.steeringWheel.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const deltaX = clientX - centerX;
            const deltaY = clientY - centerY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            const clampedDistance = Math.min(distance, maxDistance);
            const angle = Math.atan2(deltaY, deltaX);
            
            const knobX = Math.cos(angle) * clampedDistance;
            const knobY = Math.sin(angle) * clampedDistance;
            
            this.mobileControls.steeringKnob.style.transform = 
                `translate(-50%, -50%) translate(${knobX}px, ${knobY}px)`;
            
            // Calculate steering angle (-1 to 1)
            this.touchData.steering.currentAngle = knobX / maxDistance;
        };
        
        const handleSteeringEnd = () => {
            isDragging = false;
            this.touchData.steering.active = false;
            this.touchData.steering.currentAngle = 0;
            
            // Return knob to center
            this.mobileControls.steeringKnob.style.transform = 
                'translate(-50%, -50%)';
        };
        
        // Mouse events for steering
        this.mobileControls.steeringWheel.addEventListener('mousedown', (e) => {
            handleSteeringStart(e.clientX, e.clientY);
        });
        
        document.addEventListener('mousemove', (e) => {
            handleSteeringMove(e.clientX, e.clientY);
        });
        
        document.addEventListener('mouseup', handleSteeringEnd);
        
        // Touch events for steering
        this.mobileControls.steeringWheel.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleSteeringStart(touch.clientX, touch.clientY);
        });
        
        document.addEventListener('touchmove', (e) => {
            if (isDragging) {
                e.preventDefault();
                const touch = e.touches[0];
                handleSteeringMove(touch.clientX, touch.clientY);
            }
        });
        
        document.addEventListener('touchend', (e) => {
            handleSteeringEnd();
        });
        
        // Pedal controls
        this.mobileControls.accelerate.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touchData.accelerate = true;
        });
        
        this.mobileControls.accelerate.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touchData.accelerate = false;
        });
        
        this.mobileControls.brake.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touchData.brake = true;
        });
        
        this.mobileControls.brake.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touchData.brake = false;
        });
        
        this.mobileControls.handbrake.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touchData.handbrake = true;
        });
        
        this.mobileControls.handbrake.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touchData.handbrake = false;
        });
        
        // Mouse events for pedals (for testing on desktop)
        this.mobileControls.accelerate.addEventListener('mousedown', () => {
            this.touchData.accelerate = true;
        });
        
        this.mobileControls.accelerate.addEventListener('mouseup', () => {
            this.touchData.accelerate = false;
        });
        
        this.mobileControls.brake.addEventListener('mousedown', () => {
            this.touchData.brake = true;
        });
        
        this.mobileControls.brake.addEventListener('mouseup', () => {
            this.touchData.brake = false;
        });
        
        this.mobileControls.handbrake.addEventListener('mousedown', () => {
            this.touchData.handbrake = true;
        });
        
        this.mobileControls.handbrake.addEventListener('mouseup', () => {
            this.touchData.handbrake = false;
        });
    }
    
    // Get mobile control inputs for car (disabled)
    getMobileInputs() {
        return null; // Mobile controls disabled
    }
    
    // Menu visibility methods
    showMainMenu() {
        this.hideAllMenus();
        this.elements.mainMenu.classList.remove('hidden');
    }
    
    showPauseMenu() {
        this.elements.pauseMenu.classList.remove('hidden');
    }
    
    hidePauseMenu() {
        this.elements.pauseMenu.classList.add('hidden');
    }
    
    showRaceComplete(finalTime, isNewRecord) {
        this.hideAllMenus();
        this.elements.raceComplete.classList.remove('hidden');
        this.elements.finalTime.textContent = `Time: ${this.formatTime(finalTime)}`;
        
        if (isNewRecord) {
            this.elements.newRecord.classList.remove('hidden');
        } else {
            this.elements.newRecord.classList.add('hidden');
        }
    }
    
    showLoading() {
        // Hide menus but keep game UI hidden during loading
        this.elements.mainMenu.classList.add('hidden');
        this.elements.pauseMenu.classList.add('hidden');
        this.elements.raceComplete.classList.add('hidden');
        this.elements.instructions.classList.add('hidden');
        this.elements.gameUI.classList.add('hidden');
        
        this.elements.loadingScreen.classList.remove('hidden');
    }
    
    hideLoading() {
        this.elements.loadingScreen.classList.add('hidden');
    }
    
    showGameUI() {
        // Hide all menus first
        this.elements.mainMenu.classList.add('hidden');
        this.elements.pauseMenu.classList.add('hidden');
        this.elements.raceComplete.classList.add('hidden');
        this.elements.loadingScreen.classList.add('hidden');
        this.elements.instructions.classList.add('hidden');
        
        // Then show game UI
        this.elements.gameUI.classList.remove('hidden');
    }
    
    hideGameUI() {
        this.elements.gameUI.classList.add('hidden');
    }
    
    showInstructions() {
        this.elements.instructions.classList.remove('hidden');
    }
    
    hideInstructions() {
        this.elements.instructions.classList.add('hidden');
    }
    
    hideAll() {
        this.elements.mainMenu.classList.add('hidden');
        this.elements.pauseMenu.classList.add('hidden');
        this.elements.raceComplete.classList.add('hidden');
        this.elements.loadingScreen.classList.add('hidden');
        this.elements.instructions.classList.add('hidden');
    }
    
    hideAllMenus() {
        this.elements.mainMenu.classList.add('hidden');
        this.elements.pauseMenu.classList.add('hidden');
        this.elements.raceComplete.classList.add('hidden');
        this.elements.loadingScreen.classList.add('hidden');
        this.elements.instructions.classList.add('hidden');
        this.hideGameUI();
    }
    
    // Game state updates
    updateSpeed(speed) {
        this.elements.speedValue.textContent = speed;
    }
    
    updateLap(currentLap, totalLaps) {
        this.elements.currentLap.textContent = currentLap;
        this.elements.totalLaps.textContent = `/${totalLaps}`;
    }
    
    updateTimer(currentTime, bestTime) {
        this.elements.currentTime.textContent = this.formatTime(currentTime);
        
        if (bestTime) {
            this.elements.bestTimeValue.textContent = this.formatTime(bestTime);
        }
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const centiseconds = Math.floor((seconds % 1) * 100);
        
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }
    
    // Additional UI features
    showToast(message, duration = 2000) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            z-index: 1000;
            font-size: 18px;
            font-weight: bold;
            border: 2px solid #4ecdc4;
            box-shadow: 0 0 20px rgba(78, 205, 196, 0.3);
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, duration);
    }
    
    showBestTimes() {
        const bestTime = this.game.bestTime;
        const message = bestTime ? 
            `Best Time: ${this.formatTime(bestTime)}` : 
            'No best time recorded yet!';
        
        alert(message);
    }
    
    showSettings() {
        // Simple settings dialog for now
        const settings = `
Settings:
- C: Cycle camera modes
- P/ESC: Pause game
- R: Reset car position
- WASD/Arrows: Drive car
- Space: Handbrake

Mobile: Use touch controls at bottom
        `;
        alert(settings);
    }
    
    // Performance overlay (for debugging)
    showFPS() {
        const fpsCounter = document.createElement('div');
        fpsCounter.id = 'fpsCounter';
        fpsCounter.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: #00ff88;
            padding: 5px 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 100;
        `;
        document.body.appendChild(fpsCounter);
        
        let lastTime = performance.now();
        let frameCount = 0;
        
        const updateFPS = () => {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                fpsCounter.textContent = `FPS: ${fps}`;
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(updateFPS);
        };
        
        updateFPS();
    }
    
    // Mini-map (future feature)
    createMiniMap() {
        const miniMap = document.createElement('canvas');
        miniMap.id = 'miniMap';
        miniMap.width = 150;
        miniMap.height = 150;
        miniMap.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 10px;
            background: rgba(0, 0, 0, 0.5);
            z-index: 50;
        `;
        document.body.appendChild(miniMap);
        
        // Mini-map implementation would go here
        // Draw track outline and car position
    }
}