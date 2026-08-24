# Tasks: Persistência Real de Operações

**Input**: Design documents from `/specs/004-sqlite-ops-store/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — FR-013/FR-014 e US3 exigem testes `:memory:` (seed, abrir/listar/resolver, filtros, CHECKs) e tools sobre SQLite sem rede; constitution princípio 5.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, tests colocated as `*.test.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repo hygiene and scaffolds for SQLite store per plan.md

- [x] T001 Add `data/` to `.gitignore` (FR-012)
- [x] T002 [P] Remove `mysql2` and `sequelize` from `package.json` and refresh lockfile (`npm install`) per constitution v2.0.0 / research Decisão 9
- [x] T003 [P] Scaffold `src/store/sqlite-ops-store.ts` with placeholder `export class SqliteOpsStore` accepting `path?: string` per `contracts/ops-store.md`
- [x] T004 [P] Create empty `src/store/sqlite-ops-store.test.ts` and `src/agents/tools.test.ts` importing `node:test` / `node:assert/strict` ready for US1–US3 cases

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Domain contract `OpsStore`, Mercadinho seed payload, and in-memory parity that ALL stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Extend domain in `src/domain/types.ts`: rename `IStore` → `OpsStore`; add `ServiceTier`, `tier` on `Service`, `summary` on `Incident`, `Runbook`, and full `OpsStore` methods (`seed`, `getIncidents`, `getRunbook`, `resolveIncident` with optional summary) per `data-model.md` / `contracts/ops-store.md`
- [x] T006 [P] Add `RunbookNotFoundError` to `src/domain/errors.ts` per `data-model.md`
- [x] T007 Rewrite `src/store/seed-data.json` to Mercadinho: 5 services with tiers (`checkout`, `payments`, `auth`, `catalog`, `inventory`), 6 alerts (3 firing / 3 resolved), 3 runbooks (`checkout`, `payments`, `auth`) per research Decisão 3
- [x] T008 Update `src/store/seed.ts`: zod schemas for tier + runbooks; `seedOpsStore(store: OpsStore)` calling `store.seed(...)` (remove `instanceof InMemoryStore`) per research Decisão 2/5
- [x] T009 Update `src/store/in-memory-store.ts` to implement `OpsStore` (runbooks map, filtered `getIncidents`, `getRunbook`, `resolveIncident(id, summary?)`, idempotent `seed`) per `contracts/ops-store.md`
- [x] T010 Update call sites / imports from `IStore` → `OpsStore` in `src/agents/tools.ts`, `src/store/in-memory-store.test.ts`, and any other `IStore` references; keep `src/bench.ts` and `src/arena.ts` on `InMemoryStore`
- [x] T011 Adjust `src/store/in-memory-store.test.ts` for new Mercadinho service names and `OpsStore` behaviors (getIncidents / getRunbook smoke) so foundation stays green
- [x] T012 Run `npm run typecheck` and confirm domain + in-memory + seed compile under `strict: true`

**Checkpoint**: Foundation ready — SQLite persistence and new tools can begin

---

## Phase 3: User Story 1 — Plantonista Mantém Estado Entre Reinícios (Priority: P1) 🎯 MVP

**Goal**: `SqliteOpsStore` persiste services/alerts/incidents/runbooks em arquivo (`OPSPILOT_DB`); seed Mercadinho idempotente; bootstrap de produção injeta SQLite.

**Independent Test**: `SqliteOpsStore(":memory:")` + seed → 5/6/3; create+resolve sobrevivem em reabrir o mesmo path de arquivo (smoke); `src/index.ts` usa `SqliteOpsStore`.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T013 [P] [US1] Test seed idempotente ×2: 5 services, 6 alerts (3 firing / 3 resolved), 3 runbooks; sem duplicar PKs in `src/store/sqlite-ops-store.test.ts` (SC-002)
- [x] T014 [P] [US1] Test createIncident → getIncidents(`open`) → resolveIncident → getIncidents(`resolved`) with `resolved_at` / `summary` in `src/store/sqlite-ops-store.test.ts` (SC-003)
- [x] T015 [P] [US1] Test getAlerts filters (`firing` / `resolved` / all) against seeded Mercadinho in `src/store/sqlite-ops-store.test.ts`

