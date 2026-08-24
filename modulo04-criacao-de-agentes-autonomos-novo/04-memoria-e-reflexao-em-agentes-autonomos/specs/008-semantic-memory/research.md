# Research: Memória Semântica

**Phase 0 output for** `specs/008-semantic-memory/plan.md`

---

## Contexto

`POST /chat` já persiste conversa e injeta histórico (`007`). Falta memória **semântica** de longo prazo por usuário: fatos com embedding local, recall por similaridade, e injeção no prompt além do histórico recente. Spec fixa limiares, top-3, modelo MiniLM, paths `src/memory/*` e colunas da tabela `memories`.

---

## Decisão 1: Módulo `src/memory/` + mesmo arquivo DB

**Decisão**:

- Interface `MemoryStore` (e tipos `MemoryFact` / `RecalledMemory`) em `domain/types.ts`.
- Implementação `SqliteMemoryStore` em `src/memory/memory-store.ts` (não em `src/store/` — escopo semântico + dependência de Embedder).
- Path: `process.env.OPSPILOT_DB ?? "./data/opspilot.db"`; testes `:memory:`.
- DDL no construtor: tabela `memories` + índice `(user_id)`; prepared statements only.
- Produção: terceira conexão `DatabaseSync` no mesmo path (padrão já usado ops + conversation).

**Rationale**: Spec manda paths sob `src/memory/`; contrato distinto de `OpsStore` / `ConversationStore`; mesmo path evita segundo arquivo.

**Alternatives considered**:

- Colocar em `src/store/sqlite-memory-store.ts` — contradiz FR-007 canônico.
- Um único `DatabaseSync` compartilhado — adiar (mesmo trade-off da 007).

---

## Decisão 2: Embeddings — Transformers.js lazy singleton

**Decisão**:

- Dependência: `@huggingface/transformers`.
- Modelo: `Xenova/all-MiniLM-L6-v2` (ONNX para Transformers.js; equivalente all-MiniLM-L6-v2).
- API em `src/memory/embeddings.ts`:

```ts
export interface Embedder {
  embed(text: string): Promise<Float32Array>; // dim 384, L2-normalized
}

export function getDefaultEmbedder(): Embedder; // lazy singleton
```

- Internamente: `pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2")` uma vez; cada `embed` chama com `{ pooling: "mean", normalize: true }` e devolve `Float32Array` de length 384.
- Singleton: promise memoizada (evita double-init concorrente).
- Falha de load/inferência → `EmbeddingError` (domínio).

**Rationale**: Spec FR-006; docs oficiais usam exatamente pooling mean + normalize; singleton alinhado ao tutorial Node do HF.

**Alternatives considered**:

- `sentence-transformers` Python sidecar — fora da stack Node.
- API remota de embeddings — contradiz “local”.

---

## Decisão 3: Similaridade, limiares e brute-force

**Decisão**:

- Similaridade = **produto escalar** `Σ a_i * b_i` (vetores já normalizados ⇒ cosseno).
- `remember`: carregar embeddings do `userId`; se **algum** score **> 0,92**, **não inserir** (near-duplicate ignorado); retornar `{ stored: false, id: existingId }` ou shape equivalente. Caso contrário INSERT e `{ stored: true, id }`.
- `recall`: scores de todos os fatos do user; filtrar **≥ 0,3**; ordenar desc; **slice(0, 3)**.
- Escala v1: brute-force in-process (sem índice vetorial). Suficiente para dezenas/centenas de fatos por usuário.

**Rationale**: Limiares e top-3 da spec; ignore-on-dup é a política near-duplicate mais simples e testável.

**Alternatives considered**:

- Atualizar `created_at` no near-dup — complexidade sem ganho no aceite.
- sqlite-vss / FAISS — overkill para o escopo do módulo.

---

## Decisão 4: BLOB e IDs

**Decisão**:

- Dimensão fixa **384**.
- Serialização: `Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength)` ao gravar; ao ler `new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)` (ou cópia explícita se o Buffer for slice Node).
- `id`: `crypto.randomUUID()`.
- `created_at`: epoch ms (`Date.now()`).
- `user_id` / `fact`: TEXT NOT NULL; fact trim; rejeitar `""` após trim.

