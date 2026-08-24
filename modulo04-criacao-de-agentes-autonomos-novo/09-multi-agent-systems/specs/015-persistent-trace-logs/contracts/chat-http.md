# Contract: Chat HTTP — requestId + GET /requests/:id

**Phase 1 output for** `specs/015-persistent-trace-logs/plan.md`

Estende o contrato de `/chat` (`003`–`014`). Adiciona correlação e endpoint de auditoria.

---

## `POST /chat`

### Headers de resposta

| Header | Quando | Valor |
|--------|--------|-------|
| `X-Request-Id` | Sempre que o handler atribuiu id (incluindo `400` pós-mint) | UUID v4 = `requestId` |

### Response `200` (campos novos)

```json
{
  "requestId": "<uuid>",
  "answer": "...",
  "trace": [ /* TraceEvent[] */ ],
  "metrics": { /* ExecutionMetrics */ },
  "conversationId": "..."
}
```

Garantia: `body.requestId ===` header `X-Request-Id`.

### Erros

Contratos de status existentes (`400`, `422`, `404`, `503`, `504`, `500`) permanecem. Header `X-Request-Id` presente após mint. Persistência de auditoria **não** é exigida em `400` pré-execução.

---

## `GET /requests/:id`

### Path

| Param | Type | Notes |
|-------|------|-------|
| `id` | UUID | Validação zod; inválido → `400` |

### Response `200`

```json
{
  "request": {
    "id": "<uuid>",
    "createdAt": 0,
    "finishedAt": 0,
    "status": "success",
    "httpStatus": 200,
    "conversationId": "<uuid>|null",
    "userId": "...",
    "metrics": { /* ExecutionMetrics */ },
    "latencyMs": 0,
    "llmCalls": 0,
    "route": "react",
    "modelUsed": "..."
  },
  "trace": [ /* TraceEvent[] na ordem seq */ ]
}
```

### Erros

| Caso | Status | Body |
|------|--------|------|
| `id` não-UUID / inválido | `400` | `validation_error` + issues |
| UUID ok, registro ausente | `404` | `request_not_found` + `requestId` |
| Método ≠ GET | 404 framework | — |

---

## Testes HTTP mínimos

| # | Caso | Esperado |
|---|------|----------|
| 1 | `POST /chat` fake 200 | `requestId` body === `X-Request-Id`; distinto entre calls |
| 2 | `POST` + `GET /requests/:id` | registro + trace N eventos mesma ordem |
| 3 | `GET` id inexistente | `404` |
| 4 | `GET` id `not-a-uuid` | `400` |
| 5 | `POST` body inválido | `400` + header `X-Request-Id` |
| 6 | Persist store throw após sucesso | ainda `200` com `requestId`; log `request_persist_failed` |
