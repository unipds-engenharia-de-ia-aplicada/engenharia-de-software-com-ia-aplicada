import { test } from "node:test";
import assert from "node:assert/strict";
import { Card } from "../support/helper.js";

const isSet = (a, b, c) => Card.parse(a).formsSetWith(Card.parse(b), Card.parse(c));

test("all different is a set", () => {
  assert.equal(isSet("1 red oval solid", "2 green diamond striped", "3 purple squiggle open"), true);
});

test("only shading changes: is a set", () => {
  assert.equal(isSet("1 red oval solid", "1 red oval striped", "1 red oval open"), true);
});

test("number and shape change, the rest is the same: is a set", () => {
  assert.equal(isSet("1 red oval solid", "2 red diamond solid", "3 red squiggle solid"), true);
});

test("color with two equal and one different: not a set", () => {
  assert.equal(isSet("1 red oval solid", "1 red oval striped", "1 green oval open"), false);
});

test("shading with two equal and one different: not a set", () => {
  assert.equal(isSet("1 red oval solid", "2 red oval striped", "3 red oval solid"), false);
});

test("number with two equal and one different: not a set", () => {
  assert.equal(isSet("1 red oval solid", "1 green diamond striped", "2 purple squiggle open"), false);
});

test("card order does not matter", () => {
  assert.equal(isSet("3 purple squiggle open", "1 red oval solid", "2 green diamond striped"), true);
});
