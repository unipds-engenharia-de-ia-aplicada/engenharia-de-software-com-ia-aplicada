# Quickstart: Sumarização de Histórico — Validação

**Phase 1 output for** `specs/011-history-summarization/plan.md`

Guia de validação end-to-end. Sem código de implementação completo.

---

## Pré-requisitos

- Node.js 22 LTS
- `npm install`
- Features `007`–`010` no código

---

## 1. Validação automatizada (sem rede LLM)

```bash
npm test
npm run typecheck
```

**Esperado**:

- Store: `conversation_summaries`, watermark, `messagesAscending`
- `history-summarizer.test.ts` — fake: 0/1 calls, merge, fail-safe
- `runChat` / HTTP — janela 8, evento `summarize`, summary no contexto
- Testes antigos de teto 12 atualizados para 8
- zero erros de tipo

### Cenários mínimos

| # | Caso | Esperado |
|---|------|----------|
| 1 | Fake, total&lt;16 | summarizer 0× |
| 2 | Fake, total=16 | 1×; covered=8; trace summarize |
| 3 | Turno seguinte | 0×; resumo reutilizado |
| 4 | Segundo lote (24) | merge; covered=16 |
| 5 | historyMessages | ≤ 8 sempre |
| 6 | Summarizer throw | 200 / runChat ok; watermark intacto |

Referências: [contracts/conversation-summary.md](./contracts/conversation-summary.md), [contracts/chat-http.md](./contracts/chat-http.md).

---

## 2. Smoke manual (opcional — API key)

```bash
npm run dev
# 16+ turnos no mesmo conversationId (ou ./scripts/conversa-longa.sh)
# jq '.trace[] | select(.type=="summarize")' e .metrics.historyMessages
```

**Esperado**: em algum turno após ~8 turnos (16 msgs), aparece evento `summarize`; `historyMessages` ≤ 8.

---

## 3. Critérios de aceite rápido

- [x] SC-001 — 0 calls sem lote; 1 call no primeiro lote
- [x] SC-002 — reutilização sem recompute
- [x] SC-003 — evento + persistência (+ merge no 2º lote)
- [x] SC-004 — historyMessages ≤ 8 + summary no contexto
- [x] SC-005 — `npm test` + `typecheck` verdes

---

## Nota

Sumarização LLM em produção é best-effort (~150 tokens). Aceite automatizado usa **fake** apenas.
