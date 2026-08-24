# Tasks: Deploy War Room no GitHub Pages

**Input**: Design documents from `/specs/017-pages-web-deploy/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Incluídos como validação — smoke `web:build --base=/ops-pilot/`; inspeção do workflow (SC-002/003); checklist quickstart (sem suite unitária de YAML)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Workflow: `.github/workflows/`
- Docs: `README.md` (raiz), `web/README.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Garantir pasta de workflows e que `web/dist` não será commitado

- [x] T001 Create directory `.github/workflows/` if missing (repo root)
- [x] T002 [P] Verify `.gitignore` includes `web/dist/` (or `dist` covering it); append `web/dist/` only if absent

**Checkpoint**: Estrutura pronta para o YAML

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirmar build Pages localmente antes de authoring do workflow — **BLOCKS** stories de publish

**⚠️ CRITICAL**: No user story publish work until local smoke base passes

- [x] T003 Run `npm ci --prefix web` and `npm --prefix web run build -- --base=/ops-pilot/` successfully; confirm `web/dist/index.html` references `/ops-pilot/` assets
- [x] T004 [P] Document the exact CI build one-liner in a comment stub or scratch note aligned with `contracts/pages-workflow.md` (consumed by T005)

**Checkpoint**: Artefato estático com base correta é reproduzível localmente

---

## Phase 3: User Story 1 — Publicar a War Room Automaticamente (Priority: P1) 🎯 MVP

**Goal**: Workflow build → upload-pages-artifact → site Pages a partir de `web/dist`

**Independent Test**: Workflow file presente; build step usa `--base=/ops-pilot/`; artifact path `web/dist`; job deploy needs build; triggers `master` paths + `workflow_dispatch`

### Validation for User Story 1

- [x] T005 [P] [US1] Draft/assert checklist from `specs/017-pages-web-deploy/quickstart.md` “Checklist de inspeção” items that apply to build+upload (artifact path, base flag, no PR trigger) — keep as comments in PR or mark in quickstart when implementing

### Implementation for User Story 1

- [x] T006 [US1] Create `.github/workflows/pages.yml` with `on.push.branches: [master]`, `paths: [web/**, .github/workflows/pages.yml]`, and `workflow_dispatch` per `contracts/pages-workflow.md`
- [x] T007 [US1] Add job `build` in `.github/workflows/pages.yml`: `actions/checkout@v4`, `actions/setup-node@v4` (node 22, cache npm, `cache-dependency-path: web/package-lock.json`), `npm ci --prefix web`, `npm --prefix web run build -- --base=/ops-pilot/`
- [x] T008 [US1] In job `build`, add `actions/configure-pages@v5` and `actions/upload-pages-artifact@v3` with `path: web/dist` in `.github/workflows/pages.yml`
- [x] T009 [US1] Add job `deploy` with `needs: build`, `environment: github-pages`, and `actions/deploy-pages@v4` (id `deployment`, url output) in `.github/workflows/pages.yml`
- [x] T010 [US1] Ensure build failure prevents deploy via `needs: build` only (no `continue-on-error` on build) in `.github/workflows/pages.yml`

**Checkpoint**: MVP — pipeline de publish definido (ativar Source=Actions no GitHub para ir live)

---

## Phase 4: User Story 2 — Workflow com Permissões Corretas (Priority: P1)

**Goal**: `permissions` mínimas + concurrency group `pages`

**Independent Test**: Abrir `.github/workflows/pages.yml` e verificar `pages: write`, `id-token: write`, `contents: read`, `concurrency.group: pages`

### Validation for User Story 2

- [x] T011 [P] [US2] Inspect `.github/workflows/pages.yml` against SC-003 checklist (permissions + concurrency) in `specs/017-pages-web-deploy/quickstart.md`

### Implementation for User Story 2

