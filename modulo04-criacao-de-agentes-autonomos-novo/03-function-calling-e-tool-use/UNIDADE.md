# Unidade 3 — Function Calling e Tool Use

O cérebro da U2 ganha **mãos**: persistência real em SQLite, tools redesenhadas ("schema é prompt"), uma tool externa resiliente e um servidor MCP — o OpsPilot deixa de ser só cliente e vira provedor. Snapshot do commit `17851d6` ("add memory and mcp").

## O que é novo nesta unidade

- **Spec `003-chat-api`** — `POST /chat` em `src/http/server.ts` (a API que é, ela mesma, um agente): body `{message, strategy?, reflect?}`, validação zod, timeout. *(Conteúdo do fim da U2 que caiu no commit da U3.)*
- **Spec `004-sqlite-ops-store`** — `src/store/sqlite-ops-store.ts` (`node:sqlite`): tabelas `services`, `alerts`, `incidents`, `runbooks`; DDL idempotente, prepared statements, seed do Mercadinho, `OPSPILOT_DB` (`:memory:` nos testes).
- **Tools novas/redesenhadas** — `src/tools/list-incidents.ts` e `src/tools/consultar-runbook.ts`; descrições reescritas pelas 6 regras de design de schema.
- **Spec `005-provider-status-tool`** — `src/tools/check-provider-status.ts`: tool de API externa (statuspage.io) com timeout via `AbortSignal`, retry único, zod na resposta, erro-como-observação e `fetch` injetável.
- **Spec `006-mcp-ops-server`** — `src/mcp/server.ts` + `create-server.ts` (`@modelcontextprotocol/sdk`, transporte stdio, script `npm run mcp`): as tools do OpsPilot expostas via MCP para o Copilot (prova circular: o Copilot cria um incidente via MCP e ele aparece no `POST /chat`).

## Diferenças em relação ao roteiro

- Este snapshot já contém a **conversa persistente** (spec `007-persistent-conversation`: `src/chat/`, `src/store/sqlite-conversation-store.ts`), que é matéria da U4 — foi commitada junto com o MCP. A explicação dela fica no [UNIDADE.md da pasta 04](../04-memoria-e-reflexao-em-agentes-autonomos/UNIDADE.md).
- O SQLite (spec 004) foi commitado ainda no commit "databasee integration", junto do `POST /chat`.

## Como rodar

```bash
npm ci && cp .env.example .env
npm run dev      # POST /chat
npm run mcp      # servidor MCP via stdio (registre em .vscode/mcp.json / .cursor/mcp.json)
npm test && npm run typecheck
```
