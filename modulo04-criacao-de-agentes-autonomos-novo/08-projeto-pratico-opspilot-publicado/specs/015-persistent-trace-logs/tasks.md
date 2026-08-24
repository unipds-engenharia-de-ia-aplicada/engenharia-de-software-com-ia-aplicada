# Tasks: Trace Persistido + Logs JSON

**Input**: Design documents from `/specs/015-persistent-trace-logs/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — FR-011 / SC-001–SC-005; store `:memory:`; logger 1 linha JSON; HTTP `requestId` / `GET /requests/:id`; sem rede

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold dos módulos novos sem comportamento completo

- [x] T001 [P] Create `src/obs/logger.ts` exporting stub `createLogger` / `Logger` types (no-op or passthrough write) per `contracts/logger.md` shape
- [x] T002 [P] Create `src/store/sqlite-request-store.ts` with `SqliteRequestStore` class stub (ctor accepts `path`, no DDL yet)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos de domínio, erro, schema de path e deps HTTP — **BLOCKS** all user stories

**⚠️ CRITICAL**: No user story work until this phase is complete

- [x] T003 Add `RequestStatus`, `RequestRecord`, `SaveRequestInput`, and `RequestStore` interface to `src/domain/types.ts` per `data-model.md`
- [x] T004 [P] Add `RequestNotFoundError` (or equivalent domain error with stable `code`) in `src/domain/errors.ts`
- [x] T005 [P] Add `requestIdParamSchema` (`z.string().uuid()`) in `src/http/chat-schema.ts`
- [x] T006 Extend `ChatAppDeps` in `src/http/server.ts` with optional `requests?: RequestStore` and `logger?: Logger` (compile-only; no persist/log behavior yet)
- [x] T007 Run `npm run typecheck` and fix fallout from T003–T006

**Checkpoint**: Tipos e deps prontos; stories podem começar

---

## Phase 3: User Story 1 — Correlacionar Resposta com `requestId` (Priority: P1) 🎯 MVP

**Goal**: Todo `POST /chat` atribui UUID; `200` inclui `requestId` no body e o mesmo valor em `X-Request-Id`; erros pós-mint mantêm o header

**Independent Test**: Estratégia/grafo fake — assert `body.requestId ===` header; duas calls → ids distintos; `400` ainda tem `X-Request-Id`

### Tests for User Story 1

> Write these tests FIRST; ensure they FAIL before implementation

- [x] T008 [P] [US1] HTTP test: `POST /chat` 200 → `body.requestId` equals `X-Request-Id` and is non-empty UUID in `src/http/server.test.ts`
- [x] T009 [P] [US1] HTTP test: two successive `POST /chat` return distinct `requestId`s in `src/http/server.test.ts`
- [x] T010 [P] [US1] HTTP test: invalid body `400` still sets `X-Request-Id` header in `src/http/server.test.ts`

### Implementation for User Story 1

- [x] T011 [US1] At start of `POST /chat` in `src/http/server.ts`, mint `requestId = crypto.randomUUID()` and `res.setHeader("X-Request-Id", requestId)` before body validation
- [x] T012 [US1] Include `requestId` in successful `200` JSON body alongside `answer` / `trace` / `metrics` / `conversationId` in `src/http/server.ts`
- [x] T013 [US1] Verify all post-mint error responses (`400`, `422`, `404`, `503`, `504`, `500`) keep `X-Request-Id` in `src/http/server.ts` (adjust early returns if needed)

**Checkpoint**: MVP — correlação HTTP funciona sem persistência

---

## Phase 4: User Story 2 — Auditar Execução Persistida (Priority: P1)

**Goal**: Persistir request + `trace_events` ordenados; `GET /requests/:id` devolve registro + trace; `404`/`400` conforme contrato

**Independent Test**: Chat fake com N eventos → `GET` retorna mesmos N na ordem; id ausente → `404`; id inválido → `400`

### Tests for User Story 2

- [x] T014 [P] [US2] Unit tests: `save` + `getById` order, empty trace, missing id, idempotent DDL in `src/store/sqlite-request-store.test.ts` (`:memory:`)
- [x] T015 [P] [US2] HTTP test: after `POST /chat` with N trace events, `GET /requests/:id` returns same ordered trace in `src/http/server.test.ts`
- [x] T016 [P] [US2] HTTP test: `GET /requests/:id` → `404` unknown UUID and `400` non-UUID in `src/http/server.test.ts`

### Implementation for User Story 2

- [x] T017 [US2] Implement `SqliteRequestStore` DDL (`requests`, `trace_events`), prepared `save` (with `seq`) and `getById` (ORDER BY seq) in `src/store/sqlite-request-store.ts` per `contracts/request-store.md` / `data-model.md`
- [x] T018 [US2] After successful turn in `src/http/server.ts`, call `requests.save(...)` best-effort (`try/catch`; never flip a successful turn to 5xx solely for persist failure)
- [x] T019 [US2] Implement `GET /requests/:id` in `src/http/server.ts`: validate with `requestIdParamSchema`, map null → `RequestNotFoundError` → `404` `{ error: "request_not_found", requestId }`, `200` `{ request, trace }`
- [x] T020 [US2] Wire `SqliteRequestStore` into `src/index.ts` (`new SqliteRequestStore(dbPath)`) and inject `requests` in test `createApp` harnesses in `src/http/server.test.ts`

**Checkpoint**: Auditoria recuperável via GET

---

## Phase 5: User Story 3 — Logs JSON Estruturados (Priority: P2)

**Goal**: `src/obs/logger.ts` emite 1 linha JSON por evento só com metadados; HTTP emite start/end/error + `request_persist_failed`

**Independent Test**: Sink fake — linhas `JSON.parse`áveis; deny-list sem `message`/`answer`/`trace`/`content`/`payload`; persist throw → log + ainda `200`

### Tests for User Story 3

- [x] T021 [P] [US3] Unit tests: one JSON line per call, deny-list forbidden meta keys, two calls → two lines in `src/obs/logger.test.ts`
- [x] T022 [P] [US3] HTTP test: forced `requests.save` throw after success still returns `200` with `requestId` and emits `request_persist_failed` via injectable logger sink in `src/http/server.test.ts`

### Implementation for User Story 3

- [x] T023 [US3] Implement `createLogger({ write })` in `src/obs/logger.ts` per `contracts/logger.md` (default write → stdout one line)
- [x] T024 [US3] Emit `chat_request_start` / `chat_request_end` / `chat_request_error` with `requestId` + scalar meta only (no user message / answer / trace) in `src/http/server.ts`
- [x] T025 [US3] On persist failure in `src/http/server.ts`, `logger.error("request_persist_failed", { requestId, ... })` and continue with the HTTP response already prepared
- [x] T026 [US3] Pass default `createLogger()` from `src/index.ts` into `createApp({ logger })`

**Checkpoint**: Observabilidade em tempo real correlacionável ao `requestId`

---

## Phase 6: User Story 4 — Persistência Sobrevive ao Processo (Priority: P2)

**Goal**: Mesmo `OPSPILOT_DB` em arquivo; após reopen, `getById` devolve dados; testes automatizados usam `:memory:`

**Independent Test**: Temp file DB → save → new `SqliteRequestStore(samePath)` → getById ok; suite HTTP/store não escreve no default `./data/opspilot.db`

### Tests for User Story 4

- [x] T027 [P] [US4] File reopen smoke: temp path save → new store instance → `getById` in `src/store/sqlite-request-store.test.ts` (SC-005)

### Implementation for User Story 4

- [x] T028 [US4] Confirm `src/index.ts` uses the same `dbPath` (`OPSPILOT_DB` ?? `./data/opspilot.db`) for `SqliteRequestStore` alongside ops/conversation/memory stores
- [x] T029 [US4] Audit tests: all `SqliteRequestStore` / HTTP integration paths use `:memory:` or isolated temp files — never the default production path — in `src/store/sqlite-request-store.test.ts` and `src/http/server.test.ts`

**Checkpoint**: SC-005 coberto; coexistência com outros stores

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: CI verde + quickstart

- [x] T030 Run full `npm test` and `npm run typecheck`; fix regressions from `requestId` body shape / new deps
- [x] T031 [P] Walk `specs/015-persistent-trace-logs/quickstart.md` checks (or tick expected outcomes after automated coverage)
- [x] T032 [P] Grep `src/obs/logger.ts` and HTTP log call sites for forbidden meta keys (`message`, `answer`, `trace`, `content`, `payload`, `toolArgs`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP `requestId` (no store required)
- **US2 (Phase 4)**: Depends on Foundational (+ US1 mint for end-to-end GET after chat); store can be unit-tested alone
- **US3 (Phase 5)**: Depends on Foundational; HTTP wire ideally after US1 mint + US2 persist hook
- **US4 (Phase 6)**: Depends on US2 store implementation
- **Polish (Phase 7)**: Depends on US1–US4

### User Story Dependencies

- **US1**: After Foundational — no dependency on store/logger
- **US2**: After Foundational; e2e HTTP nicer after US1 `requestId`
- **US3**: Logger unit tests parallelizable anytime after T001; HTTP events after US1/US2 hooks exist
- **US4**: After T017 store impl

### Within Each Story

- Tests (marked) written first and failing before implementation
- Domain/store before HTTP wire
- Best-effort persist before logger failure path asserts

### Parallel Opportunities

- T001 ∥ T002 (Setup)
- T004 ∥ T005 (Foundational)
- T008 ∥ T009 ∥ T010 (US1 tests)
- T014 ∥ T015 ∥ T016 (US2 tests)
- T021 ∥ T022 (US3 tests)
- T031 ∥ T032 (Polish)
- After Foundational: US1 can proceed while US2 store unit work (T014/T017) starts in parallel if staffed

---

## Parallel Example: User Story 1

```bash
# Tests in parallel:
Task: "HTTP test requestId === X-Request-Id in src/http/server.test.ts"
Task: "HTTP test distinct requestIds in src/http/server.test.ts"
Task: "HTTP test 400 keeps X-Request-Id in src/http/server.test.ts"
```

## Parallel Example: User Story 2

```bash
# Store unit vs HTTP contract tests in parallel (after T017 or with failing stubs):
Task: "Unit tests save/getById in src/store/sqlite-request-store.test.ts"
Task: "HTTP GET ordered trace in src/http/server.test.ts"
Task: "HTTP GET 404/400 in src/http/server.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1–2
2. Complete Phase 3 (US1)
3. **STOP and VALIDATE**: `requestId` body + header
4. Demo correlação sem persistência

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → correlação HTTP (MVP)
3. US2 → persist + GET auditoria
4. US3 → logs JSON
5. US4 → reopen arquivo + wiring confirmado
6. Polish → `npm test` / typecheck verde

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Dev A: US1 → then US3 HTTP events
3. Dev B: US2 store + GET → then US4 reopen
4. Merge + Polish

---

## Notes

- [P] = different files, no incomplete-task dependencies
- [Story] labels map to spec user stories US1–US4
- Commit after each task or logical group
- Persist failure must not convert a successful chat into 5xx
- Avoid logging user message / full trace payloads
- Suggested MVP: Phase 3 (US1) only
