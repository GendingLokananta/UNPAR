const crypto = require('node:crypto');

const COLORS = ['red', 'yellow', 'green', 'blue'];
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;
const GAME_MODES = Object.freeze({ CLASSIC: 'classic', UNOLLELE: 'unollele' });
const UNOLLELE_ELEMENTS = Object.freeze(['fire', 'water', 'grass', 'electric', 'ground', 'colorless']);
const UNOLLELE_NUMBER_ELEMENTS = Object.freeze(['fire', 'water', 'grass', 'electric', 'ground']);
const UNOLLELE_WEAKNESS = Object.freeze({
  fire: ['water', 'ground', 'dragon'],
  water: ['grass', 'electric', 'dragon'],
  grass: ['fire', 'dragon'],
  electric: ['ground', 'dragon'],
  ground: ['water', 'grass', 'dragon'],
  colorless: ['fire', 'water', 'grass', 'electric', 'ground'],
  dragon: ['fire', 'water', 'grass', 'electric', 'ground', 'colorless', 'dragon'],
});
const UNOLLELE_BLOCKABLE_ELEMENTS = Object.freeze([
  'fire', 'water', 'grass', 'electric', 'ground', 'colorless', 'dragon',
]);
const DRAGON_EFFECT_COPIES = Object.freeze({
  skip: 4,
  switch_direction: 4,
  draw_two: 4,
  reroll: 4,
  switch_hand: 3,
  draw_one_all: 4,
  discard: 4,
  reset_all: 1,
  revive: 4,
  block: 4,
});
const DRAGON_EFFECTS = Object.freeze(Object.keys(DRAGON_EFFECT_COPIES));
const UNOLLELE_STARTING_HAND = 7;
const TURN_DURATION_MS = 15_000;
const UNO_CALL_WINDOW_MS = 500;
const UNOLLELE_DRAGON_COPIES = 4;

function normalizeGameMode(value) {
  const mode = String(value || GAME_MODES.CLASSIC).trim().toLowerCase();
  if (!Object.values(GAME_MODES).includes(mode)) {
    throw new Error('Mode permainan tidak dikenal.');
  }
  return mode;
}

function makeCard(color, value) {
  return { id: crypto.randomUUID(), color, value };
}

function makeUnolleleNumberCard(element, number) {
  return {
    id: crypto.randomUUID(),
    type: 'number',
    element,
    number,
  };
}

function makeDragonCard(effect) {
  return {
    id: crypto.randomUUID(),
    type: 'dragon',
    element: 'dragon',
    effect,
  };
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// UNO Classic deck (108 cards). Keep this unchanged for the existing mode.
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

function createUnolleleDeck() {
  const deck = [];
  for (const element of UNOLLELE_NUMBER_ELEMENTS) {
    for (let number = 1; number <= 10; number += 1) {
      // Two copies of each Fire/Water/Grass/Electric/Ground number.
      deck.push(makeUnolleleNumberCard(element, number));
      deck.push(makeUnolleleNumberCard(element, number));
    }
  }
  // Ten identical Colorless 10 cards.
  for (let copy = 0; copy < 10; copy += 1) {
    deck.push(makeUnolleleNumberCard('colorless', 10));
  }
  for (const effect of DRAGON_EFFECTS) {
    for (let copy = 0; copy < DRAGON_EFFECT_COPIES[effect]; copy += 1) {
      deck.push(makeDragonCard(effect));
    }
  }
  return deck;
}

function validatePlayerCount(players) {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`Permainan membutuhkan ${MIN_PLAYERS}-${MAX_PLAYERS} pemain.`);
  }
}

