# Data Model: Sumarização de Histórico

**Phase 1 output for** `specs/011-history-summarization/plan.md`

---

## Entities

### ConversationSummary

| Field | Type | Constraints |
|-------|------|-------------|
| `conversationId` | `string` | PK / FK → `conversations.id` |
| `text` | `string` | Resumo mesclado atual; trim length ≥ 1 quando persistido |
| `coveredCount` | `number` (int ≥ 0) | Quantas mensagens mais antigas já cobertas |
| `updatedAt` | `number` | Epoch ms |

Persistido em `conversation_summaries`.

---

### SummarizeBatch

Lote de exatamente **8** `ConversationMessage` contíguas a partir de `coveredCount`, ordem ascending.

---

### ConversationSummarizer (porta)

Entrada: `{ previousSummary: string | null, batch: ConversationMessage[] }`  
Saída: `Promise<string>` (novo resumo mesclado, alvo ~150 tokens).

---

### TraceEvent `summarize`

| Field | Value |
|-------|--------|
| `type` | `"summarize"` |
| `content` | Texto do resumo após merge bem-sucedido |

---

## Constants

| Name | Value |
|------|-------|
| `HISTORY_LIMIT` | `8` |
| `SUMMARY_BATCH_SIZE` | `8` |
| `SUMMARY_TOKEN_TARGET` | `150` |

---

## Watermark state machine

```text
total = countMessages(cid)          # before append current user
covered = getSummary(cid)?.coveredCount ?? 0
outside = max(0, total - 8)
pending = outside - covered

if pending >= 8:
  batch = messagesAscending(cid, covered, 8)
  text = await summarizer({ previousSummary, batch })  # fail-safe
  upsertSummary(cid, text, covered + 8)
  emit summarize event
```

---

## ConversationStore (estendido)

Além de `create` / `append` / `lastMessages`:

| Method | Notes |
|--------|-------|
| `countMessages(conversationId)` | |
| `messagesAscending(conversationId, offset, limit)` | ASC por rowid |
| `getSummary(conversationId)` | `ConversationSummary \| null` |
| `upsertSummary(conversationId, text, coveredCount)` | |

---

## Context composition

```text
[Conversation summary?] + [Relevant memories?] + Current message
+ strategy.history = lastMessages(8)
```

`metrics.historyMessages` = length do history bruto (≤ 8).  
`contextBreakdown.summary` = `estimateTokens(summaryText)` ou `0`.

---

## Validation rules

| Regra | Onde |
|-------|------|
| Disparo só se `pending >= 8` | `maybeSummarize` |
| Watermark avança só após upsert | `maybeSummarize` |
| Summarizer throw → sem upsert / sem evento | fail-safe |
| `HISTORY_LIMIT === 8` | `run-chat.ts` |
| Trace type `summarize` no union | `domain/types.ts` |
