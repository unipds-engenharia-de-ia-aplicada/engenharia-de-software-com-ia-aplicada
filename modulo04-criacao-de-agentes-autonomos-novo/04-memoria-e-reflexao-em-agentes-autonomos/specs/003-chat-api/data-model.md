# Data Model: Chat HTTP API

**Phase 1 output for** `specs/003-chat-api/plan.md`

---

## Entidades de request/response

### ChatRequest

Entrada validada na fronteira HTTP (após zod + defaults).

| Campo | Tipo | Default | Restrições |
|-------|------|---------|------------|
| `message` | `string` | — | Obrigatório; `min(1)` após trim? **não trim obrigatório** — `min(1)` na string crua (espaços-only passam se length ≥ 1; vazio `""` falha) |
| `strategy` | `string` | `"react"` | Qualquer string; existência validada no registry |
| `reflect` | `boolean` | `false` | Se `true`, resolve via `withReflection` |

**Schema zod** (ver [contracts/chat-http.md](./contracts/chat-http.md)):

```typescript
const chatRequestSchema = z.object({
  message: z.string().min(1),
  strategy: z.string().default("react"),
  reflect: z.boolean().default(false),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;
```

---

### ChatResponse

Espelho de `StrategyResult` na borda HTTP (status 200).

| Campo | Tipo | Origem |
|-------|------|--------|
| `answer` | `string` | `StrategyResult.answer` |
| `trace` | `TraceEvent[]` | `StrategyResult.trace` |
| `metrics` | `ExecutionMetrics` | `{ llmCalls: number, latencyMs: number }` |

Nenhuma transformação de domínio além da serialização JSON.

---

### StrategyRegistry

Mapa imutável (na prática) de nome canônico → instância.

| Conceito | Tipo |
|----------|------|
| chave | `string` (ex.: `"react"`, `"plan-and-execute"`, `"fake"` em testes) |
| valor | `ReasoningStrategy` |

**Operações**:
- `get(name): ReasoningStrategy | undefined`
- `has(name): boolean`
- criação via `createRegistry(entries: Record<string, ReasoningStrategy>)`

Produção: chaves `react` e `plan-and-execute` a partir do bootstrap.

---

## Erros de domínio (novos)

### UnknownStrategyError

| Campo | Valor |
|-------|-------|
| `name` | `"UnknownStrategyError"` |
| `strategy` | nome pedido |
| `message` | ex.: `Unknown strategy: ${strategy}` |

Mapeado para HTTP `422`.

### ChatTimeoutError

| Campo | Valor |
|-------|-------|
| `name` | `"ChatTimeoutError"` |
| `timeoutMs` | limite aplicado |
| `message` | ex.: `Chat timed out after ${timeoutMs}ms` |

Mapeado para HTTP `504`.

---

## Entidades reutilizadas (sem mudança de schema)

- **ReasoningStrategy** / **StrategyResult** / **TraceEvent** / **ExecutionMetrics** — `src/domain/types.ts`
- **ReflectionOpts** / **withReflection** — `src/strategies/reflect.ts`

---

## Fluxo de resolução

```
body JSON
  → chatRequestSchema.safeParse
       │ fail → 400 + issues
       ▼
  ChatRequest { message, strategy, reflect }
       │
       ▼
  resolveStrategy(registry, strategy, reflect, reflectionOpts)
       │ missing → UnknownStrategyError → 422
       ▼
  ReasoningStrategy (talvez reflect:*)
       │
       ▼
  Promise.race(run(message), timeout)
       │ timeout → ChatTimeoutError → 504
       │ ok → 200 ChatResponse
       │ throw → 500
```

---

## Módulo TypeScript (alvo)

```text
src/http/chat-schema.ts     → chatRequestSchema, ChatRequest
src/http/server.ts          → createApp, startServer
src/agents/index.ts         → StrategyRegistry, createRegistry, resolveStrategy
src/domain/errors.ts        → + UnknownStrategyError, ChatTimeoutError
```
