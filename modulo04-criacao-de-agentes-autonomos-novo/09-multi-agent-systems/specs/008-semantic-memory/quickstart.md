# Quickstart: Memória Semântica — Validação

**Phase 1 output for** `specs/008-semantic-memory/plan.md`

Guia de validação end-to-end. Sem código de implementação completo.

---

## Pré-requisitos

- Node.js 22 LTS
- `npm install` na raiz (inclui `@huggingface/transformers`)
- Primeira execução do teste semântico pode **baixar** `Xenova/all-MiniLM-L6-v2` (cache local HF); rede necessária só nesse cold start
- Smoke com LLM: `OPENROUTER_API_KEY` em `.env` (opcional)

---

## 1. Validação automatizada

```bash
npm test
npm run typecheck
```

**Esperado**:

- `src/memory/memory-store.test.ts` verde (`:memory:` + fake embedder + caso semântico)
- `src/http/server.test.ts` verde com `userId` + recall injetado
- zero erros de tipo

### Cenários mínimos

| # | Caso | Esperado |
|---|------|----------|
| 1 | remember → recall | fato retornado com score ≥ 0.3 |
| 2 | near-dup > 0.92 | segundo `stored: false`; uma linha |
| 3 | recall top-3 / min 0.3 | ≤ 3 itens; scores válidos |
| 4 | isolamento `userId` | A ≠ B |
| 5 | forget | some do recall |
| 6 | **sem palavra em comum** | modelo real acha o fato |
| 7 | `POST /chat` sem `userId` | `400` |
| 8 | `/chat` com memórias + fake | `input.message` contém `Relevant memories:`; `recalledMemories ≥ 1` |

Referências: [contracts/memory-store.md](./contracts/memory-store.md), [contracts/chat-http.md](./contracts/chat-http.md), [data-model.md](./data-model.md).

---

## 2. Smoke manual (opcional)

```bash
npm run dev
```

Pré-popular memórias via script/teste one-shot (não há HTTP `remember` nesta feature), depois:

```bash
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"como está a fila de pagamentos?","userId":"demo-user"}' \
  | jq '{recalledMemories: .metrics.recalledMemories, historyMessages: .metrics.historyMessages, answer}'
```

**Esperado**: `recalledMemories` > 0 se houver fato semanticamente próximo; answer pode citar o contexto.

---

## 3. Critérios de aceite rápido

- [ ] SC-001 — recall ≤ 3 e score ≥ 0.3
- [ ] SC-002 — dedup > 0.92
- [ ] SC-003 — teste sem palavra em comum verde
- [ ] SC-004 — `/chat` injeta recall no prompt
- [ ] SC-005 — forget + isolamento
- [ ] SC-006 — `npm test` + `typecheck` verdes

---

## Nota

Memórias compartilham `OPSPILOT_DB` com ops e conversations. Cache do modelo HF fica fora do repo (não commitar pesos).
