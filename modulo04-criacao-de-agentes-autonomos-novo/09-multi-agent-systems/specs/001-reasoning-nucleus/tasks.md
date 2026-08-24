# Tasks: OpsPilot Reasoning Nucleus

**Input**: Design documents from `specs/001-reasoning-nucleus/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Included — required by constitution principle 5 ("Teste é parte da tarefa") and explicitly by SC-004 and SC-006.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[US#]**: Which user story this task belongs to (US1–US4)
- Exact file paths included in every description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure project skeleton, scripts, and TypeScript configuration are ready before any feature code.

- [X] T001 Add npm scripts `typecheck`, `test`, and `arena` to `package.json` (`tsc --noEmit`, `node --import tsx --test "src/**/*.test.ts"`, `tsx src/arena.ts`)
- [X] T002 [P] Verify `tsconfig.json` is configured for ESM strict mode: `"type": "module"`, `"strict": true`, `"moduleResolution": "NodeNext"` in `tsconfig.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain types, core store, LLM factory, and seed data — shared building blocks that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Define all domain types (`Alert`, `Incident`, `Service`, `TraceEvent`, `ExecutionMetrics`, `ReasoningStrategy` interface) in `src/domain/types.ts`
- [X] T004 [P] Define `IncidentNotFoundError` domain error class (`extends Error`, sets `this.name`) in `src/domain/errors.ts`
- [X] T005 [P] Implement `createModel()` factory reading `OPENROUTER_API_KEY` (throws if absent) and `OPENROUTER_MODEL` (defaults to `"openai/gpt-4o-mini"`) from `process.env`, returning a `ChatOpenAI` instance pointed at OpenRouter in `src/llm/factory.ts`
- [X] T006 Implement `InMemoryStore` class with `getAlerts(status?)`, `createIncident(data)` (generates `inc-<timestamp>-<random>` id), and `resolveIncident(id)` (throws `IncidentNotFoundError` if id not found) in `src/store/in-memory-store.ts`
- [X] T007 [P] Create `seedStore(store: IStore): void` function pre-loading 5 services and 6 alerts (3 `firing`: alert-001/payment-api/critical, alert-002/auth-service/high, alert-003/order-service/critical; 3 `resolved`: alert-004/inventory-api/medium, alert-005/notification-worker/high, alert-006/payment-api/medium) in `src/store/seed.ts`
- [X] T008 Write unit tests for all `InMemoryStore` operations: `getAlerts()` returns all 6, `getAlerts("firing")` returns exactly 3, `getAlerts("resolved")` returns exactly 3, `createIncident()` generates unique id, `resolveIncident()` transitions status to `"resolved"`, `resolveIncident()` throws `IncidentNotFoundError` for unknown id in `src/store/in-memory-store.test.ts`

**Checkpoint**: `npm test` passes for store tests; `npm run typecheck` exits 0 — user story implementation can now begin.

---

## Phase 3: User Story 1 — Detectar e escalar alertas ativos via agente (Priority: P1) 🎯 MVP

**Goal**: An engineer can ask "Quais alertas estão ativos?" and the ReAct agent queries the in-memory store, returns a natural-language answer listing the 3 firing services with severities, and produces a typed trace.

**Independent Test**: Run `tsx src/arena.ts --strategies react --input "Quais alertas estão ativos?"` against the seed store and verify the answer mentions `payment-api`, `auth-service`, and `order-service` and the trace contains `thought → action → observation → answer`.

### Implementation for User Story 1

- [X] T009 [US1] Implement `createListAlertsTool(store)` as `DynamicStructuredTool` with zod schema `{ status: z.enum(["firing","resolved"]) }`, returning formatted string per `contracts/tools.md` output spec in `src/tools/list-alerts.ts`
- [X] T010 [P] [US1] Implement `buildTraceFromMessages(messages: BaseMessage[]): TraceEvent[]` parsing `AIMessage` with `tool_calls` → `thought` + `action` events, `ToolMessage` → `observation` events, final `AIMessage` without `tool_calls` → `answer` event in `src/trace/builder.ts`
- [X] T011 [P] [US1] Write unit tests for `buildTraceFromMessages()` covering: correct `thought→action→observation→answer` sequence, `action` events carry `tool` name and `toolArgs`, final event is always type `answer` in `src/trace/builder.test.ts`
- [X] T012 [US1] Implement `ReactStrategy` class satisfying `ReasoningStrategy` interface: constructs `createReactAgent` from `@langchain/langgraph/prebuilt`, passes `{ recursionLimit: maxIterations * 3 }` in invoke config, catches `GraphRecursionError` and appends `answer` event with iteration-limit message in `src/strategies/react.ts`
- [X] T013 [P] [US1] Create `createTools(store: IStore): DynamicStructuredTool[]` barrel exporting `list_alerts` tool (open/resolve tools added in Phase 4) in `src/tools/index.ts`
- [X] T014 [US1] Implement `src/arena.ts` with argument parsing (`--strategies`, `--input`, `--max-iterations`), early exit on missing `OPENROUTER_API_KEY`, single-strategy execution loop, and formatted stdout per `contracts/arena-cli.md` (separator blocks, `── Trace ──`, `── Metrics ──`, `── Answer ──` sections) in `src/arena.ts`

