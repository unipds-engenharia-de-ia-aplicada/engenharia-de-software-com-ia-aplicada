# Tasks: Conversa Persistente

**Input**: Design documents from `/specs/007-persistent-conversation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — FR-011 / FR-012 / US3 exigem `:memory:` + fake; constitution princípio 5; TDD por story.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, tests colocated as `*.test.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffolds de módulos novos per plan.md / research Decisões 1–2

- [x] T001 Create directory `src/chat/` and scaffold `src/chat/compose-prompt.ts` exporting stubs `HISTORY_LIMIT = 12` and `composeChatPrompt(history, currentMessage): string` (body TODO) per plan structure
- [x] T002 [P] Scaffold `src/store/sqlite-conversation-store.ts` with placeholder `export class SqliteConversationStore` accepting `path?: string` (default `OPSPILOT_DB` / `./data/opspilot.db`) per `contracts/conversation-store.md`
- [x] T003 [P] Scaffold empty `src/store/sqlite-conversation-store.test.ts` with `node:test` / `node:assert/strict` imports ready for US1–US3

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos de domínio, erro e contratos TS — bloqueia store e `/chat`

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Add `ConversationMessageRole`, `ConversationMessage`, and `ConversationStore` interfaces to `src/domain/types.ts`; add optional `historyMessages?: number` on `ExecutionMetrics` per `data-model.md` / research Decisão 3
- [x] T005 [P] Add `ConversationNotFoundError` (with `conversationId` field) to `src/domain/errors.ts` per `contracts/conversation-store.md`
- [x] T006 Make `SqliteConversationStore` implement `ConversationStore` in `src/store/sqlite-conversation-store.ts` with method stubs that throw `Error("not implemented")` (so types compile)
- [x] T007 Run `npm run typecheck` and confirm scaffolds + domain types compile under `strict: true`

**Checkpoint**: Foundation ready — store, compose e HTTP podem começar

---

## Phase 3: User Story 1 — Plantonista Continua a Mesma Conversa (Priority: P1) 🎯 MVP

**Goal**: `ConversationStore` persiste conversas/mensagens; `POST /chat` aceita `conversationId` opcional, cria/reutiliza, devolve o id; append só após sucesso; 404 se id inexistente.

**Independent Test**: Fake strategy + `SqliteConversationStore(":memory:")` — dois `POST /chat` com o mesmo id; segundo devolve o mesmo `conversationId`; id desconhecido → `404` sem `run`.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T008 [P] [US1] Test `create` → `lastMessages` returns `[]`; `append` user+assistant round-trip order in `src/store/sqlite-conversation-store.test.ts` (FR-011)
- [x] T009 [P] [US1] Test `POST /chat` without `conversationId` returns `200` with `conversationId` (UUID) in `src/http/server.test.ts` (SC-001 / FR-005/FR-006)
- [x] T010 [P] [US1] Test second `POST /chat` with returned id reuses same `conversationId` and persists turn (store `lastMessages` length grows) in `src/http/server.test.ts`
- [x] T011 [P] [US1] Test unknown UUID → `404` `{ error: "conversation_not_found", conversationId }` with fake `calls === 0`; invalid `conversationId` → `400` in `src/http/server.test.ts` (SC-003 / FR-007)

### Implementation for User Story 1

