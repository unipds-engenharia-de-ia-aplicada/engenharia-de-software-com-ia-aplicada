# Tasks: War Room Web

**Input**: Design documents from `/specs/016-war-room-web/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — constitution + plan Decision 7; API `node:test` (CORS, 202, approvals); web Vitest + Testing Library (chat, trace, card, settings); sem rede LLM (fake strategies)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- API: `src/` at repository root
- War Room: `web/` (Vite + React + TS package)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold do pacote `web/` e stubs de borda HTTP sem comportamento completo

- [x] T001 Create Vite + React + TypeScript app scaffold under `web/` (`package.json`, `vite.config.ts` with `base: '/opspilot/'`, `tsconfig.json`, `index.html`, `src/main.tsx`)
- [x] T002 [P] Add root npm scripts `web:dev`, `web:build`, `web:test`, `web:typecheck` in root `package.json` delegating to `npm --prefix web`
- [x] T003 [P] Create stub `src/http/cors.ts` exporting `createCorsMiddleware(origins?: string[])` (no-op passthrough until US6)
- [x] T004 [P] Create stub `src/store/memory-approval-store.ts` with `MemoryApprovalStore` class implementing empty `save` / `get` / `take`
- [x] T005 [P] Create `web/src/styles/tokens.css` with semantic CSS variables (`--bg`, `--surface`, `--text`, `--muted`, `--border`, `--danger`, `--success`) + `color-scheme` dark/light per design instructions
- [x] T006 Configure Vitest + Testing Library in `web/package.json` / `web/vite.config.ts` (or `web/vitest.config.ts`) so `npm run web:test` runs

**Checkpoint**: `web/` sobe com `npm run web:dev`; stubs compilam

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos de domínio, schemas, deps HTTP, shell UI e cliente API tipado — **BLOCKS** all user stories

**⚠️ CRITICAL**: No user story work until this phase is complete

- [x] T007 Add `PendingApproval`, `ChatRequestSnapshot`, `ApprovalStore` interface (and related types) to `src/domain/types.ts` per `data-model.md`
- [x] T008 [P] Add `ApprovalNotFoundError` in `src/domain/errors.ts` with stable code for HTTP mapping
- [x] T009 [P] Extend `chatRequestSchema` with optional `awaitHumanApproval` (default `false`) in `src/http/chat-schema.ts`
- [x] T010 [P] Add `approvalIdParamSchema` and `approvalDecisionSchema` (`decision`, `userId`) in `src/http/chat-schema.ts`
- [x] T011 Extend `ChatAppDeps` in `src/http/server.ts` with optional `approvals?: ApprovalStore` and wire `createCorsMiddleware` placeholder early in `createApp` (still no-op OK)
- [x] T012 Implement `MemoryApprovalStore` (`save` / `get` / `take`) fully in `src/store/memory-approval-store.ts` per `data-model.md`
- [x] T013 [P] Create `web/src/api/types.ts` with zod schemas mirroring chat `200`/`202`, `TraceEvent`, and approval `200` responses per contracts
- [x] T014 [P] Create `web/src/api/config.ts` — load/save API base URL in `localStorage` (`opspilot.warRoom.apiBaseUrl`), default `http://localhost:3000`, normalize trailing slash
- [x] T015 Create `web/src/api/client.ts` with `postChat` / `postApproval` using `joinBase`, `AbortSignal`, and zod parse of responses (throw typed errors on contract mismatch)
- [x] T016 Create War Room shell `web/src/App.tsx` + import tokens in `web/src/main.tsx`: header “OpsPilot” + main landmark + empty slot for thread/composer (no full chat yet)
- [x] T017 [P] Create reusable `web/src/components/EmptyState.tsx` (title, message, optional action) per design instructions
- [x] T018 Run `npm run typecheck` and `npm run web:typecheck`; fix fallout from T007–T017

**Checkpoint**: Foundation ready — stories can start

---

## Phase 3: User Story 1 — Plantonista Conversa na War Room (Priority: P1) 🎯 MVP

**Goal**: Enviar mensagem via `POST /chat` e ver resposta no fio; empty/error states; loading + abort

**Independent Test**: Com client mock ou API + fake strategy — abrir War Room, enviar mensagem, ver bolha user + assistant; falha de rede mostra erro acionável