**Checkpoint**: `npm run typecheck` exits 0; `npm test` green; `tsx src/arena.ts --strategies react --input "Quais alertas estão ativos?"` produces correct trace and answer — US1 is fully functional.

---

## Phase 4: User Story 2 — Abrir e resolver incidentes via agente (Priority: P1)

**Goal**: An on-call engineer can ask the agent to open a critical incident for `payment-api` and later resolve it by ID — all via natural language. `IncidentNotFoundError` is handled gracefully.

**Independent Test**: Run arena with `--input "Abra um incidente crítico para payment-api chamado 'Alta taxa de erros'"`, verify the answer includes a generated `inc-...` id; then run arena with `--input "Resolva o incidente inc-XXXX"` and verify the store state changes. Then run with a non-existent id and verify the agent reports "not found" without crashing.

### Implementation for User Story 2

- [X] T015 [P] [US2] Implement `createOpenIncidentTool(store)` as `DynamicStructuredTool` with zod schema `{ title: z.string().min(1), service: z.string().min(1), severity: z.enum([...]) }`, calling `store.createIncident()` and returning formatted confirmation with generated id per `contracts/tools.md` in `src/tools/open-incident.ts`
- [X] T016 [P] [US2] Implement `createResolveIncidentTool(store)` with zod schema `{ id: z.string().min(1) }`, calling `store.resolveIncident()`, catching `IncidentNotFoundError` and returning error string to the agent (not throwing to graph) per `contracts/tools.md` in `src/tools/resolve-incident.ts`
- [X] T017 [US2] Extend `createTools()` in `src/tools/index.ts` to include `createOpenIncidentTool(store)` and `createResolveIncidentTool(store)` alongside `list_alerts`

**Checkpoint**: Arena with `--strategies react` handles open-incident and resolve-incident queries; resolving unknown id returns graceful error message; no process crash.

---

## Phase 5: User Story 3 — Comparar estratégias de raciocínio na arena (Priority: P2)

**Goal**: A developer can run `tsx src/arena.ts --strategies react,plan-and-execute` and see two labeled strategy blocks side-by-side with independent traces and metrics. `--max-iterations 3` caps both strategies.

**Independent Test**: Run `tsx src/arena.ts --strategies react,plan-and-execute --input "Quais serviços têm alertas ativos?"` and verify two separator blocks appear, the P&E trace contains at least one `[plan]` event, both traces end with `[answer]`, and both metrics blocks show `llmCalls` and `latencyMs`.

### Implementation for User Story 3

- [X] T018 [US3] Implement `PlanExecuteStrategy` as `StateGraph` with `Annotation.Root` state (`input`, `plan`, `pastSteps`, `response`, `trace`): planner node (LLM → `string[]` step list → emits `plan` TraceEvent), executor node (`createReactAgent` sub-graph for one step → emits `action`/`observation` TraceEvents), replanner node (LLM → revised plan or final answer → emits `critique` TraceEvent if revised, `answer` TraceEvent if done; truncates plan to max 8 steps) in `src/strategies/plan-execute.ts`
- [X] T019 [P] [US3] Extend `buildTraceFromMessages()` in `src/trace/builder.ts` (or add `buildPlanExecuteTrace()` helper) to reconstruct `plan`, `critique`, and `answer` TraceEvents from Plan-and-Execute state transitions
- [X] T020 [US3] Extend `src/arena.ts` to iterate over all values in `--strategies` flag (comma-separated), pass `maxIterations` to each strategy constructor, and print per-strategy separator blocks per `contracts/arena-cli.md`; exit with code 1 if any strategy errored

**Checkpoint**: Both strategies run on the same input; P&E trace includes `[plan]` event; `--max-iterations 3` terminates strategies correctly; exit code 0 on success.

---

## Phase 6: User Story 4 — Rastrear o raciocínio passo a passo (Priority: P2)

**Goal**: A developer inspecting the trace can see every step typed correctly (`thought`, `action` with tool name+args, `observation`, `plan`, `critique`, `answer`) for both strategies, with action events carrying exact tool name and arguments.

**Independent Test**: Run any arena command and verify: ReAct trace sequence is `thought → action → observation → ... → answer`; P&E trace includes `plan` event with step list and `action`/`observation` pairs; every `action` line in the output shows tool name and serialized args; final event is always `answer`.

### Implementation for User Story 4

