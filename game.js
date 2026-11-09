class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.car = null;
        this.track = null;
        this.cameraController = null;
        this.ui = null;
        
        this.gameState = 'menu'; // 'menu', 'loading', 'racing', 'paused', 'complete'
        this.raceStartTime = 0;
        this.currentLapTime = 0;
        this.lapTimes = [];
        this.bestTime = null;
        this.currentLap = 1;
        this.totalLaps = 3;
        
        this.particles = [];
        this.particleSystem = null;
        this.keys = {};
        this.audioContext = null;
        this.sounds = {};
        this.multiplayer = null;
        this.multiplayerRace = false;
        this.init();
    }
    
    init() {
        this.setupRenderer();
        this.setupScene();
        this.setupLighting();
        this.setupEventListeners();
        
        this.ui = new UI(this);
        window.polyTrackGame = this;
        this.cameraController = new CameraController(this.camera);
        this.setupParticleSystem();
        // this.setupAudio(); // Disabled for now
        
        this.loadBestTime();
        this.showMainMenu();
        
        this.animate();
    }
    
    setupRenderer() {
        const canvas = document.getElementById('gameCanvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Low-poly aesthetic with flat shading
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
    }
    
    setupScene() {
        this.scene = new THREE.Scene();
        
        // Gradient sky background
        const skyGeometry = new THREE.SphereGeometry(1000, 32, 16);
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0xFF6B35) },
                bottomColor: { value: new THREE.Color(0x4ECDC4) },
                offset: { value: 50 },
                exponent: { value: 0.8 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });
        
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(sky);
        
        // Setup camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            2000
        );
        this.camera.position.set(0, 15, 20);
    }
    
    setupLighting() {
        // Ambient light for low-poly aesthetic
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // Main directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xFFE4B5, 1.2);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        this.scene.add(directionalLight);
        
        // Fill light
        const fillLight = new THREE.DirectionalLight(0x4ECDC4, 0.4);
        fillLight.position.set(-50, 50, -50);
        this.scene.add(fillLight);
    }
    
    setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            
            // Game controls
            if (event.code === 'KeyP' || event.code === 'Escape') {
                if (this.gameState === 'racing') {
                    this.pauseGame();
                } else if (this.gameState === 'paused') {
                    this.resumeGame();
                }
            }
            
            if (event.code === 'KeyR' && this.gameState === 'racing') {
                this.resetCarPosition();
            }
        });
        
        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        // Prevent context menu on right click
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }
    
    setupParticleSystem() {
        // Create particle geometry and material
        const particleGeometry = new THREE.BufferGeometry();
        const particleCount = 1000;
        
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            
            colors[i * 3] = 1;
            colors[i * 3 + 1] = 1;
            colors[i * 3 + 2] = 1;
            
            sizes[i] = 1;
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2,
            transparent: true,
            opacity: 0.8,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthTest: false
        });
        
        this.particleSystem = new THREE.Points(particleGeometry, particleMaterial);
        this.scene.add(this.particleSystem);
    }
    
    createParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
        
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        return texture;
    }
    
    setupAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Simple sound generation using Web Audio API
            this.sounds = {
                engine: this.createEngineSound(),
                collision: this.createCollisionSound(),
                checkpoint: this.createCheckpointSound()
            };
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }
    
    createEngineSound() {
        return {
            play: (pitch = 1) => {
                if (!this.audioContext) return;
                
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(100 * pitch, this.audioContext.currentTime);
                
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
                
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.5);
            }
        };
    }
    
    createCollisionSound() {
        return {
            play: () => {
                if (!this.audioContext) return;
                
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                const filter = this.audioContext.createBiquadFilter();
                
                oscillator.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.type = 'white';
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1000, this.audioContext.currentTime);
                
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.2);
            }
        };
    }
    
    createCheckpointSound() {
        return {
            play: () => {
                if (!this.audioContext) return;
                
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
                oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime + 0.1);
                
                gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.3);
            }
        };
    }
    
    startRace() {
        console.log('Starting race...');
        this.gameState = 'loading';
        this.ui.showLoading();
        
        // Simulate loading time
        setTimeout(() => {
            try {
                console.log('Initializing race...');
                this.initializeRace();
                this.gameState = 'racing';
                this.ui.hideLoading();
                this.ui.showGameUI();
                this.raceStartTime = performance.now();
                this.currentLap = 1;
                this.lapTimes = [];
                console.log('Race started successfully!');
            } catch (error) {
                console.error('Error starting race:', error);
                this.gameState = 'menu';
                this.ui.hideLoading();
                this.ui.showMainMenu();
            }
        }, 1500);
    }
    
    initializeRace() {
        console.log('Clearing existing objects...');
        // Clear existing objects
        if (this.car) this.scene.remove(this.car.mesh);
        if (this.track) this.track.removeFromScene(this.scene);
        
        console.log('Creating track...');
        // Create track
        this.track = new Track();
        this.track.addToScene(this.scene);
        
        console.log('Creating car...');
        // Create car
        this.car = new Car();
        this.car.addToScene(this.scene);
        
        console.log('Positioning car...');
        // Position car at track start
        const startPosition = this.track.getStartPosition();
        const startRotation = this.track.getStartRotation();
        console.log('Start position:', startPosition, 'Start rotation:', startRotation);
        this.car.reset(startPosition, startRotation);
        
        console.log('Setting up camera...');
        // Position camera
        this.cameraController.setTarget(this.car);
        this.cameraController.reset();
        console.log('Race initialization complete!');
    }
    
    pauseGame() {
        this.gameState = 'paused';
        this.ui.showPauseMenu();
    }
    
    resumeGame() {
        this.gameState = 'racing';
        this.ui.hidePauseMenu();
        this.ui.showGameUI();
    }
    
    resetCarPosition() {
        if (this.car && this.track) {
            const startPosition = this.track.getStartPosition();
            const startRotation = this.track.getStartRotation();
            this.car.reset(startPosition, startRotation);
        }
    }
    
    finishRace() {
        this.gameState = 'complete';
        if (this.multiplayer && this.multiplayerRace) {
            this.multiplayer.finishLocalPlayer(this.currentLapTime);
        }
        const finalTime = this.currentLapTime;
        
        // Check if new best time
        let isNewRecord = false;
        if (!this.bestTime || finalTime < this.bestTime) {
            this.bestTime = finalTime;
            this.saveBestTime();
            isNewRecord = true;
        }
        
        this.ui.showRaceComplete(finalTime, isNewRecord);
    }
    
    showMainMenu() {
        this.gameState = 'menu';
        this.multiplayerRace = false;
        this.ui.showMainMenu();
    }
    
    loadBestTime() {
        const saved = localStorage.getItem('polytrack_best_time');
        if (saved) {
            this.bestTime = parseFloat(saved);
        }
    }
    
    saveBestTime() {
        if (this.bestTime) {
            localStorage.setItem('polytrack_best_time', this.bestTime.toString());
        }
    }
    
    update() {
        if (this.gameState !== 'racing') return;
        
        // Update car physics
        if (this.car) {
            const mobileInputs = this.ui ? this.ui.getMobileInputs() : null;
            this.car.update(this.keys, mobileInputs);
            
            // Generate particles based on car speed
            const speed = this.car.getSpeed();
            if (speed > 20) {
                this.createSpeedParticles(this.car.position, speed);
            }
            
            // Engine sound disabled
            
            // Check lap completion
            const lapComplete = this.track.checkLapCompletion(this.car.position);
            if (lapComplete) {
                this.completeLap();
                // Checkpoint sound disabled
            }
            
            // Check collision with track boundaries
            const hadCollision = this.track.checkCollision(this.car);
            if (hadCollision) {
                // Collision sound disabled
                this.cameraController.shake(0.5);
            }
        }
        
        // Update camera
        if (this.cameraController && this.car) {
            this.cameraController.update(this.car.position, this.car.rotation);
        }
        
        // Update timer
        if (this.raceStartTime) {
            this.currentLapTime = (performance.now() - this.raceStartTime) / 1000;
            this.ui.updateTimer(this.currentLapTime, this.bestTime);
        }
        
        // Update speed display
        if (this.car) {
            this.ui.updateSpeed(this.car.getSpeed());
        }
        
        // Publish local state and render remote opponents during multiplayer races.
        if (this.multiplayer && this.multiplayer.connected && this.multiplayerRace && this.car) {
            this.multiplayer.updateLocalPlayer(this);
        }

        // Update particles
        this.updateParticles();
    }
    
    completeLap() {
        this.lapTimes.push(this.currentLapTime);
        this.currentLap++;
        
        if (this.currentLap > this.totalLaps) {
            this.finishRace();
        } else {
            this.ui.updateLap(this.currentLap, this.totalLaps);
            // Reset timer for next lap
            this.raceStartTime = performance.now();
        }
    }
    
    createSpeedParticles(position, speed) {
        if (!this.particleSystem) return;
        
        const particleCount = Math.min(Math.floor(speed / 10), 20);
        
        for (let i = 0; i < particleCount; i++) {
            const particle = {
                position: position.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 3,
                    Math.random() * 0.5,
                    -Math.random() * 3 - 2 // Behind the car
                )),
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.1,
                    Math.random() * 0.05,
                    -Math.random() * 0.2 - 0.1
                ),
                life: 1.0,
                decay: 0.02,
                size: Math.random() * 2 + 1,
                color: {
                    r: 0.8 + Math.random() * 0.2,
                    g: 0.4 + Math.random() * 0.3,
                    b: 0.1 + Math.random() * 0.2
                }
            };
            this.particles.push(particle);
        }
        
        // Limit particle count for performance
        if (this.particles.length > 500) {
            this.particles.splice(0, this.particles.length - 500);
        }
    }
    
    updateParticles() {
        if (!this.particleSystem) return;
        
        // Update individual particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.position.add(particle.velocity);
            particle.life -= particle.decay;
            particle.velocity.multiplyScalar(0.98); // Friction
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        // Update particle system geometry
        const positions = this.particleSystem.geometry.attributes.position.array;
        const colors = this.particleSystem.geometry.attributes.color.array;
        const sizes = this.particleSystem.geometry.attributes.size.array;
        
        // Clear arrays
        positions.fill(0);
        colors.fill(0);
        sizes.fill(0);
        
        // Update with current particles
        for (let i = 0; i < Math.min(this.particles.length, 1000); i++) {
            const particle = this.particles[i];
            
            positions[i * 3] = particle.position.x;
            positions[i * 3 + 1] = particle.position.y;
            positions[i * 3 + 2] = particle.position.z;
            
            colors[i * 3] = particle.color.r * particle.life;
            colors[i * 3 + 1] = particle.color.g * particle.life;
            colors[i * 3 + 2] = particle.color.b * particle.life;
            
            sizes[i] = particle.size * particle.life;
        }
        
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        this.particleSystem.geometry.attributes.color.needsUpdate = true;
        this.particleSystem.geometry.attributes.size.needsUpdate = true;
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new Game();
});