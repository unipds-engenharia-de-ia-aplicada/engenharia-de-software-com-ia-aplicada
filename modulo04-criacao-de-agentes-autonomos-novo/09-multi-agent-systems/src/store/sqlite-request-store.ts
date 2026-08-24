import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync, type StatementSync } from "node:sqlite";

import type {
  ExecutionMetrics,
  RequestRecord,
  RequestStatsBucket,
  RequestStatsSummary,
  RequestStatus,
  RequestStore,
  SaveRequestInput,
  TraceEvent,
  TraceEventType,
} from "../domain/types.js";
import {
  estimatePromptCostUsd,
  percentile,
} from "../obs/request-stats.js";

interface RequestRow {
  id: string;
  created_at: number;
  finished_at: number;
  status: string;
  http_status: number;
  conversation_id: string | null;
  user_id: string | null;
  metrics_json: string;
  latency_ms: number | null;
  llm_calls: number | null;
  route: string | null;
  model_used: string | null;
}

interface TraceEventRow {
  id: string;
  request_id: string;
  seq: number;
  type: string;
  node: string;
  content: string;
  payload_json: string | null;
}

const TRACE_PAYLOAD_KEYS = [
  "tool",
  "toolArgs",
  "round",
  "approved",
  "timestampMs",
  "route",
  "override",
  "reason",
] as const;

function splitTraceEvent(event: TraceEvent): {
  type: TraceEventType;
  node: string;
  content: string;
  payload: Record<string, unknown> | null;
} {
  const payload: Record<string, unknown> = {};
  for (const key of TRACE_PAYLOAD_KEYS) {
    const value = event[key];
    if (value !== undefined) {
      payload[key] = value;
    }
  }
  return {
    type: event.type,
    node: event.node,
    content: event.content,
    payload: Object.keys(payload).length > 0 ? payload : null,
  };
}

function rowToTraceEvent(row: TraceEventRow): TraceEvent {
  const base: TraceEvent = {
    type: row.type as TraceEventType,
    node: row.node,
    content: row.content,
  };
  if (!row.payload_json) {
    return base;
  }
  const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
  return { ...base, ...payload } as TraceEvent;
}

function rowToRequest(row: RequestRow): RequestRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    status: row.status as RequestStatus,
    httpStatus: row.http_status,
    conversationId: row.conversation_id,
    userId: row.user_id,
    metrics: JSON.parse(row.metrics_json) as ExecutionMetrics,
    latencyMs: row.latency_ms,
    llmCalls: row.llm_calls,
    route: row.route,
    modelUsed: row.model_used,
  };
}

/**
 * SQLite audit store for /chat requests + ordered trace_events.
 * Same OPSPILOT_DB file as other stores; use ":memory:" in tests.
 */
export class SqliteRequestStore implements RequestStore {
  /** @internal Exposed for tests only. */
  readonly database: DatabaseSync;

  private readonly insertRequest: StatementSync;
  private readonly insertTraceEvent: StatementSync;
  private readonly selectRequest: StatementSync;
  private readonly selectTraceEvents: StatementSync;
  private readonly selectSince: StatementSync;

