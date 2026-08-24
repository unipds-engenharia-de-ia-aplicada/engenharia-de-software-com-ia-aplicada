import assert from "node:assert/strict";
import test from "node:test";

import { EMBEDDING_DIM, getDefaultEmbedder } from "./embeddings.js";

test(
  "default embedder returns 384-d approximately unit vector",
  { timeout: 180_000 },
  async () => {
    const vec = await getDefaultEmbedder().embed("OpsPilot embedding smoke");
    assert.equal(vec.length, EMBEDDING_DIM);
    let norm = 0;
    for (let i = 0; i < vec.length; i += 1) {
      const v = vec[i] ?? 0;
      norm += v * v;
    }
    norm = Math.sqrt(norm);
    assert.ok(Math.abs(norm - 1) < 0.05, `expected ~unit norm, got ${norm}`);
  },
);
