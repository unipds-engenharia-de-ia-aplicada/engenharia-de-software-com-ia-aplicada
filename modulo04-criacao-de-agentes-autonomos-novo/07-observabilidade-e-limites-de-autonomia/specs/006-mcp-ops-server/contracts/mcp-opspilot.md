# MCP Contract: `opspilot`

**Phase 1 output for** `specs/006-mcp-ops-server/plan.md`

Servidor MCP stdio que expõe o subconjunto operacional mínimo do OpsPilot.

Referências: [data-model.md](../data-model.md), [research.md](../research.md).

---

## Server

| Campo | Valor |
|-------|--------|
| name | `opspilot` |
| version | igual a `package.json` (`0.1.0` no momento do plano) |
| transport | stdio (`StdioServerTransport`) |
| package | `@modelcontextprotocol/sdk` |
| entrypoint | `src/mcp/server.ts` |
| npm script | `mcp` → `node --env-file-if-exists=.env --import tsx src/mcp/server.ts` |

### Regra de I/O

| Canal | Uso |
|-------|-----|
| stdout | **Somente** frames JSON-RPC MCP (transport) |
| stderr | Diagnóstico e falhas de bootstrap (`console.error`) |
| proibido | `console.log` / writes manuais em stdout em `src/mcp/**` |

---

## Factory (contrato interno testável)

```typescript
createOpsMcpServer(store: OpsStore): McpServer
```

- Registra exatamente as 3 tools abaixo.
- Não conecta transport (caller de teste ou entrypoint faz `connect`).
- Não exige `OPENROUTER_API_KEY`.

---

## Tool: `list_alerts`

**Quando usar / não usar**: mesma description da tool LangChain em `createListAlertsTool`.

### Schema (fonte única)

Exportado de `src/agents/tools.ts` — `listAlertsSchema`:

```typescript
z.object({
  status: z.preprocess(
    (value) => value ?? "firing",
    z.enum(["firing", "resolved", "all"]).describe(
      'Filtro: "firing" (ativos), "resolved" (encerrados), "all" (todos). Default firing.',
    ),
  ),
})
```

### Comportamento

Delega a `createListAlertsTool(store).invoke(args)`. Retorno MCP: texto da tool em `content[0].text`.

---

## Tool: `open_incident`

### Schema (fonte única)

`openIncidentSchema` — campos `title`, `service`, `severity` (enum canônico + aliases sev1–sev4 via `normalizeSeverity`), todos com `.describe(...)`.

### Comportamento

Delega a `createOpenIncidentTool(store).invoke(args)`. Cria incidente no `OpsStore`; retorno confirma ID/status.

---

## Tool: `resolve_incident`

### Schema (fonte única)

`resolveIncidentSchema` — `{ id: z.string().min(1).describe(...) }`.

### Comportamento

Delega a `createResolveIncidentTool(store).invoke(args)`. ID inexistente → texto `Error: ...` (não crash do server).

---

## Catálogo (`tools/list`)

Resposta MUST conter **exatamente** estes nomes (ordem indiferente; testes podem sortar):

1. `list_alerts`
2. `open_incident`
3. `resolve_incident`

Fora do catálogo v1: `list_incidents`, `consultar_runbook`, `check_provider_status`, e qualquer outra tool do agente.

---

## Teste mínimo (contrato)

| Assert | Esperado |
|--------|----------|
| `listTools()` length | `3` |
| nomes | set igual a `{ list_alerts, open_incident, resolve_incident }` |
| server name | `opspilot` |
| fonte `src/mcp` (não-test) | sem `console.log` |
