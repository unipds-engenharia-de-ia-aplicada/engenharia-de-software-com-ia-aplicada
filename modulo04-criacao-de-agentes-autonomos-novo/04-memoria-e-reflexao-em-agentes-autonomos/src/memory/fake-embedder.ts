import assert from "node:assert/strict";

import type { Embedder } from "../domain/types.js";
import { EMBEDDING_DIM } from "./embeddings.js";

function normalize(values: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i] ?? 0;
    norm += v * v;
  }
  norm = Math.sqrt(norm);
  assert.ok(norm > 0);
  for (let i = 0; i < values.length; i += 1) {
    values[i] = (values[i] ?? 0) / norm;
  }
  return values;
}

/** Deterministic unit vectors for store/HTTP unit tests (no HF download). */
export class FakeEmbedder implements Embedder {
  private readonly table = new Map<string, Float32Array>();

  set(text: string, values: number[]): this {
    assert.equal(values.length, EMBEDDING_DIM, "fake vector must be 384-d");
    this.table.set(text, normalize(Float32Array.from(values)));
    return this;
  }

  /** One-hot style: unit vector on axis `axis` (0..383). */
  setAxis(text: string, axis: number): this {
    const values = Array.from({ length: EMBEDDING_DIM }, (_, i) => (i === axis ? 1 : 0));
    return this.set(text, values);
  }

  async embed(text: string): Promise<Float32Array> {
    const registered = this.table.get(text);
    if (registered) {
      return new Float32Array(registered);
    }
    // Deterministic fallback so /chat tests without seeded memories still recall safely.
    const vec = new Float32Array(EMBEDDING_DIM);
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const axis = Math.abs(h) % EMBEDDING_DIM;
    vec[axis] = 1;
    vec[(axis + 1) % EMBEDDING_DIM] = ((h >>> 8) & 0xff) / 255;
    return normalize(vec);
  }
}
