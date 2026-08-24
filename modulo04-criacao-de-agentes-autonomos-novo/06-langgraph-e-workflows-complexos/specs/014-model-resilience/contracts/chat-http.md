# Contract: Chat HTTP — Resiliência de Modelo

**Phase 1 output for** `specs/014-model-resilience/plan.md`

Estende `/chat` (features `003`–`013`).

---

## Success `200`

Shape existente + métricas:

| Campo | Semântica |
|-------|-----------|
| `metrics.modelUsed` | Id do modelo que produziu a resposta do turno (primário ou reserva) |
| `metrics.route` / `routeReason` | Inalterados (013) |
| `trace[]` | Pode incluir `type: "fallback"` se a reserva atendeu |

---

## Error `503` — modelo indisponível

Quando primário (+ reserva se houver) falham após retries:

```json
{
  "error": "model_unavailable",
  "message": "…"
}
```

| Status | Condição |
|--------|----------|
| 503 | `ModelUnavailableError` |
| 504 | timeout de chat (existente) |
| 500 | demais erros internos |

Não retornar `200` com `answer` inventada.

---

## Testes HTTP mínimos

| # | Caso | Esperado |
|---|------|----------|
| 1 | Harness com fallback sucesso | `200`, `metrics.modelUsed` = reserva, trace tem `fallback` |
| 2 | Harness all-fail | `503`, `error: model_unavailable` |
| 3 | Primário ok | `200`, `modelUsed` = primary, sem evento `fallback` |
