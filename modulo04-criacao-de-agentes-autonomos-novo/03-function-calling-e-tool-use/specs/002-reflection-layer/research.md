# Research: Reflection Layer

**Phase 0 output for** `specs/002-reflection-layer/plan.md`

---

## Contexto

A codebase já implementa duas `ReasoningStrategy` completas (`ReactStrategy`, `PlanExecuteStrategy`), um trace builder, zod em toda a fronteira, e o padrão `model.withStructuredOutput(schema)` para saída estruturada do LLM. Todos os padrões necessários para o reflection layer já estão presentes — a fase de pesquisa serve para tomar decisões de design e documentar os trade-offs.

---

## Decisão 1: Como injetar o crítico no decorator

**Decisão escolhida**: `CriticFn` como campo opcional em `ReflectionOpts`

```typescript
type CriticFn = (answer: string, trace: TraceEvent[]) => Promise<CritiqueResult>;

interface ReflectionOpts {
  maxReflections?: number;           // default: 2
  critic?: CriticFn;                 // injeta mock em testes
  modelFactory?: () => ChatOpenAI;   // cria crítico LLM se critic não for fornecido
}
```

**Rationale**: Permite testes 100% determinísticos (mock de `critic` sem rede) e produção com LLM real (via `modelFactory`). Segue o mesmo padrão de injeção de dependência já usado nos construtores de `ReactStrategy` e `PlanExecuteStrategy`.

**Alternativas rejeitadas**:
- Hardcode da chamada LLM dentro do decorator → impossibilita testes sem rede; viola princípio de testabilidade da constituição.
- Passar uma segunda `ReasoningStrategy` como crítico → over-engineered; o crítico só precisa retornar saída estruturada, não um `StrategyResult` completo com trace e métricas.
- `modelFactory` como segundo argumento posicional obrigatório → quebraria o contrato `withReflection(strategy, opts?)` da spec (opts deve ser opcional).

---

## Decisão 2: Como injetar o feedback na próxima invocação da estratégia base

**Decisão escolhida**: Prepend estruturado no `input` string

```
[Critique - Round N]:
{feedback}

Original request:
{original_input}
```

**Rationale**: A interface `ReasoningStrategy.run(input: string)` aceita apenas uma string — não há mecanismo para metadados adicionais sem alterar a interface. Injetar o feedback como preamble no prompt é o padrão "critique-then-revise" amplamente usado em sistemas LLM. O modelo recebe o feedback de forma visível, atendendo ao requisito da spec ("o modelo receba o feedback de forma visível"). O `original_input` fica explicitamente separado para manter clareza.

**Alternativas rejeitadas**:
- Adicionar segundo parâmetro a `run()` → muda a interface `ReasoningStrategy` (breaking change que afeta `ReactStrategy`, `PlanExecuteStrategy`, e todos os consumidores em `arena.ts`).
- Objeto de contexto genérico como segundo parâmetro opcional → mesma complexidade de breaking change.
- JSON stringified como input → opaco para o modelo; o LLM processa melhor linguagem natural.

---

## Decisão 3: Extensão de TraceEvent para campos do CritiqueEvent

**Decisão escolhida**: Campos opcionais em `TraceEvent` existente

```typescript
export interface TraceEvent {
  type: TraceEventType;
  content: string;
  tool?: string;
  toolArgs?: Record<string, unknown>;
  // campos específicos de eventos critique gerados pelo reflection layer:
  round?: number;
  approved?: boolean;
  timestampMs?: number;
}
```

**Rationale**: Backward compatible — nenhum código existente quebra (TypeScript trata campos opcionais ausentes como `undefined`). O `PlanExecuteStrategy` já produz eventos `critique` com apenas `content`; esses continuam funcionando sem alteração. Os novos campos são semanticamente relevantes apenas para `critique` events do reflection layer.

**Alternativas rejeitadas**:
- Discriminated union com tipo específico para cada `TraceEventType` → correta do ponto de vista de tipos, mas requer refatoração significativa de todos os consumidores (`buildTraceFromMessages`, `buildPlanExecuteTrace`, `arena.ts`) — escopo fora desta feature.
- Armazenar dados extras em `content` como JSON → fragile parsing; arena.ts renderiza `content` diretamente para o usuário; JSON seria exibido como ruído.
- Campo `meta?: Record<string, unknown>` genérico → menos type-safe que campos nomeados; não permite checagem de tipo em `approved` e `round`.

