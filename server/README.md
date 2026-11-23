# UNO Party Server

Node.js + Express + Socket.IO authoritative multiplayer game server.

```bash
npm install
npm test
npm start
```

Default address: `http://0.0.0.0:3000`, health endpoint: `GET /health`.

## Game modes

- `classic`: UNO Classic, 108 cards, 7-card hands.
- `unollele`: UNOLLELE, 136 cards, 5-card hands, elemental weakness rules and Dragon effects.

The host selects `gameMode` in `create_room`. The server persists it in room state and selects the matching engine in `start_game`. The server remains authoritative for playable-card validation, turn order, drawing, penalties, effects, and winner detection.

UNOLLELE elemental weakness is validated by the server. Colorless can be played on another numbered element only when its number is higher. Dragon cards can only be played on Colorless; a Dragon top card accepts any numbered elemental card but not another Dragon. See `src/game.js` and `test/unollele.test.js` for the complete rules and coverage.

Room/game state is held in memory and is lost when the process restarts. See the root README for Windows, LAN and tunnel instructions.
