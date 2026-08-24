# Contract: Reflection Decorator API

**Phase 1 output for** `specs/002-reflection-layer/plan.md`

---

## Função pública: `withReflection`

Arquivo: `src/strategies/reflect.ts`

Envolve qualquer `ReasoningStrategy` com um ciclo crítico–regeneração. Retorna uma nova `ReasoningStrategy` com interface idêntica.

### Assinatura

```typescript
function withReflection(
  strategy: ReasoningStrategy,
  opts?: ReflectionOpts,
): ReasoningStrategy
```

### Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `strategy` | `ReasoningStrategy` | Sim | Estratégia base a ser decorada |
| `opts` | `ReflectionOpts` | Não | Opções de configuração (ver abaixo) |

### ReflectionOpts

```typescript
interface ReflectionOpts {
  maxReflections?: number;         // default: 2
  critic?: CriticFn;               // injetado em testes; substitui modelFactory
  modelFactory?: () => ChatOpenAI; // cria crítico LLM em produção
}
```

| Campo | Default | Descrição |
|-------|---------|-----------|
| `maxReflections` | `2` | Máximo de ciclos crítica+regeneração. `0` = pass-through sem crítica. |
| `critic` | `undefined` | Função crítica mock para testes. Se fornecida, `modelFactory` é ignorado. |
| `modelFactory` | `undefined` | Factory de modelo LLM. Necessário em produção quando `maxReflections > 0`. |

### Tipo CriticFn

```typescript
type CriticFn = (answer: string, trace: TraceEvent[]) => Promise<CritiqueResult>;
```

### Tipo CritiqueResult

```typescript
// validado via zod antes do uso
interface CritiqueResult {
  approved: boolean;
  feedback: string;
}
```

### Retorno

Objeto que implementa `ReasoningStrategy`:

| Propriedade | Valor |
|-------------|-------|
| `name` | `"reflect:<nome-da-estratégia-base>"` — ex: `"reflect:react"`, `"reflect:plan-and-execute"` |
| `run(input)` | `Promise<StrategyResult>` — retorna resposta com trace e métricas acumuladas |

---

## Comportamento

### Caso 1: aprovação imediata

```
run(input)
  → base.run(input)             → StrategyResult (1 rodada)
  → critic(answer, trace)       → { approved: true }
  → adiciona CritiqueEvent ao trace
  → retorna resultado com llmCalls += 1
```

### Caso 2: reprovação com regeneração

```
run(input)
  → base.run(input)             → StrategyResult (rodada 0)
  → critic(answer, trace)       → { approved: false, feedback: "..." }
  → adiciona CritiqueEvent (round: 1, approved: false)
  → enriquecer input com feedback
  → base.run(enrichedInput)     → StrategyResult (rodada 1)
  → critic(answer, trace)       → { approved: true }
  → adiciona CritiqueEvent (round: 2, approved: true)
  → retorna resultado com métricas acumuladas
```

### Caso 3: limite atingido

```
run(input)
  → [ciclo repete maxReflections vezes com approved: false]
  → retorna último resultado sem nova chamada ao crítico
  → trace contém exatamente maxReflections eventos critique
```

### Caso 4: maxReflections = 0

```
run(input)
  → base.run(input)
  → retorna resultado sem nenhuma chamada ao crítico
  → trace = trace da estratégia base (sem eventos critique)
```

### Caso 5: erro na estratégia base

```
run(input)
  → base.run(input) → throws Error
  → decorator NÃO captura; erro propaga sem modificação
```

---

## Injeção de feedback no contexto

Quando o crítico reprova, o `input` da próxima invocação da estratégia base é enriquecido:

```
[Critique - Round {N}]:
{feedback}

Original request:
{original_input}
```

Se `feedback` for string vazia, a seção de feedback é omitida:

```
[Critique - Round {N}]:
(sem feedback adicional)

Original request:
{original_input}
```

---

## Acumulação de métricas

| Campo | Cálculo |
|-------|---------|
| `latencyMs` | `Date.now() - startedAt` — wall-clock externo do `run()` completo |
| `llmCalls` | `Σ(base.metrics.llmCalls para cada rodada)` + `total de chamadas ao crítico LLM` |

**Exemplo com `maxReflections: 2`, crítico sempre reprova**:
- 3 chamadas à estratégia base (rodada 0 + 2 regenerações)
- 2 chamadas ao crítico
- `llmCalls` = `(llmCalls_base_0 + llmCalls_base_1 + llmCalls_base_2) + 2`

Para simplificação nos testes com mocks, cada chamada de estratégia base retorna `metrics.llmCalls: 1` e cada chamada ao crítico mock conta como 1, resultando em `llmCalls: 5` para esse cenário.

---

## Export

```typescript
// src/strategies/reflect.ts
export { withReflection };
export type { CriticFn, CritiqueResult, ReflectionOpts };
```
