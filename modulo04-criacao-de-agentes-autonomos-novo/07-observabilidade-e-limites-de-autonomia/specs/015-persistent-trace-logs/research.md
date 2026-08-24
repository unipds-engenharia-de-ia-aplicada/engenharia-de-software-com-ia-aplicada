# Research: Trace Persistido + Logs JSON

**Phase 0 output for** `specs/015-persistent-trace-logs/plan.md`

---

## Contexto

Hoje `POST /chat` devolve `answer` / `trace` / `metrics` / `conversationId` sem id correlacionável, sem persistência de auditoria e sem logger estruturado. Já existem três stores SQLite no mesmo `OPSPILOT_DB` (`SqliteOpsStore`, `SqliteConversationStore`, `SqliteMemoryStore`), cada um com seu `DatabaseSync` e DDL idempotente.

---

## Decisão 1: Store dedicado `SqliteRequestStore` (não estender OpsStore)

**Decisão**: Criar `src/store/sqlite-request-store.ts` implementando `RequestStore` (domínio), com tabelas `requests` e `trace_events`. Mesmo `OPSPILOT_DB`; ctor `path = process.env.OPSPILOT_DB ?? "./data/opspilot.db"`; testes `:memory:`.

**Rationale**: OpsStore é contrato de operações (alertas/incidentes). Auditoria de chat é orthogonal — mesmo padrão da feature 007 (conversation store separado). Camadas explícitas: HTTP depende de `RequestStore`, não de SQL.

**Alternatives considered**:

- Colunas/tabelas dentro de `SqliteOpsStore` — acopla domínio ops a HTTP chat.
- Segundo arquivo de DB — contradiz assumption da spec (mesmo banco).
- Só memória + logs — não atende SC-005 / GET recuperável.

---

## Decisão 2: `requestId` na entrada do handler

**Decisão**: No início de `POST /chat` (antes da validação zod do body), gerar `requestId = crypto.randomUUID()`, setar `res.setHeader("X-Request-Id", requestId)`. Em sucesso `200`, incluir `requestId` no JSON. Em erros pós-atribuição (`400` validação, `422`, `404` conversa, `503`, `504`, `500`), manter o header; corpo de erro **pode** omitir `requestId` (header basta), exceto `200` onde o body é obrigatório.

**Rationale**: Spec: id no header mesmo em `400` se já atribuído; mint precoce cobre isso sem ambiguidade.

**Alternatives considered**:

- Mint só após validação OK — perde correlação em `400`.
- Cliente envia id — fora de escopo v1 (assumption).

---

## Decisão 3: Persistência best-effort ao fim do turno

**Decisão**: Após `runProductionTurn` (sucesso) — e em falhas que já tenham `trace`/`metrics` parciais quando a borda conseguir capturá-los — chamar `requestStore.save(...)` dentro de `try/catch`. Falha de write → `logger.error({ event: "request_persist_failed", requestId, ... })` e **ainda** devolver a resposta HTTP do turno (ex. `200`). Em `400` pré-execução: **não** persistir registro (MAY da spec); header já correla.

**Rationale**: Spec edge case: não transformar turno respondido em 5xx por falha de auditoria.

**Alternatives considered**:

- Transação obrigatória falha → 500 — piora UX do plantão.
- Persistência síncrona antes de montar resposta com retry agressivo — overkill v1.

---

## Decisão 4: Schema SQL — métricas JSON + eventos ordenados

**Decisão**:

- `requests`: `id`, `created_at`, `finished_at`, `status` (`success` | `error`), `conversation_id` nullable, `user_id` nullable, `http_status`, `metrics_json` (TEXT JSON do `ExecutionMetrics`), campos denormalizados opcionais (`latency_ms`, `llm_calls`, `route`, `model_used`) para inspeção rápida.
- `trace_events`: `id`, `request_id` FK, `seq` INTEGER (0-based ordem de emissão), `type`, `node`, `content`, `payload_json` (campos opcionais do `TraceEvent`: `tool`, `toolArgs`, `round`, `approved`, `timestampMs`, `route`, `override`, `reason`).
- Índice `(request_id, seq)` para `GET` ordenado.

**Rationale**: Espelha TraceEvent rico sem explosão de colunas; `seq` garante ordem estável mesmo com timestamps ausentes.

**Alternatives considered**:

- Uma coluna `trace_json` blob na request — piora query parcial e viola intenção de tabela `trace_events`.
- Normalizar cada campo opcional em coluna — DDL frágil a cada novo tipo de evento.

---

## Decisão 5: Logger metadata-only

**Decisão**: `src/obs/logger.ts` exporta `createLogger` / funções `info|warn|error` que fazem `stdout.write(JSON.stringify(line) + "\n")`. Shape mínimo:

```ts
{ ts: number; level: "info"|"warn"|"error"; event: string; requestId?: string; ...meta }
```

Proibido nos meta: `message` (texto do user), `answer`, `trace`, `content`, `payload`, `toolArgs`. Eventos canônicos HTTP: `chat_request_start`, `chat_request_end`, `chat_request_error`, `request_persist_failed`.

Testes injetam `write` fake ou capturam via dependency.

**Rationale**: FR-007/008 e SC-004; separa hot-path de log de auditoria rica no SQLite.

**Alternatives considered**:

- pino/winston — dependência nova desnecessária; constitution prefere stack mínima.
- Logar trace completo — viola “só metadados”.

---

## Decisão 6: Validação `GET /requests/:id`

**Decisão**: Param `id` com zod `z.string().uuid()` → `400` + `validation_error` se inválido; store `getById` → `null` ⇒ `404` + erro de domínio (`request_not_found`). Resposta `200`: `{ request: RequestRecordPublic, trace: TraceEvent[] }` (trace reidratado do store, ordem `seq ASC`).

**Rationale**: Spec default explícito (400 malformado / 404 ausente).

**Alternatives considered**:

- Sempre `404` para inválido — menos informativo para cliente.
- Aceitar qualquer string não-vazia — afrouxa fronteira.

---

## Decisão 7: Composição

**Decisão**: `index.ts` instancia `SqliteRequestStore(dbPath)` e passa em `createApp({ ..., requests, logger })`. Testes HTTP usam `:memory:` + logger com sink em array.

**Rationale**: Mesmo wiring dos outros stores; injeção facilita FR-011.

---

## Resolução de clarificações

Não restam NEEDS CLARIFICATION no Technical Context — defaults acima fecham id, schema, best-effort, logger e validação.
