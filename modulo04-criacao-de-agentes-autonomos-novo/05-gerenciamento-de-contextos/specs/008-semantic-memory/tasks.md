# Tasks: Memória Semântica

**Input**: Design documents from `/specs/008-semantic-memory/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — FR-009 / FR-010 / US3 exigem store `:memory:`, teste semântico (sem palavra em comum) e `/chat` fake; constitution princípio 5; TDD por story.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, tests colocated as `*.test.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependência HF + scaffolds `src/memory/` per plan.md / research Decisões 1–2

- [x] T001 Add dependency `@huggingface/transformers` via `npm install @huggingface/transformers` and confirm entry in `package.json` / lockfile
- [x] T002 [P] Create `src/memory/embeddings.ts` scaffolding `export interface` re-export or stub `getDefaultEmbedder(): Embedder` and constants `EMBEDDING_DIM = 384`, `MODEL_ID = "Xenova/all-MiniLM-L6-v2"` (body TODO) per `contracts/memory-store.md`
- [x] T003 [P] Scaffold `src/memory/memory-store.ts` with placeholder `export class SqliteMemoryStore` accepting `path?: string` and optional `embedder?: Embedder` per plan
- [x] T004 [P] Scaffold empty `src/memory/memory-store.test.ts` with `node:test` / `node:assert/strict` imports ready for US1–US3

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos de domínio, erro e contratos TS — bloqueia store e `/chat`

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Add `MemoryFact`, `RecalledMemory`, `RememberResult`, `Embedder`, and `MemoryStore` interfaces to `src/domain/types.ts`; add optional `recalledMemories?: number` on `ExecutionMetrics` per `data-model.md`
- [x] T006 [P] Add `EmbeddingError` to `src/domain/errors.ts` (falha de carga/inferência do modelo) per research Decisão 2
- [x] T007 Make `SqliteMemoryStore` implement `MemoryStore` in `src/memory/memory-store.ts` with method stubs that throw `Error("not implemented")` so types compile; wire constructor path default `OPSPILOT_DB` / `./data/opspilot.db`
- [x] T008 Run `npm run typecheck` and confirm scaffolds + domain types compile under `strict: true`

**Checkpoint**: Foundation ready — embeddings, store e HTTP podem começar

---

## Phase 3: User Story 1 — Plantonista Guarda Fatos por Usuário (Priority: P1) 🎯 MVP

**Goal**: `MemoryStore.remember` persiste fatos por `userId` com embedding BLOB; dedup se similaridade **> 0,92**; isolamento entre usuários.

**Independent Test**: `SqliteMemoryStore(":memory:", fakeEmbedder)` — remember grava; near-dup não duplica; fatos de user A não aparecem no universo de B (via recall stub ou query interna de teste).

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T009 [P] [US1] Add deterministic `FakeEmbedder` helper (texto → vetor unitário controlado) in `src/memory/memory-store.test.ts` for unit tests without HF download
- [x] T010 [P] [US1] Test `remember` inserts fact for `userId` and returns `{ stored: true, id }` in `src/memory/memory-store.test.ts` (FR-001/FR-002)
- [x] T011 [P] [US1] Test near-duplicate: second `remember` with embedding dot **> 0.92** returns `{ stored: false }` and leaves a single row in `src/memory/memory-store.test.ts` (SC-002)
- [x] T012 [P] [US1] Test user isolation: remember under user A does not create/affect rows visible to user B in `src/memory/memory-store.test.ts` (FR-011)

### Implementation for User Story 1

- [x] T013 [US1] Implement `getDefaultEmbedder` lazy singleton in `src/memory/embeddings.ts`: `pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2")`, call with `{ pooling: "mean", normalize: true }`, return `Float32Array` length 384; wrap failures as `EmbeddingError` (research Decisão 2)
- [x] T014 [US1] Implement `SqliteMemoryStore` DDL + `remember` in `src/memory/memory-store.ts`: table `memories` (`id`, `user_id`, `fact`, `embedding` BLOB, `created_at`), index `user_id`, Float32↔Buffer helpers, dedup **> 0.92**, reject empty fact after trim per `data-model.md` / research Decisões 3–4
- [x] T015 [US1] Implement minimal `recall`/`forget` stubs still throwing **or** temporary private row-count helper only if needed for US1 isolation asserts — prefer completing enough SQL select-by-user for tests without full recall algorithm yet
- [x] T016 [US1] Run US1 cases via `npm test -- src/memory/memory-store.test.ts` (or full `npm test` filtering) until green with FakeEmbedder (no rede LLM)

