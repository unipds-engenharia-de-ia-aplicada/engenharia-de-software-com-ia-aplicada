# Tasks: Modo Equipe (Supervisor + Papéis)

**Input**: Design documents from `/specs/018-team-mode/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — FR-015 / SC-001–SC-006; supervisor fake injetável, harness por papel, teto 8, contrato HTTP e drawer web; tudo sem rede LLM

**Organization**: Tasks grouped by user story for independent implementation and testing.

> **Status: concluído (as-built)**. Todas as 45 tarefas implementadas. Ajuste durante o implement (exemplo do usuário): sentinela de encerramento é `done` (tarefas abaixo dizem `finish`) e o `brief` do `done` carrega o resumo final — o nó de fechamento não faz chamada LLM (`finalize` removido); fallback determinístico usa o blackboard renderizado. Contratos e data-model sincronizados.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Include exact file paths in descriptions

## Path Conventions

- Backend: `src/` at repository root; SPA: `web/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold do módulo `src/team/` sem lógica ainda

- [X] T001 Create `src/team/blackboard.ts` with exported stubs: `BlackboardEntry`, `BlackboardKind` types and `renderBlackboard(entries)` (identity/join stub ok)
- [X] T002 [P] Create `src/team/supervisor-prompt.ts` exporting `SUPERVISOR_ROLE_TABLE` / `SUPERVISOR_SYSTEM_PROMPT` string constants (placeholder text)
- [X] T003 [P] Create `src/team/supervisor.ts` with exported stubs: `TEAM_ROLES`, `supervisorDecisionSchema`, `SupervisorDecision`, `DecideNextFn`, `createDecideNext` (throw `not implemented`)
- [X] T004 [P] Create `src/team/roles.ts` with exported stubs: `RoleRunner` interface, `createAnalistaRunner`, `createPlanejadorRunner`, `createExecutorRunner` (throw `not implemented`)
- [X] T005 [P] Create `src/team/team-graph.ts` (`MAX_HANDOFFS = 8`, `createTeamGraph` throw) and `src/team/team-strategy.ts` (`TeamStrategy` class stub, `name: "team"`)
- [X] T006 [P] Create smoke test files `src/team/supervisor.test.ts`, `src/team/roles.test.ts`, `src/team/team-graph.test.ts` with import-only asserts so `npm test` picks them up

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domínio do trace + tipos/schemas base — **BLOCKS** all user stories

**⚠️ CRITICAL**: No user story work until this phase is complete

- [X] T007 Extend `TraceEventType` with `"handoff"` and add optional `to?: string` to `TraceEvent` in `src/domain/types.ts` per `contracts/trace-handoff.md` (additive — no compile breaks expected)
- [X] T008 [P] Implement `BlackboardEntry` (`role`, `kind: "facts" | "plan" | "execution" | "error"`, `brief`, `content`) and `renderBlackboard` in `src/team/blackboard.ts` per `data-model.md`
- [X] T009 [P] Implement `TEAM_ROLES = ["analista", "planejador", "executor"]` + `supervisorDecisionSchema` (`z.object({ next: z.enum([...TEAM_ROLES, "finish"]), brief: z.string() })`) + `DecideNextFn` type in `src/team/supervisor.ts`
- [X] T010 [P] Fill `SUPERVISOR_ROLE_TABLE` (papel → quando delegar → o que entrega) + `SUPERVISOR_SYSTEM_PROMPT` in `src/team/supervisor-prompt.ts` (assertable: contains `analista`, `planejador`, `executor`, `finish`)
- [X] T011 Run `npm run typecheck` and fix any breakage from the new types

**Checkpoint**: Tipos, schema do supervisor e blackboard prontos; stories podem começar

---

## Phase 3: User Story 1 — Supervisor Coordena a Equipe sobre um Blackboard (Priority: P1) 🎯 MVP

**Goal**: Sub-grafo `src/team/team-graph.ts` executa o ciclo supervisor → papel → blackboard → supervisor → finish, com `decideNext`/`roleRunners`/`finalize` injetáveis e adapter `TeamStrategy`

**Independent Test**: `decideNext` fake com sequência fixa + role runners fakes; assertar ordem de execução, contribuições no blackboard e `answer` não vazio

### Tests for User Story 1

> Write these tests FIRST; ensure they FAIL before implementation

