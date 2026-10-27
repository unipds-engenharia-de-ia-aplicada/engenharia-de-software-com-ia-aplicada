import { test } from "node:test";
import assert from "node:assert/strict";

const base = process.env.SOLUTION ? "../solution" : "../src";
const { duplicates } = await import(`${base}/duplicates.js`);

test("example from the problem", () => {
  assert.deepEqual(duplicates([1, 2, 2, 3, 3, 3]), [2, 3]);
});

test("edge case: empty list", () => {
  assert.deepEqual(duplicates([]), []);
});

test("edge case: no repeated numbers", () => {
  assert.deepEqual(duplicates([1, 2, 3]), []);
});

test("keeps the order of first appearance", () => {
  assert.deepEqual(duplicates([5, 1, 5, 1, 2]), [5, 1]);
});

test("works with negative numbers", () => {
  assert.deepEqual(duplicates([-1, -1, 0]), [-1]);
});
