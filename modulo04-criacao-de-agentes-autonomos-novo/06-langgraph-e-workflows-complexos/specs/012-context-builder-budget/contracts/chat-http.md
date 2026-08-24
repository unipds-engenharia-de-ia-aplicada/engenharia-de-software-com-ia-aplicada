# Contract: Chat HTTP — impacto ContextBuilder

**Phase 1 output for** `specs/012-context-builder-budget/plan.md`

Estende o contrato de `/chat` das features `007`–`011`. Corpo request/response **inalterado** em shape; mudam **semântica** das métricas e do prompt interno.

---

## Endpoint

`POST /chat` — sem novos campos obrigatórios.

---

## Métricas (pós-orçamento)

| Campo | Semântica após 012 |
|-------|---------------------|
| `metrics.historyMessages` | Contagem de mensagens da janela **após** corte por `CONTEXT_BUDGET_HISTORY` (≤ 8 e ≤ o que couber no teto) |
| `metrics.recalledMemories` | Contagem de memórias **após** corte por `CONTEXT_BUDGET_MEMORIES` |
| `metrics.contextBreakdown.summary` | `estimateTokens` do resumo **após** teto |
| `metrics.contextBreakdown.history` | `estimateTokens` do texto da janela **após** teto |
| `metrics.contextBreakdown.memories` | `estimateTokens` dos facts **após** teto |
| `metrics.contextBreakdown.system` | System completo (intocável) |
| `metrics.contextBreakdown.message` | Mensagem crua do request (intocável; não o envelope) |

Garantias com defaults:

- `contextBreakdown.summary ≤ 200` (ou 0 se omitido)
- `contextBreakdown.history ≤ 1200`
- `contextBreakdown.memories ≤ 300`

---

## Comportamento interno (não exposto no JSON)

- Prompt da strategy montado por `buildContext` (único caminho em `runChat`).
- Tetos via env `CONTEXT_BUDGET_*` (ver [context-builder.md](./context-builder.md)).

---

## Testes HTTP / integração mínimos

1. Com strategy fake e tetos baixos (via options/env no harness): `historyMessages` / `recalledMemories` / breakdown respeitam cortes.
2. Sem env custom: defaults; regressão 011 (janela ≤ 8, summary quando existir) permanece.
