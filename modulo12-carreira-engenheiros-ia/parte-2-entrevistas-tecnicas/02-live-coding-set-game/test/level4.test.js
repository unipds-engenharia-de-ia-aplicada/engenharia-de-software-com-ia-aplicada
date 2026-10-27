import { test } from "node:test";
import assert from "node:assert/strict";
import { Card, Deck, Board, BOARD_WITHOUT_SET } from "../support/helper.js";

const deckWithNoSetOnTop = () => {
  const rest = new Deck().cards.filter((c) => !BOARD_WITHOUT_SET.includes(c.toString()));
  return new Deck([...BOARD_WITHOUT_SET.map((t) => Card.parse(t)), ...rest]);
};

test("the board starts with 12 cards from the top of the deck", () => {
  const deck = new Deck();
  const board = new Board(deck);
  assert.equal(board.cards.length, 12);
  assert.equal(deck.size, 69);
});

test("findSets finds the set formed by the first 3 cards", () => {
  const board = new Board(new Deck());
  const first = board.findSets()[0].map(String);
  assert.deepEqual(first, ["1 red oval solid", "1 red oval striped", "1 red oval open"]);
});

test("findSets returns an empty list when there is no set", () => {
  const board = new Board(deckWithNoSetOnTop());
  assert.deepEqual(board.findSets(), []);
});

test("dealUntilSet adds nothing if there is already a set", () => {
  const board = new Board(new Deck());
  board.dealUntilSet();
  assert.equal(board.cards.length, 12);
});

test("dealUntilSet adds 3 cards and stops when a set appears", () => {
  const board = new Board(deckWithNoSetOnTop());
  board.dealUntilSet();
  assert.equal(board.cards.length, 15);
  assert.ok(board.findSets().length > 0);
});

test("dealUntilSet stops when the deck runs out", () => {
  const board = new Board(new Deck(BOARD_WITHOUT_SET.map((t) => Card.parse(t))));
  board.dealUntilSet();
  assert.equal(board.cards.length, 12);
});
