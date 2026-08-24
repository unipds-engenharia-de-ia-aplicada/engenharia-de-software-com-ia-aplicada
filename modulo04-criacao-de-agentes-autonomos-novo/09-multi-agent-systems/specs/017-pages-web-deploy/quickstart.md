# Quickstart: Deploy War Room no GitHub Pages

**Phase 1 output for** `specs/017-pages-web-deploy/plan.md`

Contratos: [pages-workflow](./contracts/pages-workflow.md), [readme](./contracts/readme-pages.md).

---

## Prerequisites

- Repo com Pages **Source = GitHub Actions** (Settings → Pages)
- Node 22 local (smoke build)
- Permissão para ver Actions / environments `github-pages`

---

## Local smoke (mesmo base do CI)

```bash
npm ci --prefix web
npm --prefix web run build -- --base=/ops-pilot/
# inspecionar web/dist/index.html — asset paths sob /ops-pilot/
```

Build falha → não seguir para publish (SC-005).

---

## Disparar deploy

1. Merge/push em `master` tocando `web/**` **ou** Actions → workflow **Pages** → **Run workflow**.
2. Job `build` verde → job `deploy` verde.
3. Abrir `https://thiagobussola.github.io/ops-pilot/` (SC-001).

---

## Checklist de inspeção do workflow (SC-002, SC-003)

- [x] `permissions`: `pages: write`, `id-token: write`, `contents: read`
- [x] `upload-pages-artifact` com `path: web/dist`
- [x] `deploy-pages` no job `deploy` com `needs: build`
- [x] Sem trigger em `pull_request`
- [x] `concurrency.group: pages`

---

## README (SC-004)

- [x] Raiz documenta URL + Source Actions + engrenagem API
- [x] `web/README.md` não é mais o template Vite genérico

---

## Notes

- Dev local continua em `/opspilot/`; só o artefato Pages usa `/ops-pilot/`.
- Primeiro enable do environment `github-pages` pode pedir aprovação no GitHub UI.