- [x] T012 [US2] Set top-level `permissions: { contents: read, pages: write, id-token: write }` in `.github/workflows/pages.yml`
- [x] T013 [US2] Set `concurrency: { group: pages, cancel-in-progress: false }` in `.github/workflows/pages.yml`
- [x] T014 [US2] Confirm no `pull_request` trigger and no extra broad permissions (`contents: write`, etc.) in `.github/workflows/pages.yml`

**Checkpoint**: Contrato de segurança do workflow fechado

---

## Phase 5: User Story 3 — README Orienta Acesso e Deploy (Priority: P2)

**Goal**: README raiz + `web/README.md` com URL Pages, Source Actions, engrenagem API

**Independent Test**: Ler READMEs — URL `https://thiagobussola.github.io/ops-pilot/`, passo Source=GitHub Actions, link workflow, nota API

### Validation for User Story 3

- [x] T015 [P] [US3] Self-check SC-004: from repo root, locate Pages URL + Actions source instruction in under 2 minutes using only `README.md`

### Implementation for User Story 3

- [x] T016 [US3] Create root `README.md` per `contracts/readme-pages.md` (OpsPilot blurb, local API/War Room, GitHub Pages section, useful scripts)
- [x] T017 [P] [US3] Replace `web/README.md` Vite boilerplate with OpsPilot War Room short doc linking to `../README.md`
- [x] T018 [US3] In root `README.md`, explicitly document CI base `/ops-pilot/` vs local `/opspilot/` and API-via-gear / CORS note

**Checkpoint**: Docs desbloqueiam contribuidores e settings Pages

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Alinhar quickstart e validação final

- [x] T019 [P] Update `specs/017-pages-web-deploy/quickstart.md` notes if any path/URL drift after implementation (keep in sync with workflow)
- [x] T020 Re-run local smoke: `npm --prefix web run build -- --base=/ops-pilot/` and confirm asset prefix in `web/dist/index.html`
- [x] T021 Final review: `.github/workflows/pages.yml` matches `contracts/pages-workflow.md` (actions pins v4/v4/v5/v3/v4 as contracted)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** US1 publish confidence
- **US1 (Phase 3)**: After Foundational — MVP workflow body
- **US2 (Phase 4)**: Can start after T006 exists (same file); ideally immediately after/with US1 top-level keys — sequentially safe after T006–T009
- **US3 (Phase 5)**: Independent of workflow green locally; can parallel with US1/US2 after Setup
- **Polish (Phase 6)**: After US1–US3

### User Story Dependencies

- **US1 (P1)**: Core workflow — MVP
- **US2 (P1)**: Same file as US1 — complete permissions/concurrency on the YAML from US1
- **US3 (P2)**: Docs only — parallelizable with US1/US2

### Parallel Opportunities

- T001 then T002 [P]
- After T006 skeleton: US3 (T016/T017) in parallel with finishing US1/US2
- T015 validation parallel with T016 drafting

---

## Parallel Example: User Story 3

```bash
Task: "Create root README.md per contracts/readme-pages.md"
Task: "Replace web/README.md boilerplate"
# Then T018 cross-links base path / API notes in root README
```

---

## Implementation Strategy

### MVP First (User Story 1 + US2 permissions)

1. Phase 1–2: Setup + local smoke build
2. Phase 3–4: `pages.yml` complete (build/deploy + permissions)
3. **STOP**: Enable Pages Source=Actions; `workflow_dispatch`; open URL
4. Phase 5: READMEs
5. Phase 6: Polish

### Incremental Delivery

1. Workflow only → first live Pages
2. Harden permissions/concurrency (if split) → US2
3. Docs → US3

### Parallel Team Strategy

1. Dev A: workflow US1+US2
2. Dev B: READMEs US3
3. Together: polish + smoke

---

## Notes

- Default branch is **`master`** (not `main`)
- Do not commit `web/dist`
- Human step outside tasks: GitHub Settings → Pages → Source = GitHub Actions (document in README)
- Local Vite base remains `/opspilot/`; only CI overrides with `--base=/ops-pilot/`
