# Tasks: Status de Provedores Externos

**Input**: Design documents from `/specs/005-provider-status-tool/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — FR-012 / US3 exigem fake fetch (sucesso, timeout, resposta inválida) sem rede; constitution princípio 5.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, tests colocated as `*.test.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffolds for the provider-status tool per plan.md (sem novas deps npm)

- [x] T001 [P] Scaffold `src/tools/check-provider-status.ts` with exported stubs: `FetchLike`, `PROVIDER_URLS`, `statusPageStatusSchema` placeholder, and `fetchProviderStatus` returning a TODO string per `contracts/check-provider-status.md`
- [x] T002 [P] Create empty `src/tools/check-provider-status.test.ts` importing `node:test` / `node:assert/strict` ready for US1–US3 cases
- [x] T003 [P] Add re-export placeholder comment or barrel prep in `src/tools/index.ts` (will export `createCheckProviderStatusTool` after US1 — do not break existing re-exports)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Mapa de provedores, schema zod do payload e contrato de opções de fetch que TODAS as stories usam

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Implement `PROVIDER_URLS` map (`github` → githubstatus.com, `cloudflare` → cloudflarestatus.com) and `ProviderId` type in `src/tools/check-provider-status.ts` per `data-model.md` / research Decisão 5
- [x] T005 [P] Implement `statusPageStatusSchema` (zod `{ status: { indicator, description } }` with passthrough) in `src/tools/check-provider-status.ts` per research Decisão 3
- [x] T006 [P] Define `FetchLike` and `FetchProviderStatusOptions` (`{ fetch?: FetchLike }`) with default `globalThis.fetch` documented in `src/tools/check-provider-status.ts` per research Decisão 1 / FR-011
- [x] T007 Export a thin `formatProviderStatus(indicator, description)` helper returning `` `${indicator} — ${description}` `` in `src/tools/check-provider-status.ts` per research Decisão 4
- [x] T008 Run `npm run typecheck` and confirm scaffolds + foundational types compile under `strict: true`

**Checkpoint**: Foundation ready — happy path, resiliência e testes podem começar

---

## Phase 3: User Story 1 — Plantonista Distingue Falha Interna de Provedor (Priority: P1) 🎯 MVP

**Goal**: Tool `check_provider_status` consulta statuspage, valida payload, retorna linha compacta; default `github`; registrada em `createTools`.

**Independent Test**: Fake fetch 200 + JSON válido → `indicator — description`; `createTools` inclui `check_provider_status`; omitir provider usa URL GitHub.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T009 [P] [US1] Test sucesso `github`: fake fetch 200 + JSON válido → string compacta `indicator — description` in `src/tools/check-provider-status.test.ts` (SC-001)
- [x] T010 [P] [US1] Test default provider omitido / `github` chama URL `https://www.githubstatus.com/api/v2/status.json` (assert URL no fake) in `src/tools/check-provider-status.test.ts`
- [x] T011 [P] [US1] Test `cloudflare` chama URL cloudflarestatus.com e formata retorno in `src/tools/check-provider-status.test.ts` (SC-005)

### Implementation for User Story 1

- [x] T012 [US1] Implement happy-path `fetchProviderStatus(provider, options?)` in `src/tools/check-provider-status.ts`: GET com `AbortSignal.timeout(5000)`, parse JSON, zod validate, return compact line (ainda sem retry completo — 2xx only; erros podem ser stub) per FR-004–FR-006 / FR-008–FR-009
- [x] T013 [US1] Implement `createCheckProviderStatusTool(options?)` in `src/agents/tools.ts`: schema zod `provider` enum default `github` + `.describe`; description com quando usar / quando não usar (6 regras) per `contracts/check-provider-status.md` / FR-001–FR-003
- [x] T014 [US1] Wire `createCheckProviderStatusTool()` into `createTools(store)` in `src/agents/tools.ts` (6ª tool); re-export from `src/tools/index.ts` (and optional `src/tools/check-provider-status.ts` barrel if needed)
- [x] T015 [US1] Assert `createTools` registers six tools including `check_provider_status` in `src/agents/tools.test.ts`
- [x] T016 [US1] Run US1 cases via `npm test` until green (fake fetch only)

**Checkpoint**: MVP — plantonista obtém status oficial compacto via tool do grafo

---

## Phase 4: User Story 2 — Falha Externa Vira Observação, Não Quebra o Grafo (Priority: P2)

**Goal**: Timeout 5s, 1 retry em rede/5xx/timeout; 4xx e validação sem retry; falha final → `Error: ...` sem throw.

**Independent Test**: Fake timeout → Error string + 2 calls; 5xx→200 → sucesso na 2ª; body inválido → Error sem 2ª tentativa; invoke não rejeita.

### Tests for User Story 2 ⚠️

- [x] T017 [P] [US2] Test timeout/Abort nas duas tentativas → `Error: ...` e exatamente 2 calls ao fake in `src/tools/check-provider-status.test.ts` (SC-002)
- [x] T018 [P] [US2] Test HTTP 5xx depois 200 → sucesso compacto na 2ª tentativa (1 retry) in `src/tools/check-provider-status.test.ts` (SC-003)
- [x] T019 [P] [US2] Test HTTP 4xx → `Error: ...` com exatamente 1 call (sem retry) in `src/tools/check-provider-status.test.ts`
- [x] T020 [P] [US2] Test 200 + body inválido (falha zod) → `Error: ...` sem retry in `src/tools/check-provider-status.test.ts` (SC-002)

