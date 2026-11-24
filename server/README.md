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
- `unollele`: UNOLLELE, 132 cards, 7-card hands, elemental weakness rules and six Dragon effects.

The host selects `gameMode` in `create_room`. The server persists it in room state and selects the matching engine in `start_game`. The server remains authoritative for playable-card validation, turn order, drawing, penalties, effects, and winner detection.

UNOLLELE elemental weakness is validated by the server. The 5 elemental types have 2 copies per number (1–10); Colorless has 1 copy per number (10 total). The 22 Dragon cards include Skip (4), Switch Direction (4), +2 (4), Reset (4), Switch (2), and +1 All (4). Dragon can be played over every type except Colorless, including another Dragon; Colorless can be played over all types, including Dragon. Dragon Switch exchanges the remaining full hands with a selected online player; Dragon +1 All gives one card to every player. UNOLLELE draw is optional even with a playable card and ends the turn.

Room/game state is held in memory and is lost when the process restarts. See the root README for Windows, LAN and tunnel instructions.

Both modes use a server-authoritative 15-second turn timer. Timeout draws two cards and skips the active turn. After a game finishes, any connected player can start a new game in the same room and code; at least two players must be online.
