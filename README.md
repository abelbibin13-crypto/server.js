# PolyTrack Racing + Multiplayer

## Files
- `index.html`, `style.css`, `game.js`, `car.js`, `track.js`, `camera.js`, `ui.js`, `multiplayer.js`: browser game.
- `server.js`: room and WebSocket server.

## Run locally
1. Install Node.js 18 or newer.
2. Open a terminal in this folder and run `npm install`.
3. Run `npm start`. The server listens on port 3001.
4. Serve the game folder over HTTP (not `file://`): `python -m http.server 8000`.
5. Open `http://localhost:8000`, choose Multiplayer, keep server URL `ws://localhost:3001`, and create a room.
6. Open another browser/device on the same computer/network, join with the room code.

## Public internet multiplayer
The game website and multiplayer server are separate. Deploy this folder's Node server to a public Node hosting service that supports WebSockets. Set its start command to `npm start`. The host must provide HTTPS/WSS for public browser use. Copy the server's secure WebSocket URL (usually `wss://...`) into the game's WebSocket server field. All players use that same URL and room code, regardless of their network.

For Render-style deployment: create a Web Service from this folder/repository, use build command `npm install`, start command `npm start`, and use the assigned public service URL with `wss://`. The `/health` route returns a small JSON health check.

## Current multiplayer scope
- Six-character room codes, up to 8 drivers, host-controlled race start.
- WebSocket player-state sync, remote car models, lap display, standings and finish order.
- Rooms are held in server memory. Restarting the server clears rooms. No accounts or persistent ranking database are included.
- Race standings use lap/checkpoint progress and speed as a tie-breaker until finish order is recorded.
- This is a first multiplayer implementation, not a cheat-proof competitive racing backend.
