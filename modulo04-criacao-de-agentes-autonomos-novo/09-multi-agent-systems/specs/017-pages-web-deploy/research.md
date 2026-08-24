# Research: Deploy War Room no GitHub Pages

**Phase 0 output for** `specs/017-pages-web-deploy/plan.md`

---

## Contexto

Remote: `ThiagoBussola/ops-pilot`. Branch padrão observada: `master`. War Room em `web/` com Vite `base: '/opspilot/'` (016). GitHub project Pages serve em `https://<owner>.github.io/ops-pilot/` — paths absolutos `/opspilot/...` **não** caem sob `/ops-pilot/` (quebram assets).

---

## Decisão 1: Base path no CI = `/ops-pilot/`

**Decisão**: No job de build do Pages, invocar a build com override de base:

```bash
npm --prefix web run build -- --base=/ops-pilot/
```

(ou `npx vite build --base=/ops-pilot/` no cwd `web/`). Manter `VITE_BASE = '/opspilot/'` no código para **dev local** (`npm run web:dev` → `http://localhost:5173/opspilot/`). Documentar no README os dois URLs.

**Rationale**: Satisfaz FR-009 no Pages (assets resolvem) sem forçar rename do path de produto local da 016. Override CLI do Vite é oficial.

**Alternatives considered**:

- Mudar `VITE_BASE` global para `/ops-pilot/` — unifica, mas muda UX local da 016.
- `base: './'` relativo — funciona em subpaths, mas pior para deep links futuros.
- Publicar em user site / custom domain com `/opspilot/` — fora de escopo.

---

## Decisão 2: Trigger em `master` + paths + `workflow_dispatch`

**Decisão**:

```yaml
on:
  push:
    branches: [master]
    paths:
      - "web/**"
      - ".github/workflows/pages.yml"
  workflow_dispatch:
```

Não publicar em `pull_request`.

**Rationale**: Default branch real do repo é `master`. Paths evitam rebuild em mudanças só de `src/` API. `workflow_dispatch` cobre republish manual.

**Alternatives considered**:

- Só `main` — quebraria neste remote.
- Rodar em todo push — desperdício de minutos.

---

## Decisão 3: Actions pinadas + permissions mínimas

**Decisão** (versões estáveis atuais):

| Action | Pin |
|--------|-----|
| `actions/checkout` | `v4` |
| `actions/setup-node` | `v4` (node 22, cache npm) |
| `actions/configure-pages` | `v5` |
| `actions/upload-pages-artifact` | `v3` |
| `actions/deploy-pages` | `v4` |

```yaml
permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false
```

Jobs: `build` (checkout → setup-node → `npm ci --prefix web` → build com base → `configure-pages` → `upload-pages-artifact` com `path: web/dist`) → `deploy` (`needs: build`, `environment: github-pages`, `deploy-pages`).

**Rationale**: Contrato pedido na spec; padrão oficial GitHub “Static HTML” / Vite Pages.

**Alternatives considered**:

- `peaceiris/actions-gh-pages` — fora do brief.
- Single job — GitHub recomenda deploy job separado com environment.

---

## Decisão 4: Install só em `web/`

**Decisão**: CI faz `npm ci --prefix web` (usa `web/package-lock.json`). Não precisa instalar deps do agente Node na raiz para publicar a SPA.

**Rationale**: Mais rápido; build Vite é autocontido em `web/`.

**Alternatives considered**:

- `npm ci` na raiz + prefix — desnecessário se root não é workspace npm.

---

## Decisão 5: README raiz novo + web/README enxuto

**Decisão**: Criar `README.md` na raiz (projeto hoje sem README) com visão OpsPilot, dev API/War Room, seção **GitHub Pages** (enable source Actions, URL `https://thiagobussola.github.io/ops-pilot/`, base CI, engrenagem API). Substituir `web/README.md` boilerplate por parágrafo War Room + link `../README.md`.

**Rationale**: FR-006/007; owner do remote conhecido.

**Alternatives considered**:

- Só atualizar `web/README` — brief pede README do projeto; raiz estava ausente.

---

## Resolução de NEEDS CLARIFICATION

Nenhum restante — branch `master`, base CI `/ops-pilot/`, URL Pages do remote documentados.
