const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../src/game');

function players(count = 4) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    connected: true,
  }));
}

function number(id, element, value) {
  return { id, type: 'number', element, number: value };
}

function dragon(id, effect) {
  return { id, type: 'dragon', element: 'dragon', effect };
}

function roomWith({
  playerList = players(),
  top = number('top', 'colorless', 10),
  hand = [],
  otherHands = {},
  deck = [],
  currentPlayerId = 'p1',
  direction = 1,
} = {}) {
  const hands = {};
  for (const player of playerList) hands[player.id] = otherHands[player.id] || [];
  hands[currentPlayerId] = hand;
  const game = {
    mode: engine.GAME_MODES.UNOLLELE,
    order: playerList.map((player) => player.id),
    hands,
    deck: [...deck],
    discard: [top],
    direction,
    currentPlayerId,
    winnerId: null,
    lastMove: '',
    pendingUno: null,
    turnHasDrawn: false,
    drawnCardId: null,
    turnDeadline: Date.now() + engine.TURN_DURATION_MS,
  };
  return { code: 'TEST01', gameMode: 'unollele', status: 'playing', hostId: playerList[0].id, players: playerList, game };
}

test('UNOLLELE deck contains 126 cards: 100 elemental numbers, 10 Colorless and 16 Dragon', () => {
  const deck = engine.createUnolleleDeck();
  assert.equal(deck.length, 126);
  assert.equal(deck.filter((card) => card.type === 'number').length, 110);
  assert.equal(deck.filter((card) => card.type === 'dragon').length, 16);
  for (const element of ['fire', 'water', 'grass', 'electric', 'ground']) {
    for (let value = 1; value <= 10; value += 1) {
      assert.equal(deck.filter((card) => card.element === element && card.number === value).length, 2);
    }
  }
  for (let value = 1; value <= 10; value += 1) {
    assert.equal(deck.filter((card) => card.element === 'colorless' && card.number === value).length, 1);
  }
  for (const effect of engine.DRAGON_EFFECTS) {
    assert.equal(deck.filter((card) => card.type === 'dragon' && card.effect === effect).length, 4);
  }
});

test('UNOLLELE deals seven cards per player and starts with a numbered card', () => {
  const roomPlayers = players(8);
  const game = engine.createUnolleleGame(roomPlayers);
  assert.equal(game.mode, 'unollele');
  assert.equal(Object.keys(game.hands).length, 8);
  for (const hand of Object.values(game.hands)) assert.equal(hand.length, 7);
  assert.equal(game.discard.length, 1);
  assert.equal(game.discard[0].type, 'number');
  assert.equal(game.deck.length + game.discard.length + 56, 126);
});

test('UNOLLELE mode is selected by createGameForMode while Classic still deals seven cards', () => {
  const roomPlayers = players(3);
  assert.equal(engine.createGameForMode(roomPlayers, 'unollele').hands.p1.length, 7);
  assert.equal(engine.createGameForMode(roomPlayers, 'classic').hands.p1.length, 7);
});

test('same element accepts only a strictly higher number', () => {
  const game = { discard: [number('top', 'fire', 5)] };
  assert.equal(engine.canPlayUnolleleCard(game, number('higher', 'fire', 6)), true);
  assert.equal(engine.canPlayUnolleleCard(game, number('same', 'fire', 5)), false);
  assert.equal(engine.canPlayUnolleleCard(game, number('lower', 'fire', 4)), false);
});

test('every numbered element is weak to Dragon, and Dragon is weak to every numbered element', () => {
  for (const element of engine.UNOLLELE_ELEMENTS) {
    assert.ok(engine.UNOLLELE_WEAKNESS[element].includes('dragon'));
    assert.ok(engine.UNOLLELE_WEAKNESS.dragon.includes(element));
  }
  assert.equal(engine.UNOLLELE_WEAKNESS.dragon.includes('dragon'), false);
});

test('weakness relations follow every defined element matchup and universal Colorless/Dragon', () => {
  const matchups = [
    ['fire', ['water', 'ground']],
    ['water', ['grass', 'electric']],
    ['grass', ['fire']],
    ['electric', ['ground']],
    ['ground', ['water', 'grass']],
  ];
  for (const [topElement, playableElements] of matchups) {
    const game = { discard: [number('top', topElement, 10)] };
    for (const element of playableElements) {
      assert.equal(engine.canPlayUnolleleCard(game, number(`valid-${element}`, element, 1)), true, `${element} should play on ${topElement}`);
    }
    assert.equal(engine.canPlayUnolleleCard(game, number('universal-colorless', 'colorless', 1)), true);
    assert.equal(engine.canPlayUnolleleCard(game, dragon('universal-dragon', 'skip')), true);
    for (const element of engine.UNOLLELE_ELEMENTS.filter((item) => item !== topElement && item !== 'colorless' && !playableElements.includes(item))) {
      assert.equal(engine.canPlayUnolleleCard(game, number(`invalid-${element}`, element, 10)), false, `${element} should not play on ${topElement}`);
    }
  }
});

