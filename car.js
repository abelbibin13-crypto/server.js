class Car {
    constructor() {
        this.mesh = null;
        this.position = new THREE.Vector3(0, 1, 0);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.angularVelocity = 0;
        
        // Car physics properties - faster movement
        this.acceleration = 0.025;
        this.maxSpeed = 1.5;
        this.brakeForce = 0.03;
        this.friction = 0.94;
        this.turnSpeed = 0.06;  // Moderate turning for realistic feel
        this.maxTurnSpeed = 0.08;  // Reasonable max turn rate
        this.handbrakeForce = 0.8;
        
        // Ground detection
        this.groundHeight = 0.5;
        this.gravity = -0.02;
        this.jumpForce = 0.0;
        this.onGround = true;
        
        // Visual effects
        this.wheelRotation = 0;
        this.steerAngle = 0;
        this.maxSteerAngle = 0.5;  // Moderate steering angle
        
        this.createCarMesh();
    }
    
    createCarMesh() {
        const carGroup = new THREE.Group();
        
        // Car body - low-poly design
        const bodyGeometry = new THREE.BoxGeometry(2, 0.8, 4);
        const bodyMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x00ff88
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.4;
        body.castShadow = true;
        body.receiveShadow = true;
        carGroup.add(body);
        
        // Car roof
        const roofGeometry = new THREE.BoxGeometry(1.6, 0.6, 2);
        const roofMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x0088ff
        });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.set(0, 1, 0.5);
        roof.castShadow = true;
        carGroup.add(roof);
        
        // Windshield
        const windshieldGeometry = new THREE.PlaneGeometry(1.4, 0.5);
        const windshieldMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x87CEEB,
            transparent: true,
            opacity: 0.7
        });
        const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
        windshield.position.set(0, 0.9, 1.2);
        windshield.rotation.x = -0.3;
        carGroup.add(windshield);
        
        // Wheels
        this.wheels = [];
        const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
        const wheelMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x333333
        });
        
        const wheelPositions = [
            { x: -1.1, z: 1.3 },  // Front left
            { x: 1.1, z: 1.3 },   // Front right
            { x: -1.1, z: -1.3 }, // Rear left
            { x: 1.1, z: -1.3 }   // Rear right
        ];
        
        wheelPositions.forEach((pos, index) => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(pos.x, 0.3, pos.z);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            this.wheels.push(wheel);
            carGroup.add(wheel);
        });
        
        // Headlights
        const headlightGeometry = new THREE.SphereGeometry(0.15, 6, 6);
        const headlightMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffff88,
            emissive: 0x444422
        });
        
        const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        leftHeadlight.position.set(-0.6, 0.6, 2.1);
        carGroup.add(leftHeadlight);
        
        const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        rightHeadlight.position.set(0.6, 0.6, 2.1);
        carGroup.add(rightHeadlight);
        
        // Taillights
        const taillightMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xff0000,
            emissive: 0x220000
        });
        
        const leftTaillight = new THREE.Mesh(headlightGeometry, taillightMaterial);
        leftTaillight.position.set(-0.6, 0.6, -2.1);
        carGroup.add(leftTaillight);
        
        const rightTaillight = new THREE.Mesh(headlightGeometry, taillightMaterial);
        rightTaillight.position.set(0.6, 0.6, -2.1);
        carGroup.add(rightTaillight);
        
        // Spoiler for extra style
        const spoilerGeometry = new THREE.BoxGeometry(1.8, 0.1, 0.3);
        const spoilerMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x0088ff
        });
        const spoiler = new THREE.Mesh(spoilerGeometry, spoilerMaterial);
        spoiler.position.set(0, 1.2, -1.8);
        spoiler.castShadow = true;
        carGroup.add(spoiler);
        
        this.mesh = carGroup;
        this.updatePosition();
    }
    
    addToScene(scene) {
        scene.add(this.mesh);
    }
    
    removeFromScene(scene) {
        scene.remove(this.mesh);
    }
    
    update(keys, mobileInputs = null) {
        // Always check keyboard first, mobile as fallback
        let forward = keys['KeyW'] || keys['ArrowUp'];
        let backward = keys['KeyS'] || keys['ArrowDown'];
        let left = keys['KeyA'] || keys['ArrowLeft'];
        let right = keys['KeyD'] || keys['ArrowRight'];
        let handbrake = keys['Space'];
        
        // Use mobile inputs only if no keyboard input detected
        if (mobileInputs && !forward && !backward && !left && !right && !handbrake) {
            forward = mobileInputs.forward;
            backward = mobileInputs.backward;
            left = mobileInputs.left;
            right = mobileInputs.right;
            handbrake = mobileInputs.handbrake;
        }
        
        // Calculate speed factor for turning (less penalty at high speeds)
        const speedFactor = Math.max(0.6, 1 - (this.velocity.length() / this.maxSpeed) * 0.4);
        
        // Handle steering
        let targetSteerAngle = 0;
        if (left) targetSteerAngle = this.maxSteerAngle;
        if (right) targetSteerAngle = -this.maxSteerAngle;
        
        // Moderate steering interpolation for realistic turns
        this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteerAngle, 0.15);
        
        // Apply turning (can turn even when stationary)
        const currentSpeed = this.velocity.length();
        let turnRate;
        if (currentSpeed > 0.01) {
            // Normal turning when moving
            turnRate = this.turnSpeed * speedFactor;
        } else {
            // Allow stationary turning at reduced rate
            turnRate = this.turnSpeed * 0.5;
        }
        this.angularVelocity = this.steerAngle * turnRate;
        this.rotation.y += this.angularVelocity;
        
        // Calculate movement direction based on car rotation (away from camera)
        const direction = new THREE.Vector3(0, 0, 1);  // Positive Z = away from camera
        direction.applyEuler(this.rotation);
        
        // Handle acceleration and braking
        if (forward) {
            const accelerationForce = this.acceleration;
            this.velocity.add(direction.clone().multiplyScalar(accelerationForce));
        }
        
        if (backward) {
            const brakeDirection = direction.clone().negate();
            this.velocity.add(brakeDirection.multiplyScalar(this.brakeForce));
        }
        
        // Apply handbrake
        if (handbrake) {
            this.velocity.multiplyScalar(this.handbrakeForce);
        }
        
        // Apply friction
        this.velocity.multiplyScalar(this.friction);
        
        // Limit max speed
        if (this.velocity.length() > this.maxSpeed) {
            this.velocity.normalize().multiplyScalar(this.maxSpeed);
        }
        
        // Apply gravity and ground collision
        if (this.position.y > this.groundHeight) {
            this.velocity.y += this.gravity;
            this.onGround = false;
        } else {
            this.position.y = this.groundHeight;
            this.velocity.y = 0;
            this.onGround = true;
        }
        
        // Update position
        this.position.add(this.velocity);
        
        // Update visual elements
        this.updateWheels();
        this.updatePosition();
        
        // Add some car tilt for visual effect
        this.updateCarTilt();
    }
    
    updateWheels() {
        // Rotate wheels based on movement
        this.wheelRotation += this.velocity.length() * 5;
        
        // Update front wheels (steering)
        if (this.wheels.length >= 2) {
            this.wheels[0].rotation.y = this.steerAngle; // Front left
            this.wheels[1].rotation.y = this.steerAngle; // Front right
        }
        
        // Rotate all wheels
        this.wheels.forEach(wheel => {
            wheel.rotation.x = this.wheelRotation;
        });
    }
    
    updateCarTilt() {
        // Add subtle tilting based on turning and speed
        const tiltAmount = this.angularVelocity * 0.5;
        const speedTilt = Math.sin(performance.now() * 0.01) * this.velocity.length() * 0.02;
        
        this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, tiltAmount, 0.1);
        this.mesh.rotation.x = speedTilt;
    }
    
    updatePosition() {
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation.y;
    }
    
    reset(startPosition = null, startRotation = null) {
        if (startPosition) {
            this.position.copy(startPosition);
        } else {
            this.position.set(0, this.groundHeight, 0);
        }
        
        if (startRotation !== null) {
            this.rotation.set(0, startRotation, 0);
        } else {
            this.rotation.set(0, 0, 0);
        }
        
        this.velocity.set(0, 0, 0);
        this.angularVelocity = 0;
        this.steerAngle = 0;
        this.wheelRotation = 0;
        this.updatePosition();
        
        // Reset visual tilting
        this.mesh.rotation.x = 0;
        this.mesh.rotation.z = 0;
    }
    
    getSpeed() {
        // Return speed in km/h for display
        return Math.round(this.velocity.length() * 150); // Convert to km/h scale
    }
    
    getPosition() {
        return this.position.clone();
    }
    
    getRotation() {
        return this.rotation.clone();
    }
    
    // Collision response
    handleCollision(normal) {
        // Reflect velocity based on collision normal
        const dot = this.velocity.dot(normal);
        if (dot < 0) {
            this.velocity.sub(normal.clone().multiplyScalar(dot * 1.5));
        }
        
        // Add some bounce effect
        this.velocity.add(normal.clone().multiplyScalar(0.1));
    }
    
    // Jump (for ramps or fun)
    jump() {
        if (this.onGround) {
            this.velocity.y = 0.3;
            this.onGround = false;
        }
    }
}