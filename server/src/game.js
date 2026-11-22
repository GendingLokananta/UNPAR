const crypto = require('node:crypto');

const COLORS = ['red', 'yellow', 'green', 'blue'];
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;

function makeCard(color, value) {
  return { id: crypto.randomUUID(), color, value };
}

function createDeck() {
  const deck = [];
  for (const color of COLORS) {
    deck.push(makeCard(color, '0'));
    for (let n = 1; n <= 9; n += 1) {
      deck.push(makeCard(color, String(n)));
      deck.push(makeCard(color, String(n)));
    }
    for (const action of ['skip', 'reverse', 'draw2']) {
      deck.push(makeCard(color, action));
      deck.push(makeCard(color, action));
    }
  }
  for (let i = 0; i < 4; i += 1) {
    deck.push(makeCard('wild', 'wild'));
    deck.push(makeCard('wild', 'wild_draw4'));
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function createGame(players) {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`Permainan membutuhkan ${MIN_PLAYERS}-${MAX_PLAYERS} pemain.`);
  }

  const deck = shuffle(createDeck());
  const hands = {};
  for (const player of players) {
    hands[player.id] = deck.splice(0, 7);
  }

  // Pilih kartu awal angka agar efek kartu aksi tidak perlu diproses saat setup.
  let firstCardIndex = deck.findIndex((card) => card.color !== 'wild' && /^\d$/.test(card.value));
  if (firstCardIndex < 0) firstCardIndex = 0;
  const firstCard = deck.splice(firstCardIndex, 1)[0];

  return {
    order: players.map((player) => player.id),
    hands,
    deck,
    discard: [firstCard],
    currentColor: firstCard.color,
    currentValue: firstCard.value,
    direction: 1,
    currentPlayerId: players[0].id,
    winnerId: null,
    lastMove: `${players[0].name} memulai permainan`,
    pendingUno: null,
    turnHasDrawn: false,
    drawnCardId: null,
  };
}

function refillDeck(game) {
  if (game.deck.length > 0 || game.discard.length <= 1) return;
  const top = game.discard.pop();
  game.deck = shuffle(game.discard);
  game.discard = [top];
}

function drawCards(game, playerId, amount) {
  const hand = game.hands[playerId];
  for (let i = 0; i < amount; i += 1) {
    refillDeck(game);
    if (game.deck.length === 0) break;
    hand.push(game.deck.pop());
  }
}

function nextPlayerId(game, room, fromId, steps = 1) {
  let index = game.order.indexOf(fromId);
  if (index < 0) index = 0;
  let candidate = fromId;
  const maxChecks = game.order.length * (steps + 2);
  for (let check = 0; check < maxChecks; check += 1) {
    index = (index + game.direction + game.order.length) % game.order.length;
    candidate = game.order[index];
    const player = room.players.find((p) => p.id === candidate);
    if (player && player.connected) {
      steps -= 1;
      if (steps <= 0) return candidate;
    }
  }
  return fromId;
}

function getPlayableCards(game, playerId) {
  const hand = game.hands[playerId] || [];
  if (game.turnHasDrawn && game.drawnCardId) {
    const drawn = hand.find((card) => card.id === game.drawnCardId);
    if (!drawn) return [];
    return canPlayCard(game, hand, drawn) ? [drawn.id] : [];
  }
  return hand.filter((card) => canPlayCard(game, hand, card)).map((card) => card.id);
}

function canPlayCard(game, hand, card) {
  if (!card) return false;
  if (card.color === 'wild') {
    if (card.value === 'wild_draw4') {
      const hasCurrentColor = hand.some((other) => other.id !== card.id && other.color === game.currentColor);
      if (hasCurrentColor) return false;
    }
    return true;
  }
  return card.color === game.currentColor || card.value === game.currentValue;
}

function ensureTurn(room, playerId) {
  if (room.status !== 'playing' || !room.game) throw new Error('Permainan belum dimulai.');
  if (room.game.currentPlayerId !== playerId) throw new Error('Belum giliranmu.');
}

function resolveUncalledUno(game) {
  if (!game.pendingUno) return null;
  const playerId = game.pendingUno;
  if (game.hands[playerId]) drawCards(game, playerId, 2);
  game.pendingUno = null;
  return playerId;
}

function callUno(room, playerId) {
  const game = room.game;
  if (room.status !== 'playing') throw new Error('Permainan belum dimulai.');
  if (game.pendingUno !== playerId) throw new Error('Belum ada UNO yang perlu kamu konfirmasi.');
  if ((game.hands[playerId] || []).length !== 1) throw new Error('UNO hanya bisa dipanggil saat kartumu tersisa satu.');
  game.pendingUno = null;
  game.lastMove = `${room.players.find((p) => p.id === playerId)?.name || 'Pemain'}: UNO!`;
}

function catchUno(room, catcherId) {
  const game = room.game;
  if (room.status !== 'playing' || !game.pendingUno) throw new Error('Tidak ada pemain yang belum memanggil UNO.');
  if (game.pendingUno === catcherId) throw new Error('Kamu tidak bisa menangkap UNO-mu sendiri.');
  const targetId = game.pendingUno;
  drawCards(game, targetId, 2);
  game.pendingUno = null;
  const catcher = room.players.find((p) => p.id === catcherId);
  const target = room.players.find((p) => p.id === targetId);
  game.lastMove = `${catcher?.name || 'Pemain'} menangkap UNO ${target?.name || 'pemain'} (+2 kartu)`;
}

