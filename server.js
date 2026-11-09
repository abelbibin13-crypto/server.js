const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3001);
const MAX_PLAYERS = 8;
const rooms = new Map();
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ service: 'PolyTrack multiplayer server', status: 'ok', rooms: rooms.size }));
  }
  res.writeHead(404); res.end('Not found');
});
const wss = new WebSocketServer({ server, maxPayload: 4096 });

function code() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value;
  do { value = Array.from({ length: 6 }, () => chars[crypto.randomInt(chars.length)]).join(''); } while (rooms.has(value));
  return value;
}
function send(ws, data) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }
function roomPlayers(room) {
  return [...room.players.values()].map(p => ({
    id: p.id, name: p.name, isHost: p.id === room.hostId,
    x: p.x, y: p.y, z: p.z, rotation: p.rotation, speed: p.speed,
    lap: p.lap, checkpoint: p.checkpoint, progress: p.progress, finished: p.finished,
    finishOrder: p.finishOrder, elapsed: p.elapsed
  }));
}
function broadcastRoom(room) {
  const packet = JSON.stringify({ type: 'players', players: roomPlayers(room) });
  for (const p of room.players.values()) if (p.ws.readyState === WebSocket.OPEN) p.ws.send(packet);
}
function leave(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  room.players.delete(ws.playerId);
  if (room.hostId === ws.playerId) {
    const next = room.players.values().next().value;
    room.hostId = next ? next.id : null;
  }
  if (!room.players.size) rooms.delete(ws.roomCode);
  else broadcastRoom(room);
  ws.roomCode = null; ws.playerId = null;
}
function fail(ws, message) { send(ws, { type: 'error', message }); }

wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => ws.isAlive = true);
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return fail(ws, 'Invalid message.'); }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'create-room') {
      if (ws.roomCode) leave(ws);
      const roomCode = code();
      const playerId = crypto.randomUUID();
      const room = { code: roomCode, hostId: playerId, state: 'lobby', players: new Map(), finishCount: 0 };
      room.players.set(playerId, makePlayer(ws, playerId, msg.name));
      rooms.set(roomCode, room); ws.roomCode = roomCode; ws.playerId = playerId;
      send(ws, { type: 'room-created', code: roomCode, playerId, isHost: true, players: roomPlayers(room) });
      return;
    }

    if (msg.type === 'join-room') {
      const roomCode = String(msg.code || '').toUpperCase();
      const room = rooms.get(roomCode);
      if (!room) return fail(ws, 'Room not found. Check the code.');
      if (room.state !== 'lobby') return fail(ws, 'That race has already started.');
      if (room.players.size >= MAX_PLAYERS) return fail(ws, 'Room is full (maximum 8 drivers).');
      if (ws.roomCode) leave(ws);
      const playerId = crypto.randomUUID();
      room.players.set(playerId, makePlayer(ws, playerId, msg.name));
      ws.roomCode = roomCode; ws.playerId = playerId;
      send(ws, { type: 'room-joined', code: roomCode, playerId, isHost: false, players: roomPlayers(room) });
      broadcastRoom(room);
      return;
    }

    const room = rooms.get(ws.roomCode);
    if (!room || !room.players.has(ws.playerId)) return fail(ws, 'Join a room first.');
    const player = room.players.get(ws.playerId);

    if (msg.type === 'start-race') {
      if (room.hostId !== ws.playerId) return fail(ws, 'Only the room host can start the race.');
      if (room.players.size < 1) return;
      room.state = 'racing'; room.finishCount = 0;
      for (const p of room.players.values()) { p.finished = false; p.finishOrder = null; p.lap = 1; p.checkpoint = 0; }
      const startAt = Date.now() + 3500;
      for (const p of room.players.values()) send(p.ws, { type: 'race-start', startAt });
      broadcastRoom(room);
      return;
    }

    if (msg.type === 'player-update') {
      if (room.state !== 'racing' || player.finished) return;
      for (const key of ['x','y','z','rotation','speed','elapsed','progress']) {
        if (Number.isFinite(msg[key])) player[key] = Math.max(-100000, Math.min(100000, msg[key]));
      }
      player.lap = Math.max(1, Math.min(3, Number(msg.lap) || 1));
      player.checkpoint = Math.max(0, Math.min(8, Number(msg.checkpoint) || 0));
      broadcastRoomThrottled(room);
      return;
    }

    if (msg.type === 'finish') {
      if (room.state !== 'racing' || player.finished) return;
      player.finished = true;
      player.elapsed = Number.isFinite(msg.elapsed) ? msg.elapsed : player.elapsed;
      player.finishOrder = ++room.finishCount;
      const players = roomPlayers(room);
      const packet = JSON.stringify({ type: 'race-finished', players });
      for (const p of room.players.values()) if (p.ws.readyState === WebSocket.OPEN) p.ws.send(packet);
      if ([...room.players.values()].every(p => p.finished)) room.state = 'results';
    }
  });
  ws.on('close', () => leave(ws));
  ws.on('error', () => leave(ws));
});

function makePlayer(ws, id, name) {
  return { ws, id, name: String(name || 'Driver').replace(/[<>]/g, '').slice(0,18) || 'Driver', x: 0, y: 1, z: 0, rotation: 0, speed: 0, lap: 1, checkpoint: 0, progress: 0, finished: false, finishOrder: null, elapsed: 0 };
}
const broadcastTimers = new Map();
function broadcastRoomThrottled(room) {
  if (broadcastTimers.has(room.code)) return;
  const timer = setTimeout(() => { broadcastTimers.delete(room.code); if (rooms.has(room.code)) broadcastRoom(room); }, 80);
  broadcastTimers.set(room.code, timer);
}
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 30000);
wss.on('close', () => clearInterval(heartbeat));
server.listen(PORT, '0.0.0.0', () => console.log(`PolyTrack multiplayer server listening on ${PORT}`));
