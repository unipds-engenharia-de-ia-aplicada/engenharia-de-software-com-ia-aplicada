# Data Model: Grafo Unificado de Produção

**Phase 1 output for** `specs/013-unified-production-graph/plan.md`

Sem tabelas SQLite novas. Estado do grafo e extensão do trace em memória.

---

## Entities

### ProductionRoute

```ts
type ProductionRoute = "react" | "plan-and-execute" | "reflect";
```

Conjunto fechado de nós de estratégia e valores válidos de `strategy` no body.

---

### RouterDecision

| Field | Type | Constraints |
|-------|------|-------------|
| `route` | `ProductionRoute` | Obrigatório |
| `reason` | `string` | Não vazio após trim (fallback pode usar texto fixo) |
| `override` | `boolean` | `true` se veio de `strategy` ou `reflect:true` |

Produzido pelo nó `router` (LLM ou bypass).

---

### ProductionGraphState (Annotation)

Campos mínimos do estado LangGraph (nomes exatos na implementação):

| Field | Type | Notas |
|-------|------|-------|
| `message` | `string` | Mensagem crua do request |
| `userId` | `string` | |
| `conversationId` | `string` | Criado/resolvido no context |
| `overrideRoute` | `ProductionRoute \| null` | Pré-setado pela borda HTTP |
| `built` | `ContextBuildResult \| null` | Saída do ContextBuilder |
| `route` | `ProductionRoute \| null` | Rota efetiva após router |
| `routerReason` | `string` | |
| `override` | `boolean` | |
| `answer` | `string` | |
| `trace` | `TraceEvent[]` | Reducers: concat |
| `metrics` | `ExecutionMetrics` (parcial) | Acumulado da strategy |
| `summarizeEvent` | `TraceEvent \| null` | Opcional, `node: "context"` |

---

### TraceEvent (estendido)

| Field | Type | Constraints |
|-------|------|-------------|
| `type` | `TraceEventType` | Inclui `"route"` |
| `content` | `string` | Para `route`: o `reason` |
| `node` | `string` | **Obrigatório** — id do nó produtor |
| `route` | `string?` | Presente quando `type === "route"` |
| `override` | `boolean?` | Presente quando `type === "route"` |
| `tool` / `toolArgs` / `round` / `approved` / `timestampMs` | existentes | Inalterados |

#### Node ids canônicos

| `node` | Produtor |
|--------|----------|
| `context` | Nó contexto (ex. `summarize`) |
| `router` | Evento `route` |
| `react` | Eventos da strategy ReAct |
| `plan-and-execute` | Eventos Plan-and-Execute |
| `reflect` | Eventos do ramo com reflexão (incl. `critique`) |
| `response` | Só se o nó resposta emitir eventos (opcional; default não emitir) |

---

### ChatRequest (comportamento)

| Field | Type | Change |
|-------|------|--------|
| `message` | `string` | Igual |
| `userId` | `string` | Igual |
| `strategy` | `ProductionRoute \| undefined` | **Sem default**; se presente = override |
| `reflect` | `boolean` | Default `false`; se `true` e sem `strategy` → override `reflect` |
| `conversationId` | `uuid?` | Igual |

---

### ChatTurnResult

Shape inalterado (`conversationId`, `answer`, `trace`, `metrics` + breakdown). Semântica: `trace` sempre inclui ≥1 `route` e todo evento tem `node`.

---

## Validation rules

- `strategy` ∈ `ProductionRoute` ou ausente; senão `422`.
- Saída LLM do router parseada com zod enum; inválida → fallback `react` + reason de fallback.
- Todo `TraceEvent` criado no caminho `/chat` MUST setar `node`.
- Um turno executa exatamente um nó de estratégia.

---

## State transitions (turno)

```text
HTTP validate body
  └─ strategy? allowlist → overrideRoute
        │
        ▼
context: summarize? → buildContext → append user → trace(+summarize)
        │
        ▼
router: if overrideRoute → decision(override=true)
        else LLM → decision(override=false) | fallback react
        → append { type:route, node:router, ... }
        │
        ▼
conditional(route) → react | plan-and-execute | reflect
        → stamp node on strategy trace
        │
        ▼
response: append assistant → learning → ChatTurnResult
```

---

## Relationships

```text
ChatRequest ──override?──► RouterDecision.route
ContextBuildResult ──► strategy.run input
RouterDecision ──► TraceEvent(type=route)
StrategyResult.trace ──stamp(node)──► TraceEvent[]
ProductionGraph ──► ChatTurnResult
```