function playCard(room, playerId, cardId, chosenColor) {
  ensureTurn(room, playerId);
  const game = room.game;
  const penalized = game.pendingUno ? resolveUncalledUno(game) : null;
  const hand = game.hands[playerId];
  const cardIndex = hand.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) throw new Error('Kartu tidak ditemukan di tanganmu.');
  const card = hand[cardIndex];
  if (game.turnHasDrawn && game.drawnCardId !== card.id) {
    throw new Error('Setelah mengambil kartu, kamu hanya boleh memainkan kartu yang baru diambil.');
  }
  if (!canPlayCard(game, hand, card)) {
    throw new Error('Kartu itu tidak cocok dengan warna atau angka yang aktif.');
  }
  if (card.color === 'wild' && !['red', 'yellow', 'green', 'blue'].includes(chosenColor)) {
    throw new Error('Pilih warna untuk kartu Wild.');
  }

  hand.splice(cardIndex, 1);
  game.discard.push(card);
  game.currentColor = card.color === 'wild' ? chosenColor : card.color;
  game.currentValue = card.value;
  game.turnHasDrawn = false;
  game.drawnCardId = null;

  const player = room.players.find((p) => p.id === playerId);
  const name = player?.name || 'Pemain';
  if (hand.length === 0) {
    game.winnerId = playerId;
    room.status = 'finished';
    game.pendingUno = null;
    game.lastMove = `${name} menang!`;
    return { penalized };
  }

  if (hand.length === 1) game.pendingUno = playerId;

  let steps = 1;
  if (card.value === 'skip') steps = 2;
  if (card.value === 'reverse') {
    game.direction *= -1;
    // Dalam duel 2 pemain, Reverse berfungsi seperti Skip.
    steps = game.order.length === 2 ? 2 : 1;
  }
  if (card.value === 'draw2' || card.value === 'wild_draw4') {
    const targetId = nextPlayerId(game, room, playerId, 1);
    drawCards(game, targetId, card.value === 'draw2' ? 2 : 4);
    steps = 2;
  }
  game.currentPlayerId = nextPlayerId(game, room, playerId, steps);
  game.lastMove = `${name} memainkan ${card.value === 'wild_draw4' ? 'Wild +4' : card.value === 'draw2' ? '+2' : card.value === 'reverse' ? 'Reverse' : card.value === 'skip' ? 'Skip' : card.value === 'wild' ? 'Wild' : card.value}`;
  if (penalized) game.lastMove += ' · Penalti UNO +2 diterapkan';
  return { penalized };
}

function drawOne(room, playerId) {
  ensureTurn(room, playerId);
  const game = room.game;
  if (game.turnHasDrawn) throw new Error('Kamu sudah mengambil kartu pada giliran ini.');
  if (game.pendingUno) resolveUncalledUno(game);
  drawCards(game, playerId, 1);
  const hand = game.hands[playerId];
  const drawn = hand[hand.length - 1];
  game.turnHasDrawn = true;
  game.drawnCardId = drawn?.id || null;
  game.lastMove = `${room.players.find((p) => p.id === playerId)?.name || 'Pemain'} mengambil 1 kartu`;
  return drawn || null;
}

function passTurn(room, playerId) {
  ensureTurn(room, playerId);
  const game = room.game;
  if (!game.turnHasDrawn) throw new Error('Ambil kartu terlebih dahulu sebelum melewati giliran.');
  if (game.pendingUno) resolveUncalledUno(game);
  game.turnHasDrawn = false;
  game.drawnCardId = null;
  game.currentPlayerId = nextPlayerId(game, room, playerId, 1);
  game.lastMove = `${room.players.find((p) => p.id === playerId)?.name || 'Pemain'} melewati giliran`;
}

function publicState(room, viewerId) {
  const base = {
    room: {
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
        connected: Boolean(player.connected),
        cardCount: room.game?.hands[player.id]?.length ?? 0,
      })),
    },
    you: { id: viewerId },
  };
  if (!room.game) return base;

  const game = room.game;
  const hand = game.hands[viewerId] || [];
  return {
    ...base,
    game: {
      currentPlayerId: game.currentPlayerId,
      currentColor: game.currentColor,
      currentValue: game.currentValue,
      topCard: game.discard[game.discard.length - 1],
      deckCount: game.deck.length,
      discardCount: game.discard.length,
      direction: game.direction,
      winnerId: game.winnerId,
      lastMove: game.lastMove,
      pendingUno: game.pendingUno,
      turnHasDrawn: game.currentPlayerId === viewerId && game.turnHasDrawn,
      drawnCardId: game.currentPlayerId === viewerId ? game.drawnCardId : null,
      playableCardIds: game.currentPlayerId === viewerId ? getPlayableCards(game, viewerId) : [],
      hand,
    },
  };
}

module.exports = {
  COLORS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  createDeck,
  createGame,
  drawOne,
  playCard,
  passTurn,
  callUno,
  catchUno,
  publicState,
  nextPlayerId,
};
