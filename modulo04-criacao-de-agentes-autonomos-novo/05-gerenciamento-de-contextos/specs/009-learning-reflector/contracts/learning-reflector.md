# Contract: LearningReflector + scheduleLearning

**Phase 1 output for** `specs/009-learning-reflector/plan.md`

Referência: [data-model.md](../data-model.md), [research.md](../research.md).

---

## Schema

```ts
learningReflectionSchema = z.object({
  hasLearning: z.boolean(),
  fact: z.string(),
});
```

---

## LearningReflectorFn

```ts
type LearningReflectorFn = (userMessage: string) => Promise<LearningReflection>;
```

| Implementação | Comportamento |
|---------------|---------------|
| `createLLMLearningReflector(modelFactory)` | `withStructuredOutput(learningReflectionSchema)`; system prompt anti-pontual/anti-segredo; fail-safe → `{ hasLearning: false, fact: "" }` |
| Fake (testes) | Retorno determinístico injetável |

Módulo: `src/memory/learning-reflector.ts`.

---

## scheduleLearning

```ts
function scheduleLearning(args: {
  reflector: LearningReflectorFn;
  memories: MemoryStore;
  userId: string;
  userMessage: string;
}): Promise<void>
```

1. `reflection = await reflector(userMessage)`
2. Se `!hasLearning` ou `!fact.trim()` → return
3. `await memories.remember(userId, fact.trim())`
4. Catch-all: nunca propaga

Chamada em `runChat`: **`void scheduleLearning(...).catch(...)`** após sucesso do turno; **sem await** no caminho do `ChatTurnResult`.

---

## runChat options (delta)

```ts
interface RunChatOptions {
  execute?: ...;
  learningReflector?: LearningReflectorFn; // se ausente: não agenda aprendizado
}
```

---

## Chat user context (ALS)

```ts
runWithChatUser<T>(userId: string, fn: () => Promise<T>): Promise<T>
getChatUserId(): string | undefined
```

`runChat` executa `strategy.run` dentro de `runWithChatUser(input.userId, ...)`.

---

## Test contract (mínimo)

| Caso | Assert |
|------|--------|
| Fake `hasLearning: true` | `remember` chamado 1× com fact |
| Fake `false` | `remember` 0× |
| Deferred remember | `runChat` resolve com remember ainda pending |
| Fail reflector throw | engolido; remember 0×; runChat ok |
