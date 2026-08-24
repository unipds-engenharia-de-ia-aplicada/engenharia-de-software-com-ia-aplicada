# Data Model: Deploy War Room no GitHub Pages

**Phase 1 output for** `specs/017-pages-web-deploy/plan.md`

Sem persistência de domínio. Entidades = artefatos de CI/docs.

---

## PagesWorkflow

| Campo | Valor / regras |
|-------|----------------|
| Arquivo | `.github/workflows/pages.yml` |
| Triggers | `push` → `master` + paths `web/**`, workflow file; `workflow_dispatch` |
| Permissions | `contents: read`, `pages: write`, `id-token: write` |
| Concurrency | group `pages`, `cancel-in-progress: false` |
| Job `build` | Node 22; `npm ci --prefix web`; build `--base=/ops-pilot/`; upload `web/dist` |
| Job `deploy` | `needs: build`; environment `github-pages`; `actions/deploy-pages` |
| PR | Não dispara publish |

---

## StaticWarRoomArtifact

| Campo | Regras |
|-------|--------|
| Path CI | `web/dist` após build |
| Conteúdo | `index.html` + assets com prefixo `/ops-pilot/` |
| Não versionar | `web/dist/` permanece no `.gitignore` |

---

## ProjectReadme

| Campo | Regras |
|-------|--------|
| `README.md` (raiz) | Criar; seção Pages obrigatória |
| `web/README.md` | Substituir template Vite; apontar para raiz |
| URL documentado | `https://thiagobussola.github.io/ops-pilot/` |
| Dev local path | `http://localhost:5173/opspilot/` (base 016) |

---

## State / transitions (deploy)

```text
push|dispatch → build (fail → stop)
             → upload artifact → deploy-pages → live site
```
