import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync, type StatementSync } from "node:sqlite";

import { InvalidMemoryInputError } from "../domain/errors.js";
import type {
  Embedder,
  MemoryStore,
  RecalledMemory,
  RememberResult,
} from "../domain/types.js";
import { EMBEDDING_DIM, getDefaultEmbedder } from "./embeddings.js";

const DEDUP_THRESHOLD = 0.92;
const RECALL_MIN_SCORE = 0.3;
const RECALL_TOP_K = 3;

interface MemoryRow {
  id: string;
  user_id: string;
  fact: string;
  embedding: Buffer;
  created_at: number;
}

function requireNonEmpty(label: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new InvalidMemoryInputError(`${label} must be non-empty`);
  }
  return trimmed;
}

export function dot(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

export function embeddingToBuffer(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

export function bufferToEmbedding(buf: Buffer): Float32Array {
  const copy = Buffer.from(buf);
  const floats = new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
  if (floats.length !== EMBEDDING_DIM) {
    throw new InvalidMemoryInputError(
      `Stored embedding has dimension ${floats.length}; expected ${EMBEDDING_DIM}`,
    );
  }
  return floats;
}

/**
 * SQLite-backed MemoryStore via node:sqlite DatabaseSync.
 * Path: OPSPILOT_DB (default ./data/opspilot.db); use ":memory:" in tests.
 */
export class SqliteMemoryStore implements MemoryStore {
  /** @internal Exposed for tests only. */
  readonly database: DatabaseSync;

  private readonly embedder: Embedder;
  private readonly insertMemory: StatementSync;
  private readonly selectByUser: StatementSync;
  private readonly deleteMemory: StatementSync;

  constructor(
    path: string = process.env.OPSPILOT_DB ?? "./data/opspilot.db",
    embedder: Embedder = getDefaultEmbedder(),
  ) {
    this.embedder = embedder;

    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.database = new DatabaseSync(path);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        fact TEXT NOT NULL,
        embedding BLOB NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memories_user
        ON memories (user_id);
    `);

    this.insertMemory = this.database.prepare(
      `INSERT INTO memories (id, user_id, fact, embedding, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    this.selectByUser = this.database.prepare(
      `SELECT id, user_id, fact, embedding, created_at
       FROM memories
       WHERE user_id = ?`,
    );
    this.deleteMemory = this.database.prepare(
      `DELETE FROM memories WHERE id = ? AND user_id = ?`,
    );
  }

  private allForUser(userId: string): Array<{
    id: string;
    userId: string;
    fact: string;
    embedding: Float32Array;
    createdAt: number;
  }> {
    const rows = this.selectByUser.all(userId) as unknown as MemoryRow[];
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      fact: row.fact,
      embedding: bufferToEmbedding(row.embedding),
      createdAt: row.created_at,
    }));
  }

  async remember(userId: string, fact: string): Promise<RememberResult> {
    const uid = requireNonEmpty("userId", userId);
    const text = requireNonEmpty("fact", fact);
    const embedding = await this.embedder.embed(text);

    for (const existing of this.allForUser(uid)) {
      if (dot(embedding, existing.embedding) > DEDUP_THRESHOLD) {
        return { id: existing.id, stored: false };
      }
    }

    const id = randomUUID();
    const createdAt = Date.now();
    this.insertMemory.run(id, uid, text, embeddingToBuffer(embedding), createdAt);
    return { id, stored: true };
  }

  /**
   * Recall top-k by cosine (dot of L2-normalized vectors).
   * Order: score all → filter ≥ 0.3 → sort desc → slice(0, k).
   * (Filter-before-slice so mid-ranked items above the floor are not dropped.)
   */
  async recall(userId: string, query: string, k = RECALL_TOP_K): Promise<RecalledMemory[]> {
    const uid = requireNonEmpty("userId", userId);
    const qText = requireNonEmpty("query", query);
    const q = await this.embedder.embed(qText);

    return this.allForUser(uid)
      .map((mappedUser) => ({
        id: mappedUser.id,
        fact: mappedUser.fact,
        score: dot(q, mappedUser.embedding),
      }))
      .filter((mappedUser) => mappedUser.score >= RECALL_MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async forget(userId: string, id: string): Promise<boolean> {
    const uid = requireNonEmpty("userId", userId);
    const memoryId = requireNonEmpty("id", id);
    const result = this.deleteMemory.run(memoryId, uid) as { changes: number };
    return result.changes === 1;
  }
}