test('Colorless counters all elemental types regardless of number, but same Colorless requires higher number', () => {
  const game = { discard: [number('top-fire-5', 'fire', 5)] };
  assert.equal(engine.canPlayUnolleleCard(game, number('colorless-1', 'colorless', 1)), true);
  assert.equal(engine.canPlayUnolleleCard(game, number('colorless-5', 'colorless', 5)), true);
  assert.equal(engine.canPlayUnolleleCard({ discard: [number('top-c-5', 'colorless', 5)] }, number('colorless-6', 'colorless', 6)), true);
  assert.equal(engine.canPlayUnolleleCard({ discard: [number('top-c-5', 'colorless', 5)] }, number('colorless-5', 'colorless', 5)), false);
});

test('Colorless accepts all five elemental types and Dragon regardless of number', () => {
  const game = { discard: [number('top', 'colorless', 10)] };
  for (const element of ['fire', 'water', 'grass', 'electric', 'ground']) {
    assert.equal(engine.canPlayUnolleleCard(game, number(`c-${element}`, element, 1)), true);
  }
  assert.equal(engine.canPlayUnolleleCard(game, dragon('d', 'skip')), true);
  assert.equal(engine.canPlayUnolleleCard(game, number('colorless-low', 'colorless', 1)), false);
  assert.equal(engine.canPlayUnolleleCard(game, number('colorless-high', 'colorless', 10)), false);
});

test('Dragon can be played on every numbered type, and never on another Dragon', () => {
  for (const element of engine.UNOLLELE_ELEMENTS) {
    assert.equal(engine.canPlayUnolleleCard({ discard: [number(`top-${element}`, element, 2)] }, dragon(`dragon-${element}`, 'skip')), true);
  }
  assert.equal(engine.canPlayUnolleleCard({ discard: [dragon('d3', 'draw_two')] }, dragon('d4', 'reset')), false);
});

test('every numbered element can be played on Dragon, but another Dragon cannot', () => {
  const game = { discard: [dragon('top-dragon', 'skip')] };
  for (const element of engine.UNOLLELE_ELEMENTS) {
    assert.equal(engine.canPlayUnolleleCard(game, number(`n-${element}`, element, 1)), true);
  }
  assert.equal(engine.canPlayUnolleleCard(game, dragon('other-dragon', 'reset')), false);
});

test('Dragon Skip keeps the turn with the player who played it', () => {
  const room = roomWith({ hand: [dragon('skip', 'skip'), number('fire-1', 'fire', 1)] });
  engine.playCard(room, 'p1', 'skip');
  assert.equal(room.game.currentPlayerId, 'p1');
  assert.equal(room.game.discard.at(-1).id, 'skip');
  assert.equal(room.status, 'playing');
  assert.deepEqual(engine.getPlayableCards(room.game, 'p1'), ['fire-1']);
});

test('Dragon Switch Direction reverses direction and advances to the previous player', () => {
  const room = roomWith({ hand: [dragon('switch', 'switch_direction')] });
  engine.playCard(room, 'p1', 'switch');
  assert.equal(room.game.direction, -1);
  assert.equal(room.game.currentPlayerId, 'p4');
});

test('Dragon Switch Direction in a two-player game gives the turn back to the player', () => {
  const room = roomWith({ playerList: players(2), hand: [dragon('switch', 'switch_direction')] });
  engine.playCard(room, 'p1', 'switch');
  assert.equal(room.game.direction, -1);
  assert.equal(room.game.currentPlayerId, 'p1');
});

test('Dragon +2 penalizes and skips the next player, then advances to the following player', () => {
  const room = roomWith({
    hand: [dragon('plus-two', 'draw_two')],
    deck: [number('draw-a', 'fire', 1), number('draw-b', 'water', 2), number('draw-c', 'grass', 3)],
  });
  engine.playCard(room, 'p1', 'plus-two');
  assert.equal(room.game.hands.p2.length, 2);
  assert.equal(room.game.currentPlayerId, 'p3');
  assert.equal(room.game.discard.at(-1).id, 'plus-two');
  assert.equal(engine.canPlayUnolleleCard(room.game, number('any', 'grass', 1)), true);
});

test('Dragon +2 as the final card wins but still applies the two-card penalty', () => {
  const room = roomWith({
    hand: [dragon('last-plus-two', 'draw_two')],
    deck: [number('draw-a', 'fire', 1), number('draw-b', 'water', 2)],
  });
  engine.playCard(room, 'p1', 'last-plus-two');
  assert.equal(room.status, 'finished');
  assert.equal(room.game.winnerId, 'p1');
  assert.equal(room.game.hands.p2.length, 2);
});

