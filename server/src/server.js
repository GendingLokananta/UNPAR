require('dotenv').config();
const crypto = require('node:crypto');
const http = require('node:http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const gameEngine = require('./game');
const roomLifecycle = require('./room_lifecycle');

const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, name: 'UNO Party server' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  pingInterval: 20000,
  pingTimeout: 45000,
});

const rooms = new Map();
const turnTimers = new Map();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

function ackWith(ack, payload) {
  if (typeof ack === 'function') ack(payload);
}

function safeName(value) {
  const name = String(value || '').trim().replace(/[<>]/g, '').slice(0, 18);
  if (!name) throw new Error('Masukkan nickname terlebih dahulu.');
  return name;
}

function safePlayerId(value) {
  const id = String(value || '').trim();
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id)) throw new Error('ID pemain tidak valid.');
  return id;
}

function generateRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from(crypto.randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join('');
  } while (rooms.has(code));
  return code;
}

function findRoomForPlayer(playerId) {
  for (const room of rooms.values()) {
    if (room.players.some((player) => player.id === playerId)) return room;
  }
  return null;
}

function emitRoom(room) {
  for (const player of room.players) {
    if (player.connected && player.socketId) {
      io.to(player.socketId).emit('room_state', gameEngine.publicState(room, player.id));
    }
  }
}

function clearTurnTimer(roomCode) {
  const existing = turnTimers.get(roomCode);
  if (existing) clearTimeout(existing);
  turnTimers.delete(roomCode);
}

function scheduleTurnTimer(room, { reset = false } = {}) {
  clearTurnTimer(room.code);
  if (room.status !== 'playing' || !room.game || !room.players.some((player) => player.connected)) return;
  if (reset || !Number.isFinite(room.game.turnDeadline)) {
    room.game.turnDeadline = Date.now() + gameEngine.TURN_DURATION_MS;
  }
  const delay = Math.max(0, room.game.turnDeadline - Date.now());
  const timer = setTimeout(() => {
    if (room.status !== 'playing' || !room.game) return;
    if (room.game.turnDeadline && Date.now() + 20 < room.game.turnDeadline) {
      scheduleTurnTimer(room);
      return;
    }
    gameEngine.timeoutTurn(room);
    emitRoom(room);
    scheduleTurnTimer(room);
  }, delay);
  timer.unref?.();
  turnTimers.set(room.code, timer);
}

function emitError(socket, error) {
  socket.emit('action_error', { message: error?.message || 'Terjadi kesalahan.' });
}

function bindAction(socket, event, handler) {
  socket.on(event, (payload = {}, ack) => {
    try {
      const playerId = socket.data.playerId;
      if (!playerId) throw new Error('Bergabung ke room terlebih dahulu.');
      const room = findRoomForPlayer(playerId);
      if (!room) throw new Error('Room tidak ditemukan.');
      handler(room, playerId, payload || {});
      if (['play_card', 'draw_card', 'pass_turn', 'restart_game'].includes(event)) {
        scheduleTurnTimer(room, { reset: room.status === 'playing' });
      }
      emitRoom(room);
      ackWith(ack, { ok: true });
    } catch (error) {
      emitError(socket, error);
      ackWith(ack, { ok: false, error: error.message });
    }
  });
}

function addOrReconnectPlayer(room, socket, playerId, name) {
  const existing = room.players.find((player) => player.id === playerId);
  if (existing) {
    if (existing.socketId && existing.socketId !== socket.id) {
      io.to(existing.socketId).emit('session_replaced', { message: 'Sesi pemain ini aktif di perangkat lain.' });
    }
    existing.name = name || existing.name;
    existing.connected = true;
    existing.socketId = socket.id;
    socket.data.playerId = playerId;
    return existing;
  }
  if (room.status !== 'lobby') throw new Error('Permainan sudah dimulai.');
  if (room.players.length >= gameEngine.MAX_PLAYERS) throw new Error('Room sudah penuh (maksimal 8 pemain).');
  const player = { id: playerId, name, connected: true, socketId: socket.id };
  room.players.push(player);
  socket.data.playerId = playerId;
  return player;
}

