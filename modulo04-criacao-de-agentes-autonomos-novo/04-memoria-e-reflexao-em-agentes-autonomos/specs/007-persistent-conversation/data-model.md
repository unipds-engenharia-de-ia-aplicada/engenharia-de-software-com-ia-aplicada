# Data Model: Conversa Persistente

**Phase 1 output for** `specs/007-persistent-conversation/plan.md`

---

## Entities

### Conversation

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `string` | PK; UUID v4 (`crypto.randomUUID()`) |
| `createdAt` / `created_at` | `number` | Epoch ms; NOT NULL |

Criada via `ConversationStore.create()` → retorna o id (e opcionalmente o objeto).

---

### Message (`ConversationMessage`)

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `string` | PK; UUID v4 |
| `conversationId` / `conversation_id` | `string` | FK → `conversations.id`; NOT NULL |
| `role` | `"user" \| "assistant"` | CHECK SQL; NOT NULL |
| `content` | `string` | NOT NULL; texto do turno |
| `createdAt` / `created_at` | `number` | Epoch ms; NOT NULL; ordenação |

**State**: mensagens são append-only nesta feature (sem edit/delete).

---

## Closed Domains

| Domain | Values |
|--------|--------|
| `ConversationMessageRole` | `user`, `assistant` |

---

## SQL DDL (idempotente)

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at);
```

Mesmo arquivo que o ops store (`OPSPILOT_DB`); tabelas ops e chat coexistem.

---

## TypeScript contracts (domínio)

```ts
export type ConversationMessageRole = "user" | "assistant";

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: ConversationMessageRole;
  content: string;
  createdAt: number;
}

export interface ConversationStore {
  create(): string; // conversationId
  append(conversationId: string, role: ConversationMessageRole, content: string): ConversationMessage;
  lastMessages(conversationId: string, limit: number): ConversationMessage[];
  /** Opcional útil: exists(id) ou append/lastMessages lançam ConversationNotFoundError */
}
```

`lastMessages`:

1. Se conversa não existe → `ConversationNotFoundError`.
2. Senão: até `limit` mensagens mais recentes, retornadas em ordem **cronológica crescente** (antiga → recente).
3. `limit` tipicamente `12` (`HISTORY_LIMIT`).

`append`:

- Conversa inexistente → `ConversationNotFoundError`.
- Gera `id` + `createdAt = Date.now()` (ou clock injetável só se testes exigirem; default `Date.now()` + UUID basta).

---

## Chat request / response (visão de modelo)

### ChatRequest (estendido)

| Field | Required | Notes |
|-------|----------|-------|
| `message` | sim | ≥ 1 char |
| `strategy` | não | default `react` |
| `reflect` | não | default `false` |
| `conversationId` | não | se presente: UUID válido; se ausente: criar |

### ChatResponse (estendido)

| Field | Notes |
|-------|-------|
| `answer` | inalterado |
| `trace` | inalterado |
| `metrics` | `llmCalls`, `latencyMs`, **`historyMessages`** (int ≥ 0) |
| `conversationId` | sempre presente em `200` |

### ExecutionMetrics

| Field | Notes |
|-------|-------|
| `llmCalls` | existente |
| `latencyMs` | existente |
| `historyMessages` | opcional no tipo de estratégia; **obrigatório** na resposta HTTP `/chat` desta feature |

---

## Fluxo de um turno (estado)

```text
[sem conversationId]
  → create() → id
  → lastMessages(id, 12) = []
  → historyMessages = 0
  → compose(prompt) = message
  → run(prompt)
  → append(user) + append(assistant)
  → 200 { conversationId: id, ..., metrics.historyMessages: 0 }

[com conversationId válido]
  → lastMessages(id, 12) = H (|H| ≤ 12)
  → historyMessages = |H|
  → compose(H, message) → run
  → append(user) + append(assistant)
  → 200 { conversationId: id, metrics.historyMessages: |H| }

[com conversationId desconhecido]
  → ConversationNotFoundError → 404 (sem run, sem append)

[falha em run / timeout]
  → sem append; sem 200
```

---

## Validation rules

| Regra | Onde |
|-------|------|
| `conversationId` UUID se presente | zod (`chatRequestSchema`) |
| `conversationId` existe | store / domínio antes de `run` |
| `role` ∈ user\|assistant | TS + SQL CHECK |
| `limit` de histórico = 12 | constante de composição (não configurável nesta feature) |
| Sem SQL concatenado | prepared statements |
