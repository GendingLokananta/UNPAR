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
- `unollele`: UNOLLELE, 126 cards, 7-card hands, elemental weakness rules and Dragon effects.

The host selects `gameMode` in `create_room`. The server persists it in room state and selects the matching engine in `start_game`. The server remains authoritative for playable-card validation, turn order, drawing, penalties, effects, and winner detection.

UNOLLELE elemental weakness is validated by the server. The 5 elemental types have 2 copies per number (1–10); Colorless has 1 copy per number (10 total); each Dragon effect has 4 copies. Colorless can counter all numbered types, Dragon can be played on any numbered card, and any numbered card can be played on Dragon; Dragon cannot be stacked on Dragon. UNOLLELE draw is optional even with a playable card and ends the turn. See `src/game.js` and `test/unollele.test.js` for the complete rules and coverage.

Room/game state is held in memory and is lost when the process restarts. See the root README for Windows, LAN and tunnel instructions.

Both modes use a server-authoritative 15-second turn timer. Timeout draws two cards and skips the active turn. Finished rooms support a connected-player majority rematch vote without changing the room code.