### Tests for User Story 1

> Write these tests FIRST; ensure they FAIL before implementation

- [x] T019 [P] [US1] Vitest: Composer submit calls `postChat` with `message` + `userId: "war-room"` in `web/src/components/Composer.test.tsx` (or colocated test)
- [x] T020 [P] [US1] Vitest: ChatThread renders empty state when no turns in `web/src/components/ChatThread.test.tsx`
- [x] T021 [P] [US1] Vitest: failed `postChat` shows inline error with retry affordance in `web/src/App.test.tsx` (or session hook test)

### Implementation for User Story 1

- [x] T022 [P] [US1] Implement `web/src/components/Composer.tsx` — labeled textarea, Enviar, Cancel/abort while sending, disabled when blocked prop set
- [x] T023 [P] [US1] Implement `web/src/components/ChatThread.tsx` — render turns (user/assistant), wire EmptyState for empty conversation
- [x] T024 [US1] Wire session state in `web/src/App.tsx`: append user turn → `postChat` → append assistant on `200`; map network/HTTP errors to inline error; support abort
- [x] T025 [US1] Persist/pass `conversationId` from successful responses into subsequent `postChat` calls in `web/src/App.tsx` / `web/src/api/client.ts`
- [x] T026 [US1] Handle `200` without `answer` as contract error (user-visible) in `web/src/api/client.ts` or `web/src/App.tsx`

**Checkpoint**: MVP — chat feliz funciona na War Room (mock ou API)

---

## Phase 4: User Story 2 — Ver Raciocínio / Trace Tipado (Priority: P1)

**Goal**: “Ver raciocínio” abre drawer/modal com eventos tipados; empty quando sem trace

**Independent Test**: Turno com `trace` mock → clique abre lista tipada; trace vazio → empty state explícito

### Tests for User Story 2

- [x] T027 [P] [US2] Vitest: TraceDrawer lists event `type` / `content` / `node` from props in `web/src/components/TraceDrawer.test.tsx`
- [x] T028 [P] [US2] Vitest: empty trace shows empty copy; Escape closes drawer in `web/src/components/TraceDrawer.test.tsx`

### Implementation for User Story 2

- [x] T029 [US2] Implement `web/src/components/TraceDrawer.tsx` — dialog/drawer, focus trap basics, Escape to close, restore focus, typed event rows (toolArgs collapsed/subordinate)
- [x] T030 [US2] Add “Ver raciocínio” control on assistant turns with `trace.length > 0` in `web/src/components/ChatThread.tsx`; open TraceDrawer for that turn
- [x] T031 [US2] When trace missing/empty and control shown or opened, show EmptyState “Sem eventos de raciocínio” per `contracts/war-room-ui.md`

**Checkpoint**: Auditoria visual do trace na UI

---

## Phase 5: User Story 3 — Aprovar / Negar (HTTP 202) (Priority: P1)

**Goal**: `awaitHumanApproval` → `202` + cartão; Aprovar/Negar via `POST /approvals/:id`; bloquear composer enquanto pending

**Independent Test**: API fake — `202` → card; approve → `200` answer; deny → cancelamento; segundo approve → `404`

### Tests for User Story 3

- [x] T032 [P] [US3] Unit tests: `MemoryApprovalStore` save/get/take and missing id in `src/store/memory-approval-store.test.ts`
- [x] T033 [P] [US3] HTTP test: `POST /chat` with `awaitHumanApproval: true` → `202` + `pending.approvalId` in `src/http/server.test.ts`
- [x] T034 [P] [US3] HTTP test: approve → `200` answer/trace; deny → cancelamento; unknown id → `404` in `src/http/server.test.ts`
- [x] T035 [P] [US3] Vitest: `202` renders ApprovalCard; pending disables composer in `web/src/components/ApprovalCard.test.tsx` / `web/src/App.test.tsx`

### Implementation for User Story 3