### Implementation for User Story 1

- [x] T016 [US1] Implement `SqliteOpsStore` in `src/store/sqlite-ops-store.ts`: open `DatabaseSync`, `mkdirSync` for file parents, idempotent DDL (4 tables + CHECKs) per `data-model.md`
- [x] T017 [US1] Implement prepared statements + methods `seed`, `getAlerts`, `getIncidents`, `createIncident`, `resolveIncident`, `getRunbook` in `src/store/sqlite-ops-store.ts` (no SQL concatenation) per `contracts/ops-store.md` / FR-007
- [x] T018 [US1] Expose internal `database` (or equivalent) on `SqliteOpsStore` for CHECK tests later per research Decisão 10
- [x] T019 [US1] Wire `bootstrapOpsPilot` / `src/index.ts` to construct `SqliteOpsStore(process.env.OPSPILOT_DB ?? "./data/opspilot.db")`, `seedOpsStore(store)`, and `createTools(store)` (FR-011)
- [x] T020 [US1] Run US1 cases in `src/store/sqlite-ops-store.test.ts` via `npm test` until green

**Checkpoint**: MVP — estado operacional persiste via SQLite; seed Mercadinho disponível

---

## Phase 4: User Story 2 — Agente Lista Incidentes e Consulta Runbooks (Priority: P2)

**Goal**: Tools `list_incidents` e `consultar_runbook`; todas as 5 tools em `src/agents/tools.ts` alinhadas às 6 regras (dívida `open_incident`).

**Independent Test**: Invocar tools contra `SqliteOpsStore(":memory:")` seedado — filtros de incidentes e runbook hit/miss sem rede.

### Tests for User Story 2 ⚠️

- [x] T021 [P] [US2] Tool test `list_incidents` default `open` + filtros `resolved` / `all` in `src/agents/tools.test.ts` (SC-005)
- [x] T022 [P] [US2] Tool test `consultar_runbook` hit (`payments`) and miss (serviço sem runbook → Error string) in `src/agents/tools.test.ts`
- [x] T023 [P] [US2] Tool regression: `list_alerts` / `open_incident` / `resolve_incident` still work on `:memory:` SQLite in `src/agents/tools.test.ts` (FR-014)

### Implementation for User Story 2

- [x] T024 [US2] Revise `list_alerts`, `open_incident`, `resolve_incident` in `src/agents/tools.ts`: descriptions with quando usar / quando não usar; `.describe()` on every field; enums; optional `summary` on resolve per `contracts/tools.md` / FR-010
- [x] T025 [P] [US2] Implement `createListIncidentsTool` in `src/agents/tools.ts` (`status` open|resolved|all, default open) per `contracts/tools.md` / FR-008
- [x] T026 [P] [US2] Implement `createConsultarRunbookTool` in `src/agents/tools.ts` (catch `RunbookNotFoundError` → Error string) per FR-009
- [x] T027 [US2] Update `createTools` in `src/agents/tools.ts` to return all 5 tools; add re-exports in `src/tools/` if needed (`list-incidents.ts`, `consultar-runbook.ts`, `index.ts`)
- [x] T028 [US2] Run US2 cases in `src/agents/tools.test.ts` via `npm test` until green

**Checkpoint**: Agente tem listagem de incidentes + runbooks; descrições passam nas 6 regras

---

## Phase 5: User Story 3 — Desenvolvedor Valida Persistência e Tools Sem Rede (Priority: P3)

**Goal**: CHECKs cobertos; suíte completa verde; bench/arena permanecem `InMemoryStore` para cenários reproduzíveis.

**Independent Test**: `npm test` + `npm run typecheck` verdes; INSERT inválido rejeitado; bench não depende de `./data/opspilot.db`.

### Tests for User Story 3 ⚠️

