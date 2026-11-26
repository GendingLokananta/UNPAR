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
- `unollele`: UNOLLELE, 146 cards, 7-card hands, elemental weakness rules and ten Dragon effects.

The host selects `gameMode` in `create_room`. The server persists it in room state and selects the matching engine in `start_game`. The server remains authoritative for playable-card validation, turn order, drawing, penalties, effects, and winner detection.

UNOLLELE uses 100 elemental number cards (Fire/Water/Grass/Electric/Ground, 2 copies each for values 1–10), 10 Colorless 10 cards, and 36 Dragon cards. Colorless 10 can be played over an elemental number only when its value is higher, and can counter every Dragon. Any elemental number can be played over Colorless regardless of value; Dragon cannot be played over Colorless. Dragon can be played over elemental cards and other Dragon cards. Dragon copies: Skip All (4), Switch Direction (4), +2 (4), Reroll 4 (4), Switch (3), +1 for all other active players (4), Discard (4), Reset All (1), Revive (4), and Block (4). Reset All discards the hands of all active players and deals 7 new cards to each of them, including its user; spectators are excluded. A player who empties their hand becomes a spectator, and the match continues until one active player remains as the loser. Dragon Switch exchanges the remaining full hands with a selected online active player. UNOLLELE draw is optional even with a playable card and ends the turn.

Room/game state is held in memory and is lost when the process restarts. See the root README for Windows, LAN and tunnel instructions.

Both modes use a server-authoritative 15-second turn timer. Timeout draws two cards and skips the active turn. After a game finishes, the centered loser popup offers a new game in the same room and code; at least two players must be online.