- [X] T012 [P] [US1] Test: fake `decideNext` sequence (analista → planejador → finish) runs role fakes in that order, each appending a `BlackboardEntry`, control returns to supervisor between roles, final `answer` non-empty in `src/team/team-graph.test.ts`
- [X] T013 [P] [US1] Test: `decideNext` receives current `blackboard` (grows between rounds); malformed decision / invalid `next` is treated as `finish` (controlled degradation, no throw) in `src/team/team-graph.test.ts`
- [X] T014 [P] [US1] Test: finish with empty blackboard still produces `answer` from original message; `finalize` failure degrades to deterministic concat of blackboard content in `src/team/team-graph.test.ts`
- [X] T015 [P] [US1] Test: role runner failure appends `kind: "error"` entry and returns control to supervisor (turn continues) in `src/team/team-graph.test.ts`

### Implementation for User Story 1

- [X] T016 [US1] Implement `TeamState` annotations (`message`, `blackboard` concat reducer, `handoffCount`, `currentBrief`, `nextRole`, `answer`, `trace` concat reducer, `llmCalls`) in `src/team/team-graph.ts` per `data-model.md`
- [X] T017 [US1] Implement supervisor node in `src/team/team-graph.ts`: injectable `decideNext` (default `createDecideNext`), `supervisorDecisionSchema` validation, malformed/invalid → `finish`, set `currentBrief`/`nextRole`
- [X] T018 [US1] Implement role dispatch nodes in `src/team/team-graph.ts`: injectable `roleRunners` per role, append returned `BlackboardEntry` + role trace, runner failure → `kind: "error"` entry, edge back to supervisor
- [X] T019 [US1] Implement finish node in `src/team/team-graph.ts`: injectable `finalize` (default: one LLM call with message + `renderBlackboard`), fallback deterministic concat on failure; wire edges `START→supervisor→(analista|planejador|executor|finish)`, roles→supervisor, `finish→END`
- [X] T020 [US1] Implement `createDecideNext(modelFactory)` in `src/team/supervisor.ts` using `withStructuredOutput(supervisorDecisionSchema)` + `parse`, prompt from `supervisor-prompt.ts`, input = message + rendered blackboard + handoffCount
- [X] T021 [US1] Implement `TeamStrategy` adapter in `src/team/team-strategy.ts`: `run(input)` invokes compiled team graph and returns `StrategyResult` (`answer`, `trace`, `metrics.llmCalls` aggregated supervisor+papéis+finish, `latencyMs`)

**Checkpoint**: MVP — ciclo de equipe completo e testável sem rede via fakes

---

## Phase 4: User Story 2 — Três Papéis com Poderes Distintos (Priority: P1)

**Goal**: Runners reais com partição **estrutural** de tools: analista (só leitura, entrega `facts`, não propõe), planejador (zero tools, entrega `plan`), executor (só incidentes, entrega `execution`)

**Independent Test**: Inspecionar `RoleRunner.tools` de cada papel (contrato estrutural) e o `kind` da entrada produzida com model fakes

### Tests for User Story 2

- [X] T022 [P] [US2] Test: tool sets by inspection — analista == {`list_alerts`, `list_incidents`, `consultar_runbook`, `check_provider_status`}, planejador == `[]`, executor == {`open_incident`, `resolve_incident`, `list_incidents`} in `src/team/roles.test.ts`
- [X] T023 [P] [US2] Test: with fake models, analista returns entry `kind: "facts"`, planejador returns `kind: "plan"` without any tool call, executor returns `kind: "execution"` with action/observation trace signed `node: "executor"` in `src/team/roles.test.ts`

### Implementation for User Story 2

- [X] T024 [US2] Implement `createAnalistaRunner({ modelFactory, tools })` in `src/team/roles.ts`: `createReactAgent` with read-only tools, low `recursionLimit` (reuse `ReactStrategy` pattern), prompt "fatos/diagnóstico, não proponha plano nem ações", trace via `buildTraceFromMessages(msgs, "analista")`, entry `kind: "facts"`
- [X] T025 [P] [US2] Implement `createPlanejadorRunner({ modelFactory })` in `src/team/roles.ts`: pure model call (no `createReactAgent`, no tools by signature), input = brief + rendered blackboard, entry `kind: "plan"`, trace `node: "planejador"`
- [X] T026 [P] [US2] Implement `createExecutorRunner({ modelFactory, tools })` in `src/team/roles.ts`: `createReactAgent` with incident tools only, domain errors surface as observations, entry `kind: "execution"`, trace `node: "executor"`
- [X] T027 [US2] Wire default role runners in `src/team/team-strategy.ts` (built from injected tool partitions + modelFactory when `roleRunners` not injected) keeping test injection path from US1 intact

**Checkpoint**: Papéis reais com restrição por construção; US1 + US2 funcionam juntos

---

## Phase 5: User Story 3 — Evento `handoff` Visível no "Ver raciocínio" (Priority: P1)

**Goal**: Cada decisão do supervisor emite `{ type: "handoff", node: "supervisor", to, content: brief }`; War Room renderiza no drawer

