# Quickstart: Trace Persistido + Logs JSON

**Phase 1 output for** `specs/015-persistent-trace-logs/plan.md`

Validação end-to-end local (sem rede de LLM se usar fake/deps de teste).

---

## Prerequisites

- Node.js 22+
- Dependências instaladas (`npm ci` / `npm install`)
- Contratos: [chat-http.md](./contracts/chat-http.md), [request-store.md](./contracts/request-store.md), [logger.md](./contracts/logger.md)

---

## Automated

```bash
npm run typecheck
npm test
```

Foco esperado após implementação:

- `src/obs/logger.test.ts` — 1 linha JSON / deny-list
- `src/store/sqlite-request-store.test.ts` — save/get / ordem / `:memory:`
- `src/http/server.test.ts` — `requestId` === `X-Request-Id`; GET 200/404/400; persist fail → ainda 200

---

## Manual smoke (arquivo real)

```bash
export OPSPILOT_DB=./data/opspilot-audit-smoke.db
# subir servidor (npm run dev / comando do projeto) com modelo configurado ou harness

curl -sD - -X POST http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"liste alertas","userId":"smoke"}'
# anotar requestId do body e X-Request-Id

curl -s http://localhost:3000/requests/<requestId> | jq .
# esperando request.metrics + trace ordenado

# reiniciar processo com mesmo OPSPILOT_DB e repetir GET — mesmos dados (SC-005)
```

Stdout: linhas JSON com `event` `chat_request_*` e `requestId`, sem texto da mensagem.

---

## Expected outcomes

| Check | Pass |
|-------|------|
| Body `requestId` = header | ✅ SC-001 (server.test) |
| GET devolve N eventos na ordem | ✅ SC-002 (server.test) |
| GET uuid inexistente | ✅ 404 SC-003 |
| Logs 1× JSON / só meta | ✅ SC-004 (logger.test) |
| Restart + GET | ✅ SC-005 (sqlite-request-store.test file reopen) |
