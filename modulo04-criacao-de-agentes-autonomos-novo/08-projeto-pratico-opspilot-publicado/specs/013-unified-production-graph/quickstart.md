# Quickstart: Grafo Unificado — Validação

**Phase 1 output for** `specs/013-unified-production-graph/plan.md`

Guia de validação end-to-end. Sem código de implementação completo.

---

## Pré-requisitos

- Node.js 22 LTS
- `npm install`
- Features `007`–`012` no código (conversas, memórias, summary, ContextBuilder)
- `OPENROUTER_API_KEY` só para smoke manual com LLM real

---

## 1. Validação automatizada (sem rede LLM)

```bash
npm test
npm run typecheck
```

**Esperado**:

- `src/graph/production-graph.test.ts` — fluxo com router/strategies fake; override; evento `route`; `node` em todos os eventos
- `src/http/server.test.ts` — `strategy` opcional / override / `422`; defaults antigos de “sempre react” atualizados
- typecheck verde (`TraceEvent.node` obrigatório)

### Cenários mínimos

| # | Caso | Esperado |
|---|------|----------|
| 1 | Sem override, router fake → `reflect` | Nó reflect executa; `route.override === false` |
| 2 | `strategy: "react"` com router que escolheria outro | Só react; `override: true` |
| 3 | `strategy: "unknown"` | HTTP `422` |
| 4 | Trace completo | 100% eventos com `node`; ≥1 `type:"route"` |
| 5 | Prompt do router | Contém tabela com as três rotas |

Referências: [contracts/production-graph.md](./contracts/production-graph.md), [contracts/chat-http.md](./contracts/chat-http.md), [contracts/trace.md](./contracts/trace.md).

---

## 2. Smoke manual (opcional, com rede)

```bash
npm run dev
```

```bash
# auto-route
curl -s localhost:3000/chat -H 'content-type: application/json' \
  -d '{"message":"liste alertas ativos","userId":"u1"}' | jq '.trace[] | {type,node,route,override,content}'

# override
curl -s localhost:3000/chat -H 'content-type: application/json' \
  -d '{"message":"liste alertas","userId":"u1","strategy":"plan-and-execute"}' \
  | jq '.trace[] | select(.type=="route")'
```

**Esperado**: primeiro caso com `override` false/ausente e `route` ∈ {react, plan-and-execute, reflect}; segundo com `route: "plan-and-execute"` e `override: true`.

---

## 3. Critérios de aceite rápido

- [x] SC-001 — todo trace de sucesso tem `route` + `node` em 100% dos eventos
- [x] SC-002 — router fake determina a strategy executada
- [x] SC-003 — override prevalece e aparece no trace
- [x] SC-004 — body mínimo sem `strategy` funciona
- [x] SC-005 — `422` para strategy inválida
- [x] `npm test` + `typecheck` verdes

---

## Nota

Arena (`npm run arena`) permanece fora do production graph; apenas precisa stamp de `node` para o tipo.