**Independent Test**: Turno fake com N decisões ⇒ N eventos `handoff` no trace; Vitest renderiza item handoff no `TraceDrawer`

### Tests for User Story 3

- [X] T028 [P] [US3] Test: N supervisor decisions ⇒ exactly N `handoff` events with `node: "supervisor"`, `to` ∈ {roles, "finish"}, `content` == brief; anomaly finish uses stable prefix `"decisão inválida do supervisor"` in `src/team/team-graph.test.ts`
- [X] T029 [P] [US3] Web test: `TraceDrawer` renders handoff item showing type `handoff`, `para: analista` and brief content; mixed turn (route + handoff + thought) renders all items in order in `web/src/components/TraceDrawer.test.tsx`

### Implementation for User Story 3

- [X] T030 [US3] Emit `handoff` TraceEvent per supervisor decision in `src/team/team-graph.ts` (delegação, finish voluntário, finish por anomalia com prefixo estável) per `contracts/trace-handoff.md`
- [X] T031 [P] [US3] Add `"handoff"` to `traceEventSchema` type enum + `to: z.string().optional()` in `web/src/api/types.ts`
- [X] T032 [US3] Render handoff item in `web/src/components/TraceDrawer.tsx`: destino em linha `para: {to}` (padrão visual das linhas `nó:`/`tool:`), brief como corpo; tokens semânticos e escala 4px per `.cursor/rules/design.mdc`

**Checkpoint**: Handoffs auditáveis ponta a ponta (trace + UI)

---

## Phase 6: User Story 4 — Rota `team` no Grafo de Produção (Priority: P2)

**Goal**: `team` como quarta rota: classificável pelo roteador, override via `strategy`, branch sem re-stamp de `node`, bootstrap com partições de tools; salvaguardas herdadas (sem bypass)

**Independent Test**: Classificador fake devolve `team` ⇒ nó team executa; `strategy: "team"` ⇒ override no evento `route`; `awaitHumanApproval` + team fica pendente

### Tests for User Story 4

- [X] T033 [P] [US4] Test: production graph with fake classifier returning `{ route: "team" }` runs the team strategy and the branch **preserves** role node names (`supervisor`/`analista`/... — no `stampNode("team")`) in `src/graph/production-graph.test.ts`
- [X] T034 [P] [US4] HTTP tests: `strategy: "team"` → `200` with `route` event `override: true` and `metrics.route === "team"`; unknown strategy still `422`; `awaitHumanApproval: true` + `strategy: "team"` → pending response with zero role execution (SC-004) in `src/http/server.test.ts`

### Implementation for User Story 4

- [X] T035 [US4] Add `"team"` to `PRODUCTION_ROUTES` and to `parseOverrideStrategy` in `src/graph/router.ts`; add `team` row to `ROUTER_DECISION_TABLE` in `src/graph/router-prompt.ts` ("investigação + plano + execução coordenadas / papéis distintos" → `team`); keep fallback `react`
- [X] T036 [US4] Add `team: ReasoningStrategy` to `ProductionStrategies`, `team` node + conditional edge in `src/graph/production-graph.ts`; team branch returns strategy trace **without** `stampNode` (per research R2); update router node route-validation allowlist to include `team`
- [X] T037 [US4] Bootstrap in `src/index.ts`: build analista/executor tool partitions with existing factories from `src/agents/tools.ts` (per `data-model.md` table), instantiate `TeamStrategy` with `createModel`, pass in `strategies`
- [X] T038 [US4] Verify `chatRequestSchema` accepts `"team"` by derivation from `PRODUCTION_ROUTES` (add assert in `src/http/server.test.ts`) and existing route tests stay green (no regression on `react`/`planExecute`/`reflect`)

**Checkpoint**: Modo equipe alcançável em produção via classificação e override

---

## Phase 7: User Story 5 — Teto de 8 Handoffs por Turno (Priority: P2)

**Goal**: `MAX_HANDOFFS = 8` como regra de domínio: aresta condicional força `finish` no teto, com handoff de encerramento identificável e resposta do blackboard

**Independent Test**: Supervisor fake que nunca encerra ⇒ turno termina controlado após exatamente 8 delegações

### Tests for User Story 5

- [X] T039 [P] [US5] Test: never-finishing fake supervisor ⇒ exactly 8 delegation handoffs (`to != "finish"`), then forced finish handoff with stable prefix `"teto de handoffs atingido"`, non-empty `answer`, no error in `src/team/team-graph.test.ts`
- [X] T040 [P] [US5] Test: natural finish before the cap ⇒ delegation handoff count reflects only real delegations (e.g. 2) in `src/team/team-graph.test.ts`

### Implementation for User Story 5

