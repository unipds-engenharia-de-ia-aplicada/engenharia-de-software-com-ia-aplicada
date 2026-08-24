# Data Model: Servidor MCP OpsPilot

**Phase 1 output for** `specs/006-mcp-ops-server/plan.md`

Sem entidades de persistência novas. O MCP reutiliza o modelo operacional já persistido em `OpsStore` (Alert, Incident, etc.). Este documento descreve as entidades de **borda MCP** e os inputs das três tools.

---

## McpOpsServer

Identidade e catálogo do processo MCP.

| Campo | Tipo | Regras |
|-------|------|--------|
| name | `"opspilot"` | Fixo (FR-002) |
| version | string | Alinhar a `package.json` do OpsPilot |
| transport | stdio | Único transport no v1 |
| tools | McpToolBinding[] | Exactamente 3 no v1 |

---

## McpToolBinding

Ligação nome → schema → handler sobre `OpsStore`.

| Campo | Tipo | Regras |
|-------|------|--------|
| name | `"list_alerts"` \| `"open_incident"` \| `"resolve_incident"` | Catálogo fechado v1 |
| description | string | Mesma description da tool LangChain correspondente |
| inputSchema | ZodObject | **Mesma instância/definição** exportada de `agents/tools.ts` |
| handler | (args) → texto | Delega à factory LangChain / mesmo comportamento sobre `OpsStore` |

---

## ListAlertsInput

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| status | `"firing"` \| `"resolved"` \| `"all"` | Não | Default `firing` via `z.preprocess` (mesmo schema da tool do agente) |

---

## OpenIncidentInput

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| title | string | Sim | `min(1)` |
| service | string | Sim | Nome exato do serviço |
| severity | `"critical"` \| `"high"` \| `"medium"` \| `"low"` | Sim | Normalização de aliases `sev1`–`sev4` via preprocess existente |

---

## ResolveIncidentInput

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| id | string | Sim | ID do incidente local (`min(1)`) |

---

## McpToolResult (saída lógica)

| Caso | Representação MCP | Conteúdo |
|------|-------------------|----------|
| Sucesso | `content: [{ type: "text", text }]` | Mesma string que a tool LangChain retornaria |
| Erro de domínio (ex.: incidente inexistente) | Idem, texto `Error: ...` | Sem derrubar o processo; alinhado à tool do agente |
| Args inválidos | Erro de validação do SDK / rejeição na fronteira | Sem mutar o store |

---

## Relacionamentos

```text
Cliente MCP ──stdio──► McpOpsServer (opspilot)
McpOpsServer ──bindings──► list_alerts | open_incident | resolve_incident
bindings ──shared zod──► schemas em agents/tools.ts
bindings ──invoke──► DynamicStructuredTool / OpsStore
OpsStore ──persists──► Alert, Incident (modelo existente — sem mudança de schema)
```

Nenhuma nova tabela SQLite. Seed Mercadinho permanece o cenário base do entrypoint arquivo / testes `:memory:`.
