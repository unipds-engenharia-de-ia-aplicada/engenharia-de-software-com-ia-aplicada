# Quickstart: Servidor MCP OpsPilot

**Phase 1 output for** `specs/006-mcp-ops-server/plan.md`

Guia de validação end-to-end. Sem código de implementação completo.

Referências: [data-model.md](./data-model.md), [contracts/mcp-opspilot.md](./contracts/mcp-opspilot.md).

---

## Pré-requisitos

- Node.js 22+
- `npm install` na raiz (inclui `@modelcontextprotocol/sdk`)

---

## 1. Validação automatizada

```bash
npm test
npm run typecheck
```

**Esperado**: verdes, incluindo:

| # | Caso | Esperado |
|---|------|----------|
| 1 | `createOpsMcpServer` + client in-memory `listTools` | Exatamente 3 tools: `list_alerts`, `open_incident`, `resolve_incident` |
| 2 | Identidade do server | Nome `opspilot` |
| 3 | (recomendado) ausência de `console.log` em `src/mcp/*.ts` de produção | Assert na fonte |
| 4 | Regressão tools LangChain | `createTools` / testes existentes continuam passando |

Sem rede externa e sem LLM.

---

## 2. Subir o server localmente

```bash
npm run mcp
```

**Esperado**:

- Processo fica à espera em stdio (cliente MCP consome stdin/stdout).
- Nada útil/protocolar impresso via `console.log`.
- Falha de bootstrap (ex.: DB inacessível) aparece em **stderr** e processo encerra ≠ 0.

Variáveis: `OPSPILOT_DB` (default `./data/opspilot.db`), carregadas via `--env-file-if-exists=.env` no script.

---

## 3. Smoke com cliente MCP (opcional)

Configurar o cliente/IDE para spawn:

```bash
node --env-file-if-exists=.env --import tsx src/mcp/server.ts
```

(ou `npm run mcp`)

**Esperado**:

1. List tools → as três operações.
2. `list_alerts` com default → alertas firing do seed (se DB seedado).
3. `open_incident` → cria incidente; `resolve_incident` com o ID → resolve.

---

## 4. Regressão do restante do produto

```bash
npm run dev    # HTTP /chat — inalterado por esta feature
npm test
```

Grafo LangGraph e catálogo completo do agente (6 tools) MUST permanecer intactos; MCP v1 só espelha 3 delas.
