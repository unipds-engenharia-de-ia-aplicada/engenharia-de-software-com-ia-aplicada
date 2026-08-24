# Tasks: Servidor MCP OpsPilot

**Input**: Design documents from `/specs/006-mcp-ops-server/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — FR-008 / US1 exigem teste de listagem de tools; US2 paridade de invoke; US3 ausência de `console.log`; constitution princípio 5.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, tests colocated as `*.test.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependências npm e scaffolds `src/mcp/` per plan.md / research Decisão 1 e 3

- [x] T001 Add `@modelcontextprotocol/sdk` dependency in `package.json` (and lockfile via `npm install`); bump `zod` to `^3.25.0` (or peer-satisfying range) if install requires it per research Decisão 1 / FR-009
- [x] T002 [P] Create directory `src/mcp/` and scaffold `src/mcp/create-server.ts` exporting stub `createOpsMcpServer(store: OpsStore): McpServer` (empty registrations OK) per plan structure
- [x] T003 [P] Scaffold `src/mcp/server.ts` entrypoint stub (no `console.log`; bootstrap TODO) and empty `src/mcp/server.test.ts` with `node:test` / `node:assert/strict` imports ready for US1–US3

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Exportar schemas zod compartilhados — bloqueia registro MCP e paridade com o agente

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Export `listAlertsSchema`, `openIncidentSchema`, and `resolveIncidentSchema` from `src/agents/tools.ts` (same object instances used by LangChain factories) per research Decisão 2 / FR-004 / `contracts/mcp-opspilot.md`
- [x] T005 Confirm existing `src/agents/tools.test.ts` still passes after schema exports (`npm test` subset / full) — no behavior change
- [x] T006 Run `npm run typecheck` and confirm scaffolds + exported schemas compile under `strict: true`

**Checkpoint**: Foundation ready — MCP factory, listagem, handlers e entrypoint podem começar

---

## Phase 3: User Story 1 — Cliente MCP Descobre as Ferramentas Operacionais (Priority: P1) 🎯 MVP

**Goal**: `createOpsMcpServer(store)` registra exatamente `list_alerts`, `open_incident`, `resolve_incident`; server name `opspilot`; teste in-memory valida `listTools`.

**Independent Test**: Client + InMemoryTransport → `listTools()` length 3 e nomes corretos; identidade `opspilot` — sem LLM/rede/stdio real.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T007 [P] [US1] Test `listTools` returns exactly `{ list_alerts, open_incident, resolve_incident }` via `createOpsMcpServer` + SDK Client/InMemoryTransport in `src/mcp/server.test.ts` (SC-001 / FR-008)
- [x] T008 [P] [US1] Test server identity name is `opspilot` (Client initialize / `getServerVersion` per SDK API) in `src/mcp/server.test.ts` (FR-002)

### Implementation for User Story 1

- [x] T009 [US1] Implement `createOpsMcpServer(store)` in `src/mcp/create-server.ts`: `new McpServer({ name: "opspilot", version })`; `registerTool` for the three names with shared schemas + descriptions from LangChain factories; stub handlers returning empty/placeholder text OK for list-only MVP per `contracts/mcp-opspilot.md` / research Decisão 2–3
- [x] T010 [US1] Wire test helpers in `src/mcp/server.test.ts` to use `SqliteOpsStore(":memory:")` + `seedOpsStore` (or minimal store) when constructing the server
- [x] T011 [US1] Run US1 cases via `npm test` until green (InMemoryTransport only; no child process)

**Checkpoint**: MVP — cliente MCP descobre o catálogo operacional mínimo

---

## Phase 4: User Story 2 — Mesmas Operações do Plantão via MCP (Priority: P1)

**Goal**: Handlers MCP delegam às factories LangChain (`.invoke`) — mesmos defaults, validação e efeitos no `OpsStore`.

**Independent Test**: Seeded store → MCP `list_alerts` / `open_incident` / `resolve_incident` espelham tools do agente; ID inexistente → `Error: ...` sem crash.

### Tests for User Story 2 ⚠️

- [x] T012 [P] [US2] Test MCP `list_alerts` (default firing) returns same observation shape as `createListAlertsTool(store).invoke(...)` on shared seeded store in `src/mcp/server.test.ts` (SC-002)
- [x] T013 [P] [US2] Test MCP `open_incident` creates incident in store and returns confirmation text in `src/mcp/server.test.ts`
- [x] T014 [P] [US2] Test MCP `resolve_incident` resolves known ID; unknown ID returns `Error: ...` text without throwing in `src/mcp/server.test.ts`

### Implementation for User Story 2

- [x] T015 [US2] Replace stub handlers in `src/mcp/create-server.ts` with delegation to `createListAlertsTool` / `createOpenIncidentTool` / `createResolveIncidentTool` `.invoke(args)` mapping string → `{ content: [{ type: "text", text }] }` per research Decisão 2 / FR-005
- [x] T016 [US2] Ensure tool `description` strings passed to `registerTool` match the LangChain tool descriptions (reuse from factories or shared constants) in `src/mcp/create-server.ts`
- [x] T017 [US2] Run US2 cases via `npm test` until green

**Checkpoint**: Paridade operacional agente ↔ MCP sobre o mesmo store

---

## Phase 5: User Story 3 — Stdio Seguro para Diagnóstico (Priority: P2)

**Goal**: Zero `console.log` / writes manuais em stdout em `src/mcp/**` de produção; diagnóstico só stderr.

**Independent Test**: Assert estático na fonte; falha de bootstrap documentada via `console.error`.

