# Contract: MemoryStore + Embedder

**Phase 1 output for** `specs/008-semantic-memory/plan.md`

Referência de entidades: [data-model.md](../data-model.md).

---

## Embedder

```ts
interface Embedder {
  embed(text: string): Promise<Float32Array>;
}
```

| Regra | Detalhe |
|-------|---------|
| Dimensão | 384 |
| Norma | L2 ≈ 1 (normalize: true) |
| Modelo default | `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers` |
| Pipeline | `feature-extraction` + `{ pooling: "mean", normalize: true }` |
| Lifecycle | Lazy singleton (`getDefaultEmbedder()`); uma pipeline por processo |
| Erros | Falha de carga/inferência → `EmbeddingError` |

Módulo: `src/memory/embeddings.ts`.

---

## MemoryStore

```ts
interface MemoryStore {
  remember(userId: string, fact: string): Promise<RememberResult>;
  recall(userId: string, query: string): Promise<RecalledMemory[]>;
  forget(userId: string, id: string): Promise<boolean>;
}
```

Implementação: `SqliteMemoryStore` em `src/memory/memory-store.ts`.

### Constructor

```ts
new SqliteMemoryStore(
  path?: string,           // default OPSPILOT_DB ?? ./data/opspilot.db
  embedder?: Embedder,     // default getDefaultEmbedder()
)
```

### remember

| | |
|---|---|
| **Input** | `userId` não vazio; `fact` trim length ≥ 1 |
| **Behavior** | Embed → se algum fato do user com dot **> 0.92**, não insert (`stored: false`, `id` do existente); senão insert |
| **Output** | `{ id: string, stored: boolean }` |

### recall

| | |
|---|---|
| **Input** | `userId`; `query` trim length ≥ 1 |
| **Behavior** | Embed query → dot vs todos do user → filter **≥ 0.3** → sort desc → top **3** |
| **Output** | `RecalledMemory[]` (0–3); cada item `{ id, fact, score }` |
| **Isolamento** | Nunca retorna fatos de outro `userId` |

### forget

| | |
|---|---|
| **Input** | `userId`, `id` |
| **Behavior** | `DELETE WHERE id = ? AND user_id = ?` |
| **Output** | `true` se removeu 1 linha; `false` caso contrário (no-op) |

---

## Persistence

Tabela `memories` — ver DDL em [data-model.md](../data-model.md).

BLOB: 384 × float32 LE. Testes: `path === ":memory:"`.

---

## Test contract (mínimo)

| Caso | Assert |
|------|--------|
| remember → recall mesmo texto | score alto; fato presente |
| near-dup `> 0.92` | segundo `stored === false`; count = 1 |
| top-3 + min 0.3 | length ≤ 3; todos score ≥ 0.3 |
| isolamento user | A não vê fatos de B |
| forget | recall não retorna id |
| **sem palavra em comum** | modelo real; query lexicalmente disjunta encontra o fato |