function createGame(players) {
  validatePlayerCount(players);
  const deck = shuffle(createDeck());
  const hands = {};
  for (const player of players) {
    hands[player.id] = deck.splice(0, 7);
  }

  // Start with a number card so no action effect is triggered during setup.
  let firstCardIndex = deck.findIndex((card) => card.color !== 'wild' && /^\d$/.test(card.value));
  if (firstCardIndex < 0) firstCardIndex = 0;
  const firstCard = deck.splice(firstCardIndex, 1)[0];

  return {
    mode: GAME_MODES.CLASSIC,
    order: players.map((player) => player.id),
    hands,
    deck,
    discard: [firstCard],
    currentColor: firstCard.color,
    currentValue: firstCard.value,
    direction: 1,
    currentPlayerId: players[0].id,
    winnerId: null,
    winnerIds: [],
    loserId: null,
    lastMove: `${players[0].name} memulai permainan`,
    pendingUno: null,
    pendingUnoDeadline: null,
    turnHasDrawn: false,
    drawnCardId: null,
    turnDeadline: Date.now() + TURN_DURATION_MS,
  };
}

function createUnolleleGame(players) {
  validatePlayerCount(players);
  const deck = shuffle(createUnolleleDeck());
  const hands = {};
  for (const player of players) {
    hands[player.id] = deck.splice(0, UNOLLELE_STARTING_HAND);
  }

  // The initial top card is always a numbered elemental card, never Dragon.
  const firstCardIndex = deck.findIndex((card) => card.type === 'number');
  if (firstCardIndex < 0) throw new Error('Deck UNOLLELE tidak memiliki kartu angka untuk memulai.');
  const firstCard = deck.splice(firstCardIndex, 1)[0];

  return {
    mode: GAME_MODES.UNOLLELE,
    order: players.map((player) => player.id),
    hands,
    deck,
    discard: [firstCard],
    direction: 1,
    currentPlayerId: players[0].id,
    winnerId: null,
    winnerIds: [],
    loserId: null,
    blockedElement: null,
    blockedByPlayerId: null,
    lastMove: `${players[0].name} memulai UNOLLELE`,
    pendingUno: null,
    pendingUnoDeadline: null,
    turnHasDrawn: false,
    drawnCardId: null,
    turnDeadline: Date.now() + TURN_DURATION_MS,
  };
}

function createGameForMode(players, gameMode) {
  const mode = normalizeGameMode(gameMode);
  return mode === GAME_MODES.UNOLLELE ? createUnolleleGame(players) : createGame(players);
}

function refillDeck(game) {
  if (game.deck.length > 0 || game.discard.length <= 1) return;
  const top = game.discard.pop();
  game.deck = shuffle(game.discard);
  game.discard = [top];
}

function drawCards(game, playerId, amount) {
  const hand = game.hands[playerId];
  if (!hand) return 0;
  let drawn = 0;
  for (let i = 0; i < amount; i += 1) {
    refillDeck(game);
    if (game.deck.length === 0) break;
    hand.push(game.deck.pop());
    drawn += 1;
  }
  return drawn;
}

function isSpectator(game, playerId) {
  return (game.winnerIds || []).includes(playerId);
}

function activePlayerIds(game) {
  return game.order.filter((playerId) => !isSpectator(game, playerId));
}

function nextPlayerId(game, room, fromId, steps = 1) {
  if (!game.order.length) return fromId;
  let index = game.order.indexOf(fromId);
  if (index < 0) index = 0;
  let candidate = fromId;
  const maxChecks = game.order.length * (steps + 2);
  for (let check = 0; check < maxChecks; check += 1) {
    index = (index + game.direction + game.order.length) % game.order.length;
    candidate = game.order[index];
    const player = room.players.find((p) => p.id === candidate);
    if (player && player.connected && !isSpectator(game, candidate)) {
      steps -= 1;
      if (steps <= 0) return candidate;
    }
  }
  return fromId;
}

function updateBlockedTurn(game, nextPlayerId) {
  if (game.blockedElement && game.blockedByPlayerId === nextPlayerId) {
    game.blockedElement = null;
    game.blockedByPlayerId = null;
  }
}

function setNextTurn(room, fromId, steps = 1) {
  const game = room.game;
  const nextId = nextPlayerId(game, room, fromId, steps);
  game.currentPlayerId = nextId;
  updateBlockedTurn(game, nextId);
  return nextId;
}

