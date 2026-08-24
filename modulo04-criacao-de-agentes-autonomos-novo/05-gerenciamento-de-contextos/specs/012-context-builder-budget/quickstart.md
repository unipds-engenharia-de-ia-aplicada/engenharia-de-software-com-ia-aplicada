# Quickstart: ContextBuilder — Validação

**Phase 1 output for** `specs/012-context-builder-budget/plan.md`

Guia de validação end-to-end. Sem código de implementação completo.

---

## Pré-requisitos

- Node.js 22 LTS
- `npm install`
- Features `007`–`011` no código (janela 8, summary, memories, tokens)

---

## 1. Validação automatizada (sem rede LLM)

```bash
npm test
npm run typecheck
```

**Esperado**:

- `src/context/context-builder.test.ts` — defaults, tetos baixos, ordem de corte, system/message intactos
- `runChat` / compose tests — métricas e input da strategy pós-orçamento
- zero erros de tipo

### Cenários mínimos

| # | Caso | Esperado |
|---|------|----------|
| 1 | Resumo longo, budget 5 | summary truncado; `estimateTokens(summary) ≤ 5` |
| 2 | 3 msgs, budget cabe só 2 recentes | mais antiga removida |
| 3 | Memórias scores 0.9 / 0.5 / 0.2, budget apertado | menor score sai primeiro |
| 4 | Budgets 0 | history=[], memories=[], summary=""`; system+message intactos |
| 5 | Tudo cabe | nenhuma remoção |
| 6 | Env inválida | defaults 200/1200/300 |

Referências: [contracts/context-builder.md](./contracts/context-builder.md), [contracts/chat-http.md](./contracts/chat-http.md).

---

## 2. Smoke manual (opcional)

```bash
# tetos baixos forçados
CONTEXT_BUDGET_SUMMARY=50 CONTEXT_BUDGET_HISTORY=100 CONTEXT_BUDGET_MEMORIES=40 npm run dev
# POST /chat com conversa que tenha summary + history + memories
# jq '.metrics | {historyMessages, recalledMemories, contextBreakdown}'
```

**Esperado**: breakdown das seções opcionais ≤ tetos; resposta 200.

---

## 3. Critérios de aceite rápido

- [x] SC-001 — testes de ordem de corte 100% verdes
- [x] SC-002 — defaults 200 / 1200 / 300 respeitados
- [x] SC-003 — único montador no caminho `runChat`
- [x] SC-004 — sem corte indevido quando cabe
- [x] `npm test` + `typecheck` verdes

---

## Nota

Arena/bench que chamam `strategy.run` direto sem `runChat` não passam pelo builder (já documentado em research).