test('Dragon Reset shuffles the remaining hand into the pile and draws four new cards', () => {
  const room = roomWith({
    hand: [dragon('reset', 'reset'), number('held-1', 'fire', 1), number('held-2', 'water', 2)],
    deck: Array.from({ length: 8 }, (_, index) => number(`deck-${index}`, 'grass', (index % 10) + 1)),
  });
  engine.playCard(room, 'p1', 'reset');
  assert.equal(room.game.hands.p1.length, 4);
  assert.equal(room.game.deck.length, 6);
  assert.equal(room.game.discard.at(-1).id, 'reset');
  assert.equal(room.game.currentPlayerId, 'p2');
  assert.equal(room.status, 'playing');
  assert.equal(room.game.winnerId, null);
});

test('Dragon Reset played as the last card is not a win and still deals four cards', () => {
  const room = roomWith({
    hand: [dragon('last-reset', 'reset')],
    deck: Array.from({ length: 4 }, (_, index) => number(`replacement-${index}`, 'electric', index + 1)),
  });
  engine.playCard(room, 'p1', 'last-reset');
  assert.equal(room.status, 'playing');
  assert.equal(room.game.winnerId, null);
  assert.equal(room.game.hands.p1.length, 4);
  assert.equal(room.game.currentPlayerId, 'p2');
});

test('UNOLLELE draw is allowed even with a valid card and immediately skips the turn', () => {
  const room = roomWith({
    top: number('top-fire-5', 'fire', 5),
    hand: [number('valid-water', 'water', 1)],
    deck: [number('draw-card', 'electric', 3)],
  });
  engine.drawOne(room, 'p1');
  assert.equal(room.game.hands.p1.length, 2);
  assert.equal(room.game.currentPlayerId, 'p2');
  assert.equal(room.game.turnHasDrawn, false);
  assert.equal(room.game.drawnCardId, null);
});

test('15-second timeout gives the active player two cards and skips their turn', () => {
  const room = roomWith({
    hand: [number('held', 'fire', 2)],
    deck: [number('timeout-a', 'water', 1), number('timeout-b', 'grass', 2)],
  });
  const before = room.game.turnDeadline;
  assert.equal(engine.TURN_DURATION_MS, 15000);
  assert.equal(engine.timeoutTurn(room), true);
  assert.equal(room.game.hands.p1.length, 3);
  assert.equal(room.game.currentPlayerId, 'p2');
  assert.equal(room.game.turnHasDrawn, false);
  assert.ok(room.game.turnDeadline >= before);
  assert.match(room.game.lastMove, /Waktu habis/);
});

test('public UNOLLELE state exposes the viewer hand and playable cards but not other hands', () => {
  const room = roomWith({
    top: number('top', 'fire', 5),
    hand: [number('playable', 'water', 1)],
    otherHands: { p2: [number('private-p2', 'grass', 1)] },
  });
  const state = engine.publicState(room, 'p1');
  assert.equal(state.game.mode, 'unollele');
  assert.equal(state.game.hand.length, 1);
  assert.deepEqual(state.game.playableCardIds, ['playable']);
  assert.equal('hands' in state.game, false);
  assert.equal('hand' in state.room.players[1], false);
  assert.equal(state.game.canDraw, true);
});

test('multiplayer room broadcasts the same active card and turn while keeping hands private', () => {
  const room = roomWith({
    top: number('start-fire-5', 'fire', 5),
    hand: [number('p1-water', 'water', 1), number('p1-grass', 'grass', 8)],
    otherHands: {
      p2: [number('p2-grass', 'grass', 2)],
      p3: [number('p3-electric', 'electric', 1)],
    },
  });

  engine.playCard(room, 'p1', 'p1-water');
  const p1State = engine.publicState(room, 'p1');
  const p2State = engine.publicState(room, 'p2');

  assert.equal(p1State.game.currentPlayerId, 'p2');
  assert.equal(p2State.game.currentPlayerId, 'p2');
  assert.equal(p1State.game.topCard.id, 'p1-water');
  assert.equal(p2State.game.topCard.id, 'p1-water');
  assert.deepEqual(p1State.game.hand.map((card) => card.id), ['p1-grass']);
  assert.deepEqual(p2State.game.hand.map((card) => card.id), ['p2-grass']);
  assert.equal('p1-grass' in p2State.game, false);
  assert.equal(p1State.game.pendingUno, 'p1');
  assert.equal(p2State.game.pendingUno, 'p1');
});

test('UNOLLELE does not offer a separate pass action after draw', () => {
  const room = roomWith({
    top: number('top-fire-5', 'fire', 5),
    hand: [number('invalid-fire-2', 'fire', 2)],
    deck: [number('draw-card', 'electric', 3)],
  });
  engine.drawOne(room, 'p1');
  assert.throws(() => engine.passTurn(room, 'p1'), /Belum giliranmu/);
  // Player 2 is now active, but pass_turn is not part of UNOLLELE.
  assert.throws(() => engine.passTurn(room, 'p2'), /langsung dilewati/);
});