function recordPlayerWinners(room, playerIds, message) {
  const game = room.game;
  if (!game.winnerIds) game.winnerIds = game.winnerId ? [game.winnerId] : [];
  for (const playerId of playerIds) {
    if (!playerId || game.winnerIds.includes(playerId)) continue;
    game.winnerIds.push(playerId);
    if (game.pendingUno === playerId) { game.pendingUno = null; game.pendingUnoDeadline = null; }
  }
  if (game.winnerIds.length > 0 && !game.winnerId) game.winnerId = game.winnerIds[0];

  if (game.blockedByPlayerId && isSpectator(game, game.blockedByPlayerId)) {
    game.blockedElement = null;
    game.blockedByPlayerId = null;
  }
  const active = activePlayerIds(game);
  if (active.length <= 1) {
    const loserId = active[0] || null;
    game.loserId = loserId;
    room.status = 'finished';
    game.currentPlayerId = loserId || game.winnerIds[0] || null;
    game.turnDeadline = null;
    const loserName = room.players.find((item) => item.id === loserId)?.name || 'Pemain';
    game.lastMove = `${loserName} kalah!`;
    return { finished: true, loserId };
  }
  game.lastMove = message;
  return { finished: false, loserId: null };
}

function canPlayClassicCard(game, hand, card) {
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

function canPlayUnolleleCard(game, card) {
  if (!card || (card.type === 'dragon' && !DRAGON_EFFECTS.includes(card.effect))) return false;
  const topCard = game.discard[game.discard.length - 1];
  if (!topCard) return false;

  const cardElement = card.type === 'dragon' ? 'dragon' : card.element;
  if (game.blockedElement && cardElement === game.blockedElement) return false;

  // Dragon cannot be played on Colorless. Every Dragon can be answered by Colorless 10.
  if (card.type === 'dragon') return topCard.element !== 'colorless';

  if (card.type !== 'number' || !UNOLLELE_ELEMENTS.includes(card.element)) return false;

  // Number cards, including Colorless, can always be played on a Dragon.
  if (topCard.type === 'dragon' || topCard.element === 'dragon') return true;
  if (topCard.type !== 'number' || !UNOLLELE_ELEMENTS.includes(topCard.element)) return false;

  // Colorless 10 beats elemental cards only when 10 is strictly higher.
  if (card.element === 'colorless') {
    if (topCard.element === 'colorless') return card.number > topCard.number;
    return card.number > topCard.number;
  }

  // Any elemental number can beat Colorless, regardless of its value.
  if (topCard.element === 'colorless') {
    return UNOLLELE_NUMBER_ELEMENTS.includes(card.element);
  }

  // Same element: only a strictly higher number is allowed.
  if (card.element === topCard.element) return card.number > topCard.number;

  // Different elemental types follow the established weakness chart.
  return (UNOLLELE_WEAKNESS[topCard.element] || []).includes(card.element);
}
function canPlayCard(game, hand, card) {
  if (game?.mode === GAME_MODES.UNOLLELE) return canPlayUnolleleCard(game, card);
  return canPlayClassicCard(game, hand, card);
}

function getPlayableCards(game, playerId) {
  const hand = game.hands[playerId] || [];
  if (game.mode === GAME_MODES.UNOLLELE) {
    if (isSpectator(game, playerId)) return [];
    return hand.filter((card) => canPlayUnolleleCard(game, card)).map((card) => card.id);
  }
  if (game.turnHasDrawn && game.drawnCardId) {
    const drawn = hand.find((card) => card.id === game.drawnCardId);
    if (!drawn) return [];
    return canPlayClassicCard(game, hand, drawn) ? [drawn.id] : [];
  }
  return hand.filter((card) => canPlayClassicCard(game, hand, card)).map((card) => card.id);
}

function ensureTurn(room, playerId) {
  if (room.status !== 'playing' || !room.game) throw new Error('Permainan belum dimulai.');
  if (isSpectator(room.game, playerId)) {
    throw new Error('Kamu sudah menang dan sekarang menjadi spectator.');
  }
  if (room.game.currentPlayerId !== playerId) throw new Error('Belum giliranmu.');
}

function resolveUncalledUno(game) {
  if (!game.pendingUno) return null;
  const playerId = game.pendingUno;
  if (game.hands[playerId]) drawCards(game, playerId, 2);
  game.pendingUno = null;
  game.pendingUnoDeadline = null;
  return playerId;
}

function callUno(room, playerId) {
  const game = room.game;
  if (room.status !== 'playing') throw new Error('Permainan belum dimulai.');
  if (isSpectator(game, playerId)) {
    throw new Error('Pemain spectator tidak dapat melakukan aksi gameplay.');
  }
  if (game.pendingUno !== playerId) throw new Error('Belum ada UNO yang perlu kamu konfirmasi.');
  if ((game.hands[playerId] || []).length !== 1) throw new Error('UNO hanya bisa dipanggil saat kartumu tersisa satu.');
  if (Date.now() > (game.pendingUnoDeadline || 0)) throw new Error('Waktu menekan UNO sudah habis.');
  game.pendingUno = null;
  game.pendingUnoDeadline = null;
  game.lastMove = `${room.players.find((p) => p.id === playerId)?.name || 'Pemain'}: UNO!`;
}

function catchUno(room, catcherId) {
  const game = room.game;
  if (room.status !== 'playing' || !game.pendingUno) throw new Error('Tidak ada pemain yang belum memanggil UNO.');
  if (game.pendingUno === catcherId) throw new Error('Kamu tidak bisa menangkap UNO-mu sendiri.');
  if (Date.now() < (game.pendingUnoDeadline || 0)) throw new Error('Tunggu sampai kesempatan UNO berakhir sebelum menembak.');
  const targetId = game.pendingUno;
  drawCards(game, targetId, 2);
  game.pendingUno = null;
  game.pendingUnoDeadline = null;
  const catcher = room.players.find((p) => p.id === catcherId);
  const target = room.players.find((p) => p.id === targetId);
  game.lastMove = `${catcher?.name || 'Pemain'} menangkap UNO ${target?.name || 'pemain'} (+2 kartu)`;
}

function playClassicCard(room, playerId, cardId, chosenColor) {
  const game = room.game;
  const penalized = game.pendingUno ? resolveUncalledUno(game) : null;
  const hand = game.hands[playerId];
  const cardIndex = hand.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) throw new Error('Kartu tidak ditemukan di tanganmu.');
  const card = hand[cardIndex];
  if (game.turnHasDrawn && game.drawnCardId !== card.id) {
    throw new Error('Setelah mengambil kartu, kamu hanya boleh memainkan kartu yang baru diambil.');
  }
  if (!canPlayClassicCard(game, hand, card)) {
    throw new Error('Kartu itu tidak cocok dengan warna atau angka yang aktif.');
  }
  if (card.color === 'wild' && !COLORS.includes(chosenColor)) {
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
  if (hand.length === 1) { game.pendingUno = playerId; game.pendingUnoDeadline = Date.now() + UNO_CALL_WINDOW_MS; }

  let steps = 1;
  if (card.value === 'skip') steps = 2;
  if (card.value === 'reverse') {
    game.direction *= -1;
    steps = game.order.length === 2 ? 2 : 1;
  }
  if (card.value === 'draw2' || card.value === 'wild_draw4') {
    const targetId = nextPlayerId(game, room, playerId, 1);
    if (targetId !== playerId) drawCards(game, targetId, card.value === 'draw2' ? 2 : 4);
    steps = 2;
  }

  if (hand.length === 0) {
    const result = recordPlayerWinners(room, [playerId], `${name} menang dan sekarang menjadi spectator`);
    if (result.finished) return { penalized, loserId: result.loserId };
  }

  setNextTurn(room, playerId, steps);
  game.turnDeadline = Date.now() + TURN_DURATION_MS;
  const label = card.value === 'wild_draw4' ? 'Wild +4'
    : card.value === 'draw2' ? '+2'
    : card.value === 'reverse' ? 'Reverse'
    : card.value === 'skip' ? 'Skip'
    : card.value === 'wild' ? 'Wild'
    : card.value;
  game.lastMove = `${name} memainkan ${label}`;
  if (isSpectator(game, playerId)) game.lastMove += ` — ${name} menang dan menjadi spectator`;
  if (penalized) game.lastMove += ' · Penalti UNO +2 diterapkan';
  return { penalized };
}
function recycleDiscardIntoDeck(game) {
  if (game.discard.length <= 1) return;
  const top = game.discard.pop();
  game.deck.push(...game.discard);
  game.discard = [top];
  shuffle(game.deck);
}

function playUnolleleCard(room, playerId, cardId, options = {}) {
  const game = room.game;
  let hand = game.hands[playerId];
  const cardIndex = hand.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) throw new Error('Kartu tidak ditemukan di tanganmu.');
  const card = hand[cardIndex];
  if (!canPlayUnolleleCard(game, card)) {
    throw new Error('Kartu tidak valid atau elemennya sedang diblokir. Periksa aturan UNOLLELE.');
  }

  const {
    targetPlayerId,
    discardHandCardId,
    reviveCardId,
    blockedElement,
  } = options || {};

  let switchTarget = null;
  if (card.type === 'dragon' && card.effect === 'switch_hand') {
    const targetId = String(targetPlayerId || '').trim();
    switchTarget = room.players.find((player) =>
      player.id === targetId &&
      player.connected &&
      targetId !== playerId &&
      !isSpectator(game, targetId) &&
      game.hands[targetId] &&
      game.order.includes(targetId));
    if (!switchTarget) {
      throw new Error('Pilih pemain lain yang masih aktif dan sedang online untuk Dragon Switch.');
    }
  }

  let discardHandCard = null;
  if (card.type === 'dragon' && card.effect === 'discard' && discardHandCardId) {
    discardHandCard = hand.find((item) => item.id === discardHandCardId && item.id !== card.id) || null;
    if (!discardHandCard) throw new Error('Pilih satu kartu lain dari tanganmu untuk Dragon Discard.');
  }

  let reviveCard = null;
  if (card.type === 'dragon' && card.effect === 'revive' && hand.length > 1) {
    reviveCard = game.discard.find((item) => item.id === reviveCardId) || null;
    if (!reviveCard) throw new Error('Pilih satu kartu dari discard pile untuk Dragon Revive.');
  }

  if (card.type === 'dragon' && card.effect === 'block') {
    if (!UNOLLELE_BLOCKABLE_ELEMENTS.includes(blockedElement)) {
      throw new Error('Pilih elemen yang ingin diblokir oleh Dragon Block.');
    }
  }

  const penalized = game.pendingUno ? resolveUncalledUno(game) : null;
  const actualIndex = hand.findIndex((item) => item.id === cardId);
  if (actualIndex < 0) throw new Error('Kartu tidak ditemukan setelah penalti UNO.');
  hand.splice(actualIndex, 1);
  game.discard.push(card);
  game.turnHasDrawn = false;
  game.drawnCardId = null;

  const player = room.players.find((p) => p.id === playerId);
  const name = player?.name || 'Pemain';
  const effectLabels = {
    skip: 'Dragon Skip All',
    switch_direction: 'Dragon Reverse',
    draw_two: 'Dragon +2',
    reroll: 'Dragon Reroll 4',
    switch_hand: 'Dragon Switch',
    draw_one_all: 'Dragon +1 All',
    discard: 'Dragon Discard',
    reset_all: 'Dragon Reset All',
    revive: 'Dragon Revive',
    block: 'Dragon Block',
  };
  let moveLabel = card.type === 'dragon'
    ? (effectLabels[card.effect] || 'Dragon')
    : `${card.element.toUpperCase()} ${card.number}`;

  let nextSteps = 1;
  let samePlayerAgain = false;
  let emptiedPlayerIds = [];

  if (card.type === 'dragon') {
    switch (card.effect) {
      case 'skip':
        // Dragon Skip All keeps the turn with the player who played it.
        samePlayerAgain = true;
        break;
      case 'switch_direction': {
        game.direction *= -1;
        const activeConnectedCount = room.players.filter((item) =>
          item.connected && game.order.includes(item.id) && !isSpectator(game, item.id)).length;
        if (activeConnectedCount === 2) samePlayerAgain = true;
        break;
      }
      case 'draw_two': {
        const targetId = nextPlayerId(game, room, playerId, 1);
        if (targetId !== playerId) drawCards(game, targetId, 2);
        nextSteps = 2;
        break;
      }
      case 'reroll': {
        game.deck.push(...hand.splice(0, hand.length));
        shuffle(game.deck);
        drawCards(game, playerId, 4);
        game.pendingUno = null;
        game.pendingUnoDeadline = null;
        moveLabel += ' (ambil 4 kartu baru)';
        break;
      }
      case 'switch_hand': {
        const targetId = switchTarget.id;
        const targetName = switchTarget.name || 'Pemain';
        const targetHand = game.hands[targetId];
        const actorPlayedLastCard = hand.length === 0;
        game.hands[playerId] = targetHand;
        game.hands[targetId] = hand;
        hand = game.hands[playerId];
        moveLabel += ` dengan ${targetName} (tukar seluruh kartu tangan)`;
        // The player who played Dragon Switch owns the win if it was their final card.
        // Do not award the win to the target merely because the empty hand was transferred.
        emptiedPlayerIds = actorPlayedLastCard ? [playerId] : [];
        game.pendingUno = null;
        game.pendingUnoDeadline = null;
        break;
      }
      case 'draw_one_all': {
        // Every other active player draws one card; the player using this card is excluded.
        for (const targetId of activePlayerIds(game)) {
          if (targetId !== playerId) drawCards(game, targetId, 1);
        }
        moveLabel += ' (semua pemain lain +1 kartu)';
        break;
      }
      case 'discard': {
        if (discardHandCard) {
          const index = hand.findIndex((item) => item.id === discardHandCard.id);
          if (index >= 0) {
            const [discarded] = hand.splice(index, 1);
            game.discard.push(discarded); // The discarded card's effect is not activated.
            moveLabel += ` (buang ${discarded.type === 'dragon' ? 'Dragon' : `${discarded.element} ${discarded.number}`})`;
          }
        }
        if (hand.length === 0) emptiedPlayerIds.push(playerId);
        break;
      }
      case 'reset_all': {
        // Keep Dragon Reset All on top; all remaining active hands become inert discard cards.
        const resetCardOnTop = game.discard.pop();
        for (const activeId of activePlayerIds(game)) {
          const activeHand = game.hands[activeId] || [];
          game.discard.push(...activeHand.splice(0, activeHand.length));
          game.pendingUno = null;
          game.pendingUnoDeadline = null;
        }
        game.discard.push(resetCardOnTop);
        for (const activeId of activePlayerIds(game)) drawCards(game, activeId, 7);
        moveLabel += ' (semua pemain aktif reset ke 7 kartu)';
        break;
      }
      case 'revive': {
        // If Dragon Revive was the final card, the player wins without taking a card back.
        if (hand.length > 0 && reviveCard) {
          const index = game.discard.findIndex((item) => item.id === reviveCard.id);
          if (index >= 0) {
            const [recovered] = game.discard.splice(index, 1);
            hand.push(recovered);
            moveLabel += ' (ambil 1 kartu dari discard pile)';
          }
        } else if (hand.length === 0) {
          emptiedPlayerIds.push(playerId);
        }
        break;
      }
      case 'block': {
        game.blockedElement = blockedElement;
        game.blockedByPlayerId = playerId;
        moveLabel += ` (blokir ${String(blockedElement).toUpperCase()} sampai giliranmu kembali)`;
        break;
      }
      default:
        throw new Error('Efek Dragon tidak dikenal.');
    }
  }

  if (card.effect !== 'switch_hand') {
    if (hand.length === 1) { game.pendingUno = playerId; game.pendingUnoDeadline = Date.now() + UNO_CALL_WINDOW_MS; }
    else if (hand.length !== 1 && game.pendingUno === playerId) { game.pendingUno = null; game.pendingUnoDeadline = null; }
  }

  if (hand.length === 0 && !emptiedPlayerIds.includes(playerId)) {
    emptiedPlayerIds.push(playerId);
  }

  const playerNames = emptiedPlayerIds.map((id) =>
    room.players.find((item) => item.id === id)?.name || 'Pemain');
  if (emptiedPlayerIds.length > 0) {
    const result = recordPlayerWinners(
      room,
      emptiedPlayerIds,
      `${playerNames.join(', ')} berhasil menang dan sekarang menjadi spectator`,
    );
    if (result.finished) return { penalized, loserId: result.loserId };
  }

  if (samePlayerAgain && !isSpectator(game, playerId)) {
    game.currentPlayerId = playerId;
  } else {
    setNextTurn(room, playerId, nextSteps);
  }
  game.turnDeadline = Date.now() + TURN_DURATION_MS;
  game.lastMove = `${name} memainkan ${moveLabel}`;
  if (emptiedPlayerIds.length > 0) {
    game.lastMove += ` — ${playerNames.join(', ')} menang dan menjadi spectator`;
  }
  if (penalized) game.lastMove += ' · Penalti UNO +2 diterapkan';
  return { penalized };
}