- [x] T029 [P] [US3] CHECK rejection tests (invalid `tier` / `severity` / `status`) via internal `database` prepare/run in `src/store/sqlite-ops-store.test.ts` (SC-004 / FR-013)
- [x] T030 [P] [US3] Assert `src/bench.ts` still constructs `InMemoryStore` + `seedOpsStore` (grep/smoke or lightweight test note); do not switch bench to SQLite file (SC-006)

### Implementation for User Story 3

- [x] T031 [US3] Confirm `src/arena.ts` remains on `InMemoryStore` + updated seed API per research Decisão 7; fix compile breaks from Mercadinho renames if any
- [x] T032 [US3] Fix any remaining compile/test fallout from service renames in `src/bench.ts` prompts/checks only if they hardcode old seed service names (keep C2 literal prompt names)
- [x] T033 [US3] Run full `npm test` and `npm run typecheck` until green (SC-006)

**Checkpoint**: Harness de desenvolvimento completo e reproduzível sem rede

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation against quickstart and final hygiene

- [x] T034 [P] Walk `specs/004-sqlite-ops-store/quickstart.md` checklist items (automated sections) and fix gaps
- [x] T035 [P] Optional file-persistence smoke doc note: same `OPSPILOT_DB` across restart (SC-001) — verify manually or with a short script comment in quickstart if not automated
- [x] T036 Final review: no SQL string concatenation in `src/store/sqlite-ops-store.ts`; `data/` ignored; five tools registered

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP persistence
- **User Story 2 (Phase 4)**: Depends on Foundational; practically after US1 so tools tests use real `SqliteOpsStore`
- **User Story 3 (Phase 5)**: Depends on US1 + US2 (CHECK + full suite)
- **Polish (Phase 6)**: Depends on stories intended for release

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on US2/US3
- **US2 (P2)**: Needs `SqliteOpsStore` + seed from US1 for `:memory:` tool tests; independently valuable once store exists
- **US3 (P3)**: Hardens US1/US2 with CHECK coverage and entrypoint guarantees

### Within Each User Story

- Tests FIRST (fail) → implementation → `npm test` green
- Domain/seed before SQLite methods
- Store before tools
- Tools before cross-entrypoint polish

### Parallel Opportunities

- T002, T003, T004 in Setup
- T006 parallel with T005 completion handoff; T007 after types exist
- T013–T015 US1 tests in parallel
- T021–T023 US2 tests in parallel
- T025–T026 tool implementations in parallel (same file — sequential if single agent)
- T029–T030 US3 tests in parallel
- T034–T035 polish in parallel

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests together (expect FAIL before T016–T018):
Task: "Test seed idempotente ×2 in src/store/sqlite-ops-store.test.ts"
Task: "Test create → list → resolve cycle in src/store/sqlite-ops-store.test.ts"
Task: "Test getAlerts filters in src/store/sqlite-ops-store.test.ts"
```

## Parallel Example: User Story 2

```bash
# Launch US2 tool tests together:
Task: "list_incidents filters in src/agents/tools.test.ts"
Task: "consultar_runbook hit/miss in src/agents/tools.test.ts"
Task: "existing tools on :memory: SQLite in src/agents/tools.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: `:memory:` seed + CRUD green; bootstrap uses SQLite
5. Demo/restart smoke with `OPSPILOT_DB` if desired

### Incremental Delivery

1. Setup + Foundational → `OpsStore` + Mercadinho in-memory
2. US1 → SQLite persistence (MVP)
3. US2 → new tools + 6-rule descriptions
4. US3 → CHECKs + full green suite + bench/arena guarantees
5. Polish → quickstart validation

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. After Foundational:
   - Dev A: US1 (`SqliteOpsStore`)
   - Dev B: can draft US2 tool schemas against `OpsStore` stubs (integrate after US1)
3. US3 after US1+US2 merge

---

## Notes

- [P] = different files, no incomplete-task dependencies
- [USn] maps to spec user stories
- Commit after each task or logical group (constitution princípio 8)
- Exact paths required in every task line
- Suggested MVP = Phase 1–3 only (US1)
