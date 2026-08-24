# Unidade 6 — LangGraph e Workflows Complexos

As estratégias das unidades anteriores são unificadas em um **grafo de produção**: contexto → roteador classificador → estratégia → resposta, com retry, fallback de modelo e degradação elegante.

> **Sobre este snapshot:** o conteúdo das unidades 6, 7 e 8 foi commitado de uma vez ("observabildiade e web" + correções "war room"). Esta pasta usa a árvore do commit `2d60133` **sem** a parte web/deploy da U8 (`web/`, CORS spec, workflow do Pages e instructions de design foram mantidos apenas na pasta 08). O código de observabilidade da U7 (`src/obs/`, trace persistido) permanece aqui porque é inseparável do commit — o foco DESTA unidade são os arquivos abaixo.

## O que é novo nesta unidade

- **Spec `013-unified-production-graph`** — `src/graph/`:
  - `production-graph.ts` — `StateGraph` com nós de contexto (U5), roteador, estratégias (react / plan-execute / reflect) e resposta;
  - `router.ts` + `router-prompt.ts` — roteador classificador com `withStructuredOutput({route, reason})`, usando a tabela de decisão da U2; evento `route` e campo `node` em todo evento de trace; `strategy` no `/chat` vira **override opcional**;
  - `stamp-node.ts` — carimbo do nó de origem nos eventos.
- **Spec `014-model-resilience`** — `src/agents/model.ts`: `withRetry` + `withFallbacks` com `OPENROUTER_MODEL_FALLBACK` no `.env`; evento `fallback` no trace; `metrics.modelUsed`; 503 honesto quando primário e fallback caem; `src/llm/model-telemetry.ts`.

## Diferenças em relação ao roteiro

- O executor **em ondas** (paralelismo com `dependsOn`) e o `npm run graph:draw` ficaram como exercício — não implementados.
- Não existe um commit com o estado "fim da U6" isolado; use os arquivos acima como recorte da unidade.

## Como rodar

```bash
npm ci && cp .env.example .env   # defina também OPENROUTER_MODEL_FALLBACK
npm run dev                      # POST /chat sem "strategy": o roteador decide (métricas route/routeReason)
npm test && npm run typecheck
```
