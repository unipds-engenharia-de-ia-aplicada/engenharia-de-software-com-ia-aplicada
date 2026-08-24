# Contract: Production Graph

**Phase 1 output for** `specs/013-unified-production-graph/plan.md`

Contrato interno do orquestrador de produção (`src/graph/production-graph.ts`).

---

## Módulo

| Item | Valor |
|------|-------|
| Path | `src/graph/production-graph.ts` |
| Factory | `createProductionGraph(deps)` |
| Runner | `runProductionTurn(graph \| deps, input)` → `Promise<ChatTurnResult>` |

---

## Dependencies (`ProductionGraphDeps`)

| Dep | Uso |
|-----|-----|
| `conversations: ConversationStore` | context + response |
| `memories: MemoryStore` | context recall + learning |
| `strategies: { react, planAndExecute, reflect }` | nós de estratégia (`ReasoningStrategy`) |
| `routeModelFactory: () => ChatOpenAI` | só nó router (quando sem override) |
| `summarizer?` / `learningReflector?` / `budgets?` / `execute?` | iguais ao `RunChatOptions` atual |

`reflect` strategy = `withReflection(reactBase, reflectionOpts)` no bootstrap.

---

## Input (`ProductionTurnInput`)

| Field | Required | Notes |
|-------|----------|-------|
| `message` | sim | |
| `userId` | sim | |
| `conversationId?` | não | |
| `overrideRoute?` | não | `ProductionRoute` se body trouxe strategy/reflect |

---

## Fluxo de nós

```text
START → context → router → (react | plan-and-execute | reflect) → response → END
```

- **Uma** strategy por turno.
- Router sempre emite evento `type: "route"` (ver [trace.md](./trace.md)).
- Context reutiliza `buildContext` (012) + `maybeSummarize` (011).

---

## Router

| Item | Contrato |
|------|----------|
| Schema | `{ route: enum(3), reason: string }` via `withStructuredOutput` |
| Prompt | Inclui tabela de decisão exportada (`router-prompt.ts`) |
| Override | Se `overrideRoute` setado: **não** chama LLM; `override: true` |
| Fallback | Parse/erro → `react` + reason de fallback |

---

## Testes mínimos (sem rede)

| # | Caso | Esperado |
|---|------|----------|
| 1 | Router fake → `plan-and-execute` | Só esse nó roda; evento route |
| 2 | `overrideRoute: react` + router fake que escolheria outro | Executa react; `override: true` |
| 3 | Todo evento | `node` não vazio |
| 4 | Fluxo completo fakes | `answer` + metrics + conversationId |
