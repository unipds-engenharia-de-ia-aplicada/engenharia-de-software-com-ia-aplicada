# Contract: POST /chat (extensão — history summarization)

**Phase 1 output for** `specs/011-history-summarization/plan.md`

Estende contratos `003` / `007` / `008` / `010`. Abaixo só o delta desta feature.

---

## Endpoint

Request body: **inalterado**.

---

## Composição do contexto (delta)

Antes de `strategy.run`:

1. `maybeSummarize` (se summarizer configurado) sobre mensagens **já** persistidas  
2. `history = lastMessages(conversationId, 8)`  
3. `summary = getSummary(conversationId)`  
4. `recall` (008)  
5. Mensagem enriquecida: summary envelope → memories envelope → current message  
6. `append` user → run → `append` assistant  

---

## Responses (delta)

### 200 OK

| Campo | Mudança |
|-------|---------|
| `metrics.historyMessages` | Teto **8** (antes 12) |
| `metrics.contextBreakdown.summary` | Tokens estimados do resumo injetado (`0` se ausente) — chave sempre presente após esta feature |
| `trace` | Pode incluir `{ "type": "summarize", "content": "..." }` quando houve merge neste turno |

Exemplo (após primeiro lote):

```json
{
  "answer": "...",
  "trace": [
    { "type": "summarize", "content": "..." },
    { "type": "answer", "content": "..." }
  ],
  "metrics": {
    "llmCalls": 1,
    "latencyMs": 100,
    "historyMessages": 8,
    "recalledMemories": 0,
    "contextBreakdown": {
      "system": 120,
      "history": 200,
      "memories": 0,
      "message": 10,
      "summary": 40
    }
  },
  "conversationId": "..."
}
```

### Erros

Inalterados. Falha do summarizer **não** vira 5xx por si só.

---

## Testes HTTP / runChat

| # | Caso | Esperado |
|---|------|----------|
| 1 | ≤ 8 msgs, fake summarizer | 0 calls; sem evento summarize; historyMessages ≤ 8 |
| 2 | 16 msgs pré-seed + turno | 1 call; evento summarize; summary no input da strategy |
| 3 | Turno seguinte | 0 calls; summary ainda no input |
| 4 | Cap history | historyMessages === 8 com histórico longo |
| 5 | Regressão 010 | `contextBreakdown` inclui `summary` |
