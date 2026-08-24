# Contract: Chat HTTP — War Room extensions (200 + 202)

**Phase 1 output for** `specs/016-war-room-web/plan.md`

Estende `POST /chat` (`003`–`015`). Não remove campos existentes.

---

## `POST /chat`

### Request body (campos novos)

| Campo | Tipo | Default | Notas |
|-------|------|---------|-------|
| `awaitHumanApproval` | boolean | `false` | Se `true`, não executa o grafo; cria pendência e responde `202` |

Demais campos inalterados: `message`, `userId`, `strategy?`, `reflect?`, `conversationId?`.

### Response `200` (sucesso imediato)

Inalterado em relação a `015`:

```json
{
  "requestId": "<uuid>",
  "answer": "...",
  "trace": [ /* TraceEvent[] */ ],
  "metrics": { /* ExecutionMetrics */ },
  "conversationId": "<uuid>"
}
```

Header: `X-Request-Id` = `requestId`.

### Response `202` (aprovação humana pendente)

Quando `awaitHumanApproval === true` **e** body válido:

```json
{
  "requestId": "<uuid>",
  "conversationId": "<uuid>|null",
  "pending": {
    "approvalId": "<uuid>",
    "summary": "<preview da message, ≤240 chars>",
    "createdAt": 0
  }
}
```

| Campo | Regras |
|-------|--------|
| `requestId` | Mesmo que `X-Request-Id` |
| `conversationId` | Eco do request se enviado; senão `null` (conversa real só no approve) |
| `pending.approvalId` | Id para `POST /approvals/:approvalId` |
| `pending.summary` | Não vazio |
| `pending.createdAt` | Unix ms |

**Não** inclui `answer` / `trace` / `metrics` no `202`.

### Erros

Contratos existentes (`400`, `422`, `404`, `503`, `504`, `500`) permanecem.  
Se `approvals` store não estiver wired e `awaitHumanApproval: true` → `503` `{ "error": "approvals_unavailable" }` (ou rejeitar no boot — preferência: exigir store quando flag usada; testes sempre injetam).

### Semântica

| `awaitHumanApproval` | Comportamento |
|----------------------|---------------|
| `false` / omitido | Executa turno → `200` |
| `true` | Persiste snapshot em ApprovalStore → `202`; **não** chama `runProductionTurn` |

Reexecução no approve **ignora** `awaitHumanApproval` (força execução).

---

## TraceEvent (consumo War Room)

Shape canônico = domínio `TraceEvent` (`type`, `content`, `node`, opcionais). War Room valida com zod espelhado; ver [data-model.md](../data-model.md).