**Checkpoint**: MVP — fatos gravados com dedup e isolamento por `userId`

---

## Phase 4: User Story 2 — Recall Semântico Top-3 no Prompt do Chat (Priority: P1)

**Goal**: `recall` top-3 por produto escalar (min **≥ 0,3**); `POST /chat` exige `userId`, injeta fatos no prompt via `formatMemoriesForPrompt`; métrica `recalledMemories`; teste semântico sem palavra em comum.

**Independent Test**: Popular memória; query lexicalmente disjunta → recall acha fato; `/chat` fake vê `Relevant memories:` em `input.message` e `metrics.recalledMemories`.

### Tests for User Story 2 ⚠️

- [x] T017 [P] [US2] Test `recall` returns ≤ 3 items, all scores ≥ 0.3, ordered desc — use FakeEmbedder with controlled vectors in `src/memory/memory-store.test.ts` (FR-003 / SC-001)
- [x] T018 [P] [US2] Test semantic recall **without shared words** using real `getDefaultEmbedder()` (timeout generoso, e.g. 120s) in `src/memory/memory-store.test.ts` (FR-009 / SC-003)
- [x] T019 [P] [US2] Unit tests for `formatMemoriesForPrompt`: empty → raw message; non-empty → `Relevant memories:` / `Current message:` in `src/chat/compose-prompt.test.ts` or `src/chat/run-chat.ts` colocated test (research Decisão 6)
- [x] T020 [P] [US2] Test `POST /chat` missing/`""` `userId` → `400` validation_error in `src/http/server.test.ts` (FR-008)
- [x] T021 [P] [US2] Test `POST /chat` with seeded memory + FakeEmbedder: fake strategy `inputs[0].message` contains `Relevant memories:` and `metrics.recalledMemories >= 1` in `src/http/server.test.ts` (SC-004)
- [x] T022 [P] [US2] Test `/chat` with no qualifying memories → `recalledMemories === 0` and message unchanged (no empty header) in `src/http/server.test.ts`

### Implementation for User Story 2

- [x] T023 [US2] Implement full `recall` in `src/memory/memory-store.ts`: embed query, brute-force dots, filter ≥ 0.3, sort desc, top 3; reject empty query (research Decisão 3)
- [x] T024 [US2] Add `formatMemoriesForPrompt(recalled, message)` and extend `runChat` / `ChatInput` in `src/chat/run-chat.ts`: require `userId` + `memories: MemoryStore`; recall → enrich message; append **original** user message; merge `recalledMemories` into metrics (research Decisão 6)
- [x] T025 [US2] Extend `chatRequestSchema` with required `userId: z.string().min(1)` in `src/http/chat-schema.ts` per `contracts/chat-http.md`
- [x] T026 [US2] Update `ChatAppDeps` + `createApp` in `src/http/server.ts`: require `memories: MemoryStore`; pass `userId` into `runChat`; map `EmbeddingError` → `500`/`internal_error` if it escapes
- [x] T027 [US2] Update all `createApp({...})` call sites in `src/http/server.test.ts` (and helpers) to inject `SqliteMemoryStore(":memory:", fakeEmbedder)` + `userId` in request bodies so prior cases stay green
- [x] T028 [US2] Wire `src/index.ts`: `new SqliteMemoryStore(dbPath)` and pass `memories` into `createApp`
- [x] T029 [US2] Run US2 cases via `npm test` until green (semantic test may download model on first run)

**Checkpoint**: Recall no prompt + métrica + teste semântico

---

## Phase 5: User Story 3 — Esquecer Fatos e Validar Store Offline (Priority: P2)

**Goal**: `forget` remove memória do usuário (no-op seguro); matriz completa alinhada ao quickstart; regressão verde.