- [x] T012 [US1] Implement `SqliteConversationStore` in `src/store/sqlite-conversation-store.ts`: open `DatabaseSync`, idempotent DDL (`conversations`, `messages`, index), prepared `create` / `append` / `lastMessages`, throw `ConversationNotFoundError` per `data-model.md` / research Decisão 1 e 5
- [x] T013 [US1] Extend `chatRequestSchema` in `src/http/chat-schema.ts` with `conversationId: z.string().uuid().optional()` per `contracts/chat-http.md`
- [x] T014 [US1] Update `ChatAppDeps` + `createApp` in `src/http/server.ts`: require `conversations: ConversationStore`; resolve/create id; on success append user+assistant (research Decisão 4); map `ConversationNotFoundError` → `404`; do **not** compose history yet (pass raw `message` to `run`) — MVP path
- [x] T015 [US1] Update existing `src/http/server.test.ts` helpers to inject `new SqliteConversationStore(":memory:")` into every `createApp({...})` so prior cases still compile/run
- [x] T016 [US1] Wire `src/index.ts`: `const conversations = new SqliteConversationStore(process.env.OPSPILOT_DB ?? "./data/opspilot.db")` and pass into `createApp({ registry, conversations, ... })`
- [x] T017 [US1] Run US1 cases via `npm test` until green (store `:memory:` + HTTP fake; no rede)

**Checkpoint**: MVP — plantonista obtém e reutiliza `conversationId` com persistência

---

## Phase 4: User Story 2 — Agente Recebe as Últimas Mensagens no Prompt (Priority: P1)

**Goal**: Composição injeta até 12 mensagens prévias no prompt; `metrics.historyMessages` reporta quantas foram injetadas.

**Independent Test**: Popular conversa; turno seguinte — fake `inputs` contém histórico formatado; `historyMessages` correto (0 / N / 12).

### Tests for User Story 2 ⚠️

- [x] T018 [P] [US2] Unit tests for `composeChatPrompt`: empty history → raw message; non-empty → `Previous conversation:` / `Current message:` format in `src/chat/compose-prompt.test.ts` (research Decisão 2)
- [x] T019 [P] [US2] Test first turn `metrics.historyMessages === 0` in `src/http/server.test.ts` (FR-009)
- [x] T020 [P] [US2] Test second turn: `historyMessages >= 2` and fake strategy `inputs[1]` contains prior user/assistant content in `src/http/server.test.ts` (SC-001)
- [x] T021 [P] [US2] Test store with 15 messages + new chat turn → `historyMessages === 12` in `src/http/server.test.ts` (SC-002)

### Implementation for User Story 2

- [x] T022 [US2] Implement `composeChatPrompt` and export `HISTORY_LIMIT` in `src/chat/compose-prompt.ts` per research Decisão 2
- [x] T023 [US2] In `src/http/server.ts`: before `run`, `history = conversations.lastMessages(id, HISTORY_LIMIT)`; `prompt = composeChatPrompt(history, message)`; merge `metrics: { ...result.metrics, historyMessages: history.length }` on `200`
- [x] T024 [US2] Confirm `lastMessages` returns chronological order and respects `limit` in `src/store/sqlite-conversation-store.ts` (fix if US1 stub incomplete)
- [x] T025 [US2] Run US2 cases via `npm test` until green

**Checkpoint**: Histórico no prompt + métrica observável

---

## Phase 5: User Story 3 — Desenvolvedor Valida Store e Chat Sem Rede (Priority: P2)

**Goal**: Matriz completa de testes `:memory:` + fake alinhada ao quickstart; regressão verde.

**Independent Test**: `npm test` + `npm run typecheck` cobrem create/append/lastMessages (limite 12), 404/400, historyMessages — sem rede.

### Tests for User Story 3 ⚠️

- [x] T026 [P] [US3] Complete store matrix in `src/store/sqlite-conversation-store.test.ts`: 15 appends → `lastMessages(_, 12)` length 12 last ones; `append`/`lastMessages` unknown id → `ConversationNotFoundError` (FR-011 / quickstart §1)
- [x] T027 [P] [US3] Assert failure path does **not** append assistant (throwing fake → only user message remains) in `src/http/server.test.ts` per user `runChat` order

### Implementation for User Story 3

- [x] T028 [US3] Fix any gaps so quickstart scenarios 1–6 pass; keep tests offline (`:memory:` + fake only)
- [x] T029 [US3] Run full `npm test` and `npm run typecheck` until green (SC-004)

