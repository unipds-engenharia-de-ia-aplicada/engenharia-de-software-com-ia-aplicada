# Tool Contract: `check_provider_status`

**Phase 1 output for** `specs/005-provider-status-tool/plan.md`

Uma tool nova no catálogo (`src/agents/tools.ts`), núcleo de I/O em `src/tools/check-provider-status.ts`. Segue as **6 regras** (nome; o quê; quando usar; quando não usar; `.describe()` em todo campo; enums fechados).

Referência de entidades: [data-model.md](../data-model.md).

---

## Shared: 6 regras (checklist)

1. `name` estável snake_case  
2. `description` = o que faz  
3. Inclui **quando usar**  
4. Inclui **quando não usar**  
5. Todo campo zod com `.describe(...)`  
6. Domínio fechado → `z.enum([...])`

---

## Tool: `check_provider_status`

**Quando usar**: suspeita de problema externo; dúvida “é o nosso ou do provedor?”; dependência (GitHub/Cloudflare) aparentemente fora do ar.  
**Quando não usar**: inventário local de alertas/incidentes/runbooks; não substitui `list_alerts`, `list_incidents` ou `consultar_runbook`.

### Schema (entrada)

```typescript
z.object({
  provider: z.preprocess(
    (v) => v ?? "github",
    z.enum(["github", "cloudflare"]).describe(
      'Provedor externo cuja statuspage pública será consultada: "github" (default) ou "cloudflare".',
    ),
  ),
})
```

### URLs (sem chave)

| provider | URL |
|----------|-----|
| `github` | `https://www.githubstatus.com/api/v2/status.json` |
| `cloudflare` | `https://www.cloudflarestatus.com/api/v2/status.json` |

### Comportamento de rede

1. `GET` com `signal: AbortSignal.timeout(5000)` por tentativa.  
2. Se rede, timeout (`AbortError`) ou HTTP 5xx → **uma** nova tentativa (mesmo timeout).  
3. HTTP 4xx → erro legível, sem retry.  
4. HTTP 2xx → `response.json()` + zod `{ status: { indicator: string, description: string } }` (passthrough).  
5. Validação falha → erro legível, sem retry.  
6. Sucesso → `` `${indicator} — ${description}` ``.  
7. Qualquer falha final → `` `Error: ...` ``; **nunca** throw para o caller da tool.

### Saída

| Caso | Formato |
|------|---------|
| Sucesso | Uma linha: `none — All Systems Operational` (exemplo) |
| Falha | `Error: ...` |

### Injeção para testes

```typescript
type FetchLike = typeof globalThis.fetch;

fetchProviderStatus(
  provider: "github" | "cloudflare",
  options?: { fetch?: FetchLike },
): Promise<string>;

createCheckProviderStatusTool(options?: { fetch?: FetchLike }): DynamicStructuredTool;
```

Default de `fetch` = `globalThis.fetch`. Testes MUST passar fake e NÃO usar rede.

### Registro

`createTools(store)` MUST incluir `check_provider_status` (6ª tool no catálogo atual). A factory da tool não usa `store`.

---

## Payload externo (contrato statuspage.io)

Resposta mínima aceita (outros campos ignorados):

```json
{
  "status": {
    "indicator": "none",
    "description": "All Systems Operational"
  }
}
```

Validação: zod no processo após 2xx; não confiar no shape sem parse.
