# Contract: GitHub Pages workflow

**Phase 1 output for** `specs/017-pages-web-deploy/plan.md`

Arquivo: `.github/workflows/pages.yml`

---

## Triggers

```yaml
on:
  push:
    branches: [master]
    paths:
      - "web/**"
      - ".github/workflows/pages.yml"
  workflow_dispatch:
```

---

## Top-level

```yaml
permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false
```

---

## Job `build`

| Step | Action / comando | Notas |
|------|------------------|-------|
| Checkout | `actions/checkout@v4` | |
| Node | `actions/setup-node@v4` | `node-version: "22"`, `cache: npm`, `cache-dependency-path: web/package-lock.json` |
| Install | `npm ci --prefix web` | |
| Build | `npm --prefix web run build -- --base=/ops-pilot/` | Override do Vite base para project Pages |
| Configure Pages | `actions/configure-pages@v5` | |
| Upload | `actions/upload-pages-artifact@v3` | `path: web/dist` |

Se Install ou Build falhar → job falha → **sem** upload/deploy.

---

## Job `deploy`

```yaml
needs: build
runs-on: ubuntu-latest
environment:
  name: github-pages
  url: ${{ steps.deployment.outputs.page_url }}
steps:
  - id: deployment
    uses: actions/deploy-pages@v4
```

---

## Pré-requisito GitHub (humano)

Settings → Pages → **Source: GitHub Actions** (uma vez por repo).

---

## Fora de escopo

- Deploy a partir de `pull_request`
- Custom domain / HTTPS cert manual
- Injetar URL da API no build (continua engrenagem na UI)
