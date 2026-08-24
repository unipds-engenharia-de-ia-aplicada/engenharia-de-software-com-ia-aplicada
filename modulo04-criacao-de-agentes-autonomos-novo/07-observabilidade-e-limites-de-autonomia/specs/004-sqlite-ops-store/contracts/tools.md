# Tool Contracts: Operational Tools (v2)

**Phase 1 output for** `specs/004-sqlite-ops-store/plan.md`

Cinco tools em `src/agents/tools.ts`. Todas seguem as **6 regras** (nome; o quê; quando usar; quando não usar; `.describe()` em todo campo; enums fechados).

---

## Shared: 6 regras (checklist por tool)

1. `name` estável snake_case  
2. `description` = o que faz  
3. Inclui **quando usar**  
4. Inclui **quando não usar**  
5. Todo campo zod com `.describe(...)`  
6. Domínio fechado → `z.enum([...])`

---

## Tool: `list_alerts`

**Quando usar**: inventário de alertas por status operacional.  
**Quando não usar**: para incidentes formais (usar `list_incidents`) ou procedimentos (usar `consultar_runbook`).

```typescript
z.object({
  status: z.preprocess(
    (v) => v ?? "firing",
    z.enum(["firing", "resolved", "all"]).describe(
      'Filtro: "firing" (ativos), "resolved" (encerrados), "all" (todos). Default firing.',
    ),
  ),
})
```

Saída: string multilinha (padrão atual) ou mensagem de vazio.

---

## Tool: `open_incident`

**Quando usar**: após identificar um problema que exige registro formal (ex. alerta crítico em investigação).  
**Quando não usar**: só para “olhar” alertas; não usar se o incidente já existe (aí `list_incidents` / `resolve_incident`).

```typescript
z.object({
  title: z.string().min(1).describe("Título curto do incidente"),
  service: z.string().min(1).describe("Nome exato do serviço afetado (ex.: payments, checkout, auth)"),
  severity: z.enum(["critical", "high", "medium", "low"]).describe(
    "Severidade: critical|high|medium|low (sev1=critical, sev2=high, sev3=medium, sev4=low)",
  ),
})
```

---

## Tool: `resolve_incident`

**Quando usar**: mitigação concluída e o incidente deve fechar.  
**Quando não usar**: para criar incidente novo ou listar estado.

```typescript
z.object({
  id: z.string().min(1).describe("ID do incidente (ex.: inc-1722103456789-a3f2)"),
  summary: z
    .string()
    .min(1)
    .optional()
    .describe("Resumo opcional da resolução (o que foi feito)"),
})
```

Erro conhecido → string `Error: ...` (não throw no grafo).

---

## Tool: `list_incidents` (NOVA)

**Quando usar**: ver incidentes abertos/resolvidos/todos durante o plantão.  
**Quando não usar**: para alertas crus (`list_alerts`) ou texto de runbook.

```typescript
z.object({
  status: z.preprocess(
    (v) => v ?? "open",
    z.enum(["open", "resolved", "all"]).describe(
      'Filtro: "open" (default), "resolved", ou "all".',
    ),
  ),
})
```

Saída: lista formatada com id, service, severity, status (e summary se houver); ou mensagem de vazio.

---

## Tool: `consultar_runbook` (NOVA)

**Quando usar**: preciso dos passos operacionais de um serviço com runbook (checkout, payments, auth).  
**Quando não usar**: para inventar procedimento se não houver runbook; não substitui abrir/resolver incidente.

```typescript
z.object({
  service: z.string().min(1).describe("Nome do serviço cujo runbook será consultado"),
})
```

Sucesso: conteúdo do runbook.  
Ausência: `Error: Runbook not found: <service>` (via `RunbookNotFoundError`).

---

## Registration

```typescript
createTools(store: OpsStore): DynamicStructuredTool[] // 5 tools na ordem:
// list_alerts, open_incident, resolve_incident, list_incidents, consultar_runbook
```
