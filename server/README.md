# UNO Party Server

Node.js + Express + Socket.IO authoritative game server.

```bash
npm install
npm test
npm start
```

Default address: `http://0.0.0.0:3000`, health endpoint: `GET /health`.

Room/game state is in memory and is lost when the process restarts. See the root README for Windows, LAN and public-tunnel instructions.
