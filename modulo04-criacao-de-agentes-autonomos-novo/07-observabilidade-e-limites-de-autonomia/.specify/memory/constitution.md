<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0 (MAJOR: stack obrigatória redefinida — MySQL/Sequelize → SQLite via node:sqlite)
- Modified principles:
  - 1. Agente no centro — "Express e MySQL" → "Express e SQLite"
- Added sections: Versioning metadata (Version / Ratified / Last Amended)
- Removed sections: none
- Templates requiring updates:
  - .specify/templates/plan-template.md — ✅ sem referência a MySQL; Constitution Check genérico
  - .specify/templates/spec-template.md — ✅ sem referência a stack de banco
  - .specify/templates/tasks-template.md — ✅ sem referência a MySQL
  - .github/copilot-instructions.md — ✅ atualizado (Banco → SQLite via node:sqlite)
- Follow-up TODOs: specs históricas (001–003) ainda citam MySQL como infra futura — fora do escopo desta emenda; corrigir na feature de persistência SQLite
-->

# Constitution - OpsPilot

Princípios não-negociáveis que toda spec, plano, tarefa e código seguem.

1. **Agente no centro.** O produto é um grafo LangGraph. Toda nova capacidade operacional vira nó ou ferramenta do grafo; Express e SQLite são infraestrutura de suporte.
2. **Camadas explícitas.** Dependências fluem em uma única direção: `http/cli → agent (graph) → tools/services → store`. O domínio não faz I/O diretamente.
3. **Validação na fronteira.** Toda entrada externa (HTTP, CLI, saída do LLM) é validada com `zod` antes de entrar no grafo ou no domínio.
4. **Erros são de domínio.** Falhas previsíveis viram classes de erro, traduzidas em status HTTP ou saída CLI na borda.
5. **Teste é parte da tarefa.** Nenhuma lógica nova entra sem teste. `npm run typecheck` e `npm test` sempre verdes.
6. **Segurança por padrão.** Sem segredos no repo. Variáveis via `--env-file` nativo do Node. Ações destrutivas passam por guardrails (deny list), não pela confiança no modelo.
7. **Spec antes de código.** Mudanças relevantes passam por `speckit.specify → plan → tasks → implement`, com revisão humana entre as fases.
8. **Pequeno e reversível.** Cada tarefa cabe em um commit.

## Stack obrigatória

Node.js 22 LTS, TypeScript ESM `strict: true`, `zod`, `node:test` via `tsx`, LangChain + LangGraph → OpenRouter, Express, SQLite via `node:sqlite` (`DatabaseSync`). Persistência de arquivo configurável por `OPSPILOT_DB` (default `./data/opspilot.db`); `:memory:` obrigatório em testes. Sem ORM externo (Sem Sequelize/MySQL).

## Governance

Esta constitution prevalece sobre práticas ad hoc. Emendas exigem atualização deste arquivo, bump de versão semântica e propagação aos templates/instruções do agente. PRs e reviews MUST verificar conformidade com os princípios e com a stack obrigatória.

**Version**: 2.0.0 | **Ratified**: 2026-08-01 | **Last Amended**: 2026-08-01
