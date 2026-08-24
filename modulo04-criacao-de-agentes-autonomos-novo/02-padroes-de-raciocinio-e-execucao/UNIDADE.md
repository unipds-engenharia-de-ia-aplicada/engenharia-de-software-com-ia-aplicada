# Unidade 2 — Padrões de Raciocínio e Execução

Kickoff do **OpsPilot** (copiloto de plantão do e-commerce fictício "Mercadinho"). Nasce o cérebro do agente: três estratégias de raciocínio atrás de uma interface comum, com trace tipado, arena de comparação e bench com métricas. Snapshot do commit `a46c75b` ("react, reflection, and plan-and-execute").

## O que é novo nesta unidade

- **Spec `001-reasoning-nucleus`** — o núcleo de raciocínio:
  - `src/strategies/react.ts` — ReAct (Thought → Action → Observation);
  - `src/strategies/plan-execute.ts` — Plan-and-Execute (planner/executor/replanner);
  - `src/trace/builder.ts` — trace tipado (`thought | action | observation | plan | critique | answer`);
  - `src/tools/` — tools mock sobre store em memória: `list_alerts`, `open_incident`, `resolve_incident` (`src/store/in-memory-store.ts` + seed do Mercadinho);
  - `src/llm/factory.ts` + `src/agents/model.ts` — fábrica única de modelo (ChatOpenAI → OpenRouter);
  - `src/arena.ts` — compara estratégias lado a lado; `src/bench.ts` — cenários com acerto medido no **estado do store**, não no texto.
- **Spec `002-reflection-layer`** — `src/strategies/reflect.ts`: camada de Reflection (crítico com feedback estruturado e teto de iterações).
- Projeto configurado com Spec Kit (`.specify/`, `/speckit.*`) e `.github/copilot-instructions.md`.

## Diferenças em relação ao roteiro

- O `POST /chat` (spec `003-chat-api`) estava planejado para fechar a U2, mas foi commitado junto com a persistência da U3 — o código dele aparece a partir da pasta [03-function-calling-e-tool-use](../03-function-calling-e-tool-use/).
- O roteiro cita a spec como `001-nucleo-raciocinio`; o nome real ficou em inglês (`001-reasoning-nucleus`).

## Como rodar

```bash
npm ci && cp .env.example .env   # OPENROUTER_API_KEY
npm run arena -- --strategies react,plan-execute
npm run bench
npm test && npm run typecheck
```