- [x] T036 [US3] In `src/http/server.ts` `POST /chat`: when `awaitHumanApproval`, save `PendingApproval` (summary ≤240 chars, snapshot without re-flag) and respond `202` per `contracts/chat-http.md` (no `runProductionTurn`)
- [x] T037 [US3] Implement `POST /approvals/:approvalId` in `src/http/server.ts`: validate schemas; `take` pending; approve → `runProductionTurn` → `200`; deny → cancelation payload per `contracts/approvals-http.md`; map `ApprovalNotFoundError` → `404`
- [x] T038 [US3] Map approval domain/validation errors in Express error middleware in `src/http/server.ts`; set `X-Request-Id` on approval responses
- [x] T039 [US3] Wire `MemoryApprovalStore` in `src/index.ts` into `createApp({ approvals })` and inject in `src/http/server.test.ts` harness
- [x] T040 [US3] Implement `web/src/components/ApprovalCard.tsx` — summary, Aprovar/Negar, status transitions, a11y labels
- [x] T041 [US3] Add “Exigir aprovação” toggle (default off) in `web/src/components/Composer.tsx`; pass `awaitHumanApproval` through `postChat`
- [x] T042 [US3] On `202` in `web/src/App.tsx`, render ApprovalCard, set pending, block composer; on decision call `postApproval` and append assistant turn / update card status

**Checkpoint**: Fluxo HITL completo API + UI

---

## Phase 6: User Story 4 — Engrenagem / URL da API (Priority: P2)

**Goal**: Configurar URL base da API via engrenagem; validar; persistir; próximas calls usam a URL

**Independent Test**: Salvar URL → próximo `postChat` usa nova base (assert no mock ou spy)

### Tests for User Story 4

- [x] T043 [P] [US4] Vitest: invalid URL shows field error and does not persist in `web/src/components/SettingsGear.test.tsx`
- [x] T044 [P] [US4] Vitest: save valid URL updates config used by client in `web/src/api/config.test.ts` or SettingsGear test

### Implementation for User Story 4

- [x] T045 [US4] Implement `web/src/components/SettingsGear.tsx` — gear button, dialog with labeled API URL field, Save/Cancel, Escape closes, `aria-describedby` for errors
- [x] T046 [US4] Wire SettingsGear into `web/src/App.tsx` header; on save refresh session `apiConfig` so `client` uses new baseUrl
- [x] T047 [US4] Ensure `joinBase` prevents double slashes (`http://host/` + `/chat`) in `web/src/api/client.ts`

**Checkpoint**: War Room apontável a qualquer host API sem rebuild

---

## Phase 7: User Story 5 — Base `/opspilot/` (Priority: P2)

**Goal**: App e assets carregam sob prefixo `/opspilot/`; reload não quebra

**Independent Test**: Abrir `/opspilot/` e recarregar — HTML/assets OK

### Tests for User Story 5

- [x] T048 [P] [US5] Assert `vite.config.ts` `base` is `'/opspilot/'` in a small node/vitest check under `web/` (e.g. `web/src/basepath.test.ts` reading config export or constant)

### Implementation for User Story 5

- [x] T049 [US5] Verify `web/vite.config.ts` `base: '/opspilot/'` and that `web/index.html` / asset URLs resolve under prefix; fix Router/`BrowserRouter` basename if introduced
- [x] T050 [US5] Document preview/static SPA fallback note if needed in `specs/016-war-room-web/quickstart.md` (only if gap found during verify)

**Checkpoint**: SC-005 satisfeito

---

## Phase 8: User Story 6 — CORS (Priority: P2)

**Goal**: API permite origem da War Room; preflight OPTIONS; chat + approvals cobertos

**Independent Test**: `OPTIONS /chat` com Origin allowlisted → `204` + ACAO; `POST` inclui ACAO; origin estranha não ecoa

### Tests for User Story 6

- [x] T051 [P] [US6] Unit/HTTP tests for allowlisted OPTIONS/POST and non-allowlisted Origin in `src/http/cors.test.ts` and/or `src/http/server.test.ts` per `contracts/cors.md`
- [x] T052 [P] [US6] HTTP test: `OPTIONS /approvals/:id` allowlisted includes POST in Allow-Methods in `src/http/server.test.ts`

### Implementation for User Story 6

- [x] T053 [US6] Implement `createCorsMiddleware` in `src/http/cors.ts` reading `OPSPILOT_CORS_ORIGINS` (default `http://localhost:5173`) per `contracts/cors.md`
- [x] T054 [US6] Ensure middleware is registered first in `createApp` in `src/http/server.ts` covering `/chat` and `/approvals/:id`
- [x] T055 [US6] Document `OPSPILOT_CORS_ORIGINS` in `.env.example` (create or update) and confirm quickstart curl scenario

