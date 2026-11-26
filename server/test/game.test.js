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
  timeoutTurn,
  callUno,
  catchUno,
  TURN_DURATION_MS,
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


test('UNO call has a 500ms window and spectators may shoot after it expires', () => {
  const roomPlayers = players(4);
  const game = createGame(roomPlayers);
  const actor = game.currentPlayerId;
  const catcher = roomPlayers.find((player) => player.id !== actor).id;
  game.currentColor = 'red';
  game.currentValue = '5';
  game.discard = [{ id: 'uno-top', color: 'red', value: '5' }];
  game.hands[actor] = [{ id: 'last-red', color: 'red', value: '6' }, { id: 'spare', color: 'blue', value: '1' }];
  game.deck = [{ id: 'penalty-a', color: 'green', value: '2' }, { id: 'penalty-b', color: 'yellow', value: '3' }];
  const room = { code: 'UNO500', gameMode: 'classic', status: 'playing', hostId: roomPlayers[0].id, players: roomPlayers, game };
  playCard(room, actor, 'last-red');
  assert.equal(game.pendingUno, actor);
  assert.equal(game.pendingUnoDeadline - Date.now() <= 500, true);
  assert.throws(() => catchUno(room, catcher), /Tunggu/);
  game.pendingUnoDeadline = Date.now() - 1;
  game.winnerIds = [catcher]; // catcher is now a spectator but may still shoot UNO.
  assert.doesNotThrow(() => catchUno(room, catcher));
  assert.equal(game.hands[actor].length, 3);
  assert.equal(game.pendingUno, null);
});

test('player cannot call UNO after the 500ms grace period', () => {
  const roomPlayers = players(2);
  const game = createGame(roomPlayers);
  const actor = game.currentPlayerId;
  game.hands[actor] = [{ id: 'one-card', color: 'red', value: '1' }];
  game.pendingUno = actor;
  game.pendingUnoDeadline = Date.now() - 1;
  const room = { code: 'UNO-LATE', gameMode: 'classic', status: 'playing', hostId: roomPlayers[0].id, players: roomPlayers, game };
  assert.throws(() => callUno(room, actor), /Waktu menekan UNO sudah habis/);
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


test('15-second timeout also draws two cards and skips the turn in UNO Classic', () => {
  const roomPlayers = players(2);
  const game = createGame(roomPlayers);
  const activeId = game.currentPlayerId;
  game.deck = [
    { id: 'timeout-a', color: 'red', value: '4' },
    { id: 'timeout-b', color: 'blue', value: '8' },
  ];
  const otherId = roomPlayers.find((player) => player.id !== activeId).id;
  const room = { code: 'CLASS1', gameMode: 'classic', status: 'playing', hostId: roomPlayers[0].id, players: roomPlayers, game };
  const beforeCount = game.hands[activeId].length;
  assert.equal(TURN_DURATION_MS, 15000);
  assert.equal(timeoutTurn(room), true);
  assert.equal(game.hands[activeId].length, beforeCount + 2);
  assert.equal(game.currentPlayerId, otherId);
  assert.match(game.lastMove, /Waktu habis/);
});


test('UNO Classic also continues after winners become spectators until the last player loses', () => {
  const roomPlayers = players(4);
  const [first, second, third, last] = roomPlayers;
  const game = createGame(roomPlayers);
  game.currentPlayerId = first.id;
  game.direction = 1;
  game.currentColor = 'red';
  game.currentValue = '5';
  game.discard = [{ id: 'classic-top', color: 'red', value: '5' }];
  game.deck = [];
  game.hands[first.id] = [{ id: 'first-last', color: 'red', value: '6' }];
  game.hands[second.id] = [{ id: 'second-last', color: 'red', value: '7' }];
  game.hands[third.id] = [{ id: 'third-last', color: 'red', value: '8' }];
  game.hands[last.id] = [{ id: 'last-card', color: 'red', value: '9' }];
  const room = {
    code: 'CLASS-OUT',
    gameMode: 'classic',
    status: 'playing',
    hostId: first.id,
    players: roomPlayers,
    game,
  };

  playCard(room, first.id, 'first-last');
  assert.equal(room.status, 'playing');
  assert.deepEqual(game.winnerIds, [first.id]);
  assert.equal(game.currentPlayerId, second.id);
  assert.throws(() => playCard(room, first.id, 'first-last'), /spectator/);

  playCard(room, second.id, 'second-last');
  assert.equal(room.status, 'playing');
  assert.deepEqual(game.winnerIds, [first.id, second.id]);
  assert.equal(game.currentPlayerId, third.id);

  playCard(room, third.id, 'third-last');
  assert.equal(room.status, 'finished');
  assert.deepEqual(game.winnerIds, [first.id, second.id, third.id]);
  assert.equal(game.loserId, last.id);
  assert.equal(game.currentPlayerId, last.id);
  assert.equal(game.turnDeadline, null);
});