function playCard(room, playerId, cardId, chosenColor, options = {}) {
  ensureTurn(room, playerId);
  if (room.game.mode === GAME_MODES.UNOLLELE) {
    const normalizedOptions = typeof options === 'string' ? { targetPlayerId: options } : options;
    return playUnolleleCard(room, playerId, cardId, normalizedOptions);
  }
  return playClassicCard(room, playerId, cardId, chosenColor);
}

function timeoutTurn(room) {
  if (room.status !== 'playing' || !room.game) return false;
  const game = room.game;
  const playerId = game.currentPlayerId;
  if (!playerId || !game.hands[playerId]) return false;

  if (game.pendingUno) resolveUncalledUno(game);
  const drawn = drawCards(game, playerId, 2);
  game.turnHasDrawn = false;
  game.drawnCardId = null;
  setNextTurn(room, playerId, 1);
  game.turnDeadline = Date.now() + TURN_DURATION_MS;
  const name = room.players.find((p) => p.id === playerId)?.name || 'Pemain';
  game.lastMove = `Waktu habis: ${name} mengambil ${drawn} kartu (+2), giliran dilewati`;
  return true;
}

function drawOne(room, playerId) {
  ensureTurn(room, playerId);
  const game = room.game;
  if (game.mode === GAME_MODES.UNOLLELE) {
    // Drawing is an optional way to end the turn, even when a playable card exists.
    if (game.pendingUno) resolveUncalledUno(game);
    const drawn = drawCards(game, playerId, 1);
    game.turnHasDrawn = false;
    game.drawnCardId = null;
    setNextTurn(room, playerId, 1);
    game.turnDeadline = Date.now() + TURN_DURATION_MS;
    const name = room.players.find((p) => p.id === playerId)?.name || 'Pemain';
    game.lastMove = drawn > 0
      ? `${name} mengambil 1 kartu; giliran dilewati`
      : `${name} tidak dapat mengambil kartu; giliran dilewati`;
    return drawn;
  }

  if (game.turnHasDrawn) throw new Error('Kamu sudah mengambil kartu pada giliran ini.');
  if (game.pendingUno) resolveUncalledUno(game);
  drawCards(game, playerId, 1);
  const hand = game.hands[playerId];
  const drawn = hand[hand.length - 1];
  game.turnHasDrawn = true;
  game.drawnCardId = drawn?.id || null;
  game.turnDeadline = Date.now() + TURN_DURATION_MS;
  game.lastMove = `${room.players.find((p) => p.id === playerId)?.name || 'Pemain'} mengambil 1 kartu`;
  return drawn || null;
}

