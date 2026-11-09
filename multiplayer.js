class PolyTrackMultiplayer {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.connected = false;
        this.roomCode = null;
        this.playerId = null;
        this.isHost = false;
        this.players = new Map();
        this.remoteCars = new Map();
        this.lastSend = 0;
        this.lastLeaderboard = 0;
        this.raceStarted = false;
        this.bindUI();
    }

    el(id) { return document.getElementById(id); }

    bindUI() {
        this.el('multiplayerOpen').addEventListener('click', () => {
            this.game.ui.hideAllMenus();
            this.el('multiplayerPanel').classList.remove('hidden');
        });
        this.el('mpClose').addEventListener('click', () => {
            this.el('multiplayerPanel').classList.add('hidden');
            this.game.ui.showMainMenu();
        });
        this.el('mpCreate').addEventListener('click', () => this.connectAndCreate());
        this.el('mpJoin').addEventListener('click', () => this.connectAndJoin());
        this.el('mpStart').addEventListener('click', () => this.send({ type: 'start-race' }));
        this.el('mpRoomCode').addEventListener('input', e => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    }

    setStatus(message, error = false) {
        const node = this.el('mpStatus');
        node.textContent = message;
        node.classList.toggle('error', error);
    }

    connect() {
        if (this.connected && this.socket && this.socket.readyState === WebSocket.OPEN) return Promise.resolve();
        const url = this.el('mpServerUrl').value.trim();
        if (!/^wss?:\/\//i.test(url)) {
            this.setStatus('Enter a valid ws:// or wss:// server URL.', true);
            return Promise.reject(new Error('Invalid WebSocket URL'));
        }
        this.setStatus('Connecting to multiplayer server...');
        return new Promise((resolve, reject) => {
            let settled = false;
            try {
                this.socket = new WebSocket(url);
                const timeout = setTimeout(() => {
                    if (!settled) { settled = true; reject(new Error('Connection timed out')); this.setStatus('Server did not respond.', true); }
                }, 8000);
                this.socket.addEventListener('open', () => {
                    this.connected = true;
                    settled = true;
                    clearTimeout(timeout);
                    this.setStatus('Connected. Joining room...');
                    resolve();
                });
                this.socket.addEventListener('message', event => this.onMessage(event));
                this.socket.addEventListener('close', () => {
                    this.connected = false;
                    this.setStatus('Disconnected from server.', true);
                    this.cleanupRemoteCars();
                });
                this.socket.addEventListener('error', () => {
                    if (!settled) { settled = true; clearTimeout(timeout); reject(new Error('Could not connect')); }
                    this.setStatus('Connection failed. Check the server URL and server status.', true);
                });
            } catch (error) { reject(error); this.setStatus(error.message, true); }
        });
    }

    async connectAndCreate() {
        try {
            await this.connect();
            this.send({ type: 'create-room', name: this.playerName() });
        } catch (error) { this.setStatus(error.message, true); }
    }

    async connectAndJoin() {
        const code = this.el('mpRoomCode').value.trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(code)) { this.setStatus('Enter a six-character room code.', true); return; }
        try {
            await this.connect();
            this.send({ type: 'join-room', code, name: this.playerName() });
        } catch (error) { this.setStatus(error.message, true); }
    }

    playerName() {
        return (this.el('mpPlayerName').value.trim() || 'Driver').slice(0, 18);
    }

    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(data));
    }

    onMessage(event) {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'error') { this.setStatus(data.message || 'Server error.', true); return; }
        if (data.type === 'room-created' || data.type === 'room-joined') {
            this.roomCode = data.code;
            this.playerId = data.playerId;
            this.isHost = !!data.isHost;
            this.el('mpRoomCode').value = data.code;
            this.el('mpRoomCodeDisplay').textContent = data.code;
            this.el('mpRoomInfo').classList.remove('hidden');
            this.el('mpStart').classList.toggle('hidden', !this.isHost);
            this.setStatus(this.isHost ? 'Room created. Share the code with friends.' : 'Joined room. Waiting for the host.');
            this.renderPlayers(data.players || []);
            return;
        }
        if (data.type === 'players') {
            this.renderPlayers(data.players || []);
            this.players = new Map((data.players || []).map(player => [player.id, player]));
            this.updateRemoteCars(data.players || []);
            this.renderLeaderboard(data.players || []);
            return;
        }
        if (data.type === 'race-start') {
            const delay = Math.max(0, (data.startAt || Date.now()) - Date.now());
            this.setStatus('Race starting...');
            this.raceStarted = true;
            this.game.multiplayerRace = true;
            setTimeout(() => {
                this.el('multiplayerPanel').classList.add('hidden');
                this.el('raceLeaderboard').classList.remove('hidden');
                this.game.startRace();
            }, delay);
            return;
        }
        if (data.type === 'race-finished') {
            this.renderLeaderboard(data.players || []);
            this.toast('Race finished! Check the leaderboard.');
        }
    }

    renderPlayers(players) {
        this.el('mpPlayers').innerHTML = players.map(p => `<div class="mp-player"><span>${this.escape(p.name)}</span><span>${p.id === this.playerId ? 'YOU' : (p.isHost ? 'HOST' : 'READY')}</span></div>`).join('') || 'Waiting for players...';
    }

    updateLocalPlayer(game) {
        const now = performance.now();
        if (now - this.lastSend < 80) return;
        this.lastSend = now;
        const p = game.car.position;
        const checkpoint = game.track ? game.track.checkpointsPassed.size : 0;
        let routeProgress = 0;
        if (game.track && game.track.trackPoints.length) {
            let nearestIndex = 0, nearestDistance = Infinity;
            game.track.trackPoints.forEach((point, index) => {
                const dx = p.x - point.x, dz = p.z - point.z;
                const distance = dx * dx + dz * dz;
                if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
            });
            routeProgress = nearestIndex / game.track.trackPoints.length;
        }
        this.send({
            type: 'player-update',
            x: p.x, y: p.y, z: p.z, rotation: game.car.rotation.y,
            speed: game.car.getSpeed(), lap: Math.min(game.currentLap, game.totalLaps),
            checkpoint, progress: routeProgress, finished: game.gameState === 'complete',
            elapsed: game.currentLapTime || 0
        });
    }

    updateRemoteCars(players) {
        if (!this.game.scene || !this.game.track) return;
        const liveIds = new Set(players.filter(p => p.id !== this.playerId).map(p => p.id));
        for (const [id, car] of this.remoteCars) {
            if (!liveIds.has(id)) { this.game.scene.remove(car.mesh); this.remoteCars.delete(id); }
        }
        players.forEach((player, index) => {
            if (player.id === this.playerId || !Number.isFinite(player.x) || !Number.isFinite(player.z)) return;
            let remote = this.remoteCars.get(player.id);
            if (!remote) {
                remote = new Car();
                remote.mesh.traverse(obj => {
                    if (obj.material && obj.material.color) obj.material = obj.material.clone();
                });
                const colors = [0xff4d6d, 0xffd166, 0x8b5cf6, 0x38bdf8, 0xf97316, 0xe879f9];
                const body = remote.mesh.children[0];
                if (body && body.material && body.material.color) body.material.color.setHex(colors[index % colors.length]);
                remote.addToScene(this.game.scene);
                this.remoteCars.set(player.id, remote);
            }
            const target = new THREE.Vector3(player.x, player.y, player.z);
            remote.position.lerp(target, 0.45);
            remote.rotation.y += THREE.MathUtils.euclideanModulo(player.rotation - remote.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
            remote.mesh.position.copy(remote.position);
            remote.mesh.rotation.copy(remote.rotation);
        });
    }

    renderLeaderboard(players) {
        const ordered = [...players].sort((a, b) => {
            if (!!a.finished !== !!b.finished) return a.finished ? -1 : 1;
            if (a.finished && b.finished) return (a.finishOrder || 999) - (b.finishOrder || 999);
            return (b.lap || 1) - (a.lap || 1) || (b.progress || 0) - (a.progress || 0) || (b.checkpoint || 0) - (a.checkpoint || 0);
        });
        this.el('leaderboardRows').innerHTML = ordered.map((p, i) => {
            const label = p.finished ? 'FINISHED' : `LAP ${Math.min(p.lap || 1, 3)}/3`;
            return `<div class="leader-row ${p.id === this.playerId ? 'self' : ''}"><b>${p.finished ? (p.finishOrder || i + 1) : i + 1}</b><span>${this.escape(p.name)}${p.id === this.playerId ? ' (YOU)' : ''}</span><small>${label}</small></div>`;
        }).join('');
    }

    finishLocalPlayer(time) { this.send({ type: 'finish', elapsed: time || 0 }); }

    cleanupRemoteCars() {
        for (const car of this.remoteCars.values()) if (this.game.scene) this.game.scene.remove(car.mesh);
        this.remoteCars.clear();
        this.el('raceLeaderboard').classList.add('hidden');
    }

    toast(message) {
        const node = this.el('mpToast');
        node.textContent = message;
        node.classList.remove('hidden');
        setTimeout(() => node.classList.add('hidden'), 3000);
    }

    escape(value) {
        return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }
}

window.addEventListener('load', () => {
    if (window.polyTrackGame) {
        window.polyTrackGame.multiplayer = new PolyTrackMultiplayer(window.polyTrackGame);
    }
});
