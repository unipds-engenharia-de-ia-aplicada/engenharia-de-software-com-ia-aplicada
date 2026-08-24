# Implementation Plan: Servidor MCP OpsPilot

**Branch**: `006-mcp-ops-server` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-mcp-ops-server/spec.md`

## Summary

Expor um servidor MCP nomeado `opspilot` em `src/mcp/server.ts` via `@modelcontextprotocol/sdk` + transporte stdio, publicando exatamente `list_alerts`, `open_incident` e `resolve_incident`. Reutilizar o mesmo `OpsStore` e os mesmos schemas zod das tools do agente (fonte única). Script npm `mcp` com carregamento de env. Regra crítica: zero escrita em stdout fora do protocolo (`console.error` / stderr apenas). Teste com transport in-memory valida a listagem de tools.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM `strict: true`

**Primary Dependencies**: `@modelcontextprotocol/sdk` (McpServer + StdioServerTransport), `zod` (^3.25+ peer do SDK; projeto hoje em `^3.23.0` — bump mínimo), reuso de `OpsStore` / factories em `src/agents/tools.ts`

**Storage**: `SqliteOpsStore` no entrypoint (mesmo padrão de `src/index.ts`: `OPSPILOT_DB` default `./data/opspilot.db` + seed); testes com store injetável / `:memory:`

**Testing**: `node:test` via `tsx`; `InMemoryTransport` (ou par linked do SDK) + `Client.listTools()` — sem rede, sem LLM, sem processo stdio real no unit test

**Target Platform**: Node.js processo local (stdio spawn por clientes MCP / IDE)

**Project Type**: Entrypoint paralelo (como HTTP/CLI) sobre a mesma camada tools/store; não altera o grafo LangGraph

**Performance Goals**: Listagem de tools síncrona/local; invocações limitadas pela latência do store SQLite local

**Constraints**: Stdio — stdout exclusivo do JSON-RPC MCP; sem `console.log` no server; catálogo v1 = 3 tools; schemas compartilhados (sem duplicar); sem auth MCP

**Scale/Scope**: 1 entrypoint MCP + factory testável + 1–2 arquivos de teste; refactor leve para exportar schemas / bindings; ~4–6 arquivos tocados + `package.json`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | Capacidade operacional continua sendo as tools do domínio; MCP é superfície de exposição (borda), não substitui o grafo |
| 2 | **Camadas explícitas** | ✅ PASS | `mcp (entrypoint) → tools/agents factories → store`; domínio sem I/O MCP |
| 3 | **Validação na fronteira** | ✅ PASS | Schemas zod compartilhados validados pelo SDK na `tools/call` |
| 4 | **Erros são de domínio** | ✅ PASS | Mesmas mensagens/observações das tools (`Error: ...` / sucesso textual); falha de bootstrap → stderr + exit |
| 5 | **Teste é parte da tarefa** | ✅ PASS | FR-008 — teste de listagem de tools sobre factory do server |
| 6 | **Segurança por padrão** | ✅ PASS | Sem secrets no repo; env via `--env-file-if-exists`; stdio local; sem auth no v1 (escopo) |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | Entrypoint + wiring + export de schemas; sem migration |

**Stack**: ✅ Nova dep `@modelcontextprotocol/sdk` justificada por FR-001/FR-009; bump `zod` se peer exigir ≥3.25.

**Gate result: ALL PASS** — Complexity Tracking não necessário.

**Re-check pós Phase 1**: contratos mantêm entrypoint MCP fino, schemas exportados da mesma fonte das tools LangChain, testes via InMemoryTransport. Gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/006-mcp-ops-server/
├── plan.md                 # Este arquivo
├── research.md             # Phase 0
├── data-model.md           # Phase 1
├── quickstart.md           # Phase 1
├── contracts/
│   └── mcp-opspilot.md     # Contrato MCP (server + 3 tools)
└── tasks.md                # Phase 2 (/speckit.tasks — NÃO gerado aqui)
```

### Source Code (repository root)

```text
src/
├── mcp/
│   ├── server.ts              # NOVO: entrypoint stdio (bootstrap store + connect); sem console.log
│   ├── create-server.ts       # NOVO: createOpsMcpServer(store) → McpServer (testável)
│   └── server.test.ts         # NOVO: listTools = 3 nomes; server name opspilot; sem console.log no módulo
├── agents/
│   └── tools.ts               # ← exportar schemas das 3 tools (e/ou helpers de binding) — fonte única
├── store/                     # reuso SqliteOpsStore + seed (sem mudança de schema)
└── index.ts                   # sem mudança obrigatória (entrypoint HTTP permanece)

package.json                   # ← dep @modelcontextprotocol/sdk; script "mcp"; bump zod se necessário
```

**Structure Decision**: Projeto único. Factory `createOpsMcpServer(store)` separada do bootstrap stdio para testes sem processo filho. Schemas continuam definidos uma vez em `agents/tools.ts` (exportados); handlers MCP delegam às factories LangChain existentes (`.invoke`) ou a funções de execução compartilhadas — ver research Decisão 2.

## Complexity Tracking

> Nenhuma violação — seção vazia de propósito.
