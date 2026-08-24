# Tasks: ContextBuilder com Orçamento por Seção

**Input**: Design documents from `/specs/012-context-builder-budget/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — FR-009 / SC-001–SC-004; tetos baixos; ordem de corte; sem rede LLM

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold do módulo ContextBuilder sem lógica ainda

- [x] T001 Create `src/context/context-builder.ts` with exported stubs: `DEFAULT_SECTION_BUDGETS`, `SectionBudgets`, `ContextBuildInput`, `ContextBuildResult`, `resolveSectionBudgets`, `buildContext` (throw or identity passthrough)
- [x] T002 [P] Create `src/context/context-builder.test.ts` with a single smoke import/`describe` placeholder so the file is picked up by `npm test`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos, defaults e resolução de env — bloqueia todas as stories

**⚠️ CRITICAL**: No user story work until this phase is complete

- [x] T003 Implement `DEFAULT_SECTION_BUDGETS` (`summary: 200`, `window: 1200`, `memories: 300`) and `resolveSectionBudgets(overrides?, env?)` in `src/context/context-builder.ts` per `contracts/context-builder.md` (invalid/non-finite → default; `≤0` kept as-is for empty-section semantics)
- [x] T004 [P] Unit tests for `resolveSectionBudgets` (defaults, valid env, invalid env, overrides win, `≤0`) in `src/context/context-builder.test.ts`
- [x] T005 Optionally export shared types from `src/domain/types.ts` only if other modules need them; otherwise keep types local to `src/context/context-builder.ts`
- [x] T006 Run `npm run typecheck` to confirm stubs compile

**Checkpoint**: Budgets resolvem de forma testável — stories podem começar

---

## Phase 3: User Story 1 — Montagem Única do Prompt (Priority: P1) 🎯 MVP

**Goal**: Um único `buildContext` monta system / summary / window / memories / message e produz `enrichedMessage` + `history` para todas as strategies via `runChat`

**Independent Test**: Chamar `buildContext` com fixtures e assertar envelope canônico; `runChat` com strategy fake recebe `message`/`history` vindos do builder (sem enrich ad hoc restante)

### Tests for User Story 1

> Write these tests FIRST; ensure they FAIL before implementation

- [x] T007 [P] [US1] Tests: `buildContext` omits empty summary/memories/history blocks; always keeps system + raw message; `enrichedMessage` order is summary → memories → current in `src/context/context-builder.test.ts`
- [x] T008 [P] [US1] Test: `runChat` strategy fake sees builder output (capture `StrategyRunInput`) in `src/chat/compose-prompt.test.ts`

### Implementation for User Story 1

- [x] T009 [US1] Implement assemble path in `buildContext` in `src/context/context-builder.ts`: copy system/message; format `historyText`/`memoriesText`/`summaryText`; build `enrichedMessage` using `formatSummaryForPrompt` / memories envelope (move or import helpers from `src/chat/run-chat.ts` / `src/chat/history-summarizer.ts`); no cuts yet (pass-through sections)
- [x] T010 [US1] Wire `runChat` in `src/chat/run-chat.ts` to call `buildContext` after `lastMessages` + `getSummary` + `recall`; pass `built.enrichedMessage` and `built.history` to `strategy.run`; remove duplicate enrich (`formatMemoriesForPrompt` + `formatSummaryForPrompt` inline)
- [x] T011 [US1] Re-export or keep `formatMemoriesForPrompt` from `src/chat/run-chat.ts` for existing tests that import it; update callers if signature/location changes
- [x] T012 [US1] Confirm ReAct / plan-execute / reflect still compile against `StrategyRunInput` with no strategy-file budget logic (`src/agents/react.ts`, `src/strategies/plan-execute.ts`, `src/strategies/reflect.ts`)

**Checkpoint**: MVP — composição unificada no caminho `/chat`; budgets ainda pass-through

---

## Phase 4: User Story 2 — Tetos por Seção Configuráveis (Priority: P1)

**Goal**: Aplicar `CONTEXT_BUDGET_*` (defaults 200/1200/300); system e mensagem intocáveis

**Independent Test**: Com budgets default e conteúdos que cabem, seções opcionais ≤ tetos; system/message longos permanecem íntegros

### Tests for User Story 2

- [x] T013 [P] [US2] Tests: defaults enforce `estimateTokens(summary) ≤ 200`, history ≤ 1200, memories ≤ 300 in `src/context/context-builder.test.ts`
- [x] T014 [P] [US2] Tests: custom `options.budgets` / env overrides; system + message unchanged when optional budgets are tiny in `src/context/context-builder.test.ts`

### Implementation for User Story 2

- [x] T015 [US2] Apply `resolveSectionBudgets` inside `buildContext` in `src/context/context-builder.ts`; truncate summary to budget (`slice(0, budget * 4)`); if budget ≤ 0 set summary to `""`
- [x] T016 [US2] Enforce window/memories budgets at least as “empty if ≤0” and “truncate sole item if over” scaffolding in `src/context/context-builder.ts` (full drop-order algorithms land in US3 if not already complete)
- [x] T017 [US2] Document env names in a short comment atop `DEFAULT_SECTION_BUDGETS` in `src/context/context-builder.ts` matching `contracts/context-builder.md`

**Checkpoint**: Tetos configuráveis ativos; system/message intocáveis

---

## Phase 5: User Story 3 — Cortes Determinísticos na Ordem Certa (Priority: P1)

**Goal**: Janela dropa mais antigas; memórias dropam menor score (empate → maior índice); resumo já truncado; tudo simultâneo com tetos baixos

**Independent Test**: Fixtures com tetos baixos — assertar exatamente quais msgs/memórias/trechos sobrevivem

### Tests for User Story 3

- [x] T018 [P] [US3] Tests: window drops oldest first; sole oversized message content truncated in `src/context/context-builder.test.ts`
- [x] T019 [P] [US3] Tests: memories drop lowest score first; score tie drops higher input index; sole oversized fact truncated in `src/context/context-builder.test.ts`
- [x] T020 [P] [US3] Test: low ceilings on all optional sections apply simultaneously without touching system/message in `src/context/context-builder.test.ts`

### Implementation for User Story 3

- [x] T021 [US3] Implement window cut loop in `src/context/context-builder.ts` per research (while over budget and length > 1 drop `history[0]`; else truncate remaining `content`)
- [x] T022 [US3] Implement memories cut loop in `src/context/context-builder.ts` per research (drop lowest score / higher index on tie; truncate sole `fact`)
- [x] T023 [US3] Ensure `historyMessages` / `recalledMemories` / `historyText` / `memoriesText` / `summaryText` on `ContextBuildResult` reflect **post-cut** state in `src/context/context-builder.ts`

**Checkpoint**: Ordem de corte determinística e testada

---

## Phase 6: User Story 4 — Testes de Orçamento + Métricas Pós-Corte (Priority: P1)

**Goal**: Suíte completa sem rede; métricas `/chat` refletem o que entrou no prompt após orçamento (FR-010)

**Independent Test**: `npm test` cobre builder + runChat/HTTP métricas; `npm run typecheck` verde

### Tests for User Story 4

- [x] T024 [P] [US4] Tests: content that already fits is not removed (regression) in `src/context/context-builder.test.ts`
- [x] T025 [US4] Update `src/chat/compose-prompt.test.ts` so `historyMessages`, `recalledMemories`, and `contextBreakdown` assert **post-budget** values when low budgets are injected via `buildContext` options (or testable hook)
- [x] T026 [P] [US4] Update/add HTTP assertion in `src/http/server.test.ts` that `contextBreakdown` optional sections respect defaults (or document harness env) per `contracts/chat-http.md`

### Implementation for User Story 4

- [x] T027 [US4] In `src/chat/run-chat.ts`, set `metrics.historyMessages` / `recalledMemories` / `buildContextBreakdown(...)` from **builder result** texts (post-cut), not pre-cut recall/history
- [x] T028 [US4] If `runChat` needs injectable budgets for tests, add optional `budgets?: Partial<SectionBudgets>` on `RunChatOptions` in `src/chat/run-chat.ts` and forward to `buildContext`

**Checkpoint**: FR-009/FR-010 satisfeitos; quickstart cenários 1–6 cobertos

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Fechamento e validação rápida

- [x] T029 [P] Tick SC checklist items in `specs/012-context-builder-budget/quickstart.md`
- [x] T030 Run full `npm test` and `npm run typecheck`; fix any regressions from enrich refactor
- [x] T031 [P] Grep for leftover ad-hoc summary/memories enrich outside `context-builder` / intentional re-exports; remove dead paths in `src/chat/run-chat.ts` if any

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP composition
- **US2 (Phase 4)**: Depends on US1 assemble path (needs `buildContext` body)
- **US3 (Phase 5)**: Depends on US2 budget plumbing (uses same resolve path)
- **US4 (Phase 6)**: Depends on US3 cuts + US1 `runChat` wire
- **Polish (Phase 7)**: Depends on US4

### User Story Dependencies

- **US1**: After Foundational — no dependency on US2–US4
- **US2**: After US1 implementation (T009+)
- **US3**: After US2 budget application
- **US4**: After US3 + runChat metrics wire; consolidates acceptance tests

### Within Each Story

- Tests (marked) written first and failing before implementation
- Pure builder logic before `runChat` integration
- Metrics last (need post-cut result)

### Parallel Opportunities

- T001 ∥ T002 (setup files)
- T004 after T003; T005 ∥ T004
- T007 ∥ T008 (US1 tests)
- T013 ∥ T014 (US2 tests)
- T018 ∥ T019 ∥ T020 (US3 tests)
- T024 ∥ T026 (US4 tests)
- T029 ∥ T031 (polish)

---

## Parallel Example: User Story 3

```bash
# Launch US3 cut-order tests together:
Task: "Tests: window drops oldest first in src/context/context-builder.test.ts"
Task: "Tests: memories drop lowest score first in src/context/context-builder.test.ts"
Task: "Test: low ceilings on all optional sections in src/context/context-builder.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup + Phase 2 Foundational
2. Phase 3 US1 — unified `buildContext` + `runChat` wire
3. **STOP and VALIDATE**: strategy fake receives builder envelope
4. Then US2 → US3 → US4 for budgets/cuts/metrics

### Incremental Delivery

1. Setup + Foundational → env/budgets resolve
2. US1 → single composer (MVP)
3. US2 → configurable ceilings
4. US3 → deterministic cut order
5. US4 → metrics + full suite
6. Polish → quickstart + green CI

### Parallel Team Strategy

With two developers after Foundational:

- Dev A: US1 wire (`run-chat.ts`) after T009 API stabilizes
- Dev B: US1–US3 builder algorithms + `context-builder.test.ts`

---

## Notes

- [P] = different files, no incomplete-task dependencies
- Arena/bench calling `strategy.run` without `runChat` stay out of scope (research Decision 5)
- `SUMMARY_TOKEN_TARGET` (150) ≠ `CONTEXT_BUDGET_SUMMARY` (200) — do not conflate
- Commit after each task or logical group
- Avoid reintroducing enrich logic in strategies
- Implement shape: `section` → `fitToBudget` → `assemble` (user sketch); builder remains pure (I/O stays in `runChat`)
