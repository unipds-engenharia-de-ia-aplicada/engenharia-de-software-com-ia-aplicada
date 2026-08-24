# Contract: Chat HTTP — Grafo Unificado

**Phase 1 output for** `specs/013-unified-production-graph/plan.md`

Estende o contrato de `/chat` (`003`–`012`). Mudanças de **semântica** de `strategy` e shape do `trace`.

---

## Endpoint

`POST /chat`

---

## Request body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `message` | string min 1 | sim | |
| `userId` | string min 1 | sim | |
| `strategy` | `"react" \| "plan-and-execute" \| "reflect"` | **não** | Se presente = **override** de rota (sem default `react`) |
| `reflect` | boolean | não (default `false`) | Se `true` e sem `strategy` → override para `reflect`; se ambos, `strategy` vence |
| `conversationId` | uuid | não | |

### Erros de validação / domínio

| Caso | Status | Body |
|------|--------|------|
| Zod inválido | `400` | `validation_error` + issues |
| `strategy` presente e fora do enum / desconhecida | `422` | `unknown_strategy` + `strategy` |
| Timeout | `504` | (existente) |

---

## Response `200`

Shape existente:

```json
{
  "answer": "...",
  "trace": [ /* TraceEvent[] com node */ ],
  "metrics": { /* ... */ },
  "conversationId": "..."
}
```

### Garantias no `trace`

1. ≥ 1 evento com `type: "route"`.
2. Todo evento tem `node: string` não vazio.
3. Se `strategy` (ou reflect-override) foi enviado: evento `route` com `override: true` e `route` igual à rota efetiva.
4. Se omitido: `override: false` (ou ausente/`false`) e `route` = classificação (ou fallback).

Ver [trace.md](./trace.md).

---

## Comportamento interno

- Orquestração via `src/graph/production-graph.ts` — não `resolveStrategy` + default `react` na borda.
- Timeout envolve o turno completo do grafo.

---

## Testes HTTP mínimos

| # | Caso | Esperado |
|---|------|----------|
| 1 | Body só `message`+`userId`, router fake | `200`; route no trace; sem override |
| 2 | `strategy: "plan-and-execute"` | Executa esse nó; `override: true` |
| 3 | `strategy: "nope"` | `422` |
| 4 | Trace | todos com `node` |
| 5 | Regressão reflect flag | `reflect: true` sem strategy → nó reflect + override |
