# Data Model: Trace Persistido + Logs JSON

**Phase 1 output for** `specs/015-persistent-trace-logs/plan.md`

---

## Entities

### RequestRecord

| Field | Type | Constraints |
|-------|------|-------------|
| `id` / `requestId` | `string` | PK; UUID v4 (`crypto.randomUUID()`) |
| `createdAt` / `created_at` | `number` | Epoch ms; NOT NULL; início do handler |
| `finishedAt` / `finished_at` | `number` | Epoch ms; NOT NULL; momento da persistência |
| `status` | `"success" \| "error"` | CHECK; NOT NULL |
| `httpStatus` / `http_status` | `number` | NOT NULL; ex. 200, 503 |
| `conversationId` / `conversation_id` | `string \| null` | UUID se houver |
| `userId` / `user_id` | `string \| null` | Do body quando disponível |
| `metrics` / `metrics_json` | `ExecutionMetrics` | JSON; métricas do turno (pode ser parcial em erro) |
| `latencyMs` / `latency_ms` | `number \| null` | Denormalizado de metrics |
| `llmCalls` / `llm_calls` | `number \| null` | Denormalizado |
| `route` | `string \| null` | Denormalizado de metrics.route |
| `modelUsed` / `model_used` | `string \| null` | Denormalizado |

**State**: append-only v1 (sem update/delete/TTL).

---

### TraceEventRecord

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `string` | PK; UUID v4 |
| `requestId` / `request_id` | `string` | FK → `requests.id`; NOT NULL |
| `seq` | `number` | INTEGER ≥ 0; ordem de emissão; UNIQUE `(request_id, seq)` |
| `type` | `TraceEventType` | NOT NULL; alinhado ao domínio |
| `node` | `string` | NOT NULL; não vazio |
| `content` | `string` | NOT NULL |
| `payload` / `payload_json` | object \| null | Campos opcionais do `TraceEvent` serializados |

**Payload keys** (quando presentes): `tool`, `toolArgs`, `round`, `approved`, `timestampMs`, `route`, `override`, `reason`.

**Rehydration**: `GET` reconstrói `TraceEvent` = `{ type, content, node, ...payload }`.

---

### LogEvent (não persistido em SQLite)

| Field | Type | Constraints |
|-------|------|-------------|
| `ts` | `number` | Epoch ms |
| `level` | `"info" \| "warn" \| "error"` | |
| `event` | `string` | Nome canônico do evento |
| `requestId` | `string?` | Quando disponível |
| meta | scalars | Contagens, status, códigos — **sem** texto de mensagem/answer/trace |

---

## Closed Domains

| Domain | Values |
|--------|--------|
| `RequestStatus` | `success`, `error` |
| `LogLevel` | `info`, `warn`, `error` |
| `TraceEventType` | existente em `src/domain/types.ts` |

---

## Relationships

```text
RequestRecord 1 ──* TraceEventRecord (ordenado por seq)
RequestRecord  ··· LogEvent (correlação lógica via requestId; sem FK)
```

---

## SQL DDL (idempotente)

```sql
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
```

Mesmo arquivo `OPSPILOT_DB` que ops / conversations / memories.

---

## TypeScript contracts (domínio)

```ts
export type RequestStatus = "success" | "error";

export interface RequestRecord {
  id: string;
  createdAt: number;
  finishedAt: number;
  status: RequestStatus;
  httpStatus: number;
  conversationId: string | null;
  userId: string | null;
  metrics: ExecutionMetrics;
  latencyMs: number | null;
  llmCalls: number | null;
  route: string | null;
  modelUsed: string | null;
}

export interface SaveRequestInput {
  id: string;
  createdAt: number;
  finishedAt: number;
  status: RequestStatus;
  httpStatus: number;
  conversationId?: string | null;
  userId?: string | null;
  metrics: ExecutionMetrics;
  trace: TraceEvent[];
}

export interface RequestStore {
  save(input: SaveRequestInput): void;
  getById(id: string): { request: RequestRecord; trace: TraceEvent[] } | null;
}
```

Prepared statements only; sem SQL concatenado.

---

## Validation Rules

- `id` UUID v4 na fronteira HTTP para GET.
- `node` e `type` obrigatórios em cada evento persistido.
- `metrics_json` / `payload_json` MUST ser JSON válido na escrita.
- `save` em transação lógica: insert request + N events; se mid-fail, preferir rollback da transação SQLite (`BEGIN`/`COMMIT`) para não deixar request órfã sem eventos inconsistentes — se a API sync de `node:sqlite` permitir; senão documentar ordem request-first + events e testes de integridade.
