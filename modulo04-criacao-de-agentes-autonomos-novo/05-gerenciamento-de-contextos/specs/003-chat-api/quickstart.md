# Quickstart: Chat HTTP API Validation

**Phase 1 output for** `specs/003-chat-api/plan.md`

Guia de validação end-to-end. Sem código de implementação completo.

---

## Pré-requisitos

- Node.js 22 LTS
- `npm install` na raiz
- Para smoke com LLM real: `OPENROUTER_API_KEY` em `.env`

---

## 1. Validação automatizada (sem rede)

```bash
npm test
npm run typecheck
```

**Esperado**: `src/http/server.test.ts` verde; zero erros de tipo.

### Cenários mínimos do teste de integração

| # | Caso | Esperado |
|---|------|----------|
| 1 | `POST /chat` com fake registry + `{ "message": "oi" }` (strategy default ou nome fake) | `200` + `{ answer, trace, metrics }` |
| 2 | Body `{ "mensagem": "..." }` ou sem `message` | `400` + `issues` |
| 3 | `strategy: "nope"` | `422` + `unknown_strategy` |
| 4 | Fake lenta + `timeoutMs` curto | `504` |
| 5 | (opcional) `reflect: true` + critic mock | `200`; métricas/trace refletem reflexão |

Referências: [contracts/chat-http.md](./contracts/chat-http.md), [data-model.md](./data-model.md).

---

## 2. Smoke manual com servidor real (opcional — requer API key)

```bash
npm run dev
```

Em outro terminal:

```bash
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"liste alertas ativos"}' | jq '{answer, llmCalls: .metrics.llmCalls}'

curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"mensagem":"campo errado"}' | jq
```

**Esperado**: primeiro comando `200` com answer; segundo `400` com issues zod.

Com reflexão + P&E (pode demorar; timeout API = 180s):

```bash
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"abra um incidente sev2 para o catalog","strategy":"plan-and-execute","reflect":true}' \
  | jq '{answer, llmCalls: .metrics.llmCalls}'
```

---

## 3. Critérios de sucesso (mapeamento)

| SC | Como verificar |
|----|----------------|
| SC-001 | Caso 1 da tabela / curl mínimo |
| SC-002 | Caso 2 |
| SC-003 | Caso 3 |
| SC-004 | Caso 1 completa < 5s |
| SC-005 | Caso 4 |
| SC-006 | Caso 5 (reflect + mock) |

---

## Referências

- [plan.md](./plan.md)
- [research.md](./research.md)
- [contracts/agents-registry.md](./contracts/agents-registry.md)
