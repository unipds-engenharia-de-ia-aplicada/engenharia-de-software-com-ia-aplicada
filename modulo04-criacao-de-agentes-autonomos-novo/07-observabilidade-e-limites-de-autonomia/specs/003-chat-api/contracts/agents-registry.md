# Contract: Strategy Registry

**Phase 1 output for** `specs/003-chat-api/plan.md`

Arquivo alvo: `src/agents/index.ts`

---

## Tipos

```typescript
import type { ReasoningStrategy } from "../domain/types.js";
import type { ReflectionOpts } from "../strategies/reflect.js";

type StrategyRegistry = ReadonlyMap<string, ReasoningStrategy>;
```

---

## Funções públicas

### `createRegistry`

```typescript
function createRegistry(
  entries: Record<string, ReasoningStrategy>,
): StrategyRegistry
```

Constrói o mapa a partir de um record. Chaves canônicas de produção: `"react"`, `"plan-and-execute"`.

### `resolveStrategy`

```typescript
function resolveStrategy(
  registry: StrategyRegistry,
  name: string,
  reflect: boolean,
  reflectionOpts?: ReflectionOpts,
): ReasoningStrategy
```

| Passo | Comportamento |
|-------|----------------|
| 1 | `registry.get(name)` |
| 2 | Se ausente → lança `UnknownStrategyError` |
| 3 | Se `reflect === false` → retorna a estratégia base |
| 4 | Se `reflect === true` → retorna `withReflection(base, reflectionOpts ?? {})` |

**Nota**: Em produção, passar `{ modelFactory: createModel }`. Em testes com `reflect:true`, passar `{ critic: mockCritic }` (ou `maxReflections: 0` se só quiser identity).

### Helpers opcionais

```typescript
function listStrategies(registry: StrategyRegistry): string[];
```

Útil para mensagens de erro / debug; não exigido pela spec HTTP.

---

## Relação com a Arena

A Arena continua com nomes `reflect:react` / `reflect:plan-and-execute` via CLI. O HTTP usa flag `reflect` + registry de bases. Não é obrigatório unificar os dois nesta feature; o registry HTTP é a superfície de extensão pedida pela spec.

---

## Extensão futura

Nova estratégia = instanciar + uma entrada no record passado a `createRegistry` no bootstrap. A rota `/chat` não muda.
