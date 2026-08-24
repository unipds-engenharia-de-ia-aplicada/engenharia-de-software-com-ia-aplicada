# Data Model: Resiliência de Modelo

**Phase 1 output for** `specs/014-model-resilience/plan.md`

Sem persistência nova. Configuração via env + telemetria em memória (ALS) por turno.

---

## Entities

### ModelConfig

| Field | Source | Notes |
|-------|--------|-------|
| `primaryModel` | `OPENROUTER_MODEL` \|\| `openai/gpt-4o-mini` | Id OpenRouter |
| `fallbackModel` | `OPENROUTER_MODEL_FALLBACK` | Opcional; trim; se vazio ou == primary → ausente |
| `stopAfterAttempt` | constante `3` | Primário e reserva |

---

### ModelTelemetry (por request / turno)

| Field | Type | Notes |
|-------|------|-------|
| `primaryModel` | `string` | |
| `fallbackModel` | `string \| undefined` | |
| `modelUsed` | `string \| undefined` | Último sucesso LLM |
| `fallbackUsed` | `boolean` | Reserva atendeu após falha do primário |

Escopo: AsyncLocalStorage iniciado em torno de `runProductionTurn` (e idealmente arena run se quiser métricas lá).

---

### TraceEvent (estendido)

| Field | Change |
|-------|--------|
| `type` | Inclui `"fallback"` |
| `node` | Obrigatório (já 013); ex. `resposta` ou nó onde a chamada ocorreu |
| `content` | Texto legível: `primary → fallback` / ids |
| `route` / etc. | Inalterados |

Exemplo:

```json
{
  "type": "fallback",
  "node": "resposta",
  "content": "openai/gpt-4o-mini → openai/gpt-4o-mini-fallback-id"
}
```

---

### ExecutionMetrics (estendido)

| Field | Type | Notes |
|-------|------|-------|
| `modelUsed` | `string` | Obrigatório no `200` de `/chat` após esta feature |
| (existentes) | | `route`, `routeReason`, breakdown, … |

---

### ModelUnavailableError

| Field | Type |
|-------|------|
| `name` | `"ModelUnavailableError"` |
| `message` | string legível |

Mapeamento HTTP: **503** + `{ error: "model_unavailable", message }`.

---

## State / flow

```text
createModel()
  primary.withRetry → [optional] withFallbacks([reserve.withRetry])
        │
        ▼
runProductionTurn (ALS telemetry)
  LLM calls → callbacks atualizam modelUsed / fallbackUsed
        │
   success ──► metrics.modelUsed; + evento fallback se fallbackUsed
   failure ──► ModelUnavailableError → HTTP 503
```

---

## Validation rules

- Fallback id após trim; igualdade com primary → sem fallback.
- `modelUsed` no 200 nunca vazio (fallback para primary id se telemetria omissa em caminho fake sem LLM).
- Evento `fallback` somente se `fallbackUsed === true`.
