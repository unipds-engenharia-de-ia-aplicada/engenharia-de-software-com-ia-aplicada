# Tasks: Refletor de Aprendizado

**Input**: Design documents from `/specs/009-learning-reflector/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md; feature `008` MemoryStore disponível

**Tests**: Included — FR-009 / SC-001–SC-005; constitution princípio 5; TDD por story; refletor fake (sem rede LLM).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, tests colocated as `*.test.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffolds dos módulos novos per plan.md / research Decisões 1–3

- [x] T001 Create `src/memory/chat-user-context.ts` scaffolding exports `runWithChatUser` / `getChatUserId` (bodies TODO or thin ALS stub) per research Decisão 3
- [x] T002 [P] Scaffold `src/memory/learning-reflector.ts` with exports `learningReflectionSchema`, type `LearningReflectorFn`, stubs `createLLMLearningReflector` / `scheduleLearning` per `contracts/learning-reflector.md`
- [x] T003 [P] Scaffold empty `src/memory/learning-reflector.test.ts` with `node:test` / `node:assert/strict` imports ready for US1–US2

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: ALS + schema + stubs tipados — bloqueia runChat e tools

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Implement `AsyncLocalStorage` helpers in `src/memory/chat-user-context.ts`: `runWithChatUser(userId, fn)` and `getChatUserId()` per research Decisão 3
- [x] T005 [P] Finalize `learningReflectionSchema` (`hasLearning`, `fact`) and export `LearningReflection` type in `src/memory/learning-reflector.ts` per `data-model.md`
- [x] T006 Make `scheduleLearning` and `createLLMLearningReflector` compile as stubs (`scheduleLearning` no-op or throw `"not implemented"`; LLM factory stub) in `src/memory/learning-reflector.ts`
- [x] T007 Run `npm run typecheck` and confirm new modules compile under `strict: true`

**Checkpoint**: Foundation ready — reflector, ALS e wire podem começar

---

## Phase 3: User Story 1 — Sistema Aprende Preferências Duráveis Após o Turno (Priority: P1) 🎯 MVP

**Goal**: Após turno `/chat` bem-sucedido, refletor (injetável) + `scheduleLearning` chama `memories.remember` de forma assíncrona sem atrasar a resposta.

**Independent Test**: Fake reflector `{ hasLearning: true, fact }` + store `:memory:` — após `runChat`, remember ocorre; deferred remember prova que o resultado não awaits persistência.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T008 [P] [US1] Test `scheduleLearning` with fake positive reflector calls `remember` once with trimmed fact in `src/memory/learning-reflector.test.ts` (SC-001 / FR-003)
- [x] T009 [P] [US1] Test `scheduleLearning` with `hasLearning: false` or empty fact does **not** call `remember` in `src/memory/learning-reflector.test.ts` (FR-004)
- [x] T010 [P] [US1] Test reflector throw / remember reject is swallowed (scheduleLearning resolves, no throw) in `src/memory/learning-reflector.test.ts` (FR-006)
- [x] T011 [P] [US1] Test `runChat` with deferred `remember` (controllable Promise): `ChatTurnResult` resolves while remember still pending in `src/chat/compose-prompt.test.ts` or `src/memory/learning-reflector.test.ts` (SC-003)

### Implementation for User Story 1

- [x] T012 [US1] Implement `scheduleLearning` in `src/memory/learning-reflector.ts` per research Decisão 2 (await reflector → conditional remember → catch-all)
- [x] T013 [US1] Implement `createLLMLearningReflector(modelFactory)` using `withStructuredOutput(learningReflectionSchema)` + fail-safe `{ hasLearning: false, fact: "" }` in `src/memory/learning-reflector.ts` (research Decisão 1); include system prompt placeholders for durable-only policy (US2 will harden wording)
- [x] T014 [US1] Extend `RunChatOptions` with optional `learningReflector?: LearningReflectorFn` in `src/chat/run-chat.ts`; after successful append assistant, `void scheduleLearning(...).catch(...)` without await; wrap `strategy.run` in `runWithChatUser(input.userId, ...)`
- [x] T015 [US1] Wire optional `learningReflector` through `ChatAppDeps` / `createApp` in `src/http/server.ts` into `runChat` options
- [x] T016 [US1] Wire production reflector in `src/index.ts`: `createLLMLearningReflector(createModel)` passed to `createApp` (and ensure `createTools` still works until US3)
- [x] T017 [US1] Run US1 cases via `npm test` until green (fake reflector only; no rede LLM)

**Checkpoint**: MVP — aprendizado assíncrono pós-turno com fake

---

## Phase 4: User Story 2 — Só Fatos Duráveis — Nunca Pedido Pontual nem Segredo (Priority: P1)

**Goal**: Política do refletor (prompt/schema) e testes garantem que pontual e segredo não disparam `remember` (via fake/`hasLearning: false`).

**Independent Test**: Fixtures fake cobrindo preferência → aprende; pedido pontual → não; segredo → não; assert prompt documenta regras.

### Tests for User Story 2 ⚠️

- [x] T018 [P] [US2] Test suite table: durable preference fake → remember; punctual fake → no remember; secret fake → no remember in `src/memory/learning-reflector.test.ts` (SC-002 / FR-005)
- [x] T019 [P] [US2] Assert system prompt string in `src/memory/learning-reflector.ts` contains durable / anti-pontual / anti-segredo guidance (unit string includes checks) in `src/memory/learning-reflector.test.ts`

### Implementation for User Story 2

