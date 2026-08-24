# Tool Contracts: Operational Tools

**Phase 1 output for** `specs/001-reasoning-nucleus/plan.md`

These are the three operational tools exposed to the reasoning strategies. Each tool is a `DynamicStructuredTool` whose `schema` is forwarded to the LLM as JSON Schema in the function-calling payload. All inputs are validated by `zod` before the handler executes.

---

## Tool: `list_alerts`

Lists alerts filtered by status.

### Input Schema (zod → JSON Schema)

```typescript
z.object({
  status: z.enum(["firing", "resolved"]).describe(
    'Filter alerts by status. Use "firing" for active alerts, "resolved" for cleared alerts.'
  ),
})
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | `"firing" \| "resolved"` | Yes | Alert status filter |

### Output (string returned to the agent)

Success — alerts found:
```
Found 3 firing alert(s):
- [alert-001] payment-api | critical | High error rate on /checkout
- [alert-002] auth-service | high | JWT validation failures spike
- [alert-003] order-service | critical | DB connection pool exhausted
```

Success — no alerts:
```
No firing alerts found.
```

### Error conditions

None — an empty result is a valid success case.

### Source file

`src/tools/list-alerts.ts`

---

## Tool: `open_incident`

Creates a new incident in the store and returns its generated identifier.

### Input Schema

```typescript
z.object({
  title: z.string().min(1).describe("Short descriptive title for the incident"),
  service: z.string().min(1).describe("Name of the affected service"),
  severity: z.enum(["critical", "high", "medium", "low"]).describe(
    "Severity level of the incident"
  ),
})
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` (non-empty) | Yes | Incident title |
| `service` | `string` (non-empty) | Yes | Affected service name |
| `severity` | `"critical" \| "high" \| "medium" \| "low"` | Yes | Severity level |

### Output (string returned to the agent)

Success:
```
Incident created successfully. ID: inc-1722103456789-a3f2
Title: High error rate on /checkout
Service: payment-api
Severity: critical
Status: open
```

### Error conditions

- Zod validation failure (e.g., empty `title`): zod throws before handler runs; `DynamicStructuredTool` returns the error message as a string to the agent

### Source file

`src/tools/open-incident.ts`

---

## Tool: `resolve_incident`

Marks an existing incident as resolved.

### Input Schema

```typescript
z.object({
  id: z.string().min(1).describe("The incident identifier to resolve (e.g., inc-1722103456789-a3f2)"),
})
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` (non-empty) | Yes | Incident ID to resolve |

### Output (string returned to the agent)

Success:
```
Incident inc-1722103456789-a3f2 has been resolved.
Service: payment-api
Resolved at: 2026-07-27T22:10:00.000Z
```

Error — incident not found:
```
Error: Incident not found: inc-unknown-id
```

### Error conditions

- `IncidentNotFoundError`: caught inside the tool handler; returned as a descriptive string to the agent (not a thrown exception at the graph level)
- Zod validation failure: handled by `DynamicStructuredTool` before handler runs

### Source file

`src/tools/resolve-incident.ts`

---

## Tool Registration

All three tools are exported as an array and injected into both the ReAct strategy and the Plan-and-Execute executor node:

```typescript
// src/tools/index.ts  (to be created)
export function createTools(store: IStore): DynamicStructuredTool[] {
  return [
    createListAlertsTool(store),
    createOpenIncidentTool(store),
    createResolveIncidentTool(store),
  ];
}
```
