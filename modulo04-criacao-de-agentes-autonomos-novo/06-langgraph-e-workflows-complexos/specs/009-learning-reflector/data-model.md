# Data Model: Refletor de Aprendizado

**Phase 1 output for** `specs/009-learning-reflector/plan.md`

---

## Entities

### LearningReflection

| Field | Type | Constraints |
|-------|------|-------------|
| `hasLearning` | `boolean` | true só se fato durável elegível |
| `fact` | `string` | enunciado estável; `""` se `hasLearning === false`; se true, trim length ≥ 1 para persistir |

Não persistido como linha própria — só alimenta `MemoryStore.remember` quando elegível.

---

### DurableFact (conceitual)

Texto gravado via `MemoryStore` (`008`): preferência ou contexto operacional duradouro. **Não** é pedido pontual nem segredo.

---

### ChatUserContext

| Field | Type | Notes |
|-------|------|-------|
| `userId` | `string` | Escopo ALS por request/turno |

---

## Closed Domains / Schema zod

```ts
export const learningReflectionSchema = z.object({
  hasLearning: z.boolean().describe(
    "true somente se a mensagem contiver preferência ou fato operacional DURÁVEL elegível a memória",
  ),
  fact: z
    .string()
    .describe(
      "Enunciado estável em 1 frase; string vazia se hasLearning=false. Nunca copie pedido pontual nem segredo.",
    ),
});
```

### forget_preference input

```ts
z.object({
  query: z
    .string()
    .min(1)
    .describe("Descrição da preferência ou fato a remover da memória do usuário atual"),
});
```

---

## Persistence

Nenhuma tabela nova. Persistência = `memories` (`008`) via `remember` / `forget`.

---

## Fluxo de estado (turno /chat)

```text
runChat(userId, message, ...):
  ALS.run({ userId }) {
    recall → enrich → append user → strategy.run → append assistant
  }
  // fora do critical path de await da resposta:
  void scheduleLearning(reflector?, memories, userId, message)
  return ChatTurnResult  // não espera scheduleLearning

scheduleLearning:
  reflection = await reflector(message)   // fail-safe → hasLearning false
  if reflection.hasLearning && fact.trim():
    await memories.remember(userId, fact.trim())  // erros engolidos
```

---

## Validation rules

| Regra | Onde |
|-------|------|
| Saída LLM → schema zod | LearningReflector |
| `hasLearning` true + fact vazio → não remember | scheduleLearning |
| Pontual / segredo → hasLearning false | system prompt + testes fake |
| Tool sem ALS userId → erro string | forget_preference |
| Isolamento userId | MemoryStore + ALS |
