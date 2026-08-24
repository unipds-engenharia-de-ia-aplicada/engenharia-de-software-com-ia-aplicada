# Research: Conversa Persistente

**Phase 0 output for** `specs/007-persistent-conversation/plan.md`

---

## Contexto

`POST /chat` (feature `003`) é stateless: cada request executa `strategy.run(message)` sem histórico. Ops já persiste em SQLite (`004`). Esta feature adiciona persistência de conversa + injeção das últimas 12 mensagens no prompt, com métrica `historyMessages`, sem redesenhar o grafo LangGraph.

---

## Decisão 1: Store separado, mesmo arquivo DB

**Decisão**:

- Interface `ConversationStore` em `domain/types.ts` (ou `domain/conversation.ts` re-exportado).
- Implementação `SqliteConversationStore` em `src/store/sqlite-conversation-store.ts`.
- **Não** misturar métodos de conversa em `OpsStore` / `SqliteOpsStore`.
- Path: mesmo `process.env.OPSPILOT_DB ?? "./data/opspilot.db"` (FR-003).
- DDL próprio no construtor: `conversations` + `messages` (`CREATE TABLE IF NOT EXISTS`), prepared statements only.
- Testes: `new SqliteConversationStore(":memory:")`.
- Produção (`index.ts`): segunda instância no **mesmo path** que o `SqliteOpsStore` (duas conexões `DatabaseSync` ao mesmo arquivo — aceitável para processo single-writer local).

**Rationale**: Separação de contratos (ops vs chat) respeita camadas e evita inflar `OpsStore`. Mesmo path evita segundo arquivo mágico. DDL idempotente em ambos os construtores é seguro (`IF NOT EXISTS`).

**Alternatives considered**:

- Estender `SqliteOpsStore` com tabelas/métodos de conversa — acopla plantão operacional ao chat HTTP.
- Passar um único `DatabaseSync` compartilhado — mais “limpo”, mas exige factory/refactor do ops store; adiar.
- Arquivo DB separado (`OPSPILOT_CHAT_DB`) — contradiz FR-003 (“sem segundo arquivo mágico”).

---

## Decisão 2: Composição de prompt sem mudar `ReasoningStrategy`

**Decisão**:

1. Helper `composeChatPrompt(history: ConversationMessage[], currentMessage: string): string` (módulo `src/chat/compose-prompt.ts` ou sob `src/http/`).
2. Formato canônico (texto único passado a `run`):

```text
Previous conversation:
user: <content>
assistant: <content>
...

Current message:
<currentMessage>
```

Se `history.length === 0`, o prompt é **apenas** `currentMessage` (sem cabeçalhos vazios) — preserva comportamento atual no primeiro turno.

3. Constante `HISTORY_LIMIT = 12`.
4. Fluxo em `POST /chat`:
   - resolve/create `conversationId`
   - `history = conversations.lastMessages(id, HISTORY_LIMIT)`
   - `prompt = composeChatPrompt(history, message)`
   - `historyMessages = history.length`
   - `result = await run(prompt)`
   - em sucesso: `append` user + assistant; responder com métricas mescladas

**Rationale**: Estratégias (`react`, `plan-and-execute`, reflect) e testes fake continuam com `run(input: string)`. Zero mudança no grafo. Fake strategy pode assertar substring do histórico no `input` capturado.

**Alternatives considered**:

- Estender `run(input, history?: Message[])` e passar multi-turn ao `agent.invoke` — melhor fidelidade LangChain; maior blast radius (reflect, P&E, todos os testes).
- Cookie/sessão implícita — fora da spec (cliente deve reenviar `conversationId`).

---

## Decisão 3: Métrica `historyMessages` na borda HTTP

**Decisão**:

- `ExecutionMetrics` no domínio **ganha** campo opcional ou obrigatório `historyMessages?: number` **ou** a resposta HTTP monta:

```ts
metrics: { ...result.metrics, historyMessages }
```

- Preferência: tipar em `ExecutionMetrics` como `historyMessages?: number` para o contrato JSON documentado; estratégias existentes **não** preenchem (omitido/`undefined`); a rota `/chat` **sempre** seta o valor na resposta de sucesso.
- Contagem = `history.length` **antes** do turno (mensagens prévias injetadas), **não** inclui a mensagem atual (Assumption da spec).

