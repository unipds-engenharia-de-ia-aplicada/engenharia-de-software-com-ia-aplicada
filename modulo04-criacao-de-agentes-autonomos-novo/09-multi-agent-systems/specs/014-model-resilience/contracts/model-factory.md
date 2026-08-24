# Contract: Model Factory

**Phase 1 output for** `specs/014-model-resilience/plan.md`

---

## Module

| Item | Valor |
|------|-------|
| Path | `src/agents/model.ts` |
| Export | `createModel()`, tipos `OpsChatModel`, helpers de telemetria |
| Reexport | `src/llm/factory.ts` |

---

## Environment

| Var | Required | Default / behavior |
|-----|----------|--------------------|
| `OPENROUTER_API_KEY` | sim (runtime real) | — |
| `OPENROUTER_MODEL` | não | `openai/gpt-4o-mini` |
| `OPENROUTER_MODEL_FALLBACK` | não | ausente → só retry no primário |

Documentar `OPENROUTER_MODEL_FALLBACK=` em `.env.example`.

---

## Behavior

1. Construir primário `ChatOpenAI` (OpenRouter base URL, temperature 0).
2. `primary.withRetry({ stopAfterAttempt: 3 })`.
3. Se fallback válido e ≠ primary: `reserve.withRetry({ stopAfterAttempt: 3 })` então `primary.withFallbacks({ fallbacks: [reserve] })`.
4. Anexar callbacks/tags de telemetria em ambos os raw models.

---

## Tests (sem rede)

| # | Caso | Esperado |
|---|------|----------|
| 1 | Primário falha 2× depois ok | Sucesso; `fallbackUsed=false`; `modelUsed=primary` |
| 2 | Primário sempre falha; reserva ok | Sucesso; `fallbackUsed=true`; `modelUsed=fallback` |
| 3 | Ambos falham | Throw → mapeável a `ModelUnavailableError` |
| 4 | Fallback env == primary / vazio | Sem withFallbacks (só retry) |
