# Unidade 8 — Projeto Prático: o OpsPilot de ponta a ponta, publicado

O OpsPilot vira **produto no ar**: frontend "war room" consumindo a API, CORS configurável, CI/CD com GitHub Actions e deploy do frontend no GitHub Pages. Snapshot do commit `bc8485a` — o último estado commitado do projeto (fim da U8).

## O que é novo nesta unidade

- **Spec `016-war-room-web`** — a pasta [web/](./web/) (Vite + React + TypeScript):
  - chat chamando o `POST /chat`; "ver raciocínio" renderiza o trace tipado (rota do roteador + reason, tools chamadas);
  - o `202` da U7 vira **cartão de aprovar/negar** (`ApprovalCard` → `POST /approvals/:id`);
  - engrenagem de configuração com a URL da API em `localStorage` (`SettingsGear`);
  - `base` configurável para servir sob `/opspilot/` no Pages;
  - CORS configurável na API: `src/http/cors.ts` (env `CORS_ORIGIN`, preflight OPTIONS).
- **Spec `017-pages-web-deploy`** — `.github/workflows/deploy.yml`: push na main → build do `web/` (node 22, `npm ci`, `npm run build`) → `upload-pages-artifact` → `deploy-pages` (Pages com Source = GitHub Actions).
- `.github/instructions/design.instructions.md` com `applyTo: "web/**"` (+ `.cursor/rules/design.mdc`) — instructions com escopo como especialização sob demanda do agente.
- Correções "war room" no backend (refletor de aprendizado, grafo de produção, prompts) feitas durante a construção da UI.

## Diferenças em relação ao roteiro

- Exercícios previstos e **não** implementados: painel lateral de incidentes/alertas (`GET /incidents`, `GET /alerts`), workflow de CI de testes em PR, `AVALIACAO.md`, `motion.instructions.md` e o chat mode `ui-designer`.
- O workflow de deploy passou por idas e vindas (commits "edit deploy" e a remoção de um workflow duplicado) — o estado final é o `deploy.yml`.

## Como rodar

```bash
npm ci && cp .env.example .env
npm run dev          # API em localhost:3000

cd web
npm ci
npm run dev          # war room em localhost:5173 (CORS_ORIGIN default)
```
