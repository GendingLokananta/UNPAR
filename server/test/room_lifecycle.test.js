const test = require('node:test');
const assert = require('node:assert/strict');
const { castRematchVote, getRematchVoteState, restartGameInRoom } = require('../src/room_lifecycle');
const gameEngine = require('../src/game');

function makeRoom(count = 4) {
  const players = Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    connected: true,
  }));
  return {
    code: 'REMATCH',
    gameMode: 'unollele',
    status: 'finished',
    players,
    rematchVotes: { yes: [], no: [], resolved: false, message: '' },
    game: { winnerId: 'p1' },
  };
}

function fakeCreateGame(players, mode) {
  return { mode, players: players.map((player) => player.id), fresh: true };
}

test('rematch vote restarts the same room and selected game mode after a majority yes', () => {
  const room = makeRoom(4);
  assert.equal(castRematchVote(room, 'p1', 'yes', fakeCreateGame).restarted, false);
  assert.equal(castRematchVote(room, 'p2', 'yes', fakeCreateGame).restarted, false);
  const result = castRematchVote(room, 'p3', 'yes', fakeCreateGame);
  assert.equal(result.restarted, true);
  assert.equal(room.status, 'playing');
  assert.equal(room.code, 'REMATCH');
  assert.equal(room.gameMode, 'unollele');
  assert.deepEqual(room.game.players, ['p1', 'p2', 'p3', 'p4']);
  assert.deepEqual(room.rematchVotes.yes, []);
});

test('rematch vote can be rejected by a majority no', () => {
  const room = makeRoom(3);
  castRematchVote(room, 'p1', 'no', fakeCreateGame);
  const result = castRematchVote(room, 'p2', 'no', fakeCreateGame);
  assert.equal(result.restarted, false);
  assert.equal(room.status, 'finished');
  assert.equal(room.rematchVotes.resolved, true);
  assert.match(room.rematchVotes.message, /Mayoritas memilih tidak/);
});

test('a player cannot vote more than once', () => {
  const room = makeRoom(3);
  castRematchVote(room, 'p1', 'yes', fakeCreateGame);
  assert.throws(() => castRematchVote(room, 'p1', 'no', fakeCreateGame), /sudah memberikan suara/);
});

test('only connected room players can vote', () => {
  const room = makeRoom(2);
  room.players[1].connected = false;
  assert.throws(() => castRematchVote(room, 'p2', 'yes', fakeCreateGame), /tidak termasuk peserta voting aktif/);
});

test('vote state reports current votes and eligible players', () => {
  const room = makeRoom(4);
  room.players[3].connected = false;
  castRematchVote(room, 'p1', 'yes', fakeCreateGame);
  assert.deepEqual(getRematchVoteState(room), {
    yes: ['p1'], no: [], eligible: 3, resolved: false, message: '',
  });
});

test('a tied rematch vote resolves without restarting the room', () => {
  const room = makeRoom(4);
  castRematchVote(room, 'p1', 'yes', fakeCreateGame);
  castRematchVote(room, 'p2', 'yes', fakeCreateGame);
  castRematchVote(room, 'p3', 'no', fakeCreateGame);
  const result = castRematchVote(room, 'p4', 'no', fakeCreateGame);
  assert.equal(result.restarted, false);
  assert.equal(room.status, 'finished');
  assert.equal(room.rematchVotes.resolved, true);
  assert.match(room.rematchVotes.message, /seri/);
});


test('rematch vote with fewer than two connected players does not record an invalid vote', () => {
  const room = makeRoom(2);
  room.players[1].connected = false;
  assert.throws(() => castRematchVote(room, 'p1', 'yes', fakeCreateGame), /Minimal 2 pemain online/);
  assert.deepEqual(room.rematchVotes.yes, []);
  assert.deepEqual(room.rematchVotes.no, []);
});

test('main ulang langsung membuat game baru di room dan kode yang sama', () => {
  const room = makeRoom(4);
  room.players[3].connected = false;
  room.hostId = 'p4';

  const result = restartGameInRoom(room, 'p1', fakeCreateGame);

  assert.equal(result.restarted, true);
  assert.equal(result.roomCode, 'REMATCH');
  assert.equal(room.code, 'REMATCH');
  assert.equal(room.status, 'playing');
  assert.equal(room.hostId, 'p1');
  assert.equal(room.game.mode, 'unollele');
  assert.deepEqual(room.game.players, ['p1', 'p2', 'p3']);
  assert.equal(room.rematchVotes.yes.length, 0);
  assert.equal(room.rematchVotes.no.length, 0);
});

test('main ulang memulai ulang engine UNOLLELE dengan kartu dan timer baru', () => {
  const room = makeRoom(3);
  room.game = { winnerId: 'p1', stale: true };

  restartGameInRoom(room, 'p2', gameEngine.createGameForMode);

  assert.equal(room.status, 'playing');
  assert.equal(room.game.mode, 'unollele');
  assert.equal(room.game.turnDeadline > Date.now(), true);
  assert.equal(room.game.discard.length, 1);
  assert.equal(room.game.hands.p1.length, 7);
  assert.equal(room.game.hands.p2.length, 7);
  assert.equal(room.game.hands.p3.length, 7);
  assert.equal('stale' in room.game, false);
});

test('main ulang requires a finished room and at least two online players', () => {
  const room = makeRoom(2);
  room.status = 'playing';
  assert.throws(() => restartGameInRoom(room, 'p1', fakeCreateGame), /setelah permainan selesai/);
  room.status = 'finished';
  room.players[1].connected = false;
  assert.throws(() => restartGameInRoom(room, 'p1', fakeCreateGame), /Minimal 2 pemain online/);
});