  constructor(path: string = process.env.OPSPILOT_DB ?? "./data/opspilot.db") {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.database = new DatabaseSync(path);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        finished_at INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('success', 'error')),
        http_status INTEGER NOT NULL,
        conversation_id TEXT,
        user_id TEXT,
        metrics_json TEXT NOT NULL,
        latency_ms INTEGER,
        llm_calls INTEGER,
        route TEXT,
        model_used TEXT
      );

      CREATE TABLE IF NOT EXISTS trace_events (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        type TEXT NOT NULL,
        node TEXT NOT NULL,
        content TEXT NOT NULL,
        payload_json TEXT,
        FOREIGN KEY (request_id) REFERENCES requests(id),
        UNIQUE (request_id, seq)
      );

      CREATE INDEX IF NOT EXISTS idx_trace_events_request_seq
        ON trace_events (request_id, seq);
    `);

    this.insertRequest = this.database.prepare(
      `INSERT INTO requests (
        id, created_at, finished_at, status, http_status,
        conversation_id, user_id, metrics_json,
        latency_ms, llm_calls, route, model_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.insertTraceEvent = this.database.prepare(
      `INSERT INTO trace_events (
        id, request_id, seq, type, node, content, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    this.selectRequest = this.database.prepare(
      `SELECT id, created_at, finished_at, status, http_status,
              conversation_id, user_id, metrics_json,
              latency_ms, llm_calls, route, model_used
       FROM requests WHERE id = ?`,
    );
    this.selectTraceEvents = this.database.prepare(
      `SELECT id, request_id, seq, type, node, content, payload_json
       FROM trace_events
       WHERE request_id = ?
       ORDER BY seq ASC`,
    );
    this.selectSince = this.database.prepare(
      `SELECT id, created_at, finished_at, status, http_status,
              conversation_id, user_id, metrics_json,
              latency_ms, llm_calls, route, model_used
       FROM requests
       WHERE created_at >= ?
       ORDER BY created_at ASC`,
    );
  }

  save(input: SaveRequestInput): void {
    const metricsJson = JSON.stringify(input.metrics);
    this.database.exec("BEGIN");
    try {
      this.insertRequest.run(
        input.id,
        input.createdAt,
        input.finishedAt,
        input.status,
        input.httpStatus,
        input.conversationId ?? null,
        input.userId ?? null,
        metricsJson,
        input.metrics.latencyMs ?? null,
        input.metrics.llmCalls ?? null,
        input.metrics.route ?? null,
        input.metrics.modelUsed ?? null,
      );

      for (let seq = 0; seq < input.trace.length; seq += 1) {
        const event = input.trace[seq]!;
        const parts = splitTraceEvent(event);
        this.insertTraceEvent.run(
          randomUUID(),
          input.id,
          seq,
          parts.type,
          parts.node,
          parts.content,
          parts.payload ? JSON.stringify(parts.payload) : null,
        );
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  getById(id: string): { request: RequestRecord; trace: TraceEvent[] } | null {
    const row = this.selectRequest.get(id) as RequestRow | undefined;
    if (!row) {
      return null;
    }
    const eventRows = this.selectTraceEvents.all(id) as unknown as TraceEventRow[];
    return {
      request: rowToRequest(row),
      trace: eventRows.map(rowToTraceEvent),
    };
  }

  stats(sinceMs: number): RequestStatsSummary {
    const rows = this.selectSince.all(sinceMs) as unknown as RequestRow[];
    const latencies: number[] = [];
    let total = 0;
    let errors = 0;
    let tokens = 0;
    let costUsd = 0;
    const byRoute: Record<string, RequestStatsBucket> = {};
    const byModel: Record<string, RequestStatsBucket> = {};

    const bump = (
      map: Record<string, RequestStatsBucket>,
      key: string,
      err: boolean,
      tok: number,
      cost: number,
    ) => {
      const bucket = map[key] ?? { total: 0, errors: 0, tokens: 0, costUsd: 0 };
      bucket.total += 1;
      if (err) {
        bucket.errors += 1;
      }
      bucket.tokens += tok;
      bucket.costUsd += cost;
      map[key] = bucket;
    };

    for (const row of rows) {
      total += 1;
      const isError = row.status === "error" || row.http_status >= 400;
      if (isError) {
        errors += 1;
      }
      if (typeof row.latency_ms === "number") {
        latencies.push(row.latency_ms);
      }

      let promptTokens = 0;
      try {
        const metrics = JSON.parse(row.metrics_json) as ExecutionMetrics;
        if (typeof metrics.promptTokens === "number" && metrics.promptTokens > 0) {
          promptTokens = metrics.promptTokens;
        }
      } catch {
        /* ignore bad json */
      }

      const model = row.model_used;
      const cost = estimatePromptCostUsd(model, promptTokens);
      tokens += promptTokens;
      costUsd += cost;

      bump(byRoute, row.route ?? "unknown", isError, promptTokens, cost);
      bump(byModel, model ?? "unknown", isError, promptTokens, cost);
    }

    return {
      total,
      errors,
      tokens,
      costUsd: Number(costUsd.toFixed(6)),
      latency: {
        p50: percentile(latencies, 50),
        p95: percentile(latencies, 95),
      },
      byRoute: Object.fromEntries(
        Object.entries(byRoute).map(([k, v]) => [
          k,
          { ...v, costUsd: Number(v.costUsd.toFixed(6)) },
        ]),
      ),
      byModel: Object.fromEntries(
        Object.entries(byModel).map(([k, v]) => [
          k,
          { ...v, costUsd: Number(v.costUsd.toFixed(6)) },
        ]),
      ),
    };
  }
}
