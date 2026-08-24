# Data Model: Reflection Layer

**Phase 1 output for** `specs/002-reflection-layer/plan.md`

---

## Entidades novas

### CritiqueResult

Saída estruturada do crítico LLM. Validada via zod antes de qualquer branch de lógica.

| Campo | Tipo | Restrições |
|-------|------|------------|
| `approved` | `boolean` | Required; `true` encerra o ciclo, `false` dispara regeneração |
| `feedback` | `string` | Required; texto de orientação para regeneração; pode ser vazio (string vazia é tratada como feedback ausente) |

**Schema zod**:
```typescript
const critiqueSchema = z.object({
  approved: z.boolean(),
  feedback: z.string(),
});
export type CritiqueResult = z.infer<typeof critiqueSchema>;
```

**Fail-safe**: Se o parsing falhar (saída do LLM inválida), retorna `{ approved: true, feedback: "" }` sem lançar exceção (FR-012).

---

### ReflectionOpts

Opções do decorator `withReflection`. Todos os campos são opcionais.

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `maxReflections` | `number` | `2` | Número máximo de rodadas de crítica+regeneração. `0` = sem crítica (estratégia base executa normalmente). |
| `critic` | `CriticFn \| undefined` | `undefined` | Função crítica injetada. Se fornecida, `modelFactory` é ignorado. Usada para testes determinísticos. |
| `modelFactory` | `() => ChatOpenAI \| undefined` | `undefined` | Factory de modelo LLM. Usado para criar o crítico padrão em produção quando `critic` não é fornecido. Obrigatório em produção se `maxReflections > 0`. |

**Invariante**: Se `maxReflections > 0` e nenhum `critic` nem `modelFactory` for fornecido, o decorator não conseguirá executar crítica — isso resulta em comportamento equivalente a `maxReflections: 0` (fail-safe por omissão de config).

---

### CriticFn

Tipo funcional para a função crítica.

```typescript
type CriticFn = (answer: string, trace: TraceEvent[]) => Promise<CritiqueResult>;
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `answer` | `string` | Resposta produzida pela estratégia base na rodada atual |
| `trace` | `TraceEvent[]` | Trace completo da rodada atual (inclui pensamentos, ações, observações) |

**Retorno**: `Promise<CritiqueResult>` — nunca lança exceção; erros internos retornam fail-safe.

---

## Entidades modificadas

### TraceEvent (extensão)

Arquivo: `src/domain/types.ts`

Adição de campos opcionais para suportar eventos `critique` gerados pelo reflection layer. Retrocompatível — código existente que produz eventos `critique` (ex: `plan-execute.ts`) não é afetado.

| Campo | Tipo | Quando presente |
|-------|------|-----------------|
| `type` | `TraceEventType` | Sempre (existente) |
| `content` | `string` | Sempre (existente) |
| `tool` | `string \| undefined` | Apenas quando `type === "action"` (existente) |
| `toolArgs` | `Record<string, unknown> \| undefined` | Apenas quando `type === "action"` (existente) |
| `round` | `number \| undefined` | **NOVO** — presente em eventos `critique` do reflection layer; indica o número da rodada (1-based) |
| `approved` | `boolean \| undefined` | **NOVO** — presente em eventos `critique` do reflection layer; indica se o crítico aprovou |
| `timestampMs` | `number \| undefined` | **NOVO** — presente em eventos `critique` do reflection layer; timestamp Unix em ms |

**Semântica dos novos campos para eventos `critique` do reflection layer**:
- `content`: texto do feedback do crítico (ou `"[Crítico aprovou sem feedback]"` se vazio)
- `round`: número da rodada (começa em 1)
- `approved`: resultado do crítico nesta rodada
- `timestampMs`: `Date.now()` no momento da crítica

**Evento de exemplo**:
```typescript
{
  type: "critique",
  content: "Resposta incompleta: faltou listar os serviços por severidade.",
  round: 1,
  approved: false,
  timestampMs: 1722103456789,
}
```

---

## Entidade conceitual: ReflectionDecorator

Não é uma classe instanciada — é o objeto `ReasoningStrategy` retornado por `withReflection`. Implementa a mesma interface da estratégia base.

| Propriedade | Tipo | Valor |
|-------------|------|-------|
| `name` | `string` (readonly) | `"reflect:<nome-da-base>"` — ex: `"reflect:react"` |
| `run` | `(input: string) => Promise<StrategyResult>` | Ciclo crítico–regeneração |

**Algoritmo de `run(input)`**:

```
1. Executar estratégia base com `input` → `currentResult`
2. Se maxReflections === 0: retornar `currentResult`
3. Para round = 1..maxReflections:
   a. Invocar `criticFn(currentResult.answer, currentResult.trace)` → `critiqueResult`
   b. Adicionar CritiqueEvent ao trace acumulado
   c. Se `critiqueResult.approved === true`: parar
   d. Construir `enrichedInput` com feedback injetado
   e. Executar estratégia base com `enrichedInput` → `currentResult`
4. Retornar `currentResult` com trace e métricas acumuladas
```

**Acumulação de métricas**:
```
latencyMs = Date.now() - startedAt (wall-clock externo)
llmCalls  = Σ(baseResult.metrics.llmCalls para cada rodada) + total de chamadas ao crítico LLM
```

---

## Módulo TypeScript

```text
src/strategies/reflect.ts
  ├── critiqueSchema        (z.object)
  ├── CritiqueResult        (z.infer<typeof critiqueSchema>)
  ├── CriticFn              (type alias)
  ├── ReflectionOpts        (interface)
  ├── createLLMCritic()     (factory → CriticFn usando modelFactory + withStructuredOutput)
  └── withReflection()      (factory → ReasoningStrategy decorada)

src/domain/types.ts
  └── TraceEvent            (+ round?, approved?, timestampMs?)
```

---

## Diagrama de fluxo

```
withReflection(base, opts)
         │
         ▼
     run(input)
         │
         ▼
  base.run(input) ──────────────────────────────────────────────────────┐
         │                                                               │
         ▼                                                               │
  criticFn(answer, trace)                                                │
         │                                                               │
    ┌────┴────────────────┐                                              │
    │ approved: true      │ approved: false (round < maxReflections)     │
    │                     │                                              │
    ▼                     ▼                                              │
 retornar          enrich input                                          │
 resultado         com feedback                                          │
                         │                                               │
                         └───────────────────────────────────────────►──┘
                                      (loop)
```
