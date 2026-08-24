# Quickstart: Resiliência de Modelo — Validação

**Phase 1 output for** `specs/014-model-resilience/plan.md`

Guia de validação end-to-end. Sem código de implementação completo.

---

## Pré-requisitos

- Node.js 22 LTS
- `npm install`
- Feature `013` no código (grafo + metrics.route)

---

## 1. Validação automatizada (sem rede)

```bash
npm test
npm run typecheck
```

**Esperado**:

- `src/agents/model.test.ts` — retry, fallback, all-fail
- HTTP: `503` + `modelUsed` / evento `fallback` nos testes de servidor/grafo
- typecheck verde com tipagem `OpsChatModel`

### Cenários mínimos

| # | Caso | Esperado |
|---|------|----------|
| 1 | Primário flaky → ok | sem `fallback`; `modelUsed` = primary |
| 2 | Primário down, reserva ok | evento `fallback`; `modelUsed` = fallback |
| 3 | Ambos down | `503` `model_unavailable` |
| 4 | Sem `OPENROUTER_MODEL_FALLBACK` | só retry |

Referências: [contracts/model-factory.md](./contracts/model-factory.md), [contracts/chat-http.md](./contracts/chat-http.md).

---

## 2. Smoke manual (opcional, com rede)

```bash
# .env
# OPENROUTER_MODEL=...
# OPENROUTER_MODEL_FALLBACK=...   # modelo reserva distinto

npm run dev
```

```bash
curl -s localhost:3000/chat -H 'content-type: application/json' \
  -d '{"message":"liste alertas","userId":"demo"}' \
  | jq '{modelUsed: .metrics.modelUsed, fallback: [.trace[]|select(.type=="fallback")], route: .metrics.route}'
```

**Esperado**: `modelUsed` preenchido; `fallback` só se a reserva tiver sido usada.

---

## 3. Critérios de aceite rápido

- [x] SC-001 — retry sem fallback indevido
- [x] SC-002 — fallback → evento + `modelUsed` = reserva
- [x] SC-003 — all-fail → 503
- [x] SC-004 — fábrica única
- [x] `npm test` + `typecheck` verdes

---

## Nota

Arena/bench herdam a fábrica; o contrato 503 é canônico no HTTP `/chat`.
