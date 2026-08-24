# Quickstart: Conversa Persistente — Validação

**Phase 1 output for** `specs/007-persistent-conversation/plan.md`

Guia de validação end-to-end. Sem código de implementação completo.

---

## Pré-requisitos

- Node.js 22 LTS
- `npm install` na raiz
- Smoke com LLM: `OPENROUTER_API_KEY` em `.env`

---

## 1. Validação automatizada (sem rede)

```bash
npm test
npm run typecheck
```

**Esperado**:

- `src/store/sqlite-conversation-store.test.ts` verde (`:memory:`)
- `src/http/server.test.ts` verde (fake + conversation store `:memory:`)
- zero erros de tipo

### Cenários mínimos

| # | Caso | Esperado |
|---|------|----------|
| 1 | Store: create → append × N → `lastMessages(12)` | ordem + teto 12 |
| 2 | `POST /chat` sem `conversationId` + fake | `200` + `conversationId` + `historyMessages: 0` |
| 3 | Segundo `POST` com o mesmo id | mesmo `conversationId`; `historyMessages ≥ 1`; fake `inputs` contém histórico |
| 4 | `conversationId` UUID inexistente | `404` `conversation_not_found`; fake `calls === 0` |
| 5 | `conversationId: "nope"` | `400` + issues zod |
| 6 | 12+ msgs no store → novo turno | `historyMessages === 12` |

Referências: [contracts/chat-http.md](./contracts/chat-http.md), [contracts/conversation-store.md](./contracts/conversation-store.md), [data-model.md](./data-model.md).

---

## 2. Smoke manual (opcional — API key)

```bash
npm run dev
```

```bash
# Turno 1
RESP=$(curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"liste alertas firing"}')
echo "$RESP" | jq '{conversationId, historyMessages: .metrics.historyMessages, answer}'
CID=$(echo "$RESP" | jq -r .conversationId)

# Turno 2 (mesmo fio)
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d "{\"message\":\"resumo do que vimos\",\"conversationId\":\"$CID\"}" \
  | jq '{conversationId, historyMessages: .metrics.historyMessages, answer}'
```

**Esperado**: mesmo `conversationId`; segundo turno com `historyMessages >= 2` (user+assistant do turno 1); answer coerente com o histórico.

Id inexistente:

```bash
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"oi","conversationId":"00000000-0000-4000-8000-000000000000"}' | jq
```

**Esperado**: `404` + `conversation_not_found`.

---

## 3. Critérios de aceite rápido

- [ ] SC-001 — dois turnos com o mesmo id (teste ou curl)
- [ ] SC-002 — teto 12 em `historyMessages` (teste store/HTTP)
- [ ] SC-003 — omitir id cria novo; id inválido/inexistente não roda estratégia
- [ ] SC-004 — `npm test` + `typecheck` verdes

---

## Nota

Persistência de conversa compartilha `OPSPILOT_DB` com o ops store; após smoke real, mensagens ficam no mesmo arquivo `./data/opspilot.db` (gitignored).