**Rationale**: Estratégias não precisam saber de conversa; métrica é responsabilidade da composição HTTP (FR-009).

**Alternatives considered**:

- Forçar todas as estratégias a retornar `historyMessages: 0` — ruído desnecessário.
- Contar também a mensagem atual — contradiz assumption default da spec.

---

## Decisão 4: Política de persistência em falha (append after success)

**Decisão**:

- **Não** appendar a mensagem do usuário antes de `run`.
- Após `run` bem-sucedido (e antes do `200`): `append(user)` + `append(assistant)` (dois appends ou um `appendTurn` interno — API pública continua `append` por mensagem).
- Se `run` lançar / timeout `504`: **nenhuma** mensagem nova é persistida; conversa permanece como antes do request.
- `create()` da conversa (quando `conversationId` omitido) ocorre **antes** de `run`; conversa vazia órfã em falha é aceitável (id já foi gerado; próximo sucesso no mesmo id funcionaria se o cliente reutilizar — mas em timeout o cliente pode não ter recebido o id). Mitigação: criar conversa só quando necessário; em request sem id, criar antes do run e incluir `conversationId` só no `200` — se falhar, o cliente não recebe o id (conversa vazia residual no DB é ok em v1).

**Rationale**: Evita mensagens `user` órfãs sem resposta; evita `200` parcial; testável. Spec permitia “user já appendado”; escolhemos a variante mais limpa.

**Alternatives considered**:

- Append user antes + assistant só em sucesso — histórico fica com user sem resposta; próximo turno injectaria pergunta sem answer.
- Transação SQL única user+assistant — bom, mas API `append` unitária basta se ambos só rodam após sucesso.

---

## Decisão 5: Identificadores e erros

**Decisão**:

- `conversationId` / message ids: `crypto.randomUUID()` (string UUID v4).
- Schema zod: `conversationId: z.string().uuid().optional()` — string vazia / não-UUID → `400`.
- Id ausente no store → `ConversationNotFoundError` → HTTP **`404`** `{ error: "conversation_not_found", conversationId }`.
- `lastMessages`: `ORDER BY created_at DESC, id DESC LIMIT ?`, depois **reverter** para ordem cronológica crescente no retorno.

**Rationale**: UUID alinhado a validação clara; 404 é o status pedido pela spec para id inexistente.

**Alternatives considered**:

- IDs estilo `conv-<ts>-<hex>` como incidents — ok, mas UUID + zod `.uuid()` é mais simples na fronteira.
- `422` para id inexistente — menos idiomático que 404 para recurso ausente.

---

## Decisão 6: Papéis e entidades

**Decisão**:

- Role persistido: `'user' | 'assistant'` com CHECK SQL.
- Tipo TS: `ConversationMessageRole = "user" | "assistant"`.
- Mapeamento mental LangChain: `user` ↔ HumanMessage, `assistant` ↔ AIMessage — **sem** persistir objetos LangChain.
- Conteúdo: texto puro (`string`); a `answer` da estratégia é o content do `assistant`.

**Rationale**: Simples, estável, suficiente para composição textual.

---

## Decisão 7: Test harness

**Decisão**:

| Suíte | Setup |
|-------|--------|
| `sqlite-conversation-store.test.ts` | `SqliteConversationStore(":memory:")` — create, append, lastMessages (ordem + limite 12), not-found |
| `server.test.ts` (estender) | `createApp({ registry, conversations: new SqliteConversationStore(":memory:") })` + fake strategy; casos: create id, continue, historyMessages, 404, 400 uuid inválido; fake captura `inputs` para assertar composição |

`ChatAppDeps.conversations` **obrigatório** (ou default in-memory sqlite `:memory:` só em teste — preferir **obrigatório** para falhar cedo se bootstrap esquecer).

**Rationale**: FR-011/FR-012; reutiliza padrão 003 + 004.

---

## Decisão 8: Escopo explícito fora

- CLI, Arena, bench, MCP: **não** recebem `conversationId` nesta feature.
- Sem listagem/delete de conversas, sem retenção/TTL, sem multi-tenant.
- Sem mudança de `ReactStrategy` / `PlanExecuteStrategy` / `withReflection`.

---

## Resolução de NEEDS CLARIFICATION

Nenhum item do Technical Context ficou como NEEDS CLARIFICATION — decisões 1–8 fecham path DB, composição, métrica, falha mid-turno, IDs e testes.
