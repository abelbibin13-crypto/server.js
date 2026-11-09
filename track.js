class Track {
    constructor() {
        this.trackMesh = null;
        this.barrierMeshes = [];
        this.checkpoints = [];
        this.startFinishLine = null;
        
        // Track parameters - single lane
        this.trackWidth = 3;
        this.trackPoints = [];
        this.trackRadius = 40;
        this.checkpointsPassed = new Set();
        this.lapCount = 0;
        
        // Visual elements
        this.decorations = [];
        
        this.generateTrack();
        this.createTrackMesh();
        this.createBarriers();
        this.createCheckpoints();
        this.createDecorations();
    }
    
    generateTrack() {
        // Create a curved racing circuit with elevation changes
        const numPoints = 32;
        const centerX = 0;
        const centerZ = 0;
        
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            
            // Create an interesting track shape (not just a circle)
            let radius = this.trackRadius;
            
            // Add some variation to make it more interesting
            if (i >= 4 && i <= 8) {
                radius *= 1.3; // Wider turn
            } else if (i >= 12 && i <= 16) {
                radius *= 0.8; // Tighter turn
            } else if (i >= 20 && i <= 24) {
                radius *= 1.2; // Another wide section
            }
            
            // Keep track completely flat
            let height = 0;
            
            const x = centerX + Math.cos(angle) * radius;
            const z = centerZ + Math.sin(angle) * radius;
            
            this.trackPoints.push({
                x: x,
                y: height,
                z: z,
                angle: angle
            });
        }
    }
    
    createTrackMesh() {
        const trackGroup = new THREE.Group();
        
        // Create track surface using segments
        for (let i = 0; i < this.trackPoints.length; i++) {
            const current = this.trackPoints[i];
            const next = this.trackPoints[(i + 1) % this.trackPoints.length];
            
            // Calculate track direction
            const direction = new THREE.Vector3(
                next.x - current.x,
                next.y - current.y,
                next.z - current.z
            ).normalize();
            
            // Calculate perpendicular vector for track width
            const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
            
            // Create flat black track plate (shorter segments)
            const segmentLength = Math.sqrt(
                (next.x - current.x) ** 2 + (next.z - current.z) ** 2
            );
            const segmentGeometry = new THREE.BoxGeometry(this.trackWidth, 0.3, segmentLength);
            const segmentMaterial = new THREE.MeshLambertMaterial({
                color: 0x000000  // Pure black
            });
            
            const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
            segment.position.set(
                (current.x + next.x) / 2,  // Center between current and next
                0.15,  // Slightly above ground
                (current.z + next.z) / 2   // Center between current and next
            );
            
            // Orient segment along track direction
            const angle = Math.atan2(next.z - current.z, next.x - current.x);
            segment.rotation.y = angle;
            segment.receiveShadow = true;
            segment.castShadow = true;
            
            trackGroup.add(segment);
            
            // Add track markings
            this.createTrackMarkings(trackGroup, current, next, perpendicular, i);
        }
        
        // Create ground plane
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshLambertMaterial({
            color: 0x2d5a27
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        trackGroup.add(ground);
        
        // Create two long vertical cylinders along the track
        this.createTrackCylinders(trackGroup);
        
        this.trackMesh = trackGroup;
    }
    
    createTrackMarkings(trackGroup, current, next, perpendicular, index) {
        // Simple yellow center line
        const lineGeometry = new THREE.BoxGeometry(0.3, 0.15, 4);
        const lineMaterial = new THREE.MeshLambertMaterial({
            color: 0xffff00,
            emissive: 0x222200  // Slight glow
        });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.position.set(current.x, 0.25, current.z);  // Force flat
        trackGroup.add(line);
    }
    
    createTrackCylinders(trackGroup) {
        // Create two tall vertical cylinders that span the entire track
        const cylinderHeight = 3;
        const cylinderGeometry = new THREE.CylinderGeometry(0.2, 0.2, cylinderHeight, 8);
        const cylinderMaterial = new THREE.MeshLambertMaterial({
            color: 0x000000
        });
        
        // Calculate track center
        let centerX = 0, centerZ = 0;
        this.trackPoints.forEach(point => {
            centerX += point.x;
            centerZ += point.z;
        });
        centerX /= this.trackPoints.length;
        centerZ /= this.trackPoints.length;
        
        // Left cylinder (inner side of track)
        const leftCylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
        leftCylinder.position.set(
            centerX - this.trackRadius * 0.7,
            cylinderHeight / 2,
            centerZ
        );
        leftCylinder.castShadow = true;
        trackGroup.add(leftCylinder);
        
        // Right cylinder (outer side of track)  
        const rightCylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
        rightCylinder.position.set(
            centerX + this.trackRadius * 0.7,
            cylinderHeight / 2,
            centerZ
        );
        rightCylinder.castShadow = true;
        trackGroup.add(rightCylinder);
    }
    
    createBarriers() {
        this.barrierMeshes = [];
        
        for (let i = 0; i < this.trackPoints.length; i++) {
            const current = this.trackPoints[i];
            const next = this.trackPoints[(i + 1) % this.trackPoints.length];
            
            // Calculate direction and perpendicular
            const direction = new THREE.Vector3(
                next.x - current.x,
                next.y - current.y,
                next.z - current.z
            ).normalize();
            const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
            
            // Create barriers on both sides
            this.createBarrierSegment(current, perpendicular, this.trackWidth / 2 + 2, 'outer');
            this.createBarrierSegment(current, perpendicular, -this.trackWidth / 2 - 2, 'inner');
        }
    }
    
    createBarrierSegment(point, perpendicular, offset, type) {
        const barrierGeometry = new THREE.BoxGeometry(1, 2, 1);
        const barrierMaterial = new THREE.MeshLambertMaterial({
            color: type === 'outer' ? 0xff4444 : 0x4444ff
        });
        
        const barrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
        const barrierPos = perpendicular.clone().multiplyScalar(offset);
        barrier.position.set(
            point.x + barrierPos.x,
            point.y + 1,
            point.z + barrierPos.z
        );
        barrier.castShadow = true;
        barrier.userData = { type: 'barrier' };
        
        this.barrierMeshes.push(barrier);
    }
    
    createCheckpoints() {
        this.checkpoints = [];
        const numCheckpoints = 8;
        
        for (let i = 0; i < numCheckpoints; i++) {
            const pointIndex = Math.floor((i / numCheckpoints) * this.trackPoints.length);
            const point = this.trackPoints[pointIndex];
            
            const checkpoint = {
                position: new THREE.Vector3(point.x, point.y, point.z),
                index: i,
                passed: false
            };
            
            this.checkpoints.push(checkpoint);
            
            // Create visual checkpoint marker
            const checkpointGeometry = new THREE.RingGeometry(2, 3, 8);
            const checkpointMaterial = new THREE.MeshLambertMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.3
            });
            
            const checkpointMesh = new THREE.Mesh(checkpointGeometry, checkpointMaterial);
            checkpointMesh.position.copy(checkpoint.position);
            checkpointMesh.position.y += 0.1;
            checkpointMesh.rotation.x = -Math.PI / 2;
            checkpointMesh.userData = { type: 'checkpoint', index: i };
            
            this.checkpoints[i].mesh = checkpointMesh;
        }
        
        // Create start/finish line
        const startPoint = this.trackPoints[0];
        const finishGeometry = new THREE.PlaneGeometry(this.trackWidth, 0.5);
        const finishMaterial = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        
        this.startFinishLine = new THREE.Mesh(finishGeometry, finishMaterial);
        this.startFinishLine.position.set(startPoint.x, startPoint.y + 0.05, startPoint.z);
        this.startFinishLine.rotation.x = -Math.PI / 2;
        this.startFinishLine.userData = { type: 'finish' };
    }
    
    createDecorations() {
        this.decorations = [];
        
        // Add many scattered trees around the landscape
        for (let i = 0; i < 100; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = this.trackRadius + 20 + Math.random() * 40;
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            
            if (Math.random() > 0.3) {
                // Create tree (70% chance)
                this.createTree(x, 0, z);
            } else {
                // Create rock (30% chance)
                this.createRock(x, 0, z);
            }
        }
        
        // Create a river
        this.createRiver();
    }
    
    createTree(x, y, z) {
        const treeGroup = new THREE.Group();
        
        // Trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 6);
        const trunkMaterial = new THREE.MeshLambertMaterial({
            color: 0x8B4513
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        treeGroup.add(trunk);
        
        // Leaves
        const leavesGeometry = new THREE.ConeGeometry(2, 4, 8);
        const leavesMaterial = new THREE.MeshLambertMaterial({
            color: 0x228B22
        });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 4;
        leaves.castShadow = true;
        treeGroup.add(leaves);
        
        treeGroup.position.set(x, y, z);
        this.decorations.push(treeGroup);
    }
    
    createRock(x, y, z) {
        const rockGeometry = new THREE.DodecahedronGeometry(Math.random() * 1 + 0.5, 0);
        const rockMaterial = new THREE.MeshLambertMaterial({
            color: 0x696969
        });
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.set(x, y + 0.5, z);
        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        rock.castShadow = true;
        this.decorations.push(rock);
    }
    
    createRiver() {
        // Create a winding river across the landscape
        const riverPoints = [];
        for (let i = 0; i < 20; i++) {
            const t = i / 19;
            const x = -80 + t * 160 + Math.sin(t * Math.PI * 3) * 20;
            const z = -80 + t * 160 + Math.cos(t * Math.PI * 2) * 15;
            riverPoints.push({ x, z });
        }
        
        for (let i = 0; i < riverPoints.length - 1; i++) {
            const current = riverPoints[i];
            const next = riverPoints[i + 1];
            
            const length = Math.sqrt(
                (next.x - current.x) ** 2 + (next.z - current.z) ** 2
            );
            
            const riverGeometry = new THREE.BoxGeometry(8, 0.1, length);
            const riverMaterial = new THREE.MeshLambertMaterial({
                color: 0x4466aa,
                transparent: true,
                opacity: 0.8
            });
            
            const riverSegment = new THREE.Mesh(riverGeometry, riverMaterial);
            riverSegment.position.set(
                (current.x + next.x) / 2,
                -0.05,
                (current.z + next.z) / 2
            );
            
            const angle = Math.atan2(next.z - current.z, next.x - current.x);
            riverSegment.rotation.y = angle;
            
            this.decorations.push(riverSegment);
        }
    }
    
    addToScene(scene) {
        scene.add(this.trackMesh);
        
        this.barrierMeshes.forEach(barrier => {
            scene.add(barrier);
        });
        
        this.checkpoints.forEach(checkpoint => {
            scene.add(checkpoint.mesh);
        });
        
        scene.add(this.startFinishLine);
        
        this.decorations.forEach(decoration => {
            scene.add(decoration);
        });
    }
    
    removeFromScene(scene) {
        scene.remove(this.trackMesh);
        
        this.barrierMeshes.forEach(barrier => {
            scene.remove(barrier);
        });
        
        this.checkpoints.forEach(checkpoint => {
            scene.remove(checkpoint.mesh);
        });
        
        scene.remove(this.startFinishLine);
        
        this.decorations.forEach(decoration => {
            scene.remove(decoration);
        });
    }
    
    checkCollision(car) {
        const carPosition = car.getPosition();
        let hadCollision = false;
        
        // Check collision with barriers
        this.barrierMeshes.forEach(barrier => {
            const distance = carPosition.distanceTo(barrier.position);
            if (distance < 2) {
                // Calculate collision normal
                const normal = carPosition.clone().sub(barrier.position).normalize();
                car.handleCollision(normal);
                hadCollision = true;
            }
        });
        
        // No speed boosts - removed for better control
        
        return hadCollision;
    }
    
    checkLapCompletion(carPosition) {
        // Check checkpoint progression
        const currentCheckpoint = this.checkpoints.find(cp => {
            const distance = carPosition.distanceTo(cp.position);
            return distance < 5 && !cp.passed;
        });
        
        if (currentCheckpoint) {
            currentCheckpoint.passed = true;
            this.checkpointsPassed.add(currentCheckpoint.index);
            
            // Visual feedback
            currentCheckpoint.mesh.material.color.setHex(0x0000ff);
            setTimeout(() => {
                currentCheckpoint.mesh.material.color.setHex(0x00ff00);
            }, 1000);
        }
        
        // Check if car crossed finish line with all checkpoints passed
        const finishDistance = carPosition.distanceTo(this.startFinishLine.position);
        if (finishDistance < 5 && this.checkpointsPassed.size >= this.checkpoints.length) {
            // Lap completed
            this.resetCheckpoints();
            return true;
        }
        
        return false;
    }
    
    resetCheckpoints() {
        this.checkpointsPassed.clear();
        this.checkpoints.forEach(checkpoint => {
            checkpoint.passed = false;
            checkpoint.mesh.material.color.setHex(0x00ff00);
        });
    }
    
    getStartPosition() {
        const startPoint = this.trackPoints[0];
        return new THREE.Vector3(startPoint.x, 1, startPoint.z);  // Force flat at y=1
    }
    
    getStartRotation() {
        const startPoint = this.trackPoints[0];
        const nextPoint = this.trackPoints[1];
        const direction = new THREE.Vector3(
            nextPoint.x - startPoint.x,
            0,
            nextPoint.z - startPoint.z
        ).normalize();
        
        return Math.atan2(direction.x, direction.z);
    }
}