# Implementation Plan: Deploy War Room no GitHub Pages

**Branch**: `017-pages-web-deploy` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/017-pages-web-deploy/spec.md`

## Summary

Publicar o build estático de `web/` no GitHub Pages via Actions (`upload-pages-artifact` + `deploy-pages`), com `permissions` mínimas, concurrency, trigger em `master` + `workflow_dispatch`. Build de CI usa `--base=/ops-pilot/` (nome do repo) para assets resolverem no project site. README raiz + `web/README.md` documentam URL e setup.

## Technical Context

**Language/Version**: Node.js 22 (CI); TypeScript/Vite já em `web/`

**Primary Dependencies**: GitHub Actions — `actions/checkout`, `actions/setup-node`, `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages` (versões pinadas em research)

**Storage**: N/A (artefato estático Pages)

**Testing**: Validação por inspeção do workflow + `npm run web:build` local com o mesmo `--base`; smoke manual no URL Pages pós-enable

**Target Platform**: GitHub Pages (project site `https://<owner>.github.io/ops-pilot/`)

**Project Type**: CI/CD + docs (sem mudança de domínio do agente)

**Performance Goals**: Workflow build+deploy tipicamente < 5 min; SC-001 load shell < 5s

**Constraints**: Branch padrão do remote = `master` (não `main`); PRs não publicam; API fora do Pages; base local `/opspilot/` vs Pages `/ops-pilot/` (ver research)

**Scale/Scope**: 1 workflow YAML + 2 READMEs + ajuste documentado do base no CI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | Só publica UI estática; grafo/API intocados |
| 2 | **Camadas explícitas** | ✅ PASS | CI → artefato `web/dist`; sem acoplar HTTP do agente |
| 3 | **Validação na fronteira** | ✅ PASS | N/A HTTP; build falha → sem deploy |
| 4 | **Erros são de domínio** | ✅ PASS | N/A |
| 5 | **Teste é parte da tarefa** | ✅ PASS | Build local com base Pages; checklist de inspeção do workflow |
| 6 | **Segurança por padrão** | ✅ PASS | `permissions` mínimas; sem secrets no front; Pages público ok (auth fora v1) |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | Um workflow + docs |

**Stack**: ✅ Sem alteração da stack do agente; web já Vite.

**Gate result: ALL PASS**

**Re-check pós Phase 1**: contratos separam workflow/README/base; gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/017-pages-web-deploy/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── pages-workflow.md
│   └── readme-pages.md
└── tasks.md                  # /speckit.tasks
```

### Source Code (repository root)

```text
.github/workflows/
└── pages.yml                 # NOVO: build web + upload + deploy-pages

README.md                     # NOVO (raiz): OpsPilot + seção Pages / War Room
web/
├── README.md                 # ← substituir boilerplate Vite
├── package.json              # inalterado (build via npm run build)
└── dist/                     # gerado no CI (não commitado)
```

**Structure Decision**: Workflow único em `.github/workflows/pages.yml` (dois jobs: `build` → `deploy`). Sem action composta custom. Docs na raiz + `web/README.md` curto apontando para a raiz.

## Complexity Tracking

> Nenhuma violação — seção vazia de propósito.
