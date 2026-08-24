# Contract: Approvals HTTP

**Phase 1 output for** `specs/016-war-room-web/plan.md`

Continua uma pendência criada por `POST /chat` com `awaitHumanApproval: true` (`202`).

---

## `POST /approvals/:approvalId`

### Path

| Param | Type | Notes |
|-------|------|-------|
| `approvalId` | UUID | Inválido → `400` `validation_error` |

### Request body

```json
{
  "decision": "approve" | "deny",
  "userId": "<string min 1>"
}
```

Validação zod. Body inválido → `400`.

### Response `200` — `decision: "approve"`

Mesmo shape de sucesso do chat:

```json
{
  "requestId": "<uuid>",
  "answer": "...",
  "trace": [ /* TraceEvent[] */ ],
  "metrics": { /* ExecutionMetrics */ },
  "conversationId": "<uuid>"
}
```

- Novo `requestId` para a execução (e `X-Request-Id`); o `requestId` do `202` original permanece só na auditoria/logs da pendência se desejado (v1: log meta `priorRequestId`).
- Executa `runProductionTurn` com o snapshot armazenado (sem `awaitHumanApproval`).
- Consome a pendência (`take`) **antes** ou sob lock para evitar double-approve; se execução falhar após take, comportamento: erro HTTP da falha (pendência já consumida) — documentar; preferência v1: take só após sucesso é mais seguro para retry — **Decisão**: `get` + execute + `take` on success; se concurrent second approve enquanto running, second gets `409` se ainda existe ou `404` se already taken. Simplificação v1: `take` atômico no início do handler; se approve falhar depois, pendência perdida e cliente vê erro (aceitável v1 demo).

### Response `200` — `decision: "deny"`

```json
{
  "requestId": "<uuid>",
  "answer": "Ação cancelada pelo plantonista.",
  "trace": [
    {
      "type": "answer",
      "content": "Ação cancelada pelo plantonista.",
      "node": "approval"
    }
  ],
  "metrics": { "llmCalls": 0, "latencyMs": <elapsed> },
  "conversationId": "<uuid>|null"
}
```

Pendência consumida. `conversationId`: eco do snapshot se houver.

### Erros

| Caso | Status | Body |
|------|--------|------|
| `approvalId` não-UUID | `400` | `validation_error` + issues |
| Body inválido | `400` | `validation_error` |
| Pendência inexistente / já consumida | `404` | `{ "error": "approval_not_found", "approvalId": "..." }` |
| Timeout na execução (approve) | `504` | alinhado ao chat |
| Falhas de domínio do turno | mesmos mapeamentos do `/chat` | |

Header `X-Request-Id` presente em todas as respostas deste handler.

---

## Testes HTTP mínimos

| # | Caso | Esperado |
|---|------|----------|
| 1 | `POST /chat` `awaitHumanApproval: true` | `202` + `pending.approvalId` |
| 2 | approve com fake strategy | `200` + answer/trace |
| 3 | deny | `200` + mensagem de cancelamento |
| 4 | approve id inexistente | `404` |
| 5 | segundo approve do mesmo id | `404` |
| 6 | `awaitHumanApproval: false` | `200` direto (sem pending) |
