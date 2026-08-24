# Contract: POST /chat (extensão — memória semântica)

**Phase 1 output for** `specs/008-semantic-memory/plan.md`

Estende `specs/003-chat-api/contracts/chat-http.md` e o delta de `specs/007-persistent-conversation/contracts/chat-http.md`. Abaixo só o delta desta feature.

---

## Endpoint

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/chat` |
| **Content-Type** | `application/json` |

---

## Request body (delta)

```json
{
  "message": "como está o checkout?",
  "userId": "plantonista-42",
  "strategy": "react",
  "reflect": false,
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Campo | Obrigatório | Default | Descrição |
|-------|-------------|---------|-----------|
| `message` | sim | — | (inalterado) |
| **`userId`** | **sim** | — | Identificador opaco do usuário (string ≥ 1); escopo do recall |
| `strategy` | não | `"react"` | (inalterado) |
| `reflect` | não | `false` | (inalterado) |
| `conversationId` | não | — | (007) |

Validação zod: `userId: z.string().min(1)` (aplicar trim se desejado via preprocess).

---

## Responses (delta)

### 200 OK

```json
{
  "answer": "...",
  "trace": [{ "type": "answer", "content": "..." }],
  "metrics": {
    "llmCalls": 2,
    "latencyMs": 1234,
    "historyMessages": 4,
    "recalledMemories": 2
  },
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Campo | Descrição |
|-------|-----------|
| `metrics.recalledMemories` | Quantos fatos (0–3) foram injetados no prompt neste turno |

### 400 Bad Request

Além dos casos existentes: `userId` ausente, não-string, ou string vazia.

### 404 / 422 / 504 / 500

Inalterados (conversa, strategy, timeout, internal).

---

## Composição do prompt (delta)

Antes de `strategy.run`:

1. `history = conversations.lastMessages(conversationId, 12)` (007)
2. `recalled = await memories.recall(userId, message)`
3. `enriched = formatMemoriesForPrompt(recalled, message)`
4. Persistir user com **`message` original** (não `enriched`)
5. `strategy.run({ message: enriched, history })`
6. Em sucesso: append assistant; `recalledMemories = recalled.length`

### `formatMemoriesForPrompt`

Se `recalled.length === 0` → retorna `message` inalterado.

Senão:

```text
Relevant memories:
- <fact>
- <fact>

Current message:
<message>
```

---

## App deps (delta)

```ts
export interface ChatAppDeps {
  registry: StrategyRegistry;
  conversations: ConversationStore;
  memories: MemoryStore; // obrigatório
  timeoutMs?: number;
  reflectionOpts?: ReflectionOpts;
}
```

Bootstrap (`index.ts`): `new SqliteMemoryStore(dbPath)` (mesmo `OPSPILOT_DB`).

---

## Exemplos curl

```bash
# Seed memória (via teste/REPL — sem HTTP remember nesta feature)
# Depois:

curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"status do pagamento","userId":"plantonista-42"}' \
  | jq '{conversationId, recalledMemories: .metrics.recalledMemories, answer}'
```

Sem `userId`:

```bash
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"oi"}' | jq
```

**Esperado**: `400` + `validation_error`.
