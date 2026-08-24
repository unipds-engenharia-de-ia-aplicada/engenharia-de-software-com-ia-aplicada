# Research: Sumarização de Histórico (Pruning)

**Phase 0 output for** `specs/011-history-summarization/plan.md`

---

## Contexto

`007` injeta até **12** mensagens brutas. Conversas longas (ex. `conversa-longa.sh`) incham o prompt. Esta feature troca o teto bruto para **8** e move o restante para um resumo persistido, atualizado em **lotes de 8** saídas — nunca a cada request.

---

## Decisão 1: Watermark = `covered_count` (mensagens desde o início)

**Decisão**:

- `covered_count` = quantas mensagens mais antigas (ordem crescente por `rowid`/`created_at`) já estão representadas no resumo.
- `total = countMessages(conversationId)` **antes** do append da mensagem do turno atual.
- `outside = max(0, total - HISTORY_LIMIT)` com `HISTORY_LIMIT = 8`.
- `pending = outside - covered_count`.
- Disparo se `pending >= 8`.
- Lote = próximas **8** mensagens a partir do índice `covered_count` (0-based, ascending).
- Após upsert OK: `covered_count += 8`.
- Máximo **um** lote por turno (mesmo se `pending >= 16`).

**Rationale**: Contagem estável sem depender de IDs; alinhado ao default da spec.

**Alternatives considered**:

- Watermark por `message.id` — mais frágil com deletes (não há delete hoje).
- Re-sumarizar tudo fora da janela a cada disparo — mais caro e não “lote de 8 novas”.

---

## Decisão 2: Momento = início do `runChat` (mensagens já persistidas)

**Decisão**:

Ordem do turno:

1. Resolver `conversationId` (create se necessário).
2. `maybeSummarize(conversations, summarizer, conversationId)` — pode gravar summary + emitir evento local.
3. `history = lastMessages(8)`; `summary = getSummary(...)`.
4. `recall` → enrich message **com summary** (se houver) + memories.
5. `append` user → `strategy.run({ history, message })` → `append` assistant.
6. Concatenar evento `summarize` (se houve) **no início** do `trace` retornado (antes do trace da strategy).
7. `scheduleLearning` como hoje.

**Rationale**: Spec — condição avaliada sobre histórico estável já no DB; não roda “por request” sem lote.

**Alternatives considered**: Fim do turno após appends — também válido; início evita sumarizar a mensagem ainda não respondida neste turno e casa com “ao montar contexto”.

---

## Decisão 3: Injeção do resumo no contexto

**Decisão**:

```ts
formatSummaryForPrompt(summary: string | null, body: string): string
// se summary trim vazio → return body
// senão:
// Conversation summary:\n<summary>\n\n<body>
```

Aplicar **antes** ou **em volta** de `formatMemoriesForPrompt`: ordem canônica:

1. `Conversation summary:` (se houver)
2. `Relevant memories:` (se houver)
3. `Current message:`

`history` da strategy = só as ≤ 8 brutas (`historyMessages` = `history.length`).

**Rationale**: Mesmo padrão de envelope das memórias; strategies intocadas além do texto da mensagem.

---

## Decisão 4: Porta `ConversationSummarizer` + LLM / fake

**Decisão**:

```ts
export type ConversationSummarizer = (input: {
  previousSummary: string | null;
  batch: ConversationMessage[];
}) => Promise<string>;
```

- **Fake (testes)**: determinístico, ex.  
  `merge(${previousSummary ?? ""})|batch:${batch.map(m => m.content).join(";")}`  
  opcionalmente truncar para `estimateTokens(text) ≤ 150`.
- **Prod**: `createLLMConversationSummarizer(modelFactory)` — `withStructuredOutput` `{ summary: string }` ou invoke texto; system prompt: preservar decisões, fatos, pendências; ~150 tokens; não copiar segredos; mesclar com `previousSummary`.
- `RunChatOptions.summarizer?: ConversationSummarizer` — se ausente, **não** sumariza (só janela 8); produção (`index`) injeta o LLM summarizer.
- Fail-safe: try/catch em `maybeSummarize` → sem upsert, sem evento, turno segue.

**Rationale**: FR-008/009; mesmo padrão do learning reflector.

---

## Decisão 5: Persistência na `SqliteConversationStore`

**Decisão**: Estender o store (não segundo arquivo DB):

```sql
CREATE TABLE IF NOT EXISTS conversation_summaries (
  conversation_id TEXT PRIMARY KEY,
  summary_text TEXT NOT NULL,
  covered_count INTEGER NOT NULL CHECK (covered_count >= 0),
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
```

APIs no `ConversationStore`:

| Método | Semântica |
|--------|-----------|
| `countMessages(id)` | total de rows em `messages` |
| `messagesAscending(id, offset, limit)` | lote ordenado ASC por `rowid` |
| `getSummary(id)` | `{ text, coveredCount, updatedAt } \| null` |
| `upsertSummary(id, text, coveredCount)` | INSERT OR REPLACE |

**Rationale**: FR-001; um DB; interface única para `runChat`.

---

## Decisão 6: Trace + tipos + métricas

**Decisão**:

- `TraceEventType` += `"summarize"`.
- Evento: `{ type: "summarize", content: <summary text after merge> }`.
- Em falha: **omitir** evento (não inventar summarize de erro).
- `HISTORY_LIMIT = 8`; atualizar testes que assumem 12.
- `ContextBreakdown`: adicionar chave opcional **`summary`** (estimateTokens do texto do resumo injetado; `0` se ausente). Manter as quatro chaves existentes; breakdown passa a 5 chaves quando esta feature estiver wired — **sempre** incluir `summary` (0 se vazio) para mapa estável no `/chat`.

**Rationale**: Observabilidade + continuidade com `010`.

---

## Decisão 7: Alvo ~150 tokens

**Decisão**: Constante `SUMMARY_TOKEN_TARGET = 150`.

- LLM: instrução explícita no prompt.
- Fake: truncar string até `estimateTokens(s) <= 150` (corte por chars `150 * 4`).
- Sem tokenizer real.

---

## Decisão 8: Escopo fora

- Apagar mensagens antigas do SQLite (só deixam de ir brutas no prompt).
- Sumarizar memórias semânticas (`008`).
- Endpoint HTTP dedicado para summary.
- Recompute forçado via query param.

---

## Resolução de NEEDS CLARIFICATION

Nenhum item do Technical Context ficou como NEEDS CLARIFICATION — decisões 1–8 fecham watermark, timing, injeção, store, fake/LLM e ~150 tokens.
