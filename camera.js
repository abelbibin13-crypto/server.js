class CameraController {
    constructor(camera) {
        this.camera = camera;
        this.target = null;
        
        // Camera follow settings
        this.followDistance = 15;
        this.followHeight = 8;
        this.lookAtHeight = 2;
        
        // Smooth interpolation
        this.lerpFactor = 0.05;
        this.rotationLerpFactor = 0.08;
        
        // Camera shake for effects
        this.shakeIntensity = 0;
        this.shakeDecay = 0.9;
        
        // Current camera state
        this.currentPosition = new THREE.Vector3();
        this.currentLookAt = new THREE.Vector3();
        this.idealPosition = new THREE.Vector3();
        this.idealLookAt = new THREE.Vector3();
        
        // Camera modes
        this.mode = 'follow'; // 'follow', 'cinematic', 'overhead'
        this.modeTimer = 0;
        
        this.reset();
    }
    
    setTarget(target) {
        this.target = target;
    }
    
    reset() {
        if (this.camera) {
            this.camera.position.set(0, this.followHeight, this.followDistance);
            this.camera.lookAt(0, 0, 0);
            this.currentPosition.copy(this.camera.position);
            this.currentLookAt.set(0, 0, 0);
        }
    }
    
    update(targetPosition, targetRotation) {
        if (!this.target || !targetPosition) return;
        
        // Update based on current camera mode
        switch (this.mode) {
            case 'follow':
                this.updateFollowCamera(targetPosition, targetRotation);
                break;
            case 'cinematic':
                this.updateCinematicCamera(targetPosition, targetRotation);
                break;
            case 'overhead':
                this.updateOverheadCamera(targetPosition);
                break;
        }
        
        // Apply camera shake
        this.applyCameraShake();
        
        // Smooth camera movement
        this.camera.position.lerp(this.currentPosition, this.lerpFactor);
        
        // Smooth look-at
        const lookDirection = this.currentLookAt.clone().sub(this.camera.position).normalize();
        const targetLookDirection = this.idealLookAt.clone().sub(this.camera.position).normalize();
        lookDirection.lerp(targetLookDirection, this.rotationLerpFactor);
        
        const newLookAt = this.camera.position.clone().add(lookDirection.multiplyScalar(100));
        this.camera.lookAt(newLookAt);
        
        this.modeTimer += 0.016; // Assume 60fps
    }
    
    updateFollowCamera(targetPosition, targetRotation) {
        // Calculate ideal camera position behind the car
        const offset = new THREE.Vector3(0, this.followHeight, -this.followDistance);
        
        // Apply car rotation to the offset
        offset.applyEuler(targetRotation);
        
        // Add some dynamic offset based on car speed
        const speed = this.target.getSpeed();
        const speedFactor = Math.min(speed / 100, 1);
        const dynamicDistance = this.followDistance + speedFactor * 5;
        const dynamicHeight = this.followHeight + speedFactor * 2;
        
        offset.normalize().multiplyScalar(dynamicDistance);
        offset.y = dynamicHeight;
        
        this.idealPosition.copy(targetPosition).add(offset);
        this.idealLookAt.copy(targetPosition);
        this.idealLookAt.y += this.lookAtHeight;
        
        // Add slight banking effect for turns
        const angularVelocity = this.target.angularVelocity || 0;
        this.idealPosition.x += Math.sin(angularVelocity * 10) * 2;
        
        this.currentPosition.copy(this.idealPosition);
        this.currentLookAt.copy(this.idealLookAt);
    }
    
    updateCinematicCamera(targetPosition, targetRotation) {
        // Cinematic camera with sweeping movements
        const time = this.modeTimer;
        const radius = 20;
        const height = 12;
        
        const angle = time * 0.5 + targetRotation.y;
        this.idealPosition.set(
            targetPosition.x + Math.cos(angle) * radius,
            targetPosition.y + height + Math.sin(time * 2) * 3,
            targetPosition.z + Math.sin(angle) * radius
        );
        
        this.idealLookAt.copy(targetPosition);
        this.idealLookAt.y += this.lookAtHeight;
        
        this.currentPosition.copy(this.idealPosition);
        this.currentLookAt.copy(this.idealLookAt);
    }
    
    updateOverheadCamera(targetPosition) {
        // Overhead view for better track visibility
        this.idealPosition.set(
            targetPosition.x,
            targetPosition.y + 25,
            targetPosition.z - 5
        );
        
        this.idealLookAt.copy(targetPosition);
        
        this.currentPosition.copy(this.idealPosition);
        this.currentLookAt.copy(this.idealLookAt);
    }
    
    applyCameraShake() {
        if (this.shakeIntensity > 0.01) {
            const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
            const shakeZ = (Math.random() - 0.5) * this.shakeIntensity;
            
            this.currentPosition.add(new THREE.Vector3(shakeX, shakeY, shakeZ));
            this.shakeIntensity *= this.shakeDecay;
        }
    }
    
    shake(intensity = 1) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    }
    
    switchMode(newMode) {
        this.mode = newMode;
        this.modeTimer = 0;
    }
    
    cycleCameraMode() {
        const modes = ['follow', 'cinematic', 'overhead'];
        const currentIndex = modes.indexOf(this.mode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.switchMode(modes[nextIndex]);
        return modes[nextIndex];
    }
    
    // Camera presets for different situations
    setRaceStartCamera() {
        this.mode = 'cinematic';
        this.modeTimer = 0;
        
        // Position camera for dramatic race start
        if (this.target) {
            const targetPos = this.target.getPosition();
            this.camera.position.set(
                targetPos.x - 20,
                targetPos.y + 10,
                targetPos.z + 15
            );
            this.camera.lookAt(targetPos);
        }
    }
    
    setVictoryCamera() {
        this.mode = 'cinematic';
        this.modeTimer = 0;
        
        // Dramatic victory camera angle
        if (this.target) {
            const targetPos = this.target.getPosition();
            this.camera.position.set(
                targetPos.x + 15,
                targetPos.y + 8,
                targetPos.z - 10
            );
            this.camera.lookAt(targetPos.x, targetPos.y, targetPos.z);
        }
    }
    
    // Smooth transitions between positions
    transitionTo(position, lookAt, duration = 2000) {
        const startPosition = this.camera.position.clone();
        const startLookAt = this.currentLookAt.clone();
        const startTime = performance.now();
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Smooth easing
            const easedProgress = this.easeInOutCubic(progress);
            
            this.camera.position.lerpVectors(startPosition, position, easedProgress);
            this.currentLookAt.lerpVectors(startLookAt, lookAt, easedProgress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    // Utility functions
    getCurrentMode() {
        return this.mode;
    }
    
    setFollowDistance(distance) {
        this.followDistance = distance;
    }
    
    setFollowHeight(height) {
        this.followHeight = height;
    }
    
    // Debug camera info
    getDebugInfo() {
        return {
            mode: this.mode,
            position: this.camera.position.clone(),
            lookAt: this.currentLookAt.clone(),
            followDistance: this.followDistance,
            followHeight: this.followHeight
        };
    }
}