**Checkpoint**: Harness determinístico completo sem LLM

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Regressão do produto e fechamento do quickstart

- [x] T030 [P] Confirm strategies accept `StrategyRunInput` (`{ message, history }`) in `src/agents/react.ts` / `src/strategies/plan-execute.ts` / `src/strategies/reflect.ts` per user `runChat` reference
- [x] T031 [P] Confirm CLI/Arena/bench/`src/mcp/**` untouched for `conversationId` (escopo HTTP only) — spot-check no accidental deps
- [x] T032 Run quickstart.md checklist (automated rows); optional manual curl smoke if `OPENROUTER_API_KEY` available
- [x] T033 Final `npm test` + `npm run typecheck` green

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP (`conversationId` + persist)
- **US2 (Phase 4)**: Depends on US1 HTTP flow existing (extends `server.ts` + compose)
- **US3 (Phase 5)**: Depends on US1 store + US2 compose metrics for full matrix
- **Polish (Phase 6)**: Depends on US1–US3 desired scope

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on other stories
- **US2 (P1)**: After US1 `/chat` + store append path — adds compose + `historyMessages`
- **US3 (P2)**: After US1/US2 core — completes test matrix and failure-policy asserts

### Within Each User Story

- Tests (where listed) MUST be written and FAIL before implementation
- Store DDL/ops before HTTP wiring
- Schema/validation before 404/400 asserts green
- Compose before `historyMessages` asserts green

### Parallel Opportunities

- T002 ‖ T003 (scaffolds diferentes)
- T004 ‖ T005 (domain types vs errors)
- T008 ‖ T009 ‖ T010 ‖ T011 (testes US1 em arquivos distintos / casos)
- T018 ‖ T019 ‖ T020 ‖ T021 (testes US2)
- T026 ‖ T027 (testes US3)
- T030 ‖ T031 (spot-checks polish)

---

## Parallel Example: User Story 1

```bash
# Tests US1 em paralelo:
Task: "Store create/append round-trip in src/store/sqlite-conversation-store.test.ts"
Task: "POST /chat returns conversationId in src/http/server.test.ts"
Task: "Reuse conversationId in src/http/server.test.ts"
Task: "404/400 conversationId errors in src/http/server.test.ts"

# Depois implementação sequencial:
Task: "Implement SqliteConversationStore DDL + ops"
Task: "Extend chat-schema + server flow + index wire"
Task: "npm test until US1 green"
```

---

## Parallel Example: User Story 2

```bash
# Tests US2 em paralelo (após US1 verde):
Task: "composeChatPrompt unit tests in src/chat/compose-prompt.test.ts"
Task: "historyMessages 0 / continue / cap 12 in src/http/server.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (scaffolds)
2. Complete Phase 2: Domain types + error
3. Complete Phase 3: US1 persist + `conversationId` round-trip
4. **STOP and VALIDATE**: dois turnos HTTP com fake + `:memory:`
5. Demo continuidade de conversa

### Incremental Delivery

1. Setup + Foundational → tipos e scaffolds
2. US1 → `conversationId` + persistência (MVP)
3. US2 → histórico no prompt + `historyMessages`
4. US3 → matriz de testes + política de falha
5. Polish → regressão + quickstart

### Parallel Team Strategy

1. Team: Setup + Foundational together
2. Dev A: US1 store + HTTP persist
3. Dev B: US2 compose (após US1 `server.ts` estável) + US3 matrix

---

## Notes

- [P] = different files, no incomplete-task dependencies
- [USn] maps to spec user stories
- Append user **before** `strategy.run`, assistant **after** success (user reference / `runChat`); on strategy failure user may remain without assistant
- `ReasoningStrategy.run({ message, history })` — structured history (user reference); arena/bench pass `history: []`
- Mesmo `OPSPILOT_DB` que o ops store; testes sempre `:memory:`
- Commit after each task or logical group
- Suggested MVP = Phase 1–3 (US1 only)
