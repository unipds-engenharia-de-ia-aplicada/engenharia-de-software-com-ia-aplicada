import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync, type StatementSync } from "node:sqlite";

import { ConversationNotFoundError } from "../domain/errors.js";
import type {
  ConversationMessage,
  ConversationMessageRole,
  ConversationStore,
  ConversationSummaryRecord,
} from "../domain/types.js";

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: number;
}

interface SummaryRow {
  conversation_id: string;
  summary_text: string;
  covered_count: number;
  updated_at: number;
}

/**
 * SQLite-backed ConversationStore via node:sqlite DatabaseSync.
 * Path: OPSPILOT_DB (default ./data/opspilot.db); use ":memory:" in tests.
 * Shares the same file as SqliteOpsStore (separate connection, idempotent DDL).
 */
export class SqliteConversationStore implements ConversationStore {
  /** @internal Exposed for tests only. */
  readonly database: DatabaseSync;

  private readonly insertConversation: StatementSync;
  private readonly selectConversation: StatementSync;
  private readonly insertMessage: StatementSync;
  private readonly selectLastMessages: StatementSync;
  private readonly countMessagesStmt: StatementSync;
  private readonly selectMessagesAscending: StatementSync;
  private readonly selectSummary: StatementSync;
  private readonly upsertSummaryStmt: StatementSync;

  constructor(path: string = process.env.OPSPILOT_DB ?? "./data/opspilot.db") {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.database = new DatabaseSync(path);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
        ON messages (conversation_id, created_at);

      CREATE TABLE IF NOT EXISTS conversation_summaries (
        conversation_id TEXT PRIMARY KEY,
        summary_text TEXT NOT NULL,
        covered_count INTEGER NOT NULL CHECK (covered_count >= 0),
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );
    `);

    this.insertConversation = this.database.prepare(
      `INSERT INTO conversations (id, created_at) VALUES (?, ?)`,
    );
    this.selectConversation = this.database.prepare(
      `SELECT id FROM conversations WHERE id = ?`,
    );
    this.insertMessage = this.database.prepare(
      `INSERT INTO messages (id, conversation_id, role, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    this.selectLastMessages = this.database.prepare(
      `SELECT id, conversation_id, role, content, created_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY rowid DESC
       LIMIT ?`,
    );
    this.countMessagesStmt = this.database.prepare(
      `SELECT COUNT(*) AS c FROM messages WHERE conversation_id = ?`,
    );
    this.selectMessagesAscending = this.database.prepare(
      `SELECT id, conversation_id, role, content, created_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY rowid ASC
       LIMIT ? OFFSET ?`,
    );
    this.selectSummary = this.database.prepare(
      `SELECT conversation_id, summary_text, covered_count, updated_at
       FROM conversation_summaries WHERE conversation_id = ?`,
    );
    this.upsertSummaryStmt = this.database.prepare(
      `INSERT INTO conversation_summaries (conversation_id, summary_text, covered_count, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(conversation_id) DO UPDATE SET
         summary_text = excluded.summary_text,
         covered_count = excluded.covered_count,
         updated_at = excluded.updated_at`,
    );
  }

  create(): string {
    const id = randomUUID();
    this.insertConversation.run(id, Date.now());
    return id;
  }

  append(
    conversationId: string,
    role: ConversationMessageRole,
    content: string,
  ): ConversationMessage {
    this.requireConversation(conversationId);
    const id = randomUUID();
    const createdAt = Date.now();
    this.insertMessage.run(id, conversationId, role, content, createdAt);
    return {
      id,
      conversationId,
      role,
      content,
      createdAt,
    };
  }

  lastMessages(conversationId: string, limit: number): ConversationMessage[] {
    this.requireConversation(conversationId);
    const rows = this.selectLastMessages.all(conversationId, limit) as unknown as MessageRow[];
    return rows
      .map((row) => this.mapMessage(row))
      .reverse();
  }

  countMessages(conversationId: string): number {
    this.requireConversation(conversationId);
    const row = this.countMessagesStmt.get(conversationId) as { c: number } | undefined;
    return Number(row?.c ?? 0);
  }

  messagesAscending(
    conversationId: string,
    offset: number,
    limit: number,
  ): ConversationMessage[] {
    this.requireConversation(conversationId);
    const rows = this.selectMessagesAscending.all(
      conversationId,
      limit,
      offset,
    ) as unknown as MessageRow[];
    return rows.map((row) => this.mapMessage(row));
  }

  getSummary(conversationId: string): ConversationSummaryRecord | null {
    this.requireConversation(conversationId);
    const row = this.selectSummary.get(conversationId) as SummaryRow | undefined;
    if (!row) {
      return null;
    }
    return {
      conversationId: row.conversation_id,
      text: row.summary_text,
      coveredCount: row.covered_count,
      updatedAt: row.updated_at,
    };
  }

  upsertSummary(
    conversationId: string,
    text: string,
    coveredCount: number,
  ): void {
    this.requireConversation(conversationId);
    this.upsertSummaryStmt.run(conversationId, text, coveredCount, Date.now());
  }

  private mapMessage(row: MessageRow): ConversationMessage {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role as ConversationMessageRole,
      content: row.content,
      createdAt: row.created_at,
    };
  }

  private requireConversation(conversationId: string): void {
    const row = this.selectConversation.get(conversationId);
    if (!row) {
      throw new ConversationNotFoundError(conversationId);
    }
  }
}
