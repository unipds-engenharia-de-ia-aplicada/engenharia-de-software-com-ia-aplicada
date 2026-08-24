# Contract: Conversation Summary + Summarizer

**Phase 1 output for** `specs/011-history-summarization/plan.md`

Referência: [data-model.md](../data-model.md), [research.md](../research.md).

---

## Tabela `conversation_summaries`

```sql
CREATE TABLE IF NOT EXISTS conversation_summaries (
  conversation_id TEXT PRIMARY KEY,
  summary_text TEXT NOT NULL,
  covered_count INTEGER NOT NULL CHECK (covered_count >= 0),
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
```

---

## ConversationStore APIs (delta)

```ts
interface ConversationSummaryRecord {
  conversationId: string;
  text: string;
  coveredCount: number;
  updatedAt: number;
}

interface ConversationStore {
  // existing: create, append, lastMessages
  countMessages(conversationId: string): number;
  messagesAscending(
    conversationId: string,
    offset: number,
    limit: number,
  ): ConversationMessage[];
  getSummary(conversationId: string): ConversationSummaryRecord | null;
  upsertSummary(
    conversationId: string,
    text: string,
    coveredCount: number,
  ): void;
}
```

Id desconhecido → `ConversationNotFoundError` (mesmo padrão de `append`/`lastMessages`).

---

## ConversationSummarizer

```ts
type ConversationSummarizer = (input: {
  previousSummary: string | null;
  batch: ConversationMessage[]; // length 8 no caminho feliz
}) => Promise<string>;
```

| Impl | Comportamento |
|------|----------------|
| Fake | Determinístico; inclui previous + conteúdos do lote; opcional truncate ≤ 150 tokens estimados |
| `createLLMConversationSummarizer` | Structured/text LLM; decisões/fatos/pendências; ~150 tokens; fail → throw (catch no orquestrador) |

Módulo: `src/chat/history-summarizer.ts`.

---

## `maybeSummarize`

```ts
async function maybeSummarize(args: {
  conversations: ConversationStore;
  conversationId: string;
  summarizer: ConversationSummarizer;
}): Promise<{ summaryText: string; event: TraceEvent } | null>
```

- Retorna `null` se `pending < 8`, summarizer ausente (caller não chama), ou falha.
- Sucesso: upsert + `{ summaryText, event: { type: "summarize", content: summaryText } }`.

Constantes: `HISTORY_LIMIT=8`, `SUMMARY_BATCH_SIZE=8`, `SUMMARY_TOKEN_TARGET=150`.

---

## Testes mínimos (fake)

1. `total < 16` e `covered=0` → não chama summarizer  
2. `total=16`, `covered=0` → 1 chamada; `covered_count=8`; evento summarize  
3. Turno seguinte sem novo lote → 0 chamadas; mesmo texto  
4. `total=24`, `covered=8` → merge com previous; `covered_count=16`  
5. Summarizer throw → sem upsert; turno `/chat` ainda 200  
