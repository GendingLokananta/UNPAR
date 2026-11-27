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
  top = number('top', 'fire', 5),
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
    winnerIds: [],
    loserId: null,
    blockedElement: null,
    blockedByPlayerId: null,
    lastMove: '',
    pendingUno: null,
    turnHasDrawn: false,
    drawnCardId: null,
    turnDeadline: Date.now() + engine.TURN_DURATION_MS,
  };
  return { code: 'TEST01', gameMode: 'unollele', status: 'playing', hostId: playerList[0].id, players: playerList, game };
}

test('UNOLLELE deck contains 146 cards: 100 elemental numbers, 10 Colorless 10 and 36 Dragon', () => {
  const deck = engine.createUnolleleDeck();
  assert.equal(deck.length, 146);
  assert.equal(deck.filter((card) => card.type === 'number').length, 110);
  assert.equal(deck.filter((card) => card.type === 'dragon').length, 36);
  for (const element of ['fire', 'water', 'grass', 'electric', 'ground']) {
    for (let value = 1; value <= 10; value += 1) {
      assert.equal(deck.filter((card) => card.element === element && card.number === value).length, 2);
    }
  }
  assert.equal(deck.filter((card) => card.element === 'colorless' && card.number === 10).length, 10);
  assert.equal(deck.filter((card) => card.element === 'colorless' && card.number !== 10).length, 0);
  for (const effect of engine.DRAGON_EFFECTS) {
    assert.equal(deck.filter((card) => card.type === 'dragon' && card.effect === effect).length, engine.DRAGON_EFFECT_COPIES[effect]);
  }
  assert.equal(deck.filter((card) => card.type === 'dragon' && card.effect === 'switch_hand').length, 3);
  assert.equal(deck.filter((card) => card.type === 'dragon' && card.effect === 'draw_one_all').length, 4);
  assert.equal(deck.filter((card) => card.type === 'dragon' && card.effect === 'discard').length, 4);
  assert.equal(deck.filter((card) => card.type === 'dragon' && card.effect === 'reset_all').length, 1);
  assert.equal(deck.filter((card) => card.type === 'dragon' && card.effect === 'revive').length, 4);
  assert.equal(deck.filter((card) => card.type === 'dragon' && card.effect === 'block').length, 4);
});
test('UNOLLELE deals seven cards per player and starts with a numbered card', () => {
  const roomPlayers = players(8);
  const game = engine.createUnolleleGame(roomPlayers);
  assert.equal(game.mode, 'unollele');
  assert.equal(Object.keys(game.hands).length, 8);
  for (const hand of Object.values(game.hands)) assert.equal(hand.length, 7);
  assert.equal(game.discard.length, 1);
  assert.equal(game.discard[0].type, 'number');
  assert.equal(game.deck.length + game.discard.length + 56, 146);
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

test('Dragon can counter every elemental type except Colorless, and Colorless can counter Dragon', () => {
  for (const element of ['fire', 'water', 'grass', 'electric', 'ground']) {
    assert.ok(engine.UNOLLELE_WEAKNESS[element].includes('dragon'));
    assert.ok(engine.UNOLLELE_WEAKNESS.dragon.includes(element));
  }
  assert.equal(engine.UNOLLELE_WEAKNESS.colorless.includes('dragon'), false);
  assert.ok(engine.UNOLLELE_WEAKNESS.dragon.includes('colorless'));
  assert.ok(engine.UNOLLELE_WEAKNESS.dragon.includes('dragon'));
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
    assert.equal(engine.canPlayUnolleleCard(game, number('universal-colorless', 'colorless', 10)), false);
    assert.equal(engine.canPlayUnolleleCard(game, dragon('universal-dragon', 'skip')), true);
    for (const element of engine.UNOLLELE_ELEMENTS.filter((item) => item !== topElement && item !== 'colorless' && !playableElements.includes(item))) {
      assert.equal(engine.canPlayUnolleleCard(game, number(`invalid-${element}`, element, 10)), false, `${element} should not play on ${topElement}`);
    }
  }
});

test('Colorless 10 beats an elemental card only when ten is strictly higher', () => {
  assert.equal(engine.canPlayUnolleleCard({ discard: [number('top-fire-9', 'fire', 9)] }, number('colorless-10', 'colorless', 10)), true);
  assert.equal(engine.canPlayUnolleleCard({ discard: [number('top-water-10', 'water', 10)] }, number('colorless-10', 'colorless', 10)), false);
  assert.equal(engine.canPlayUnolleleCard({ discard: [number('top-grass-1', 'grass', 1)] }, number('colorless-10', 'colorless', 10)), true);
  assert.equal(engine.canPlayUnolleleCard({ discard: [number('top-c-10', 'colorless', 10)] }, number('colorless-10b', 'colorless', 10)), false);
});
test('Colorless accepts every elemental number over Colorless, but Dragon cannot be played on Colorless', () => {
  const game = { discard: [number('top', 'colorless', 10)] };
  for (const element of ['fire', 'water', 'grass', 'electric', 'ground']) {
    assert.equal(engine.canPlayUnolleleCard(game, number(`c-${element}`, element, 1)), true);
  }
  assert.equal(engine.canPlayUnolleleCard(game, dragon('d', 'skip')), false);
  assert.equal(engine.canPlayUnolleleCard(game, number('colorless-low', 'colorless', 1)), false);
  assert.equal(engine.canPlayUnolleleCard(game, number('colorless-high', 'colorless', 10)), false);
});

test('Dragon can be played over every type except Colorless, including another Dragon', () => {
  for (const element of ['fire', 'water', 'grass', 'electric', 'ground']) {
    assert.equal(engine.canPlayUnolleleCard({ discard: [number(`top-${element}`, element, 2)] }, dragon(`dragon-${element}`, 'skip')), true);
  }
  assert.equal(engine.canPlayUnolleleCard({ discard: [number('top-colorless', 'colorless', 2)] }, dragon('dragon-colorless', 'skip')), false);
  assert.equal(engine.canPlayUnolleleCard({ discard: [dragon('d3', 'draw_two')] }, dragon('d4', 'reroll')), true);
});

test('every numbered element and Colorless can be played on Dragon, and Dragon can also be stacked', () => {
  const game = { discard: [dragon('top-dragon', 'skip')] };
  for (const element of engine.UNOLLELE_ELEMENTS) {
    assert.equal(engine.canPlayUnolleleCard(game, number(`n-${element}`, element, 1)), true);
  }
  assert.equal(engine.canPlayUnolleleCard(game, dragon('other-dragon', 'reroll')), true);
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
  const room = roomWith({ playerList: players(2), hand: [dragon('switch', 'switch_direction'), number('held', 'fire', 1)] });
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
  assert.equal(room.status, 'playing');
  assert.deepEqual(room.game.winnerIds, ['p1']);
  assert.equal(room.game.hands.p2.length, 2);
  assert.equal(room.game.currentPlayerId, 'p3');
  assert.equal(engine.publicState(room, 'p1').game.isSpectator, true);
});

test('Dragon Reroll shuffles the remaining hand into the pile and draws four new cards', () => {
  const room = roomWith({
    hand: [dragon('reset', 'reroll'), number('held-1', 'fire', 1), number('held-2', 'water', 2)],
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

test('Dragon Reroll played as the last card is not a win and still deals four cards', () => {
  const room = roomWith({
    hand: [dragon('last-reset', 'reroll')],
    deck: Array.from({ length: 4 }, (_, index) => number(`replacement-${index}`, 'electric', index + 1)),
  });
  engine.playCard(room, 'p1', 'last-reset');
  assert.equal(room.status, 'playing');
  assert.equal(room.game.winnerId, null);
  assert.equal(room.game.hands.p1.length, 4);
  assert.equal(room.game.currentPlayerId, 'p2');
});

test('Dragon Switch exchanges the remaining full hands with the selected online player', () => {
  const targetHand = [number('target-1', 'water', 1), number('target-2', 'grass', 2), number('target-3', 'fire', 3)];
  const playerHandAfterCard = [number('actor-1', 'electric', 4), number('actor-2', 'ground', 5)];
  const room = roomWith({
    hand: [dragon('switch-hand', 'switch_hand'), ...playerHandAfterCard],
    otherHands: { p2: targetHand },
  });

  engine.playCard(room, 'p1', 'switch-hand', undefined, 'p2');

  assert.deepEqual(room.game.hands.p1.map((card) => card.id), targetHand.map((card) => card.id));
  assert.deepEqual(room.game.hands.p2.map((card) => card.id), playerHandAfterCard.map((card) => card.id));
  assert.equal(room.game.currentPlayerId, 'p2');
  assert.match(room.game.lastMove, /Dragon Switch.*Player 2/);
  assert.equal(room.game.discard.at(-1).id, 'switch-hand');
});

test('Dragon Switch as the final card makes the player who played it the spectator, not the target', () => {
  const room = roomWith({
    hand: [dragon('last-switch', 'switch_hand')],
    otherHands: { p2: [number('p2-a', 'water', 1), number('p2-b', 'grass', 2)] },
  });

  engine.playCard(room, 'p1', 'last-switch', undefined, 'p2');

  assert.equal(room.status, 'playing');
  assert.deepEqual(room.game.winnerIds, ['p1']);
  assert.equal(room.game.hands.p2.length, 0);
  assert.equal(room.game.hands.p1.length, 2);
  assert.equal(room.game.currentPlayerId, 'p2');
});

test('Dragon Switch rejects a missing, self, or offline target without consuming the card', () => {
  const room = roomWith({ hand: [dragon('switch-hand', 'switch_hand')] });
  assert.throws(() => engine.playCard(room, 'p1', 'switch-hand'), /Pilih pemain lain/);
  assert.throws(() => engine.playCard(room, 'p1', 'switch-hand', undefined, 'p1'), /Pilih pemain lain/);
  room.players[1].connected = false;
  assert.throws(() => engine.playCard(room, 'p1', 'switch-hand', undefined, 'p2'), /Pilih pemain lain/);
  assert.equal(room.game.hands.p1.length, 1);
  assert.equal(room.game.discard.length, 1);
});

test('Dragon +1 All gives one card to all other active players but not its user', () => {
  const room = roomWith({
    playerList: players(3),
    hand: [dragon('plus-one-all', 'draw_one_all'), number('held', 'fire', 1)],
    otherHands: {
      p2: [number('p2-held', 'water', 2)],
      p3: [number('p3-held', 'grass', 3), number('p3-held-2', 'ground', 4)],
    },
    deck: [
      number('draw-p1', 'electric', 5),
      number('draw-p2', 'water', 6),
      number('draw-p3', 'grass', 7),
    ],
  });
  const before = Object.fromEntries(Object.entries(room.game.hands).map(([id, hand]) => [id, hand.length]));

  engine.playCard(room, 'p1', 'plus-one-all');

  for (const player of room.players) {
    const expected = before[player.id] - (player.id === 'p1' ? 1 : 0) + (player.id === 'p1' ? 0 : 1);
    assert.equal(room.game.hands[player.id].length, expected);
  }
  assert.equal(room.game.deck.length, 1);
  assert.equal(room.game.currentPlayerId, 'p2');
  assert.match(room.game.lastMove, /Dragon \+1 All/);
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


test('first player to empty their hand becomes a spectator and the game continues until one loser remains', () => {
  const room = roomWith({
    playerList: players(4),
    hand: [number('p1-last', 'water', 1)],
    otherHands: {
      p2: [number('p2-last', 'water', 2)],
      p3: [number('p3-last', 'water', 3)],
      p4: [number('p4-last', 'water', 4)],
    },
  });

  engine.playCard(room, 'p1', 'p1-last');
  assert.equal(room.status, 'playing');
  assert.deepEqual(room.game.winnerIds, ['p1']);
  assert.equal(room.game.currentPlayerId, 'p2');
  assert.throws(() => engine.drawOne(room, 'p1'), /spectator/i);
  assert.deepEqual(engine.getPlayableCards(room.game, 'p1'), []);

  engine.playCard(room, 'p2', 'p2-last');
  assert.equal(room.status, 'playing');
  assert.deepEqual(room.game.winnerIds, ['p1', 'p2']);
  assert.equal(room.game.currentPlayerId, 'p3');

  engine.playCard(room, 'p3', 'p3-last');
  assert.equal(room.status, 'finished');
  assert.deepEqual(room.game.winnerIds, ['p1', 'p2', 'p3']);
  assert.equal(room.game.loserId, 'p4');
  assert.equal(room.game.currentPlayerId, 'p4');
  assert.equal(room.game.turnDeadline, null);
  assert.equal(engine.publicState(room, 'p4').game.isSpectator, false);
  assert.equal(engine.publicState(room, 'p1').game.isSpectator, true);
});

test('Dragon Discard puts the chosen hand card on top without activating its effect', () => {
  const room = roomWith({
    hand: [
      dragon('discard', 'discard'),
      dragon('inert-plus-two', 'draw_two'),
      number('held', 'grass', 2),
    ],
    otherHands: { p2: [number('p2-held', 'water', 1)] },
    deck: [number('draw-a', 'fire', 1), number('draw-b', 'ground', 2)],
  });

  engine.playCard(room, 'p1', 'discard', undefined, { discardHandCardId: 'inert-plus-two' });

  assert.equal(room.game.discard.at(-1).id, 'inert-plus-two');
  assert.equal(room.game.hands.p2.length, 1);
  assert.equal(room.game.currentPlayerId, 'p2');
  assert.equal(room.game.hands.p1.some((card) => card.id === 'inert-plus-two'), false);
  assert.equal(room.status, 'playing');
});

test('Dragon Discard with no remaining hand wins without requiring another discard', () => {
  const room = roomWith({ hand: [dragon('last-discard', 'discard')] });
  engine.playCard(room, 'p1', 'last-discard');
  assert.deepEqual(room.game.winnerIds, ['p1']);
  assert.equal(room.status, 'playing');
  assert.equal(room.game.hands.p1.length, 0);
  assert.equal(room.game.currentPlayerId, 'p2');
});

test('Dragon Reset All makes every active player including its user discard and draw seven', () => {
  const room = roomWith({
    hand: [dragon('reset-all', 'reset_all'), number('p1-held', 'fire', 2)],
    otherHands: {
      p2: [dragon('p2-plus-two-inert', 'draw_two'), number('p2-held', 'water', 3)],
      p3: [number('p3-held', 'grass', 4), number('p3-held-2', 'ground', 5)],
      p4: [],
    },
    deck: Array.from({ length: 40 }, (_, index) => number(`reset-deck-${index}`, 'electric', (index % 10) + 1)),
  });
  room.game.winnerIds = ['p4'];

  engine.playCard(room, 'p1', 'reset-all');

  for (const id of ['p1', 'p2', 'p3']) assert.equal(room.game.hands[id].length, 7);
  assert.equal(room.game.hands.p4.length, 0);
  assert.equal(engine.publicState(room, 'p4').game.isSpectator, true);
  assert.equal(room.game.discard.at(-1).id, 'reset-all');
  assert.equal(room.status, 'playing');
});

test('Dragon Revive takes one selected discard card into hand and leaves Dragon Revive on top', () => {
  const room = roomWith({
    hand: [dragon('revive', 'revive'), number('held', 'fire', 1)],
    deck: [],
  });
  room.game.discard.push(number('revive-target', 'water', 8));

  engine.playCard(room, 'p1', 'revive', undefined, { reviveCardId: 'revive-target' });

  assert.ok(room.game.hands.p1.some((card) => card.id === 'revive-target'));
  assert.equal(room.game.discard.some((card) => card.id === 'revive-target'), false);
  assert.equal(room.game.discard.at(-1).id, 'revive');
  assert.equal(room.status, 'playing');
});

test('Dragon Revive as the last card skips recovery and makes its player a spectator', () => {
  const room = roomWith({ hand: [dragon('last-revive', 'revive')] });
  room.game.discard.push(number('available-card', 'water', 6));

  engine.playCard(room, 'p1', 'last-revive');

  assert.deepEqual(room.game.winnerIds, ['p1']);
  assert.equal(room.game.hands.p1.length, 0);
  assert.equal(room.game.hands.p1.some((card) => card.id === 'available-card'), false);
  assert.equal(room.status, 'playing');
});

test('Dragon Revive as the last card never recovers any discarded card', () => {
  const room = roomWith({ hand: [dragon('last-revive-self', 'revive')] });
  room.game.discard.push(number('older-discard-card', 'grass', 3));

  engine.playCard(room, 'p1', 'last-revive-self');

  assert.deepEqual(room.game.winnerIds, ['p1']);
  assert.equal(room.game.hands.p1.length, 0);
  assert.equal(room.game.discard.at(-1).id, 'last-revive-self');
  assert.equal(room.game.hands.p1.some((card) => card.id === 'last-revive-self'), false);
  assert.equal(room.game.hands.p1.some((card) => card.id === 'older-discard-card'), false);
});

test('Dragon Block prevents the selected element and ends as soon as direction returns to its owner', () => {
  const room = roomWith({
    hand: [dragon('block', 'block'), number('p1-held', 'fire', 1)],
    otherHands: {
      p2: [dragon('reverse', 'switch_direction'), number('p2-water', 'water', 3), number('p2-electric', 'electric', 2)],
    },
  });

  engine.playCard(room, 'p1', 'block', undefined, { blockedElement: 'electric' });
  assert.equal(room.game.blockedElement, 'electric');
  assert.equal(room.game.blockedByPlayerId, 'p1');
  assert.equal(room.game.currentPlayerId, 'p2');
  assert.deepEqual(engine.getPlayableCards(room.game, 'p2'), ['reverse', 'p2-water']);

  engine.playCard(room, 'p2', 'reverse');
  assert.equal(room.game.direction, -1);
  assert.equal(room.game.currentPlayerId, 'p1');
  assert.equal(room.game.blockedElement, null);
  assert.equal(room.game.blockedByPlayerId, null);
});

test('Dragon Block rejects invalid choices without consuming the card', () => {
  const room = roomWith({ hand: [dragon('block', 'block'), number('held', 'fire', 1)] });
  assert.throws(
    () => engine.playCard(room, 'p1', 'block', undefined, { blockedElement: 'water-plus' }),
    /Pilih elemen/,
  );
  assert.equal(room.game.hands.p1.length, 2);
  assert.equal(room.game.discard.length, 1);
});

test('Colorless 10 beats any Dragon, while Colorless itself is weak to every elemental type', () => {
  for (const effect of engine.DRAGON_EFFECTS) {
    assert.equal(
      engine.canPlayUnolleleCard({ discard: [dragon('top-dragon', effect)] }, number('colorless-counter', 'colorless', 10)),
      true,
    );
  }
  const colorlessTop = { discard: [number('top-colorless', 'colorless', 10)] };
  for (const element of ['fire', 'water', 'grass', 'electric', 'ground']) {
    assert.equal(engine.canPlayUnolleleCard(colorlessTop, number(`weak-${element}`, element, 1)), true);
  }
  assert.equal(engine.canPlayUnolleleCard(colorlessTop, dragon('dragon-cannot', 'skip')), false);
});

test('spectator players are excluded from draw-all effects and from active turn order', () => {
  const room = roomWith({
    playerList: players(4),
    hand: [dragon('plus-one', 'draw_one_all'), number('p1-held', 'fire', 1)],
    otherHands: {
      p2: [number('p2-held', 'water', 2)],
      p3: [number('p3-held', 'grass', 3)],
      p4: [],
    },
    deck: [
      number('draw-p2', 'water', 4),
      number('draw-p3', 'grass', 5),
    ],
  });
  room.game.winnerIds = ['p4'];

  engine.playCard(room, 'p1', 'plus-one');

  assert.equal(room.game.hands.p1.length, 1);
  assert.equal(room.game.hands.p2.length, 2);
  assert.equal(room.game.hands.p3.length, 2);
  assert.equal(room.game.hands.p4.length, 0);
  assert.equal(room.game.currentPlayerId, 'p2');
});