**Rationale**: Float32 BLOB é o formato natural; UUID alinhado a conversation ids.

---

## Decisão 5: `forget` — no-op seguro

**Decisão**:

- `forget(userId, id): boolean` — `DELETE FROM memories WHERE id = ? AND user_id = ?`.
- Retorna `true` se `changes === 1`, senão `false` (id inexistente **ou** outro usuário).
- **Não** lança erro para id ausente (evita oracle cross-user); nunca apaga linha de outro `user_id`.

**Rationale**: Spec permitia no-op ou erro; no-op + boolean é seguro e testável.

---

## Decisão 6: Injeção no prompt via `runChat` (estratégias intocadas)

**Decisão**:

1. Estender `ChatInput` / `runChat` com `userId: string` e dep `memories: MemoryStore`.
2. Antes de `strategy.run`: `recalled = await memories.recall(userId, message)`.
3. `enrichedMessage = formatMemoriesForPrompt(recalled, message)`.
4. `strategy.run({ message: enrichedMessage, history })` — **mesmo** `StrategyRunInput`; React e Plan-Execute veem o bloco no `message` / texto composto.
5. Formato canônico:

```text
Relevant memories:
- <fact1>
- <fact2>

Current message:
<message>
```

Se `recalled.length === 0`, prompt/message permanece **apenas** `message` (sem cabeçalho vazio).

6. Métrica: `metrics.recalledMemories = recalled.length` (sempre setada na resposta `/chat`, como `historyMessages`).
7. Ordem no fluxo: resolve conversation → `lastMessages` → **recall** → append user (mensagem **original**, não o bloco enriquecido) → `run(enriched)` → append assistant.

**Rationale**: Zero mudança em estratégias; histórico de conversa continua limpo (sem poluir DB com o prefixo de memórias); fake strategy asserta substring `Relevant memories:` no `input.message`.

**Alternatives considered**:

- Campo `memories?: string[]` em `StrategyRunInput` — blast radius em reflect/P&E/testes.
- Agent tools remember/forget nesta feature — útil depois; spec default = fora; store testável basta para SC.

---

## Decisão 7: Schema HTTP `userId`

**Decisão**:

- `userId: z.string().min(1)` **obrigatório** (não UUID — ids opacos do cliente).
- Ausente / vazio → `400` validation_error.
- `ChatAppDeps.memories: MemoryStore` obrigatório.

**Rationale**: Spec assumption; não acoplar a UUID de conversa.

---

## Decisão 8: Test harness

**Decisão**:

| Suíte | Setup |
|-------|--------|
| Unit store (dedup, top-3, forget, isolamento) | `SqliteMemoryStore(":memory:", fakeEmbedder)` — vetores ortogonais / quase-iguais controlados |
| Semântico FR-009 | Modelo **real** `getDefaultEmbedder()`; fato vs query sem overlap lexical; `timeout` alto (ex. 120s); pode baixar modelo na 1ª execução (cache `~/.cache/huggingface`) |
| `/chat` | fake strategy + conversation `:memory:` + memory `:memory:` + fake embedder; assert `userId` 400, recall no `inputs[0].message`, `recalledMemories` |

Fake embedder: hash determinístico → vetor unitário (ou tabela texto→vetor) para testes rápidos sem HF.

**Rationale**: FR-009 exige modelo real num caso; restante permanece rápido e offline de rede LLM (HF cache pode precisar rede na 1ª vez — documentar no quickstart).

---

## Decisão 9: Escopo explícito fora

- Agent tools / MCP / CLI / Arena para remember|forget|recall: **não** nesta feature.
- Sem TTL, sem listagem HTTP de memórias, sem multi-modelo.
- Sem mudança de assinatura `ReasoningStrategy` além do conteúdo de `message` enriquecido pela composição.

---

## Resolução de NEEDS CLARIFICATION

Nenhum item do Technical Context ficou como NEEDS CLARIFICATION — decisões 1–9 fecham embedder, BLOB, limiares, forget, composição, schema e testes.
