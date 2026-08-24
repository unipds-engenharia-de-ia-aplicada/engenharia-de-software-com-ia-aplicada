# Contract: POST /chat (extensão — conversa persistente)

**Phase 1 output for** `specs/007-persistent-conversation/plan.md`

Estende o contrato de `specs/003-chat-api/contracts/chat-http.md`. Campos e status anteriores permanecem; abaixo só o delta.

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
  "message": "qual o status do checkout?",
  "strategy": "react",
  "reflect": false,
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Campo | Obrigatório | Default | Descrição |
|-------|-------------|---------|-----------|
| `message` | sim | — | (inalterado) |
| `strategy` | não | `"react"` | (inalterado) |
| `reflect` | não | `false` | (inalterado) |
| `conversationId` | não | — | UUID da conversa; omitir para criar nova |

Validação zod: `conversationId: z.string().uuid().optional()`.

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
    "historyMessages": 4
  },
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Campo | Descrição |
|-------|-----------|
| `conversationId` | Sempre presente em sucesso (criado ou reutilizado) |
| `metrics.historyMessages` | Quantas mensagens prévias foram injetadas no prompt (0–12) |

### 400 Bad Request

Além dos casos de `003`: `conversationId` presente mas não-UUID (ex.: `""`, `"abc"`).

### 404 Not Found — conversa inexistente

```json
{
  "error": "conversation_not_found",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Sem executar estratégia; sem append.

### 422 / 504 / 500

Inalterados (`unknown_strategy`, `timeout`, `internal_error`).

---

## Composição do prompt

Antes de `strategy.run`:

1. `history = conversations.lastMessages(conversationId, 12)`
2. `prompt = composeChatPrompt(history, message)`
3. `historyMessages = history.length`
4. `result = await runWithTimeout(strategy.run(prompt), …)`
5. Em sucesso: `append(user, message)` + `append(assistant, result.answer)`

Formato de `composeChatPrompt`: ver [research.md](../research.md) Decisão 2. Primeiro turno (`history=[]`) → prompt === `message`.

---

## App deps

```ts
export interface ChatAppDeps {
  registry: StrategyRegistry;
  conversations: ConversationStore; // obrigatório
  timeoutMs?: number;
  reflectionOpts?: ReflectionOpts;
}
```

Bootstrap (`index.ts`): `new SqliteConversationStore(process.env.OPSPILOT_DB ?? "./data/opspilot.db")`.

---

## Exemplos curl

Nova conversa:

```bash
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"liste alertas ativos"}' | jq '{conversationId, historyMessages: .metrics.historyMessages, answer}'
```

Continuar:

```bash
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"abra um incidente para o checkout","conversationId":"<uuid-anterior>"}' \
  | jq '{conversationId, historyMessages: .metrics.historyMessages}'
```