- [X] T021 [US4] Verify and fix arena trace display in `src/arena.ts` to render action events as `[action]  <toolName>(<JSON args>)` format, matching `contracts/arena-cli.md` output spec exactly
- [X] T022 [P] [US4] Write unit tests for Plan-and-Execute trace sequences: `plan → action → observation → answer` baseline, `plan → action → observation → critique → action → observation → answer` with replanning, and that `action` events always carry `tool` and `toolArgs` fields in `src/trace/builder.test.ts`

**Checkpoint**: All unit tests pass for both ReAct and P&E trace sequences; action events show tool name and args in arena output.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Bootstrap wiring, edge case hardening, and final validation pass.

- [X] T023 [P] Update `src/index.ts` server bootstrap to instantiate `InMemoryStore`, call `seedStore()`, and re-export strategies for future HTTP layer; add early-exit guard for missing `OPENROUTER_API_KEY`
- [X] T024 [P] Run all quickstart.md validations locally (Validations 1–10) and fix any discrepancies in any `src/` file
- [X] T025 Confirm `npm run typecheck` exits 0 and `npm test` passes 100% with no network calls, satisfying SC-004 and SC-006

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └── Phase 2 (Foundational) — BLOCKS all user stories
        ├── Phase 3 (US1 — P1) 🎯 MVP
        │     └── Phase 4 (US2 — P1)
        │           └── Phase 5 (US3 — P2)
        │                 └── Phase 6 (US4 — P2)
        │                       └── Phase 7 (Polish)
        └── [Phase 3+ can proceed in parallel once Phase 2 is done]
```

### User Story Dependencies

| Story | Depends on | Notes |
|-------|-----------|-------|
| US1 (P1) | Phase 2 | Reference implementation; ReactStrategy and arena MVP |
| US2 (P1) | Phase 2 + US1 arena | Adds tools to existing strategy; arena already exists |
| US3 (P2) | US1 + US2 complete | PlanExecuteStrategy needs all 3 tools registered |
| US4 (P2) | US1 + US3 | Trace validation for both strategies |

### Within Each Phase

- T003 → T006 (InMemoryStore needs domain types)
- T003 → T007 (seed needs domain types)
- T009 → T013 (tools barrel needs tools defined)
- T012 → T014 (arena needs ReactStrategy)
- T013 → T014 (arena needs tools barrel)
- T015, T016 → T017 (barrel extension needs both tools)
- T018 → T020 (arena multi-strategy needs PlanExecuteStrategy)
- T019 → T022 (P&E trace tests need builder extension)

### Parallel Opportunities

**Phase 2** (after T003): T004, T005, T007 can run in parallel  
**Phase 3**: T010 and T011 (trace builder + tests) can run in parallel with T009 (list-alerts tool)  
**Phase 4**: T015 and T016 (open/resolve tool implementations) can run in parallel  
**Phase 6**: T021 and T022 can run in parallel  
**Phase 7**: T023 and T024 can run in parallel  

---

## Parallel Example: User Story 1

```bash
# These three tasks have no shared file — launch simultaneously:
Task T009: "Implement createListAlertsTool() in src/tools/list-alerts.ts"
Task T010: "Implement buildTraceFromMessages() in src/trace/builder.ts"
Task T013: "Create createTools() barrel in src/tools/index.ts"

# Then T011 (trace tests) can start alongside T012 (ReactStrategy)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T008) — **CRITICAL BLOCKER**
3. Complete Phase 3: US1 (T009–T014) — ReAct + list-alerts + arena baseline
4. **STOP AND VALIDATE**: `tsx src/arena.ts --strategies react --input "Quais alertas estão ativos?"`
5. Complete Phase 4: US2 (T015–T017) — add open/resolve tools
6. **STOP AND VALIDATE**: open-incident + resolve-incident flows
7. Deploy/demo operational MVP

### Incremental Delivery

1. Setup + Foundational → `npm test` green
2. + US1 → agent lists alerts, trace works → **Demo**
3. + US2 → agent opens/resolves incidents → **Demo**
4. + US3 → arena compares both strategies → **Demo**
5. + US4 → full trace observability validated → **Demo**

### Parallel Team Strategy

With 2 developers after Phase 2 completes:
- **Dev A**: T009 → T012 → T014 (tools + ReactStrategy + arena baseline)
- **Dev B**: T010 → T011 (trace builder + tests)

After US1 checkpoint:
- **Dev A**: T015 + T016 → T017 (open/resolve tools)
- **Dev B**: T018 + T019 (PlanExecuteStrategy + P&E trace)

---

## Notes

- `[P]` = task works on a different file from its siblings — safe to parallelize
- `[US#]` maps each task to its user story for traceability and independent delivery
- Constitution principle 5: no logic merged without its test — every new behavior has a companion test
- Commit after each task or logical pair (principle 8: "pequeno e reversível")
- Tests for store and trace builder run with `npm test` — **zero network calls** (SC-004, SC-006)
- `OPENROUTER_API_KEY` loaded via `node --env-file .env` at runtime; never hardcoded (principle 6)
