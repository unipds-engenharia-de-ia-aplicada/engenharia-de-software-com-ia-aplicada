# Data Model: Memória Semântica

**Phase 1 output for** `specs/008-semantic-memory/plan.md`

---

## Entities

### MemoryFact

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `string` | PK; UUID v4 |
| `userId` / `user_id` | `string` | NOT NULL; escopo de isolamento |
| `fact` | `string` | NOT NULL; texto trimado; length ≥ 1 |
| `embedding` | `Float32Array` / BLOB | NOT NULL; **384** floats little-endian |
| `createdAt` / `created_at` | `number` | Epoch ms; NOT NULL |

---

### RecalledMemory

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `string` | id do fato |
| `fact` | `string` | texto |
| `score` | `number` | produto escalar; **≥ 0,3** no resultado de `recall` |

---

### Embedder (serviço)

| Operação | Contrato |
|----------|----------|
| `embed(text)` | `Promise<Float32Array>` length 384, L2-normalized |

Implementação default: lazy singleton Transformers.js `Xenova/all-MiniLM-L6-v2`, `{ pooling: "mean", normalize: true }`.

---

## Closed Domains / Constants

| Name | Value |
|------|-------|
| Embedding dim | `384` |
| Dedup threshold | `> 0.92` (estrito) |
| Recall min score | `≥ 0.3` (inclusivo) |
| Recall top-K | `3` |
| Model id | `Xenova/all-MiniLM-L6-v2` |

---

## SQL DDL (idempotente)

```sql
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  fact TEXT NOT NULL,
  embedding BLOB NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_user
  ON memories (user_id);
```

Mesmo arquivo que ops + conversations (`OPSPILOT_DB`).

---

## TypeScript contracts (domínio)

```ts
export interface MemoryFact {
  id: string;
  userId: string;
  fact: string;
  createdAt: number;
}

export interface RecalledMemory {
  id: string;
  fact: string;
  score: number;
}

export interface RememberResult {
  id: string;
  stored: boolean; // false se near-duplicate ignorado
}

export interface Embedder {
  embed(text: string): Promise<Float32Array>;
}

export interface MemoryStore {
  remember(userId: string, fact: string): Promise<RememberResult>;
  recall(userId: string, query: string): Promise<RecalledMemory[]>;
  forget(userId: string, id: string): Promise<boolean>;
}
```

---

## Operações (estado)

### remember

```text
trim(fact); se vazio → erro de validação/domínio
embedding = embed(fact)
carregar fatos do userId
se ∃ score(embedding, existing) > 0.92 → return { id: existing.id, stored: false }
senão INSERT → return { id: newId, stored: true }
```

### recall

```text
trim(query); se vazio → erro
q = embed(query)
scores = produto escalar vs todos do userId
filtrar score ≥ 0.3; sort desc; take 3
```

### forget

```text
DELETE WHERE id = ? AND user_id = ?
return changes === 1
```

---

## Chat request / response (visão de modelo)

### ChatRequest (estendido)

| Field | Required | Notes |
|-------|----------|-------|
| `message` | sim | ≥ 1 char |
| `userId` | **sim** | string trim; min 1 |
| `strategy` | não | default `react` |
| `reflect` | não | default `false` |
| `conversationId` | não | UUID (007) |

### ChatResponse (estendido)

| Field | Notes |
|-------|-------|
| `answer` / `trace` / `conversationId` | inalterados (007) |
| `metrics.historyMessages` | 007 |
| `metrics.recalledMemories` | int 0–3; fatos injetados neste turno |

---

## Fluxo de um turno (composição)

```text
validar body (userId obrigatório)
resolve/create conversationId (007)
history = lastMessages(12)
recalled = memories.recall(userId, message)
enriched = formatMemoriesForPrompt(recalled, message)
append(user, message)          # texto original
run({ message: enriched, history })
append(assistant, answer)
200 { ..., metrics: { historyMessages, recalledMemories: recalled.length } }
```

---

## Validation rules

| Regra | Onde |
|-------|------|
| `userId` não vazio | zod `/chat` |
| `fact` / `query` não vazios após trim | MemoryStore |
| Dedup `> 0.92` | remember |
| Recall `≥ 0.3`, top 3 | recall |
| Embedding dim 384 | Embedder + assert no store |
| Isolamento por `user_id` | todas as queries SQL |
| Sem SQL concatenado | prepared statements |