- [X] T041 [US5] Enforce `handoffCount` increment per delegation and conditional-edge force to `finish` when `handoffCount >= MAX_HANDOFFS` in `src/team/team-graph.ts`; size graph `recursionLimit` above the cap so `GraphRecursionError` never fires first (per research R9)
- [X] T042 [US5] Emit forced-finish handoff event (`to: "finish"`, prefixo `"teto de handoffs atingido"`) and produce answer from blackboard on cap in `src/team/team-graph.ts`

**Checkpoint**: Guardrail de custo/latência fechado; todas as stories funcionais

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Regressão zero + fechamento do quickstart

- [X] T043 [P] Add regression assert: turns on `react`/`planExecute`/`reflect` contain zero `handoff` events in `src/graph/production-graph.test.ts`
- [X] T044 Run `npm run typecheck`, `npm test` and `npm test --prefix web`; fix any regressions across `src/**` and `web/src/**`
- [X] T045 [P] Tick SC checklist items and validate manual scenarios (override curl, guardrail pendente, drawer) in `specs/018-team-mode/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP do ciclo com fakes
- **US2 (Phase 4)**: Depends on US1 (runners plugam no dispatch do grafo)
- **US3 (Phase 5)**: Depends on US1 (supervisor node existe); web tasks independentes do US2
- **US4 (Phase 6)**: Depends on US1 + US2 (bootstrap precisa de runners reais); testes HTTP de handoff ficam melhores após US3
- **US5 (Phase 7)**: Depends on US1 + US3 (handoff de teto usa o evento)
- **Polish (Phase 8)**: Depends on US1–US5

### User Story Dependencies

- **US1**: After Foundational — MVP; tudo injetável (sem rede)
- **US2**: After US1 — substitui fakes por runners reais com partição estrutural
- **US3**: After US1 — emissão no supervisor node + espelho web; can run in parallel with US2
- **US4**: After US2 (bootstrap) — integração produção/HTTP
- **US5**: After US3 — teto com evento identificável

### Within Each Story

- Tests written first and failing before implementation
- Graph core before adapters; adapters before bootstrap/HTTP
- Backend trace shape before web schema/render

### Parallel Opportunities

- T002 ∥ T003 ∥ T004 ∥ T005 ∥ T006 (setup files)
- T008 ∥ T009 ∥ T010 after T007
- T012 ∥ T013 ∥ T014 ∥ T015 (US1 tests)
- T022 ∥ T023 (US2 tests); T025 ∥ T026 after T024
- T028 ∥ T029 (US3 tests); T031 parallel with T030
- T033 ∥ T034 (US4 tests)
- T039 ∥ T040 (US5 tests)
- T043 ∥ T045 (polish)
- After US1: Dev A on US2 (roles), Dev B on US3 (handoff + web)

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests together (all in src/team/team-graph.test.ts but separate cases):
Task: "Test: fake decideNext sequence runs roles in order over blackboard"
Task: "Test: decideNext sees growing blackboard; malformed decision → finish"
Task: "Test: empty blackboard / finalize failure degrade controlled"
Task: "Test: role failure → kind error entry, control returns to supervisor"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup + Phase 2 Foundational
2. Phase 3 US1 — ciclo completo com `decideNext`/`roleRunners`/`finalize` fakes
3. **STOP and VALIDATE**: turno de equipe end-to-end sem rede
4. Then US2 → US3 → US4 → US5

### Incremental Delivery

1. Setup + Foundational → tipos `handoff` + schema supervisor + blackboard
2. US1 → ciclo supervisor⇄papéis (MVP)
3. US2 → papéis reais com partição estrutural de tools
4. US3 → handoffs auditáveis (trace + drawer)
5. US4 → rota `team` em produção (classificação + override + guardrail herdado)
6. US5 → teto 8 com encerramento forçado
7. Polish → regressão zero + quickstart

### Parallel Team Strategy

With two developers after US1:

- Dev A: US2 (`roles.ts` + partição de tools + testes estruturais)
- Dev B: US3 (emissão handoff + `web/src/api/types.ts` + `TraceDrawer`)
- Reconvene for US4 (integração produção) → US5 (teto)

---

## Notes

- [P] = different files, no incomplete-task dependencies
- Canonical node ids: `supervisor`, `analista`, `planejador`, `executor` (branch team não re-carimba — research R2)
- Prefixos estáveis de encerramento: `"teto de handoffs atingido"`, `"decisão inválida do supervisor"` (contracts/trace-handoff.md)
- Restrição de tools é estrutural (lista por papel), nunca prompt (FR-007)
- Sem salvaguarda nova: `awaitHumanApproval` cobre a rota `team` por herança da borda HTTP (research R6)
- Commit after each task or logical group
