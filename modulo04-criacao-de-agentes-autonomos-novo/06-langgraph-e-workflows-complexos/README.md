# OpsPilot

Copiloto de plantão para alertas e incidentes — agente LangGraph/Express + **War Room** web (chat com raciocínio auditável).

## Desenvolvimento local

```bash
# API (porta 3000)
npm install
npm run dev

# War Room (outra terminal)
npm install --prefix web
npm run web:dev
# → http://localhost:5173/opspilot/
```

Na War Room, use a **engrenagem** para apontar a URL da API (default `http://localhost:3000`). CORS na API vem liberado por padrão.

## GitHub Pages (War Room)

Pré-requisito (uma vez): **Settings → Pages → Source = GitHub Actions**.

| | |
|---|---|
| Workflow | [`.github/workflows/pages.yml`](.github/workflows/pages.yml) |
| URL | https://thiagobussola.github.io/ops-pilot/ |
| Trigger | push em `master` (paths `web/**`) ou *Run workflow* |

O build de produção no CI usa base `/ops-pilot/` (path do project site no GitHub Pages). Em desenvolvimento local o Vite continua com base `/opspilot/`.

A **API não é publicada no Pages** — só o frontend estático. Configure o host da API na engrenagem da UI.

## Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | API OpsPilot |
| `npm run web:dev` | War Room (Vite) |
| `npm run web:build` | Build local (base `/opspilot/`) |
| `npm --prefix web run build -- --base=/ops-pilot/` | Build igual ao CI/Pages |
| `npm test` | Testes da API |
| `npm run web:test` | Testes da War Room |
| `npm run typecheck` | Typecheck API |
