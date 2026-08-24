# Research: Refletor de Aprendizado

**Phase 0 output for** `specs/009-learning-reflector/plan.md`

---

## Contexto

`008` entregou `MemoryStore` + recall no `/chat`, mas fatos só entram por chamada direta a `remember`. Esta feature fecha o ciclo: destilar preferências duráveis da última mensagem do usuário após cada resposta, e permitir esquecer via tool.

---

## Decisão 1: LearningReflector com withStructuredOutput (padrão critic)

**Decisão**:

```ts
export const learningReflectionSchema = z.object({
  hasLearning: z.boolean().describe("true só se houver fato durável elegível"),
  fact: z.string().describe("enunciado estável; vazio se hasLearning=false"),
});

export type LearningReflection = z.infer<typeof learningReflectionSchema>;

export type LearningReflectorFn = (userMessage: string) => Promise<LearningReflection>;
```

- `createLLMLearningReflector(modelFactory)` → `modelFactory().withStructuredOutput(learningReflectionSchema).invoke([...])` + `learningReflectionSchema.parse`.
- Em falha (rede, parse): retornar `{ hasLearning: false, fact: "" }` (fail-safe, como critic FR-012).
- System prompt explícito: aprender preferências/contexto operacional **durável**; **nunca** pedidos pontuais (liste/abra/resolva agora); **nunca** segredos (tokens, senhas, API keys, credenciais).
- Entrada: **apenas** a última mensagem do usuário (não a resposta do agente) — conforme spec.

**Rationale**: Reutiliza padrão já validado em `createLLMCritic` / plan-execute; schema camelCase da spec.

**Alternatives considered**:

- Heurística regex sem LLM — frágil para “durável vs pontual”.
- Incluir answer do agente no prompt — fora do input da spec; adiar.

---

## Decisão 2: scheduleLearning assíncrono (não bloqueia 200)

**Decisão**:

Após `strategy.run` + append assistant com sucesso, em `runChat`:

1. Disparar `void scheduleLearning({ reflector, memories, userId, userMessage }).catch(() => {})` (ou `.catch(console.error)` mínimo).
2. **Não** `await` antes do `return` de `ChatTurnResult`.
3. `scheduleLearning`: `const r = await reflector(userMessage)`; se `r.hasLearning && r.fact.trim()`, `await memories.remember(userId, r.fact.trim())`; erros engolidos.
4. Refletor injetável: `RunChatOptions.learningReflector?: LearningReflectorFn` — se ausente, no-op (testes HTTP antigos) **ou** bootstrap sempre passa o LLM reflector; preferência: **opcional** — se undefined, não agenda (testes sem side-effect); produção (`index` / `createApp`) injeta o real.

**Rationale**: SC-003 / FR-003 / FR-006.

**Alternatives considered**:

- `await remember` antes do 200 — contradiz spec.
- Queue/worker externo — overkill.

---

## Decisão 3: userId para tools via AsyncLocalStorage

**Decisão**:

- Módulo `src/memory/chat-user-context.ts`:
  - `chatUserContext = new AsyncLocalStorage<{ userId: string }>()`
  - `runWithChatUser(userId, fn)` / `getChatUserId(): string | undefined`
- `runChat` envolve `strategy.run` (e o schedule que precisa do mesmo userId) com `chatUserContext.run({ userId }, async () => { ... })`.
- `forget_preference` lê `getChatUserId()`; se ausente → retorna string `Error: no active chat user` (não throw).
- Tool schema **não** inclui `userId` (evita o modelo forjar outro usuário).

**Rationale**: Tools são criadas no bootstrap uma vez; ALS amarra o request sem recriar strategies.

**Alternatives considered**:

- `userId` no schema da tool — risco cross-user.
- Recriar tools por request — maior blast radius no HTTP.

---

## Decisão 4: forget_preference = recall + forget

**Decisão**:

- Input: `query: z.string().min(1).describe("Descrição da preferência/fato a esquecer")`.
- `recalled = await memories.recall(userId, query)`.
- Se vazio → `"No matching preference found."`
- Senão: `forget(userId, recalled[0].id)` (melhor match já ordenado); confirmar com texto incluindo o `fact` removido.
- Limiar: confiar no min score 0.3 do `recall` (`008`); se quiser mais estrito no plano de tasks, `score >= 0.5` — **default: usar top-1 do recall (≥ 0.3)**.
- Registrar em `createTools(store, memories?: MemoryStore)`: se `memories` omitido, não registra a tool (Arena/bench sem memória); bootstrap HTTP passa `memories`.
- MCP: **não** adicionar à allowlist (permanece agent-only).

**Rationale**: Assumption da spec; alinhado a `forget(userId, id)`.

---

## Decisão 5: Independência do withReflection (002)

**Decisão**: Learning reflector roda **depois** da resposta final do turno (pós-`strategy.run`, inclusive se `reflect: true` já terminou o critique loop). Não altera `withReflection` / `CritiqueResult`.

**Rationale**: Spec edge case explícito.

---

## Decisão 6: Test harness

| Caso | Como |
|------|------|
| Aprende | Fake reflector `{ hasLearning: true, fact: "..." }` + spy `remember` ou store real `:memory:` + FakeEmbedder; `await` microtask/`setImmediate` após `runChat` para ver persistência |
| Não bloqueia | Deferred `remember` (Promise controlada): `runChat` resolve enquanto remember ainda pending |
| Pontual / segredo | Fake retorna `hasLearning: false` **ou** unit test do prompt contract via fake que simula política; testes do scheduler respeitam `false` |
| forget_preference | ALS.run + tool.invoke + recall vazio |
| createTools | length 7 quando memories passado; 6 sem |

Política pontual/segredo no LLM real fica no system prompt; aceite automatizado usa fake (FR-009). Opcional: 1–2 testes de unidade que documentam exemplos no prompt string (contains “segredo”, “pontual”).

---

## Decisão 7: Escopo fora

- CLI/Arena: podem omitir reflector e forget tool (sem memories) nesta feature.
- Sem endpoint HTTP dedicado para learn/forget.
- Sem métrica `learnedFact` obrigatória (opcional no polish).

---

## Resolução de NEEDS CLARIFICATION

Nenhum item do Technical Context ficou como NEEDS CLARIFICATION — decisões 1–7 fecham schema, async, ALS, forget e testes.
