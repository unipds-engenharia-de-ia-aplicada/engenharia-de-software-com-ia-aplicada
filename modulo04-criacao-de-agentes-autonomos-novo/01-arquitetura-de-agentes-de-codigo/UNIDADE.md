# Unidade 1 — Arquitetura de Agentes de Código (GitHub Copilot)

Projeto-fundação do módulo: a **`notas-api`** (API REST + CLI de tarefas em Node 22 + TypeScript ESM + zod + `node:test`). O objetivo da unidade não é a API em si, e sim **operar um agente de código com método profissional**: harness, modos Ask/Edit/Agent, context engineering, spec-driven development, guardrails e delegação.

## O que foi construído aqui

- [notas-api/](./notas-api/) — o projeto completo gerado e evoluído com o GitHub Copilot:
  - `.github/copilot-instructions.md` — memória de projeto;
  - `.github/instructions/service.instructions.md` — instruction com escopo (`applyTo`);
  - `.github/prompts/` — SDD artesanal: `especificar`, `planejar`, `tarefas`, `implementar` (viram comandos `/especificar` etc. no chat);
  - `.vscode/settings.json` — allow/deny list de comandos de terminal para o agente (o mesmo arquivo usado no OpsPilot das unidades 2–9);
  - `.githooks/pre-commit` — guardrail determinístico (typecheck + testes), ativado com `git config core.hooksPath .githooks`;
  - `src/` — domínio, store, service, HTTP e CLI implementados via specs.
- [specs/](./specs/) — `constitution.md` + as features `001-gerenciamento-de-tarefas` e `002-persistencia-cli-json` (spec/plan/tasks de cada uma).

## Diferenças em relação ao roteiro

- O chat mode revisor (`.github/chatmodes/code-reviewer.chatmode.md` + `/revisar`) previsto no roteiro não ficou no repositório final.
- O `.vscode/settings.json` (allow/deny list) não estava versionado no `notas-api` original — o arquivo aqui é o mesmo usado no OpsPilot (era o mesmo conteúdo nas gravações).
- O roteiro cita a feature como `specs/001-notas`; no projeto ela foi nomeada `001-gerenciamento-de-tarefas`, e uma segunda feature (`002-persistencia-cli-json`) foi adicionada.

## Como rodar

```bash
cd notas-api
npm ci
npm test
npm run dev   # sobe a API; o CLI fica em src/cli.ts
```