### Tests for User Story 3 ⚠️

- [x] T018 [P] [US3] Test/assert that production sources under `src/mcp/` (exclude `*.test.ts`) contain no `console.log` (read file or grep-style assert) in `src/mcp/server.test.ts` (SC-003 / FR-006)

### Implementation for User Story 3

- [x] T019 [US3] Audit `src/mcp/create-server.ts` and any helpers: remove accidental `console.log`; use `console.error` only if diagnostic needed
- [x] T020 [US3] In `src/mcp/server.ts` bootstrap error path: catch failures → `console.error(...)` + `process.exit(1)`; never log success/protocol on stdout (leave that to StdioServerTransport) per research Decisão 4
- [x] T021 [US3] Run US3 assert + `npm test` until green

**Checkpoint**: Canal stdio seguro para clientes MCP

---

## Phase 6: User Story 4 — Desenvolvedor Sobe o Server com um Comando (Priority: P3)

**Goal**: Script npm `mcp` sobe entrypoint com env; `SqliteOpsStore` + seed + stdio connect.

**Independent Test**: `package.json` script `mcp` aponta para `src/mcp/server.ts` com padrão env do repo; entrypoint conecta transport.

### Implementation for User Story 4

- [x] T022 [US4] Implement full entrypoint in `src/mcp/server.ts`: `SqliteOpsStore(process.env.OPSPILOT_DB ?? "./data/opspilot.db")`, `seedOpsStore`, `createOpsMcpServer`, `StdioServerTransport`, `connect`; `import.meta.url` / argv main guard like `src/index.ts` per research Decisão 3 / FR-001
- [x] T023 [US4] Add script `"mcp": "node --env-file-if-exists=.env --import tsx src/mcp/server.ts"` to `package.json` (SC-005 / FR-007)
- [x] T024 [US4] Spot-check quickstart.md §2: script exists and entrypoint compiles (`npm run typecheck`); optional manual `npm run mcp` smoke (stdio hang is expected without client)

**Checkpoint**: Um comando sobe o server MCP local

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Regressão do produto e fechamento do quickstart

- [x] T025 [P] Confirm `createTools` still registers all six LangChain tools and existing `src/agents/tools.test.ts` pass (MCP catálogo v1 ≠ agente) per FR-010 / quickstart §4
- [x] T026 [P] Confirm MCP catalog does **not** register `list_incidents`, `consultar_runbook`, or `check_provider_status` in `src/mcp/server.test.ts` / `create-server.ts`
- [x] T027 Run full `npm test` and `npm run typecheck` until green; tick quickstart.md checklist rows

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on US1 factory existing (handlers replace stubs in same file)
- **US3 (Phase 5)**: Can start after US1 scaffolds exist; ideally after US2 handlers landed; coordinates with `server.ts` paths touched in US4
- **US4 (Phase 6)**: Depends on `createOpsMcpServer` (US1/US2); entrypoint + npm script
- **Polish (Phase 7)**: Depends on US1–US4 desired scope

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on other stories
- **US2 (P1)**: After US1 registration API exists — extends same `create-server.ts`
- **US3 (P2)**: After mcp modules exist — assert + stderr bootstrap discipline
- **US4 (P3)**: After factory ready — entrypoint + script

### Within Each User Story

- Tests (where listed) MUST be written and FAIL before implementation
- Register tools before assert listTools green
- Handlers before parity invoke tests green
- Entrypoint after factory stable

### Parallel Opportunities

- T002 ‖ T003 (scaffolds diferentes)
- T007 ‖ T008 (testes US1)
- T012 ‖ T013 ‖ T014 (testes US2)
- T025 ‖ T026 (regressão polish)

---

## Parallel Example: User Story 1

```bash
# Tests US1 em paralelo:
Task: "Test listTools exact catalog in src/mcp/server.test.ts"
Task: "Test server name opspilot in src/mcp/server.test.ts"

# Depois implementação sequencial:
Task: "Implement createOpsMcpServer registrations in src/mcp/create-server.ts"
Task: "Wire :memory: store in src/mcp/server.test.ts"
Task: "npm test until US1 green"
```

---

## Parallel Example: User Story 2

```bash
# Tests US2 em paralelo (após stubs US1):
Task: "Test MCP list_alerts parity in src/mcp/server.test.ts"
Task: "Test MCP open_incident in src/mcp/server.test.ts"
Task: "Test MCP resolve_incident + missing id in src/mcp/server.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (deps + scaffolds)
2. Complete Phase 2: Export schemas
3. Complete Phase 3: US1 listTools + name `opspilot`
4. **STOP and VALIDATE**: `npm test` — discovery works
5. Demo catálogo MCP

### Incremental Delivery

1. Setup + Foundational → schemas compartilhados
2. US1 → listagem (MVP)
3. US2 → invoke paridade plantão
4. US3 → disciplina stdout/stderr
5. US4 → `npm run mcp` + entrypoint stdio
6. Polish → regressão agente + typecheck

### Parallel Team Strategy

1. Team: Setup + Foundational together
2. Dev A: US1 → US2 (`create-server.ts` + testes invoke)
3. Dev B: US3 asserts + US4 entrypoint/script (coordenar merges em `server.ts`)

---

## Notes

- [P] = different files, no incomplete-task dependencies
- [USn] maps to spec user stories
- Catálogo MCP v1 = exatamente 3 tools; agente continua com 6
- Sem `console.log` em `src/mcp/**` de produção
- Commit after each task or logical group
- Suggested MVP = Phase 1–3 (US1 only)
