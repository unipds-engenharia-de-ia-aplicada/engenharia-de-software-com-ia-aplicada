# Contract: Trace — evento `fallback`

**Phase 1 output for** `specs/014-model-resilience/plan.md`

---

## TraceEventType

Adicionar:

```ts
| "fallback"
```

---

## Evento `fallback`

| Field | Required | Notes |
|-------|----------|-------|
| `type` | sim | `"fallback"` |
| `node` | sim | Preferir nó do grafo ativo; default de montagem do turno: `"resposta"` se a telemetria for agregada no fim |
| `content` | sim | Ex. `"<primary> → <fallback>"` |
| demais | não | |

Emitir **somente** quando a reserva concluir com sucesso após falha do primário (`fallbackUsed`).

---

## Relação com metrics

- `metrics.modelUsed` sempre no `200`.
- Presença de evento `fallback` ⇒ `modelUsed` deve ser o id da reserva (salvo race documentada; testes fixam essa igualdade).
