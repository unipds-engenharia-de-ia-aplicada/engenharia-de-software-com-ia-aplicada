# Contract: POST /chat (extensão — medição de contexto)

**Phase 1 output for** `specs/010-context-measurement/plan.md`

Estende `specs/003-chat-api/contracts/chat-http.md` e deltas `007` / `008` / `009`. Abaixo só o delta desta feature.

---

## Endpoint

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/chat` |

Request body: **inalterado**.

---

## Responses (delta)

### 200 OK — `metrics` estendido

```json
{
  "answer": "...",
  "trace": [{ "type": "answer", "content": "..." }],
  "metrics": {
    "llmCalls": 2,
    "latencyMs": 1234,
    "historyMessages": 4,
    "recalledMemories": 2,
    "promptTokens": 1820,
    "contextBreakdown": {
      "system": 120,
      "history": 400,
      "memories": 45,
      "message": 12
    }
  },
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Campo | Obrigatório no 200 | Descrição |
|-------|--------------------|-----------|
| `metrics.promptTokens` | **não** | Inteiro ≥ 0 = soma real de prompt tokens das LLM calls do turno. **Ausente** se nenhum usage disponível (não usar `0` como “desconhecido”). |
| `metrics.contextBreakdown` | **sim** (após esta feature) | Objeto com chaves `system`, `history`, `memories`, `message` — tokens **estimados** (chars/4) por fonte. |
| `metrics.contextBreakdown.*` | sim | Inteiro ≥ 0; `0` se a fonte estiver vazia. |

Campos existentes (`llmCalls`, `latencyMs`, `historyMessages`, `recalledMemories`) inalterados.

### Erros

Inalterados (`400` / `404` / `422` / `504` / `500`). Usage ausente **não** gera erro.

---

## Semântica do breakdown

| Chave | Conteúdo estimado |
|-------|-------------------|
| `system` | Prompt de sistema OpsPilot |
| `history` | Até 12 mensagens de histórico injetadas |
| `memories` | Fatos do recall (sem envelope de formatação) |
| `message` | Texto cru de `message` no body (não o enriched com memories) |

`promptTokens` (real) **não** precisa igualar a soma do breakdown (estimado; omite tools/overhead do runtime).

---

## Script `conversa-longa.sh` (consumidor)

Por turno, imprimir `promptTokens` de `metrics` (`n/a` se ausente). Não falhar o turno só por métrica faltante.

---

## Testes de contrato (HTTP / runChat)

| # | Setup | Esperado |
|---|-------|----------|
| 1 | Fake strategy com `promptTokens: 42` | JSON inclui `42` |
| 2 | Fake sem `promptTokens` | Campo ausente; breakdown presente |
| 3 | history + memories conhecidos | breakdown bate com `estimateTokens` |
| 4 | primeiro turno (sem hist/mem) | `history: 0`, `memories: 0`; `system` e `message` > 0 se textos não vazios |