function passTurn(room, playerId) {
  ensureTurn(room, playerId);
  const game = room.game;
  if (game.mode === GAME_MODES.UNOLLELE) {
    throw new Error('Dalam UNOLLELE, giliran langsung dilewati setelah mengambil kartu.');
  }
  if (!game.turnHasDrawn) throw new Error('Ambil kartu terlebih dahulu sebelum melewati giliran.');
  if (game.pendingUno) resolveUncalledUno(game);
  game.turnHasDrawn = false;
  game.drawnCardId = null;
  setNextTurn(room, playerId, 1);
  game.turnDeadline = Date.now() + TURN_DURATION_MS;
  game.lastMove = `${room.players.find((p) => p.id === playerId)?.name || 'Pemain'} melewati giliran`;
}

function publicState(room, viewerId) {
  const base = {
    room: {
      code: room.code,
      gameMode: normalizeGameMode(room.gameMode),
      status: room.status,
      hostId: room.hostId,
      rematchVotes: {
        yes: [...(room.rematchVotes?.yes || [])],
        no: [...(room.rematchVotes?.no || [])],
        eligible: room.players.filter((player) => player.connected).length,
        resolved: Boolean(room.rematchVotes?.resolved),
        message: room.rematchVotes?.message || '',
      },
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
        connected: Boolean(player.connected),
        cardCount: room.game?.hands[player.id]?.length ?? 0,
        isSpectator: Boolean(room.game && isSpectator(room.game, player.id)),
      })),
    },
    you: { id: viewerId },
  };
  if (!room.game) return base;

  const game = room.game;
  const hand = game.hands[viewerId] || [];
  const currentPlayerTurn = game.currentPlayerId === viewerId;
  const commonGameState = {
    currentPlayerId: game.currentPlayerId,
    topCard: game.discard[game.discard.length - 1],
    deckCount: game.deck.length,
    discardCount: game.discard.length,
    direction: game.direction,
    winnerId: game.winnerId,
    winnerIds: [...(game.winnerIds || (game.winnerId ? [game.winnerId] : []))],
    loserId: game.loserId || null,
    isSpectator: isSpectator(game, viewerId),
    blockedElement: game.blockedElement || null,
    blockedByPlayerId: game.blockedByPlayerId || null,
    discardPile: game.mode === GAME_MODES.UNOLLELE ? [...game.discard] : undefined,
    lastMove: game.lastMove,
    pendingUno: game.pendingUno,
    pendingUnoDeadline: game.pendingUnoDeadline || null,
    unoCallWindowMs: UNO_CALL_WINDOW_MS,
    turnHasDrawn: currentPlayerTurn && game.turnHasDrawn,
    drawnCardId: currentPlayerTurn ? game.drawnCardId : null,
    playableCardIds: currentPlayerTurn ? getPlayableCards(game, viewerId) : [],
    canDraw: currentPlayerTurn && (game.mode === GAME_MODES.UNOLLELE
      ? true
      : !game.turnHasDrawn),
    turnDeadline: game.turnDeadline,
    turnDurationMs: TURN_DURATION_MS,
    turnOrder: [...game.order],
    hand,
  };

  if (game.mode === GAME_MODES.UNOLLELE) {
    return {
      ...base,
      game: {
        ...commonGameState,
        mode: GAME_MODES.UNOLLELE,
        currentElement: game.discard[game.discard.length - 1]?.element ?? null,
        blockOptions: [...UNOLLELE_BLOCKABLE_ELEMENTS],
      },
    };
  }

  return {
    ...base,
    game: {
      ...commonGameState,
      mode: GAME_MODES.CLASSIC,
      currentColor: game.currentColor,
      currentValue: game.currentValue,
    },
  };
}

module.exports = {
  COLORS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  GAME_MODES,
  UNOLLELE_ELEMENTS,
  UNOLLELE_BLOCKABLE_ELEMENTS,
  UNOLLELE_WEAKNESS,
  DRAGON_EFFECTS,
  DRAGON_EFFECT_COPIES,
  UNOLLELE_STARTING_HAND,
  UNOLLELE_DRAGON_COPIES,
  TURN_DURATION_MS,
  UNO_CALL_WINDOW_MS,
  normalizeGameMode,
  createDeck,
  createUnolleleDeck,
  createGame,
  createUnolleleGame,
  createGameForMode,
  drawOne,
  timeoutTurn,
  playCard,
  passTurn,
  callUno,
  catchUno,
  publicState,
  nextPlayerId,
  canPlayCard,
  canPlayUnolleleCard,
  getPlayableCards,
  activePlayerIds,
  isSpectator,
  makeUnolleleNumberCard,
  makeDragonCard,
};
