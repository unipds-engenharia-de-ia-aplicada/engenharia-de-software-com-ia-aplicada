# Contract: ConversationStore

**Phase 1 output for** `specs/007-persistent-conversation/plan.md`

---

## Interface

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
  /** Cria conversa vazia; retorna UUID. */
  create(): string;

  /** Anexa mensagem; lança ConversationNotFoundError se id inexistente. */
  append(
    conversationId: string,
    role: ConversationMessageRole,
    content: string,
  ): ConversationMessage;

  /**
   * Até `limit` mensagens mais recentes, em ordem cronológica crescente.
   * Lança ConversationNotFoundError se conversa inexistente.
   */
  lastMessages(conversationId: string, limit: number): ConversationMessage[];
}
```

## Implementação de produção

| | |
|---|---|
| **Class** | `SqliteConversationStore` |
| **Path** | `src/store/sqlite-conversation-store.ts` |
| **DB path** | ctor arg; default `process.env.OPSPILOT_DB ?? "./data/opspilot.db"` |
| **Tests** | `":memory:"` |

## Errors

| Error | When |
|-------|------|
| `ConversationNotFoundError` | `append` / `lastMessages` com id desconhecido |

```ts
export class ConversationNotFoundError extends Error {
  readonly conversationId: string;
  constructor(conversationId: string) { ... }
}
```

## Invariants

- Prepared statements only.
- DDL idempotente no construtor (`conversations`, `messages`, index).
- `create` nunca falha por “já existe” (UUID novo).
- `lastMessages(id, 12)` com 15 msgs → retorna as 12 mais novas, ordem antiga→recente.

## Test matrix (`:memory:`)

| # | Caso | Esperado |
|---|------|----------|
| 1 | `create` + `lastMessages` | `[]` |
| 2 | `append` user/assistant + `lastMessages` | ordem cronológica |
| 3 | 15 appends + `lastMessages(_, 12)` | length 12; são as 12 últimas |
| 4 | `append` / `lastMessages` id fake | `ConversationNotFoundError` |
