# Constitution - OpsPilot

Princípios não-negociáveis que toda spec, plano, tarefa e código seguem.

1. **Agente no centro.** O produto é um grafo LangGraph. Toda nova capacidade operacional vira nó ou ferramenta do grafo; Express e MySQL são infraestrutura de suporte.
2. **Camadas explícitas.** Dependências fluem em uma única direção: `http/cli → agent (graph) → tools/services → store`. O domínio não faz I/O diretamente.
3. **Validação na fronteira.** Toda entrada externa (HTTP, CLI, saída do LLM) é validada com `zod` antes de entrar no grafo ou no domínio.
4. **Erros são de domínio.** Falhas previsíveis viram classes de erro, traduzidas em status HTTP ou saída CLI na borda.
5. **Teste é parte da tarefa.** Nenhuma lógica nova entra sem teste. `npm run typecheck` e `npm test` sempre verdes.
6. **Segurança por padrão.** Sem segredos no repo. Variáveis via `--env-file` nativo do Node. Ações destrutivas passam por guardrails (deny list), não pela confiança no modelo.
7. **Spec antes de código.** Mudanças relevantes passam por `speckit.specify → plan → tasks → implement`, com revisão humana entre as fases.
8. **Pequeno e reversível.** Cada tarefa cabe em um commit.

## Stack obrigatória

Node.js 22 LTS, TypeScript ESM `strict: true`, `zod`, `node:test` via `tsx`, LangChain + LangGraph → OpenRouter, Express, MySQL via Sequelize.
