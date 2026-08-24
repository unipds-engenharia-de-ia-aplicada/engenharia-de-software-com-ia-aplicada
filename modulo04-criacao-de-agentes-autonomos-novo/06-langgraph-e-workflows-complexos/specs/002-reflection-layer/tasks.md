---
description: "Task list for Reflection Layer feature implementation"
---

# Tasks: Reflection Layer

**Input**: Design documents from `/specs/002-reflection-layer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — constitution principle 5 ("Teste é parte da tarefa") and SC-001 require a deterministic `node:test` suite covering approval, rejection+regeneration, `maxReflections` cap, and `maxReflections: 0`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, tests colocated as `*.test.ts` (matches `store/in-memory-store.test.ts`, `trace/builder.test.ts`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm project layout and create the reflection module scaffold

- [x] T001 Create empty module scaffold `src/strategies/reflect.ts` with placeholder exports matching `contracts/reflect-decorator.md` (`withReflection`, types `CriticFn`, `CritiqueResult`, `ReflectionOpts`)
- [x] T002 [P] Create empty test file scaffold `src/strategies/reflect.test.ts` importing `node:test` / `node:assert` ready for US1–US3 cases

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types and zod critique schema that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Extend `TraceEvent` in `src/domain/types.ts` with optional fields `round?: number`, `approved?: boolean`, `timestampMs?: number` (data-model.md — backward compatible)
- [x] T004 Define `critiqueSchema` (zod), export type `CritiqueResult`, type `CriticFn`, and interface `ReflectionOpts` in `src/strategies/reflect.ts` per `contracts/reflect-decorator.md` and `data-model.md`
- [x] T005 [P] Run `npm run typecheck` and confirm extended `TraceEvent` plus new reflect types compile under `strict: true` with no consumer breakages

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Reflection Decorator Melhora Resposta Insatisfatória (Priority: P1) 🎯 MVP

**Goal**: `withReflection(strategy, opts?)` wraps any `ReasoningStrategy`, runs critique→regenerate until approved or `maxReflections`, appends `critique` TraceEvents, and propagates base errors unchanged.

**Independent Test**: Mock base strategy + mock `critic`; assert double `run` on reject, single `run` on approve, `critique` events in trace, and no reflection when `maxReflections: 0`.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T006 [P] [US1] Test immediate approval (`approved: true`) — base called once, one `critique` event with `approved: true` — in `src/strategies/reflect.test.ts`
- [x] T007 [P] [US1] Test rejection then regeneration — base called twice, feedback prepended into second input, two `critique` events — in `src/strategies/reflect.test.ts`
- [x] T008 [P] [US1] Test `maxReflections` cap (default 2, critic always rejects) — base called 3 times, exactly 2 `critique` events with `round` 1 then 2 — in `src/strategies/reflect.test.ts`
- [x] T009 [P] [US1] Test `maxReflections: 0` pass-through — critic never called, no `critique` events — in `src/strategies/reflect.test.ts`
- [x] T010 [P] [US1] Test base strategy error propagates unmodified (FR-011) in `src/strategies/reflect.test.ts`
- [x] T011 [P] [US1] Test empty critic feedback injects `(sem feedback adicional)` preamble (contracts/reflect-decorator.md) in `src/strategies/reflect.test.ts`
- [x] T012 [P] [US1] Test decorated `name === "reflect:<base.name>"` (FR-008) in `src/strategies/reflect.test.ts`

### Implementation for User Story 1

- [x] T013 [US1] Implement feedback enrichment helper in `src/strategies/reflect.ts` that builds `[Critique - Round N]:\n{feedback}\n\nOriginal request:\n{original_input}` (empty feedback → `(sem feedback adicional)`)
- [x] T014 [US1] Implement `createLLMCritic(modelFactory)` in `src/strategies/reflect.ts` using `withStructuredOutput(critiqueSchema)` + try/catch fail-safe `{ approved: true, feedback: "" }` (FR-012, research Decisão 4)
- [x] T015 [US1] Implement `withReflection(strategy, opts?)` core loop in `src/strategies/reflect.ts`: resolve critic (`opts.critic` or LLM via `modelFactory`, or skip if neither and `maxReflections > 0` → behave as 0), run base, critique, append CritiqueEvent (`type: "critique"`, `content`, `round`, `approved`, `timestampMs`), regenerate until approved or cap (FR-001–FR-006, FR-010)
- [x] T016 [US1] Export public API from `src/strategies/reflect.ts`: `withReflection`, types `CriticFn`, `CritiqueResult`, `ReflectionOpts` (and `createLLMCritic` if used by Arena/tests)
- [x] T017 [US1] Run `npm test` for US1 cases in `src/strategies/reflect.test.ts` and fix until all green

**Checkpoint**: User Story 1 fully functional and independently testable (MVP)

---

## Phase 4: User Story 2 — Métricas Acumulam Chamadas de Reflexão (Priority: P2)

**Goal**: Final `StrategyResult.metrics.llmCalls` and `latencyMs` include all base regenerations plus critic calls (wall-clock external latency).

**Independent Test**: With mocks where each base run returns `llmCalls: 1` and each critic call counts as 1: immediate approval → `base + 1`; always-reject with `maxReflections: 2` → `5`.

### Tests for User Story 2 ⚠️

- [x] T018 [P] [US2] Test metrics on immediate approval: `llmCalls === base.llmCalls + 1` (SC-003) in `src/strategies/reflect.test.ts`
- [x] T019 [P] [US2] Test metrics on 1 reflection cycle: sum of both base runs + 2 critic calls in `src/strategies/reflect.test.ts`
- [x] T020 [P] [US2] Test metrics at `maxReflections: 2` always-reject: `llmCalls === 5` (3 base + 2 critic) in `src/strategies/reflect.test.ts`
- [x] T021 [P] [US2] Test `latencyMs` is wall-clock of full `run()` (`Date.now() - startedAt`), not sum of partials, in `src/strategies/reflect.test.ts`

### Implementation for User Story 2

- [x] T022 [US2] Implement metrics accumulation in `withReflection` inside `src/strategies/reflect.ts`: `llmCalls = Σ(base.metrics.llmCalls) + criticCallCount`; `latencyMs = Date.now() - startedAt` (research Decisão 6, FR-007)
- [x] T023 [US2] Ensure mock critics used in tests increment/count as 1 `llmCalls` each so SC-003 / US2 scenarios stay deterministic in `src/strategies/reflect.test.ts`
- [x] T024 [US2] Run `npm test` focusing on metrics assertions in `src/strategies/reflect.test.ts` until green

**Checkpoint**: User Stories 1 AND 2 both work independently with correct cost metrics

---

## Phase 5: User Story 3 — Arena Expõe Estratégias Refletidas via `--strategies` (Priority: P3)

**Goal**: Arena accepts `reflect:react` and `reflect:plan-and-execute`, instantiates `withReflection(base, { modelFactory: createModel })`, and compares them alongside base strategies.

**Independent Test**: Instantiate via Arena `createStrategy` path (or exported factory) and assert `name === "reflect:react"` / `"reflect:plan-and-execute"`.

### Tests for User Story 3 ⚠️

- [x] T025 [P] [US3] Test Arena/factory produces strategy with `name === "reflect:react"` wrapping React base (SC-005) in `src/strategies/reflect.test.ts`
- [x] T026 [P] [US3] Test Arena/factory produces strategy with `name === "reflect:plan-and-execute"` wrapping PlanExecute base (SC-005) in `src/strategies/reflect.test.ts`
- [x] T027 [P] [US3] Test `parseArgs` / valid names accept `reflect:react` and `reflect:plan-and-execute` and error message lists all four names when none valid — cover via unit test of exported helpers or thin Arena parse coverage in `src/strategies/reflect.test.ts` (or colocated arena test if preferred)

### Implementation for User Story 3

- [x] T028 [US3] Extend `StrategyName` union in `src/arena.ts` with `"reflect:react" | "reflect:plan-and-execute"` (contracts/arena-cli.md)
- [x] T029 [US3] Update `validNames` array and invalid-strategies error string in `parseArgs` inside `src/arena.ts` to include `reflect:react` and `reflect:plan-and-execute`
- [x] T030 [US3] Extend `createStrategy` in `src/arena.ts` to import `withReflection` from `src/strategies/reflect.ts` and return `withReflection(new ReactStrategy(...), { modelFactory: createModel })` / same for `PlanExecuteStrategy`
- [x] T031 [US3] Run `npm test` and `npm run typecheck` confirming Arena reflection names and US1–US2 suites remain green

**Checkpoint**: All three user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation across stories and quickstart checklist

- [x] T032 [P] Verify fail-safe path: when critic throws / invalid structured output, round treated as `approved: true` without crash — assert in `src/strategies/reflect.test.ts` (FR-012; may already be covered by T014 — close gaps if any)
- [x] T033 Run full `npm test` and `npm run typecheck` until both green (SC-001, SC-002)
- [x] T034 [P] Walk through `specs/002-reflection-layer/quickstart.md` unit-validation checklist (approval, 1 cycle, maxReflections, maxReflections:0, error propagate, empty feedback, fail-safe) against `src/strategies/reflect.test.ts`
- [x] T035 Optional manual smoke (requires `OPENROUTER_API_KEY`): `npm run arena -- --strategies react,reflect:react --input "..."` per quickstart.md §5 — document pass/fail only; do not block merge on live LLM

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP; no dependency on US2/US3
- **User Story 2 (Phase 4)**: Depends on Foundational + US1 core loop (metrics live inside `withReflection`)
- **User Story 3 (Phase 5)**: Depends on Foundational + US1 `withReflection` export; metrics (US2) nice-to-have but not required for name/instantiation tests
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Phase 2 — no other story deps
- **User Story 2 (P2)**: After US1 implementation of `withReflection` (extends same file for metrics)
- **User Story 3 (P3)**: After US1 export of `withReflection`; Arena wiring independent of US2 metrics assertions

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Types/helpers before core loop
- Core loop before metrics polish
- Decorator before Arena integration
- Story complete before next priority (or parallelize US2 metrics tests with US3 Arena once US1 lands)

### Parallel Opportunities

- T001 / T002 in Setup can run in parallel after agreement on export names
- T003 then T004 sequential (types before schema consumers); T005 after both
- All US1 test tasks T006–T012 marked [P] can be authored in parallel
- All US2 test tasks T018–T021 marked [P] can be authored in parallel
- All US3 test tasks T025–T027 marked [P] can be authored in parallel
- After US1 lands: Developer A finishes US2 metrics; Developer B does US3 Arena (different primary files: `reflect.ts` vs `arena.ts` — coordinate on shared test file)

---

## Parallel Example: User Story 1

```bash
# Author all US1 failing tests together:
Task: "T006 immediate approval in src/strategies/reflect.test.ts"
Task: "T007 rejection + regeneration in src/strategies/reflect.test.ts"
Task: "T008 maxReflections cap in src/strategies/reflect.test.ts"
Task: "T009 maxReflections: 0 in src/strategies/reflect.test.ts"
Task: "T010 base error propagation in src/strategies/reflect.test.ts"
Task: "T011 empty feedback preamble in src/strategies/reflect.test.ts"
Task: "T012 reflect:<name> naming in src/strategies/reflect.test.ts"

