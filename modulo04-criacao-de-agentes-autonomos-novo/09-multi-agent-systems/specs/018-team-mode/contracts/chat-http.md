# Contract — HTTP `/chat` com rota `team`

Extensão do contrato de `013-unified-production-graph`; tudo que não está listado permanece igual.

## Rotas de produção

```ts
PRODUCTION_ROUTES = ["react", "planExecute", "reflect", "team"]
```

## Request

- `strategy: "team"` passa a ser valor **válido** de override (aceito pelo `chatRequestSchema` por derivação de `PRODUCTION_ROUTES`).
- Valores desconhecidos continuam `422` antes de executar o grafo (sem mudança).
- `awaitHumanApproval: true` + `strategy: "team"` ⇒ turno deferido (`202`/pending) **antes** de qualquer papel executar — mesma semântica das demais rotas.

## Roteador

- Tabela de decisão (`router-prompt.ts`) ganha a linha:

```text
| Investigação + plano + execução coordenadas; pedido complexo que se beneficia de papéis distintos | team |
```

- Classificação automática pode devolver `{ route: "team", reason }`; evento `route` no trace idêntico ao padrão existente (`override: false`).
- Override via body marca `override: true` no evento `route` (sem mudança de mecânica).
- Fallback do roteador permanece `react` (rota `team` nunca é fallback).

## Response (rota team)

- Contrato inalterado: `{ requestId, answer, trace, metrics, conversationId }`.
- `trace` contém: 1 evento `route` + N eventos `handoff` + eventos dos papéis (com `node` do papel) + demais eventos padrão do turno.
- `metrics.route === "team"`; `metrics.llmCalls` agrega supervisor + papéis + fechamento (+ roteador quando classificado).

## Regressão

- Turnos `react` / `planExecute` / `reflect`: zero mudança de contrato (suíte existente permanece verde).
