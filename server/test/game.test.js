const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createDeck,
  createGame,
  playCard,
  drawOne,
  passTurn,
  publicState,
  GAME_MODES,
  normalizeGameMode,
} = require('../src/game');

function players(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `player_${index + 1}`,
    name: `Player ${index + 1}`,
    connected: true,
  }));
}

test('game mode defaults to UNO Classic for older clients', () => {
  assert.equal(normalizeGameMode(undefined), GAME_MODES.CLASSIC);
  assert.equal(normalizeGameMode(''), GAME_MODES.CLASSIC);
});

test('game mode accepts UNO Classic and UNOLLELE', () => {
  assert.equal(normalizeGameMode('classic'), GAME_MODES.CLASSIC);
  assert.equal(normalizeGameMode('UNOLLELE'), GAME_MODES.UNOLLELE);
});

test('game mode rejects unknown values', () => {
  assert.throws(() => normalizeGameMode('pokemon'), /Mode permainan tidak dikenal/);
});

test('public room state includes its selected game mode', () => {
  const roomPlayers = players(2);
  const room = { code: 'ABC234', gameMode: 'unollele', status: 'lobby', hostId: roomPlayers[0].id, players: roomPlayers };
  assert.equal(publicState(room, roomPlayers[0].id).room.gameMode, 'unollele');
});

test('classic deck contains 108 cards', () => {
  assert.equal(createDeck().length, 108);
});

test('game deals seven cards and works with eight players', () => {
  const game = createGame(players(8));
  assert.equal(Object.keys(game.hands).length, 8);
  for (const hand of Object.values(game.hands)) assert.equal(hand.length, 7);
  assert.equal(game.deck.length + game.discard.length + 56, 108);
});

test('game rejects fewer than two players', () => {
  assert.throws(() => createGame(players(1)), /2-8/);
});

test('players only receive their own cards in public state', () => {
  const roomPlayers = players(2);
  const room = { code: 'ABC234', status: 'playing', hostId: roomPlayers[0].id, players: roomPlayers, game: createGame(roomPlayers) };
  const state = publicState(room, roomPlayers[0].id);
  assert.equal(state.game.hand.length, 7);
  assert.equal('hands' in state.game, false);
  assert.equal('hand' in state.room.players[1], false);
});

test('cannot play out of turn', () => {
  const roomPlayers = players(2);
  const room = { code: 'ABC234', status: 'playing', hostId: roomPlayers[0].id, players: roomPlayers, game: createGame(roomPlayers) };
  assert.throws(() => playCard(room, roomPlayers[1].id, 'not-a-card'), /Belum giliran/);
});

test('draw then pass advances the turn', () => {
  const roomPlayers = players(2);
  const room = { code: 'ABC234', status: 'playing', hostId: roomPlayers[0].id, players: roomPlayers, game: createGame(roomPlayers) };
  const first = room.game.currentPlayerId;
  drawOne(room, first);
  assert.equal(room.game.turnHasDrawn, true);
  passTurn(room, first);
  assert.notEqual(room.game.currentPlayerId, first);
  assert.equal(room.game.turnHasDrawn, false);
});