# Then implement sequentially:
Task: "T013 feedback enrichment helper in src/strategies/reflect.ts"
Task: "T014 createLLMCritic in src/strategies/reflect.ts"
Task: "T015 withReflection core loop in src/strategies/reflect.ts"
```

---

## Parallel Example: User Story 3

```bash
# After withReflection exists:
Task: "T025 reflect:react name test in src/strategies/reflect.test.ts"
Task: "T026 reflect:plan-and-execute name test in src/strategies/reflect.test.ts"
Task: "T028–T030 Arena StrategyName / validNames / createStrategy in src/arena.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (decorator + deterministic tests)
4. **STOP and VALIDATE**: `npm test` + independent mock scenarios from spec US1
5. Demo programmatic `withReflection(mockStrategy, { critic })` if ready

### Incremental Delivery

1. Setup + Foundational → types + schema ready
2. Add User Story 1 → decorator MVP → Deploy/Demo
3. Add User Story 2 → accurate cost metrics → Deploy/Demo
4. Add User Story 3 → Arena `--strategies reflect:*` → Deploy/Demo
5. Polish → quickstart + typecheck gate

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Once Foundational + US1 core are done:
   - Developer A: User Story 2 (metrics in `reflect.ts` + tests)
   - Developer B: User Story 3 (`arena.ts` + instantiation tests)
3. Stories integrate via shared `withReflection` export

---

## Notes

- [P] tasks = different concerns / can draft in parallel; watch shared file `src/strategies/reflect.test.ts` for merge conflicts
- [Story] label maps task to US1/US2/US3 for traceability
- Keep tests 100% deterministic — inject `critic` mocks; never call OpenRouter in unit tests
- Commit after each task or logical group (constitution: pequeno e reversível)
- Stop at any checkpoint to validate the story independently
- Do not modify `src/strategies/react.ts` or `src/strategies/plan-execute.ts` base implementations — decorator only
- Avoid: vague tasks, changing `ReasoningStrategy.run` signature, dynamic plugin registries