---

## Decisão 4: Padrão de saída estruturada do crítico LLM

**Decisão escolhida**: `model.withStructuredOutput(critiqueSchema)` com schema zod + try/catch para fail-safe

```typescript
const critiqueSchema = z.object({
  approved: z.boolean(),
  feedback: z.string(),
});

// dentro de createLLMCritic:
try {
  const result = await criticModel.invoke([...]);
  return critiqueSchema.parse(result); // zod valida
} catch {
  return { approved: true, feedback: "" }; // fail-safe (FR-012)
}
```

**Rationale**: Exatamente o padrão já em uso em `plan-execute.ts` para `planSchema` e `replanSchema`. Reutiliza a fronteira zod mandatória da constituição. O try/catch implementa FR-012 (falha de parsing → `approved: true`, sem crash).

**Alternativas rejeitadas**:
- Parsing manual do JSON de resposta com regex → frágil; não idiomático nesta codebase.
- Lançar erro em vez de fail-safe → viola FR-012 e quebraria a execução do agente por falha do crítico.

---

## Decisão 5: Integração na Arena

**Decisão escolhida**: Estender o tipo `StrategyName` e a função `createStrategy` em `src/arena.ts`

```typescript
type StrategyName = "react" | "plan-and-execute" | "reflect:react" | "reflect:plan-and-execute";

function createStrategy(name: StrategyName, maxIterations: number): ReasoningStrategy {
  // ...cases existentes...
  if (name === "reflect:react") {
    const base = new ReactStrategy({ modelFactory: createModel, tools, maxIterations });
    return withReflection(base, { modelFactory: createModel });
  }
  if (name === "reflect:plan-and-execute") {
    const base = new PlanExecuteStrategy({ modelFactory: createModel, tools, maxIterations });
    return withReflection(base, { modelFactory: createModel });
  }
}
```

**Rationale**: Mínima mudança no código existente; segue o padrão de `parseArgs` que já filtra `validNames`. O `validNames` array é atualizado para incluir os dois novos nomes. A função de exibição de erro em `parseArgs` lista os novos nomes válidos.

**Alternativas rejeitadas**:
- Registro/plugin dinâmico de estratégias → over-engineered para 2 novos nomes; adicionaria complexidade desnecessária.
- Arquivo separado de mapeamento Arena → indireção desnecessária; arena.ts é pequeno (137 linhas).

---

## Decisão 6: Acumulação de métricas

**Decisão escolhida**: Wall-clock externo para `latencyMs`; soma aritmética de `llmCalls`

```
latencyMs   = Date.now() - startedAt          (wall-clock do run() completo)
llmCalls    = Σ baseResult.metrics.llmCalls    (todas as rodadas da base)
            + N_critic_calls                   (1 por rodada de crítica executada)
```

**Rationale**: `latencyMs` wall-clock externo segue o padrão exato de `ReactStrategy` e `PlanExecuteStrategy` — evita divergência e inclui overhead de setup. `llmCalls` soma aritmética é direta e determinística para os testes (SC-003: +1 para aprovação imediata, SC-003 de SC-002: 3+2=5 para `maxReflections: 2` com reprovação constante).

**Nota sobre SC-002**: `metrics.llmCalls` de uma aprovação imediata = `baseResult.metrics.llmCalls + 1` (a chamada do crítico). O "1" vem do `createLLMCritic` incrementar seu próprio contador, que é então somado pelo decorator.

**Alternativas rejeitadas**:
- Somar latências parciais → undercounting do tempo real de execução; inconsistente com o padrão existente.
- Expor métricas detalhadas por rodada → fora do escopo desta feature; `StrategyResult.metrics` não tem esse campo.

---

## Resumo das Decisões

| # | Área | Decisão |
|---|------|---------|
| 1 | Injeção do crítico | `CriticFn` opcional em `ReflectionOpts` |
| 2 | Injeção de feedback | Prepend estruturado no `input` string |
| 3 | TraceEvent extension | Campos opcionais `round`, `approved`, `timestampMs` |
| 4 | Saída estruturada LLM | `withStructuredOutput` + zod + fail-safe try/catch |
| 5 | Integração Arena | Estender `StrategyName` + `createStrategy` em `arena.ts` |
| 6 | Métricas | Wall-clock externo + soma de `llmCalls` |

Nenhuma clarificação adicional pendente. Todos os NEEDS CLARIFICATION resolvidos.
