# Contract: Trace — `node` + `route`

**Phase 1 output for** `specs/013-unified-production-graph/plan.md`

Extensão do modelo de `TraceEvent` no domínio.

---

## TraceEventType

Adicionar:

```ts
| "route"
```

Tipos existentes permanecem: `thought`, `action`, `observation`, `plan`, `critique`, `answer`, `summarize`.

---

## TraceEvent

| Field | Required | Notes |
|-------|----------|-------|
| `type` | sim | |
| `content` | sim | Para `route`: texto do `reason` |
| `node` | **sim** | Id canônico do nó (`context`, `router`, `react`, `plan-and-execute`, `reflect`, `response`) |
| `route` | se `type==="route"` | Rota efetiva |
| `override` | se `type==="route"` | `true` se override de body |
| demais | como hoje | |

### Exemplo — classificação

```json
{
  "type": "route",
  "node": "router",
  "content": "Consulta simples de alertas",
  "route": "react",
  "override": false
}
```

### Exemplo — override

```json
{
  "type": "route",
  "node": "router",
  "content": "override from request",
  "route": "plan-and-execute",
  "override": true
}
```

---

## Helpers

- `stampNode(node: string, events: TraceEvent[]): TraceEvent[]` — garante `node` em lote.
- Builders de trace (`buildTraceFromMessages`, plan-execute) recebem `node` e carimbam na emissão.

---

## Compat Arena / testes legados

Caminhos fora do production graph MUST passar a stamp `node` (ex. nome da strategy) para satisfazer o tipo; não precisam emitir `route` (só o grafo de produção).
