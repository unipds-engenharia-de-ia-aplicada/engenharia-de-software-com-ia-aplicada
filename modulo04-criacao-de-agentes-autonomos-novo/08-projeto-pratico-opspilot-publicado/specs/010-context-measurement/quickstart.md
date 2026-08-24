# Quickstart: Medição de Contexto — Validação

**Phase 1 output for** `specs/010-context-measurement/plan.md`

Guia de validação end-to-end. Sem código de implementação completo.

---

## Pré-requisitos

- Node.js 22 LTS
- `npm install`
- Features `007`–`009` no código (histórico, memórias, metrics base)

---

## 1. Validação automatizada (sem rede LLM)

```bash
npm test
npm run typecheck
```

**Esperado**:

- `src/context/tokens.test.ts` — `estimateTokens`, `readLlmUsage`, soma, breakdown
- `src/chat/compose-prompt.test.ts` e/ou `src/http/server.test.ts` — `promptTokens` + `contextBreakdown`
- zero erros de tipo

### Cenários mínimos

| # | Caso | Esperado |
|---|------|----------|
| 1 | `estimateTokens` bordas 0/3/4/5 | regra `floor(n/4)` |
| 2 | usage_metadata → `readLlmUsage` | `promptTokens` correto |
| 3 | Fake `/chat` com `promptTokens: 42` | métrica na resposta |
| 4 | Fake sem usage | `promptTokens` ausente; breakdown com 4 chaves |
| 5 | history/memories controlados | breakdown = estimativas das fontes |

Referências: [contracts/tokens.md](./contracts/tokens.md), [contracts/chat-http.md](./contracts/chat-http.md).

---

## 2. Smoke manual (opcional — API key)

```bash
npm run dev
```

```bash
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"liste os alertas firing","userId":"demo"}' \
  | jq '{promptTokens: .metrics.promptTokens, contextBreakdown: .metrics.contextBreakdown, historyMessages: .metrics.historyMessages}'
```

**Esperado**: `contextBreakdown` com quatro chaves; `promptTokens` numérico se o provedor reportar usage.

Script longo (servidor no ar):

```bash
./scripts/conversa-longa.sh
```

**Esperado**: cada linha de turno inclui `promptTokens=<n|n/a>`.

---

## 3. Critérios de aceite rápido

- [x] SC-001 — `estimateTokens` canônico nos testes
- [x] SC-002 — `promptTokens` injetado/conhecido bate no `/chat`
- [x] SC-003 — `contextBreakdown` coerente com fontes
- [x] SC-004 — `conversa-longa.sh` imprime `promptTokens`
- [x] SC-005 — `npm test` + `typecheck` verdes

---

## Nota

Soma do breakdown estimado tipicamente **≠** `promptTokens` real (overhead de tools/runtime). Comparar tendência ao longo dos turnos, não igualdade estrita.
