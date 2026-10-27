import { test } from "node:test";
import assert from "node:assert/strict";
import { Card, Deck } from "../support/helper.js";

test("the full deck has 81 different cards", () => {
  const deck = new Deck();
  assert.equal(deck.size, 81);
  assert.equal(new Set(deck.cards.map(String)).size, 81);
});

test("the full deck is ordered by number, color, shape, shading", () => {
  const deck = new Deck();
  assert.equal(deck.cards[0].toString(), "1 red oval solid");
  assert.equal(deck.cards[1].toString(), "1 red oval striped");
  assert.equal(deck.cards[80].toString(), "3 purple squiggle open");
});

test("draw takes cards from the top and shrinks the deck", () => {
  const deck = new Deck();
  const hand = deck.draw(12);
  assert.equal(hand.length, 12);
  assert.equal(hand[0].toString(), "1 red oval solid");
  assert.equal(deck.size, 69);
});

test("draw returns only the cards that are left", () => {
  const deck = new Deck([Card.parse("1 green oval solid"), Card.parse("2 green oval solid")]);
  assert.equal(deck.draw(3).length, 2);
  assert.equal(deck.size, 0);
});

test("the constructor does not change the list it receives", () => {
  const cards = [Card.parse("1 green oval solid"), Card.parse("2 green oval solid")];
  const deck = new Deck(cards);
  assert.equal(deck.draw(1).length, 1);
  assert.equal(cards.length, 2);
});

test("shuffle keeps the same 81 cards and returns the deck itself", () => {
  const deck = new Deck();
  const result = deck.shuffle(() => 0.5);
  assert.equal(result, deck);
  assert.equal(deck.size, 81);
  assert.equal(new Set(deck.cards.map(String)).size, 81);
});

test("shuffle with the same random function gives the same order", () => {
  const sequence = () => {
    let x = 0.123;
    return () => (x = (x * 9301 + 0.49297) % 1);
  };
  const a = new Deck().shuffle(sequence()).cards.map(String);
  const b = new Deck().shuffle(sequence()).cards.map(String);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, new Deck().cards.map(String));
});
