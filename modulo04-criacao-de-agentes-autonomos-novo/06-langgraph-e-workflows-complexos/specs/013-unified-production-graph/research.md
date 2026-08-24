# Research: Grafo Unificado de Produção

**Phase 0 output for** `specs/013-unified-production-graph/plan.md`

---

## Contexto

Hoje `POST /chat` faz `strategy.default("react")` no zod, `resolveStrategy(registry, strategy, reflect)` e `runChat(..., strategy)`. Não há nó roteador nem campo `node` no trace. A unidade pede um LangGraph de produção com contexto, roteador, três estratégias e resposta — com override opcional de `strategy`.

---

## Decisão 1: Caminho e forma do grafo

**Decisão**: Módulo canônico `src/graph/production-graph.ts` (pasta `src/graph/`). Um `StateGraph` LangGraph com nós:

| Nó | `node` id | Responsabilidade |
|----|-----------|------------------|
| `context` | `context` | maybeSummarize + lastMessages + recall + `buildContext` + append user |
| `router` | `router` | override **ou** LLM `withStructuredOutput` → `{ route, reason }` + evento `route` |
| `react` | `react` | `ReactStrategy.run` |
| `plan-and-execute` | `plan-and-execute` | `PlanExecuteStrategy.run` |
| `reflect` | `reflect` | `withReflection(ReactStrategy)` (mesmo base react + crítico) |
| `response` | `response` | append assistant + scheduleLearning + montar `ChatTurnResult` |

Arestas: `START → context → router →` conditional(`route`) → strategy → `response → END`.

API pública sugerida:

```ts
createProductionGraph(deps): CompiledGraph
runProductionTurn(graph, input): Promise<ChatTurnResult>
```

**Rationale**: Alinha à constitution (agente = grafo); caminho explícito e testável; nomes de `node` estáveis para o trace.

**Alternatives considered**:

- `src/agents/production-graph.ts` — confunde com agents ReAct já existentes.
- Manter `runChat` escolhendo strategy e só “embrulhar” — não satisfaz FR-001/FR-002 (orquestração no grafo).

---

## Decisão 2: Schema do roteador + tabela no prompt

**Decisão**:

```ts
const routeSchema = z.object({
  route: z.enum(["react", "plan-and-execute", "reflect"]),
  reason: z.string().min(1),
});
```

- Prompt em `router-prompt.ts` com **tabela markdown** (critério → rota), exportada como string constante para assert nos testes.
- `model.withStructuredOutput(routeSchema)` + `routeSchema.parse` na fronteira.
- Entrada do classificador: mensagem atual + trecho curto do contexto já montado (ex. summary/memories truncados se preciso) — detalhe fino na implementação; mínimo: `message`.

**Tabela canônica (conteúdo mínimo)**:

| Quando | Rota |
|--------|------|
| Consulta pontual / tool call simples (listar alertas, status) | `react` |
| Pedido multi-passo / plano explícito / vários serviços | `plan-and-execute` |
| Pedido que exige verificação / alta criticidade / “revise” / resposta deve ser auditada | `reflect` |

**Rationale**: Contrato da spec; tabela testável sem LLM; enum fecha o conjunto de nós.

**Alternatives considered**:

- Classificador free-text + parse manual — frágil.
- Só embeddings/heurística sem LLM — fora do escopo didático da unidade.

---

## Decisão 3: Override de `strategy` / `reflect`

**Decisão**:

1. `chatRequestSchema`: `strategy: z.enum([...]).optional()` — **sem** `.default("react")`.
2. Allowlist = as três rotas. Fora → `UnknownStrategyError` / `422` **antes** de invocar o grafo.
3. Resolução de override na entrada do grafo:
   - Se `strategy` presente → `override = true`, `route = strategy` (LLM router **não** chamado).
   - Senão se `reflect === true` → `override = true`, `route = "reflect"`.
   - Senão → nó router chama LLM.
4. Evento `route` sempre emitido (classificado ou override).

**Rationale**: FR-009/FR-010; compat com flag `reflect` (spec edge case); `strategy` prevalece se ambos.

**Alternatives considered**:

- Manter default zod `"react"` e só “fingir” roteador — viola FR-010.
- Remover `reflect` do body agora — breaking desnecessário; mapear para nó `reflect`.

---

## Decisão 4: Trace — `route` + `node`

**Decisão**:

```ts
type TraceEventType = ... | "summarize" | "route";

interface TraceEvent {
  type: TraceEventType;
  content: string;
  node: string;           // obrigatório
  route?: string;         // evento route: rota efetiva
  override?: boolean;     // evento route: true se veio do body
  // campos existentes (tool, round, ...)
}
```

- Evento de roteamento: `{ type: "route", node: "router", content: reason, route, override }`.
- Helper `stampNode(node, events)` aplica `node` em lote.
- `buildTraceFromMessages(messages, node)` / strategies passam o id do nó.
- Eventos pré-strategy (ex. `summarize` no context): `node: "context"`.
- Fallback de rota inválida/falha do LLM: `route: "react"`, `reason` explica fallback, `override: false`, e opcionalmente content menciona `"fallback"`.

**Rationale**: SC-001; raio-X do grafo; Arena pode stamp com nome da strategy para typecheck.

**Alternatives considered**:

- `node` opcional — falha o requisito “todo evento”.
- Só JSON em `content` sem campos `route`/`override` — menos queryável nos testes.

---

## Decisão 5: Integração com `runChat` / HTTP

**Decisão**:

- Extrair a orquestração do turno para `runProductionTurn` (grafo).
- `runChat` vira fachada fina **ou** é substituído nas chamadas de `server.ts` pelo grafo (preferência: `server` → `runProductionTurn`; manter `runChat` como wrapper depreciado só se testes legados precisarem — senão migrar testes para o grafo).
- Timeout HTTP continua envolvendo a promise do turno completo.
- Registry HTTP: ainda pode existir para listagem/Arena; validação de override usa o set fixo das três rotas do grafo (não nomes arbitrários do registry), **exceto** se quisermos permitir só as três no schema zod.

**Rationale**: Um orquestrador; evita dois caminhos (registry resolve + grafo).

**Alternatives considered**:

- Grafo só “por dentro” de cada strategy — não unifica o turno.

---

## Decisão 6: Falhas do roteador

**Decisão** (alinhado ao default da spec):

- Saída com `route` fora do enum / parse fail / throw do modelo → **fallback `react`**, evento `route` com reason indicando fallback, turno segue.
- Não falha o HTTP se o ramo `react` completar.

**Rationale**: Degradação controlada; demos não quebram por classificador.

**Alternatives considered**:

- 503 no fail do router — pior DX; retry/fallback de modelo é outra feature.

---

## Decisão 7: Fora de escopo (confirmado)

- Retry/fallback de **modelo** na fábrica `createModel`
- Paralelismo em ondas no plan-execute
- Checkpointing / interrupts
- Migrar Arena para o production graph

---

## NEEDS CLARIFICATION

Nenhum — defaults da spec + decisões acima fecham o design.
