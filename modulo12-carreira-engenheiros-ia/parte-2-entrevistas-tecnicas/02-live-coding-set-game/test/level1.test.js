import { test } from "node:test";
import assert from "node:assert/strict";
import { Card } from "../support/helper.js";

test("toString returns the four attributes", () => {
  const card = new Card(2, "green", "diamond", "striped");
  assert.equal(card.toString(), "2 green diamond striped");
});

test("parse and toString are inverses", () => {
  assert.equal(Card.parse("3 purple squiggle open").toString(), "3 purple squiggle open");
});

test("rejects an invalid number", () => {
  assert.throws(() => new Card(4, "red", "oval", "solid"));
});

test("rejects an invalid color", () => {
  assert.throws(() => new Card(1, "blue", "oval", "solid"));
});

test("rejects an invalid shape", () => {
  assert.throws(() => new Card(1, "red", "square", "solid"));
});

test("rejects an invalid shading", () => {
  assert.throws(() => new Card(1, "red", "oval", "dotted"));
});