- [x] T020 [US2] Harden `LEARNING_REFLECTOR_PROMPT` (or equivalent) in `src/memory/learning-reflector.ts` with clear examples: durable preference OK; “liste alertas” / “abra incidente” → no; API keys/passwords → no (research Decisão 1 / FR-005)
- [x] T021 [US2] Ensure `createLLMLearningReflector` uses the hardened prompt and zod `.describe` texts align with policy in `src/memory/learning-reflector.ts`
- [x] T022 [US2] Run US2 cases via `npm test` until green

**Checkpoint**: Política durável documentada e coberta por fixtures fake

---

## Phase 5: User Story 3 — Plantonista Esquece Preferência via Tool (Priority: P2)

**Goal**: Tool `forget_preference` no catálogo (com `MemoryStore`); resolve via recall + forget; `userId` via ALS; MCP intocado.

**Independent Test**: ALS + seed memory → invoke tool → recall vazio; sem ALS → error string; `createTools` length 7 com memories.

### Tests for User Story 3 ⚠️

- [x] T023 [P] [US3] Test `forget_preference` with `runWithChatUser` removes top recall match in `src/agents/tools.test.ts` (SC-004 / FR-007)
- [x] T024 [P] [US3] Test invoke without ALS returns Error string and does not mutate store in `src/agents/tools.test.ts` (FR-008)
- [x] T025 [P] [US3] Test `createTools(store)` remains 6 tools; `createTools(store, memories)` includes `forget_preference` (7) in `src/agents/tools.test.ts`
- [x] T026 [P] [US3] Confirm MCP catalog test still expects only 3 tools (no `forget_preference`) in `src/mcp/server.test.ts` (no code change if already green)

### Implementation for User Story 3

- [x] T027 [US3] Implement `createForgetPreferenceTool(memories)` in `src/agents/tools.ts` per `contracts/forget-preference.md` (query schema, ALS userId, recall → forget top-1, string observations)
- [x] T028 [US3] Update `createTools(store, memories?: MemoryStore)` to append `forget_preference` when memories provided; re-export from `src/tools/index.ts` if needed
- [x] T029 [US3] Update `src/index.ts` bootstrap: `createTools(store, memories)` so HTTP agent has the tool; keep Arena/bench on `createTools(store)` unless trivial to pass memories
- [x] T030 [US3] Fix any broken callers of `createTools` signature in `src/arena.ts` / `src/bench.ts` / tests (second arg optional)
- [x] T031 [US3] Run US3 + full `npm test` and `npm run typecheck` until green (SC-005)

**Checkpoint**: Ciclo aprender/esquecer completo no agente

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Alinhamento quickstart e higiene

- [x] T032 [P] Add HTTP integration smoke in `src/http/server.test.ts`: fake learningReflector positive + FakeEmbedder store; after `postChat` 200, flush microtasks and assert memory recall (optional but preferred for SC-001 end-to-end)
- [x] T033 Confirm `withReflection` / `src/strategies/reflect.ts` untouched (learning reflector independent)
- [x] T034 Run quickstart.md checklist (SC-001–SC-005) and fix remaining gaps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP async learn
- **US2 (Phase 4)**: Depends on US1 `scheduleLearning` + reflector module (prompt/policy)
- **US3 (Phase 5)**: Depends on ALS (Phase 2) + MemoryStore (`008`); can start after Foundational in parallel with US1/US2 if staffed, but needs `runWithChatUser` for tool tests
- **Polish (Phase 6)**: After desired stories

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on US3
- **US2 (P1)**: Needs US1 scheduleLearning surface; policy/prompt + fake fixtures
- **US3 (P2)**: Needs ALS + MemoryStore; independent of LLM reflector

### Within Each User Story

- Tests FIRST (fail) → implementation → `npm test` green
- ALS before tool tests that need user context
- `runChat` wire after `scheduleLearning` works in isolation

### Parallel Opportunities

- T001–T003 scaffolds in parallel
- T004–T005 ALS + schema in parallel
- T008–T011 US1 tests in parallel
- T018–T019 US2 tests in parallel
- T023–T026 US3 tests in parallel
- US3 implementation can proceed in parallel with US2 after ALS exists

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests together:
Task: "scheduleLearning positive remember once"
Task: "hasLearning false skips remember"
Task: "errors swallowed"
Task: "runChat does not await deferred remember"
```

## Parallel Example: User Story 3

```bash
# Launch US3 tests together:
Task: "forget_preference removes fact under ALS"
Task: "no ALS → Error string"
Task: "createTools 6 vs 7"
Task: "MCP catalog unchanged"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1–2 (ALS + schema scaffolds)
2. Complete Phase 3: scheduleLearning + runChat wire + fake tests
3. **STOP and VALIDATE**: async learn without blocking
4. Demo with fake reflector

### Incremental Delivery

1. Setup + Foundational → ready
2. US1 → async remember MVP
3. US2 → durable-only policy + fixtures
4. US3 → forget_preference tool
5. Polish → HTTP e2e + typecheck/test final

### Parallel Team Strategy

1. Team completes Setup + Foundational
2. Dev A: US1 runChat/scheduleLearning
3. Dev B: US2 prompt/fixtures (after T012)
4. Dev C: US3 forget_preference (after T004 ALS)

---

## Notes

- [P] = different files, no incomplete-task dependencies
- [USn] maps to spec user stories
- Learning reflector ≠ `withReflection` critique (`002`)
- MCP must **not** gain `forget_preference`
- Production LLM reflector is best-effort; automated SC uses fakes
- Avoid: awaiting remember before HTTP 200; putting `userId` in tool schema