**Checkpoint**: Browser War Room ↔ API sem bloqueio CORS

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Qualidade transversal, a11y/design, validação quickstart

- [x] T056 [P] Audit interactive controls (enviar, ver raciocínio, aprovar/negar, engrenagem) for visible focus, ≥44px targets, keyboard paths in `web/src/components/*.tsx`
- [x] T057 [P] Apply spacing scale (4px) and hierarchy pass across War Room components; respect `prefers-reduced-motion` in `web/src/styles/tokens.css` / components
- [x] T058 Run full suite: `npm run typecheck`, `npm test`, `npm run web:typecheck`, `npm run web:test` — fix failures
- [x] T059 Execute manual scenarios in `specs/016-war-room-web/quickstart.md` (SC-001–SC-007) and note gaps if any

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: After Foundational — MVP
- **US2 (Phase 4)**: After Foundational; naturally uses US1 thread (independently testable with mock turns)
- **US3 (Phase 5)**: After Foundational; UI integrates with US1 session (API path independently testable)
- **US4 (Phase 6)**: After Foundational; enhances client config used by US1/US3
- **US5 (Phase 7)**: After Setup vite base; verify anytime after Phase 1
- **US6 (Phase 8)**: After Foundational server wiring; needed for real browser E2E with separate origins
- **Polish (Phase 9)**: After desired stories complete

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories — MVP
- **US2 (P1)**: Can use mock turns without live chat; ideally after US1 for UX continuity
- **US3 (P1)**: API independent; UI needs session/composer from US1
- **US4 (P2)**: Independent with config unit tests; wire into App after US1
- **US5 (P2)**: Mostly config verify — parallel after Setup
- **US6 (P2)**: API-only deliverable; parallel with UI stories after Foundational

### Parallel Opportunities

- Phase 1: T002–T005 in parallel after T001 started
- Phase 2: T008–T010, T013–T014, T017 in parallel after T007
- US1 tests T019–T021 parallel; Composer/ChatThread T022–T023 parallel
- US2 tests T027–T028 parallel
- US3 tests T032–T035 parallel; after API T036–T039, UI T040–T042
- US4/US5/US6 largely parallel across developers once Foundational done
- Polish T056–T057 parallel

---

## Parallel Example: User Story 1

```bash
# Tests in parallel:
Task: "Vitest Composer submit → postChat in web/src/components/Composer.test.tsx"
Task: "Vitest ChatThread empty state in web/src/components/ChatThread.test.tsx"
Task: "Vitest failed postChat inline error in web/src/App.test.tsx"

# Components in parallel:
Task: "Implement Composer.tsx"
Task: "Implement ChatThread.tsx"
# Then wire App.tsx (T024)
```

---

## Parallel Example: User Story 3

```bash
# API tests + store tests in parallel:
Task: "memory-approval-store.test.ts"
Task: "server.test.ts 202 path"
Task: "server.test.ts approve/deny/404"

# Then implement API (T036–T039), then UI card + toggle (T040–T042)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 (chat)
4. **STOP and VALIDATE** — Independent Test US1
5. Demo War Room chat (CORS US6 recommended before real two-origin browser demo)

### Incremental Delivery

1. Setup + Foundational
2. US1 chat → MVP demo
3. US2 raciocínio
4. US3 202 approve/deny
5. US4 engrenagem
6. US5 base path verify + US6 CORS
7. Polish + quickstart

### Parallel Team Strategy

1. Team: Setup + Foundational together
2. Then:
   - Dev A: US1 → US2
   - Dev B: US3 API + UI
   - Dev C: US4 + US5 + US6
3. Integrate and polish

---

## Notes

- [P] = different files, no incomplete-task dependencies
- [USn] maps to spec user stories
- Commit after each task or logical group
- Prefer fake strategies in API tests; Vitest mocks `fetch` on web
- Toggle “Exigir aprovação” default **off**; quickstart turns it on for SC-003
- Avoid LangGraph interrupt — HITL is deferred request on HTTP boundary only