io.on('connection', (socket) => {
  socket.emit('server_ready', { ok: true });

  socket.on('create_room', (payload = {}, ack) => {
    try {
      const playerId = safePlayerId(payload.playerId);
      const name = safeName(payload.name);
      const gameMode = gameEngine.normalizeGameMode(payload.gameMode);
      const oldRoom = findRoomForPlayer(playerId);
      if (oldRoom) throw new Error('Kamu masih berada di room lain. Keluar dulu dari room itu.');
      const code = generateRoomCode();
      const room = {
        code,
        hostId: playerId,
        gameMode,
        status: 'lobby',
        players: [{ id: playerId, name, connected: true, socketId: socket.id }],
        game: null,
        rematchVotes: { yes: [], no: [], resolved: false, message: '' },
        createdAt: Date.now(),
      };
      rooms.set(code, room);
      socket.data.playerId = playerId;
      socket.join(code);
      if (room.status === 'playing' && !turnTimers.has(room.code)) scheduleTurnTimer(room, { reset: true });
      emitRoom(room);
      ackWith(ack, { ok: true, state: gameEngine.publicState(room, playerId) });
    } catch (error) {
      ackWith(ack, { ok: false, error: error.message });
    }
  });

  socket.on('join_room', (payload = {}, ack) => {
    try {
      const playerId = safePlayerId(payload.playerId);
      const name = safeName(payload.name);
      const code = String(payload.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) throw new Error('Kode room tidak ditemukan.');
      const oldRoom = findRoomForPlayer(playerId);
      if (oldRoom && oldRoom.code !== code) throw new Error('Kamu masih berada di room lain.');
      addOrReconnectPlayer(room, socket, playerId, name);
      socket.join(code);
      if (room.status === 'playing' && !turnTimers.has(room.code)) scheduleTurnTimer(room, { reset: true });
      emitRoom(room);
      ackWith(ack, { ok: true, state: gameEngine.publicState(room, playerId) });
    } catch (error) {
      ackWith(ack, { ok: false, error: error.message });
    }
  });

  socket.on('rejoin_room', (payload = {}, ack) => {
    try {
      const playerId = safePlayerId(payload.playerId);
      const code = String(payload.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) throw new Error('Room sudah tidak tersedia.');
      const player = room.players.find((item) => item.id === playerId);
      if (!player) throw new Error('Data pemain tidak ditemukan di room ini.');
      if (player.socketId && player.socketId !== socket.id) {
        io.to(player.socketId).emit('session_replaced', { message: 'Sesi pemain ini aktif di perangkat lain.' });
      }
      player.connected = true;
      player.socketId = socket.id;
      socket.data.playerId = playerId;
      socket.join(code);
      if (room.status === 'playing' && !turnTimers.has(room.code)) scheduleTurnTimer(room, { reset: true });
      emitRoom(room);
      ackWith(ack, { ok: true, state: gameEngine.publicState(room, playerId) });
    } catch (error) {
      ackWith(ack, { ok: false, error: error.message });
    }
  });

  bindAction(socket, 'start_game', (room, playerId) => {
    if (room.hostId !== playerId) throw new Error('Hanya host yang bisa memulai permainan.');
    if (room.status !== 'lobby') throw new Error('Permainan sudah dimulai.');
    const connected = room.players.filter((player) => player.connected);
    if (connected.length < gameEngine.MIN_PLAYERS) throw new Error('Minimal 2 pemain untuk memulai.');
    if (connected.length > gameEngine.MAX_PLAYERS) throw new Error('Maksimal 8 pemain.');
    room.players = connected;
    room.game = gameEngine.createGameForMode(connected, room.gameMode);
    room.status = 'playing';
    scheduleTurnTimer(room);
  });

  bindAction(socket, 'play_card', (room, playerId, payload) => {
    gameEngine.playCard(room, playerId, String(payload.cardId || ''), payload.chosenColor, {
      targetPlayerId: payload.targetPlayerId,
      discardHandCardId: payload.discardHandCardId,
      reviveCardId: payload.reviveCardId,
      blockedElement: payload.blockedElement,
    });
  });
  bindAction(socket, 'draw_card', (room, playerId) => gameEngine.drawOne(room, playerId));
  bindAction(socket, 'pass_turn', (room, playerId) => gameEngine.passTurn(room, playerId));
  bindAction(socket, 'call_uno', (room, playerId) => gameEngine.callUno(room, playerId));
  bindAction(socket, 'catch_uno', (room, playerId) => gameEngine.catchUno(room, playerId));
  bindAction(socket, 'restart_game', (room, playerId) => {
    roomLifecycle.restartGameInRoom(room, playerId, gameEngine.createGameForMode);
  });

  socket.on('vote_rematch', (payload = {}, ack) => {
    try {
      const playerId = socket.data.playerId;
      if (!playerId) throw new Error('Bergabung ke room terlebih dahulu.');
      const room = findRoomForPlayer(playerId);
      if (!room) throw new Error('Room tidak ditemukan.');
      const result = roomLifecycle.castRematchVote(room, playerId, String(payload.choice || ''), gameEngine.createGameForMode);
      if (result.restarted) scheduleTurnTimer(room);
      emitRoom(room);
      ackWith(ack, { ok: true, restarted: result.restarted });
    } catch (error) {
      emitError(socket, error);
      ackWith(ack, { ok: false, error: error.message });
    }
  });

  socket.on('leave_room', (_payload = {}, ack) => {
    const playerId = socket.data.playerId;
    const room = playerId ? findRoomForPlayer(playerId) : null;
    if (!room) {
      ackWith(ack, { ok: true });
      return;
    }
    socket.leave(room.code);
    if (room.status === 'lobby') {
      room.players = room.players.filter((player) => player.id !== playerId);
      if (room.players.length === 0) {
        clearTurnTimer(room.code);
        rooms.delete(room.code);
      } else {
        if (room.hostId === playerId) room.hostId = room.players[0].id;
        emitRoom(room);
      }
    } else {
      const wasCurrent = room.game?.currentPlayerId === playerId;
      if (room.game) {
        room.game.order = room.game.order.filter((id) => id !== playerId);
        delete room.game.hands[playerId];
        if (room.game.pendingUno === playerId) room.game.pendingUno = null;
        if (room.game.winnerIds) room.game.winnerIds = room.game.winnerIds.filter((id) => id !== playerId);
        if (room.game.blockedByPlayerId === playerId) {
          room.game.blockedElement = null;
          room.game.blockedByPlayerId = null;
        }
      }
      room.players = room.players.filter((item) => item.id !== playerId);
      if (room.rematchVotes) {
        room.rematchVotes.yes = room.rematchVotes.yes.filter((id) => id !== playerId);
        room.rematchVotes.no = room.rematchVotes.no.filter((id) => id !== playerId);
      }
      if (room.hostId === playerId && room.players.length > 0) room.hostId = room.players[0].id;
      if (room.players.length === 0) {
        clearTurnTimer(room.code);
        rooms.delete(room.code);
      } else {
        if (room.status === 'playing' && room.game) {
          const activeIds = gameEngine.activePlayerIds(room.game);
          if (activeIds.length <= 1) {
            clearTurnTimer(room.code);
            room.status = 'finished';
            room.game.loserId = activeIds[0] || null;
            room.game.currentPlayerId = activeIds[0] || null;
            room.game.turnDeadline = null;
            const loser = room.players.find((item) => item.id === room.game.loserId);
            room.game.lastMove = loser ? `${loser.name} kalah!` : 'Permainan berakhir';
          } else if (wasCurrent) {
            room.game.currentPlayerId = gameEngine.nextPlayerId(room.game, room, playerId, 1);
            room.game.turnHasDrawn = false;
            room.game.drawnCardId = null;
          }
        } else if (wasCurrent && room.game && room.game.order.length > 0) {
          room.game.currentPlayerId = gameEngine.nextPlayerId(room.game, room, playerId, 1);
          room.game.turnHasDrawn = false;
          room.game.drawnCardId = null;
        }
        if (room.status === 'playing') scheduleTurnTimer(room, { reset: true });
        emitRoom(room);
      }
    }
    socket.data.playerId = null;
    ackWith(ack, { ok: true });
  });

  socket.on('disconnect', () => {
    const playerId = socket.data.playerId;
    if (!playerId) return;
    const room = findRoomForPlayer(playerId);
    if (!room) return;
    const player = room.players.find((item) => item.id === playerId);
    if (!player || player.socketId !== socket.id) return;
    if (room.status === 'lobby') {
      room.players = room.players.filter((item) => item.id !== playerId);
      if (room.players.length === 0) {
        clearTurnTimer(room.code);
        rooms.delete(room.code);
        return;
      }
      if (room.hostId === playerId) room.hostId = room.players[0].id;
    } else {
      player.connected = false;
      player.socketId = null;
      if (room.game?.blockedByPlayerId === playerId) {
        room.game.blockedElement = null;
        room.game.blockedByPlayerId = null;
      }
      if (room.game?.currentPlayerId === playerId && room.status === 'playing') {
        room.game.pendingUno = room.game.pendingUno === playerId ? null : room.game.pendingUno;
        room.game.currentPlayerId = gameEngine.nextPlayerId(room.game, room, playerId, 1);
        room.game.turnHasDrawn = false;
        room.game.drawnCardId = null;
        scheduleTurnTimer(room, { reset: true });
      }
    }
    emitRoom(room);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`UNO Party server berjalan di http://${HOST}:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
