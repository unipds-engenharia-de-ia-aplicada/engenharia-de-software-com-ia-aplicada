# Research: Servidor MCP OpsPilot

**Phase 0 output for** `specs/006-mcp-ops-server/plan.md`

---

## Contexto

O agente já expõe tools operacionais via LangChain sobre `OpsStore`. A feature adiciona um entrypoint MCP stdio (`opspilot`) que publica um subconjunto (`list_alerts`, `open_incident`, `resolve_incident`) sem duplicar schemas nem comportamento. Esta fase fecha escolha de pacote SDK, estratégia de compartilhamento, bootstrap/env, regra stdout/stderr e harness de teste.

---

## Decisão 1: Pacote `@modelcontextprotocol/sdk` (v1) + stdio

**Decisão**:

- Dependência: `@modelcontextprotocol/sdk` (conforme FR-001; **não** migrar para o split v2 `@modelcontextprotocol/server` nesta feature).
- API alta: `McpServer` de `@modelcontextprotocol/sdk/server/mcp.js`.
- Transport: `StdioServerTransport` de `@modelcontextprotocol/sdk/server/stdio.js`.
- `server.connect(transport)` no entrypoint.
- Nome: `opspilot`; `version` alinhada ao `package.json` do OpsPilot (ex.: `0.1.0`).
- Peer `zod`: SDK documenta compatibilidade com Zod ≥ 3.25; bump de `zod` de `^3.23.0` → `^3.25.0` (ou range que satisfaça o peer) se `npm install` exigir.

**Rationale**: Spec fixa o pacote; v1 permanece linha suportada e encaixa no zod 3 já usado pelo projeto. v2 prefere zod/v4 e outro packaging — fora do escopo / risco desnecessário.

**Alternatives considered**:
- `@modelcontextprotocol/server` (v2) — mais novo; exige alinhamento zod v4 e muda imports; contradiz FR-001 literal.
- Server low-level `Server` sem `McpServer` — mais boilerplate para o mesmo resultado.

---

## Decisão 2: Fonte única de schemas + comportamento

**Decisão**:

1. **Exportar** os três schemas zod hoje privados em `src/agents/tools.ts`:
   - `listAlertsSchema`
   - `openIncidentSchema`
   - `resolveIncidentSchema`
2. Factory MCP `createOpsMcpServer(store: OpsStore): McpServer` registra exatamente essas três tools com:
   - `name` / `description` iguais às tools do agente
   - `inputSchema` = schema exportado (mesmo objeto zod)
   - handler que **delega** à factory LangChain correspondente (`createListAlertsTool(store).invoke(args)` etc.) e mapeia a string de retorno para `CallToolResult` `{ content: [{ type: 'text', text }] }`
3. Não reimplementar lógica de store no MCP; não criar schemas MCP paralelos.

**Rationale**: FR-004/FR-005 — uma fonte de verdade. Delegar a `.invoke` das DynamicStructuredTool existentes garante paridade de defaults, normalização de severity e mensagens de erro sem extrair handlers agora (refactor mínimo). Exportar schemas evita duplicação na borda MCP (SDK valida com o mesmo zod).

**Alternatives considered**:
- Extrair handlers puros para `src/tools/` e fazer LangChain + MCP wrappearem — mais limpo a longo prazo, maior diff; adiar se `.invoke` bastar.
- Duplicar schemas no MCP “por enquanto” — viola FR-004.
- Expor as 6 tools do agente no MCP — fora do escopo v1 (FR-010).

---

## Decisão 3: Layout de módulos e bootstrap

**Decisão**:

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/mcp/create-server.ts` | `createOpsMcpServer(store)` — registra tools; **não** conecta transport; **sem** `console.log` |
| `src/mcp/server.ts` | Entrypoint: `SqliteOpsStore(OPSPILOT_DB ?? ./data/opspilot.db)` + `seedOpsStore` + `createOpsMcpServer` + `StdioServerTransport` + `connect`; guard `import.meta.url` / argv como `index.ts`; erros de bootstrap → `console.error` + `process.exit(1)` |
| `src/mcp/server.test.ts` | Listagem via client in-memory |

MCP **não** chama `bootstrapOpsPilot()` (esse exige `OPENROUTER_API_KEY` e sobe estratégias LLM). Store + seed bastam.

Script npm:

```json
"mcp": "node --env-file-if-exists=.env --import tsx src/mcp/server.ts"
```

(Alinha Assumption da spec: env antes do entrypoint; superior a `tsx` puro.)

**Rationale**: Camadas (entrypoint separado); testes injetam store sem stdio; sem acoplar MCP à API key do OpenRouter.

**Alternatives considered**:
- Tudo em um único `server.ts` — pior para testar sem side-effect de connect.
- Reusar `bootstrapOpsPilot` — puxa LLM desnecessariamente.

---

## Decisão 4: Stdio — stdout só protocolo

**Decisão**:

- Proibido em `src/mcp/**`: `console.log`, `process.stdout.write` (exceto o transport do SDK).
- Permitido: `console.error` / `process.stderr.write` para diagnóstico e falhas de bootstrap.
- Teste estático opcional mas recomendado: ler fonte de `src/mcp/*.ts` (excluindo `.test.ts` se necessário) e assertar ausência de `console.log`.
- Não logar “server started” em stdout após `connect`.

**Rationale**: FR-006 / US3; documentação oficial do SDK (stderr only).

**Alternatives considered**:
- Logger file-based — overkill v1.
- Silêncio total sem stderr em falha — piora operação.

---

## Decisão 5: Harness de teste da listagem

**Decisão**:

1. Criar `SqliteOpsStore(":memory:")` + seed (ou store mínimo).
2. `const server = createOpsMcpServer(store)`.
3. Par `InMemoryTransport.createLinkedPair()` (API do SDK) + `Client` do SDK.
4. `await server.connect(serverTransport)`; `await client.connect(clientTransport)`.
5. `const { tools } = await client.listTools()`.
6. Assertar:
   - exatamente 3 tools
   - nomes sorted: `list_alerts`, `open_incident`, `resolve_incident`
   - (quando exposto pelo initialize) server name / info `opspilot` via resultado de `client.getServerVersion()` / `initialize` conforme API do Client

Não spawnar `npm run mcp` no unit test (flaky / stdio). Smoke manual fica no quickstart.

**Rationale**: FR-008 / SC-001 / SC-004; mesmo espírito dos testes offline das outras features.

**Alternatives considered**:
- Testar só a lista interna de registro sem Client — mais frágil à API do SDK; preferir `listTools` real.
- Processo filho stdio no CI — desnecessário se InMemoryTransport existir no SDK instalado.

---

## Decisão 6: Escopo negativo

**Decisão**: Fora desta feature:

- Tools MCP: `list_incidents`, `consultar_runbook`, `check_provider_status`
- Transport HTTP/SSE/Streamable HTTP
- Auth OAuth MCP
- Recursos/prompts MCP
- Mudanças no grafo, `/chat`, ou seed Mercadinho

**Rationale**: FR-010 + Assumptions.

---

## Resolução de NEEDS CLARIFICATION

Nenhum item NEEDS CLARIFICATION no Technical Context. Ambiguidade pacote v1 vs v2 resolvida na Decisão 1 (seguir FR-001). Ambiguidade script `tsx` vs env resolvida na Decisão 3 (padrão do repo).
