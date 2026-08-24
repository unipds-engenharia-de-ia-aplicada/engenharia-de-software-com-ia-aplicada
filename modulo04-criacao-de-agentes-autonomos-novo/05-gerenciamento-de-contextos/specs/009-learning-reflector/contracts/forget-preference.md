# Tool Contract: `forget_preference`

**Phase 1 output for** `specs/009-learning-reflector/plan.md`

Tool nova no catálogo (`src/agents/tools.ts`). Segue as **6 regras** (nome; o quê; quando usar; quando não usar; `.describe()` em todo campo; enums fechados se houver).

---

## Shared: 6 regras (checklist)

1. `name` estável snake_case  
2. `description` = o que faz  
3. Inclui **quando usar**  
4. Inclui **quando não usar**  
5. Todo campo zod com `.describe(...)`  
6. Domínio fechado → `z.enum([...])` (N/A aqui — só string)

---

## Tool: `forget_preference`

**Quando usar**: plantonista pede para esquecer preferência/fato previamente memorizado (“não priorize mais checkout”, “esqueça que …”).  
**Quando não usar**: apagar alertas/incidentes; listar memórias; pedidos operacionais pontuais sem intenção de esquecer preferência.

### Schema (entrada)

```ts
z.object({
  query: z
    .string()
    .min(1)
    .describe("Descrição da preferência ou fato a remover da memória do usuário atual"),
})
```

**Não** inclui `userId` — obtido de `getChatUserId()` (ALS).

### Comportamento

1. `userId = getChatUserId()`; se ausente → `"Error: no active chat user context."`
2. `hits = await memories.recall(userId, query)`
3. Se `hits.length === 0` → `"No matching preference found."`
4. `forgotten = await memories.forget(userId, hits[0].id)`
5. Sucesso → `"Forgot preference: <fact>"` (ou mensagem equivalente)
6. Falha forget → `"Error: could not forget preference."` (string observação; sem throw)

### Registro

```ts
createTools(store: OpsStore, memories?: MemoryStore): DynamicStructuredTool[]
```

- Com `memories`: 7 tools (inclui `forget_preference`).
- Sem `memories`: 6 tools (comportamento atual Arena/bench).

### MCP

**Fora** do catálogo MCP (`list_alerts` / `open_incident` / `resolve_incident` only).

### Testes

| Caso | Assert |
|------|--------|
| ALS + fato seeded + query | recall após invoke não contém fato |
| Sem ALS | Error string; store intacto |
| Query sem match | No matching… |
| createTools com memories | nome `forget_preference` presente |