### Implementation for User Story 2

- [x] T021 [US2] Complete retry loop in `fetchProviderStatus` in `src/tools/check-provider-status.ts`: max 2 attempts; retry only on network / AbortError-timeout / HTTP 5xx; new `AbortSignal.timeout(5000)` per attempt per research Decisão 2 / FR-006–FR-007
- [x] T022 [US2] Ensure all final failures resolve to `Error: ...` strings (never throw) in `src/tools/check-provider-status.ts` per FR-010 / research Decisão 4; wrap LangChain tool invoke so observation is always string
- [x] T023 [US2] Run US2 cases via `npm test` until green

**Checkpoint**: Falhas externas não quebram o grafo; retry transitório funciona

---

## Phase 5: User Story 3 — Desenvolvedor Testa Sem Rede (Priority: P3)

**Goal**: Suíte offline completa; fetch injetável documentado; regressão do catálogo; typecheck verde.

**Independent Test**: `npm test` + `npm run typecheck` verdes sem chamar statuspages reais; quickstart §1 coberto.

### Tests for User Story 3 ⚠️

- [x] T024 [P] [US3] Confirm all cases in `src/tools/check-provider-status.test.ts` inject fake fetch (no undici/network to githubstatus/cloudflarestatus) — add guard assertion or comment + grep smoke if useful (SC-004 / FR-012)
- [x] T025 [P] [US3] Tool-level smoke: `createCheckProviderStatusTool({ fetch: fake })` invoke sucesso in `src/agents/tools.test.ts` (ou estender teste existente)

### Implementation for User Story 3

- [x] T026 [US3] Verify existing five tools still pass on `:memory:` SQLite in `src/agents/tools.test.ts` (regressão catálogo) per quickstart §3
- [x] T027 [US3] Run full `npm test` and `npm run typecheck` until green; spot-check quickstart.md checklist rows 1–7

**Checkpoint**: Harness CI offline completo para a tool

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Alinhamento final ao contrato e limpeza

- [x] T028 [P] Double-check tool `description` in `src/agents/tools.ts` covers quando usar (suspeita externa / nosso vs provedor / dependência fora) e quando não usar (tools locais) per FR-003 / 6 regras
- [x] T029 [P] Ensure extra JSON fields on statuspage payload are ignored (passthrough) — add/adjust test in `src/tools/check-provider-status.test.ts` if missing
- [x] T030 Run quickstart.md validation (`npm test` + `npm run typecheck`); note optional manual arena/HTTP smoke is out of CI

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP
- **User Story 2 (Phase 4)**: Depends on US1 happy-path existing (extends `fetchProviderStatus`)
- **User Story 3 (Phase 5)**: Depends on US1+US2 behaviors/tests to consolidate offline suite
- **Polish (Phase 6)**: Depends on desired stories complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependency on US2/US3
- **User Story 2 (P2)**: Builds on US1 `fetchProviderStatus` + tool wrapper (same files; sequential preferred)
- **User Story 3 (P3)**: Mostly verification; can start test guards after US1 but full green needs US2

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Core `fetchProviderStatus` before LangChain wrapper
- Wrapper before `createTools` wire
- Story green before next priority when sharing `check-provider-status.ts`

### Parallel Opportunities

- T001–T003 (Setup) can run in parallel
- T005–T006 (Foundational schemas/types) can run in parallel after T004
- T009–T011 (US1 tests) can run in parallel
- T017–T020 (US2 tests) can run in parallel
- T024–T025 (US3 tests) can run in parallel
- T028–T029 (Polish) can run in parallel
- US2/US3 share files with US1 → prefer sequential implementation on `check-provider-status.ts` / `agents/tools.ts`

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests together:
Task: "Test sucesso github fake fetch in src/tools/check-provider-status.test.ts"
Task: "Test default provider URL githubstatus in src/tools/check-provider-status.test.ts"
Task: "Test cloudflare URL + format in src/tools/check-provider-status.test.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch US2 resilience tests together:
Task: "Test timeout → Error + 2 calls in src/tools/check-provider-status.test.ts"
Task: "Test 5xx then 200 retry success in src/tools/check-provider-status.test.ts"
Task: "Test 4xx no retry in src/tools/check-provider-status.test.ts"
Task: "Test invalid body no retry in src/tools/check-provider-status.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Fake sucesso + tool registrada
5. Demo: agente responde “é do provedor?” com linha compacta (mock)

### Incremental Delivery

1. Setup + Foundational → tipos/URLs/schema prontos
2. US1 → status compacto no grafo (MVP)
3. US2 → resiliência / erro como observação
4. US3 → suíte offline + regressão
5. Polish → 6 regras + passthrough + quickstart

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. After Foundational:
   - Dev A: US1 tests + happy path (owns `check-provider-status.ts` initially)
   - Dev B: can draft US2 test cases in parallel (same test file — coordinate)
3. Prefer single owner for `src/tools/check-provider-status.ts` until US2 lands

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to US1/US2/US3
- Sem mudanças em `store/`, `http/`, `domain/` (research Decisão 7)
- Nunca chamar statuspages reais nos testes
- Commit after each task or logical group
- Stop at checkpoints to validate independently