**Independent Test**: remember → forget → recall vazio; `npm test` + `typecheck` cobrem quickstart §1.

### Tests for User Story 3 ⚠️

- [x] T030 [P] [US3] Test `forget` returns `true` and removes from subsequent `recall`; wrong user / unknown id returns `false` without deleting others in `src/memory/memory-store.test.ts` (FR-004 / SC-005)
- [x] T031 [P] [US3] Assert empty fact/query rejected (throw or validation) in `src/memory/memory-store.test.ts` (edge cases)

### Implementation for User Story 3

- [x] T032 [US3] Implement `forget(userId, id)` in `src/memory/memory-store.ts`: `DELETE WHERE id = ? AND user_id = ?`; return `changes === 1` (research Decisão 5)
- [x] T033 [US3] Close any gaps so quickstart scenarios 1–8 pass; keep unit paths on FakeEmbedder; only FR-009 uses real model
- [x] T034 [US3] Run full `npm test` and `npm run typecheck` until green (SC-006)

**Checkpoint**: Harness completo — forget + regressão

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Alinhamento final e higiene

- [x] T035 [P] Optional smoke unit for embeddings wrapper (dim 384 / normalize) in `src/memory/embeddings.test.ts` if not already covered by FR-009 — skip or mark slow if redundant
- [x] T036 Confirm strategies under `src/agents/` / `src/strategies/` remain untouched (message enrichment only in `run-chat.ts`)
- [x] T037 Run quickstart.md validation checklist (SC-001–SC-006) and fix any remaining failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP remember/dedup
- **User Story 2 (Phase 4)**: Depends on US1 `remember` + DDL (needs persisted facts); chat wiring can stub store only after recall exists
- **User Story 3 (Phase 5)**: Depends on US1/US2 store surface; forget + polish suite
- **Polish (Phase 6)**: Depends on desired stories complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on US2/US3
- **US2 (P1)**: Needs US1 `remember` + table; delivers recall + `/chat`
- **US3 (P2)**: Needs US1/US2 store methods; adds `forget` + full matrix

### Within Each User Story

- Tests FIRST (fail) → implementation → `npm test` green
- Embeddings before store methods that call `embed`
- Store before `runChat` / HTTP wiring
- Commit after each task or logical group

### Parallel Opportunities

- T002–T004 scaffolds in parallel after T001
- T005–T006 domain types/errors in parallel
- T009–T012 US1 tests in parallel
- T017–T022 US2 tests in parallel (T018 real-model may be slow — run alone if CI flakes)
- T030–T031 US3 tests in parallel

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests together:
Task: "FakeEmbedder helper in src/memory/memory-store.test.ts"
Task: "remember insert test in src/memory/memory-store.test.ts"
Task: "near-dup > 0.92 test in src/memory/memory-store.test.ts"
Task: "user isolation test in src/memory/memory-store.test.ts"
```

## Parallel Example: User Story 2

```bash
# Launch US2 tests together (except maybe run T018 alone):
Task: "recall top-3 FakeEmbedder tests"
Task: "formatMemoriesForPrompt unit tests"
Task: "POST /chat userId 400 + recall injection tests"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`@huggingface/transformers` + scaffolds)
2. Complete Phase 2: Foundational (domain types)
3. Complete Phase 3: US1 remember/dedup/isolation
4. **STOP and VALIDATE**: store tests with FakeEmbedder green
5. Demo: fatos persistidos por `userId` sem HTTP ainda

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MemoryStore.remember MVP
3. US2 → recall + `/chat` userId + semantic proof
4. US3 → forget + full quickstart green
5. Polish → typecheck/test final

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Dev A: US1 store remember
3. Dev B (after US1 DDL/API): US2 recall + chat (or stubs FakeEmbedder early)
4. Dev C: US3 forget + matrix after recall exists

---

## Notes

- [P] = different files, no incomplete-task dependencies
- [USn] maps to spec user stories
- Agent tools remember/forget **out of scope** (plan Decisão 9)
- Append conversation message = **original** text; enriched message only for `strategy.run`
- First FR-009 run may download HF weights — document in PR/notes; cache outside repo
- Avoid: changing `ReasoningStrategy` signature; second DB file; ORM
