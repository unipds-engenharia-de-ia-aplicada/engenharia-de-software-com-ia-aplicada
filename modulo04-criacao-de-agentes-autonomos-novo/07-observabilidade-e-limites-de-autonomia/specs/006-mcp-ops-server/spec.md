# Feature Specification: Servidor MCP OpsPilot

**Feature Branch**: `006-mcp-ops-server`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "MCP server do OpsPilot: src/mcp/server.ts com @modelcontextprotocol/sdk, transport stdio, expondo list_alerts, open_incident e resolve_incident - reutilizando o mesmo OpsStore e os mesmos schemas zod das tools existentes (uma unica fonte de verdade). Nome do server: opspilot. Script npm: mcp = \"tsx src/mcp/server.ts\" (se precisar de env, alterar o script e carregar elas antes). REGRA CRÍTICA: nenhum console.log no server - no stdio o stdout é o canal do protocolo; diagnóstico vai para o stderr. Test: sobre o server e valida o list de tools"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Cliente MCP Descobre as Ferramentas Operacionais (Priority: P1)

Um operador ou IDE compatível com MCP conecta-se ao OpsPilot via canal stdio. Ao listar as ferramentas disponíveis, vê exatamente `list_alerts`, `open_incident` e `resolve_incident`, com o servidor identificando-se como `opspilot`.

**Why this priority**: Sem descoberta confiável das três tools, o servidor MCP não entrega valor; é o contrato mínimo de integração.

**Independent Test**: Subir o server (ou instanciá-lo em teste), solicitar a listagem de tools e assertar nome do server e o conjunto exato das três tools — sem depender de LLM ou rede externa.

**Acceptance Scenarios**:

1. **Given** o servidor MCP OpsPilot iniciado, **When** o cliente pede a listagem de tools, **Then** a resposta contém exatamente `list_alerts`, `open_incident` e `resolve_incident` (sem extras nesta feature).
2. **Given** o mesmo servidor, **When** o cliente inspeciona a identidade do server, **Then** o nome reportado é `opspilot`.
3. **Given** a suíte de testes do server, **When** o teste de listagem roda, **Then** valida o catálogo das três tools sem chamar modelos externos.

---

### User Story 2 — Mesmas Operações do Plantão via MCP (Priority: P1)

O cliente MCP invoca `list_alerts`, `open_incident` e `resolve_incident` e obtém o mesmo comportamento operacional das tools já usadas pelo agente LangGraph: mesmos filtros/defaults, mesma validação de entrada e o mesmo store operacional (alertas/incidentes compartilhados).

**Why this priority**: Uma única fonte de verdade evita divergência entre agente e MCP; plantão e IDE devem ver o mesmo estado.

**Independent Test**: Com store seedado em memória, invocar as três operações via handlers MCP (ou wrappers compartilhados) e comparar resultado/efeitos com as tools existentes do agente.

**Acceptance Scenarios**:

1. **Given** store seedado com alertas firing/resolved, **When** o cliente MCP chama `list_alerts` (com default ou filtro), **Then** o resultado espelha a tool `list_alerts` do agente sobre o mesmo store.
2. **Given** o mesmo store, **When** o cliente MCP chama `open_incident` com título, serviço e severidade válidos, **Then** o incidente é criado no OpsStore e o retorno confirma ID/status como na tool do agente.
3. **Given** um incidente aberto conhecido, **When** o cliente MCP chama `resolve_incident` com o ID, **Then** o incidente passa a resolvido no mesmo store; ID inexistente devolve erro descritivo (observação), sem quebrar o canal MCP.

---

### User Story 3 — Stdio Seguro para Diagnóstico (Priority: P2)

Quem opera o servidor precisa de logs de diagnóstico sem corromper o protocolo MCP. Qualquer mensagem de diagnóstico sai em stderr; stdout permanece exclusivo do protocolo. Não há `console.log` (nem equivalente que escreva em stdout) no código do server.

**Why this priority**: Em transporte stdio, poluir stdout quebra clientes MCP de forma silenciosa e difícil de depurar.

**Independent Test**: Revisar/assertar no código do server (e teste estático ou de harness) que não há escrita em stdout fora do transport; smoke de diagnóstico direcionado a stderr.

**Acceptance Scenarios**:

1. **Given** o código em `src/mcp/server.ts` (e módulos exclusivos do server MCP), **When** se busca por `console.log` / escrita acidental em stdout, **Then** não há ocorrências — diagnóstico usa `console.error` / stderr.
2. **Given** o servidor em execução via script npm `mcp`, **When** ocorre um evento digno de log (ex.: falha de bootstrap), **Then** a mensagem aparece em stderr e o canal stdout do protocolo permanece intacto.

---

### User Story 4 — Desenvolvedor Sobe o Server com um Comando (Priority: P3)

Quem desenvolve ou integra o OpsPilot sobe o server MCP com `npm run mcp`, com variáveis de ambiente carregadas quando necessárias (ex.: caminho do banco), alinhado ao restante do projeto.

**Why this priority**: Facilita integração local e documentação de quickstart; não é o valor operacional central, mas desbloqueia uso.

**Independent Test**: Verificar presença do script `mcp` no `package.json` e que o entrypoint aponta para `src/mcp/server.ts`.

**Acceptance Scenarios**:

1. **Given** o repositório com a feature implementada, **When** se inspeciona `package.json`, **Then** existe script `mcp` que inicia `src/mcp/server.ts` via `tsx` (com carregamento de env se o store/persistência exigir, no mesmo padrão dos outros entrypoints).

---

### Edge Cases

- O que acontece se o cliente pedir uma tool fora do catálogo v1 (`list_incidents`, `consultar_runbook`, `check_provider_status`, etc.)? MUST não aparecer na listagem desta feature; chamada a nome desconhecido segue o comportamento padrão do SDK MCP (erro de tool inexistente).
- O que acontece se a entrada de uma tool falhar na validação zod? MUST rejeitar na fronteira com erro descritivo ao cliente MCP, sem mutar o store.
- O que acontece se `resolve_incident` receber ID inexistente? MUST devolver mensagem de erro legível (mesmo espírito da tool do agente), sem derrubar o processo do server.
- O que acontece se alguém adicionar `console.log` no server? MUST ser tratado como violação da regra crítica — testes/revisão MUST falhar ou a checklist de aceite rejeitar.
- O que acontece se `OPSPILOT_DB` / env não estiver carregado e o server usar store em arquivo? MUST carregar env no script npm (padrão `--env-file-if-exists=.env`) ou documentar default; falha de abertura do store MUST ir para stderr e encerrar de forma clara.
- Schemas zod e lógica de domínio das três tools MUST ser a mesma fonte usada pelo agente — sem duplicar schemas “só para MCP”.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST expor um servidor MCP em `src/mcp/server.ts` usando `@modelcontextprotocol/sdk` com transporte stdio.
- **FR-002**: O nome do servidor MCP MUST ser `opspilot`.
- **FR-003**: O servidor MUST registrar exatamente três tools nesta feature: `list_alerts`, `open_incident` e `resolve_incident`.
- **FR-004**: As três tools MUST reutilizar o mesmo `OpsStore` (contrato/implementação já usados pelo agente) e os mesmos schemas zod das tools existentes — uma única fonte de verdade (sem schemas MCP paralelos).
- **FR-005**: O comportamento funcional (defaults, filtros, criação/resolução, mensagens de sucesso/erro) MUST permanecer alinhado às tools equivalentes do agente sobre o mesmo store.
- **FR-006**: O código do server MCP MUST NÃO usar `console.log` nem qualquer escrita em stdout fora do transport do protocolo; diagnóstico MUST ir para stderr (`console.error` ou equivalente).
- **FR-007**: MUST existir script npm `mcp` que inicia o entrypoint (`tsx src/mcp/server.ts`); se o server precisar de variáveis de ambiente (ex.: `OPSPILOT_DB`), o script MUST carregá-las antes (preferir o padrão já usado nos outros scripts: `node --env-file-if-exists=.env --import tsx ...`).
- **FR-008**: MUST existir teste(s) focados no server que validam a listagem de tools (catálogo = as três tools esperadas; nome do server = `opspilot` quando aplicável à API de teste).
- **FR-009**: Dependência `@modelcontextprotocol/sdk` MUST ser adicionada ao projeto conforme necessário para o server e os testes.
- **FR-010**: Tools do agente além das três (ex.: `list_incidents`, `consultar_runbook`, `check_provider_status`) ficam FORA do escopo do catálogo MCP v1.

### Key Entities

- **McpOpsServer**: Processo/servidor MCP nomeado `opspilot`, transport stdio, que publica o catálogo operacional mínimo.
- **McpToolBinding**: Ligação entre nome MCP (`list_alerts` | `open_incident` | `resolve_incident`), schema zod compartilhado e handler que opera sobre `OpsStore`.
- **OpsStore** (existente): Fonte de verdade de alertas e incidentes; compartilhada conceitualmente com o agente (mesma interface; instância conforme entrypoint).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um cliente MCP consegue listar as tools e encontra exatamente as três operações de plantão (`list_alerts`, `open_incident`, `resolve_incident`) em 100% das listagens bem-sucedidas.
- **SC-002**: Em store seedado, invocar as três operações via MCP produz o mesmo efeito observável (listagem/criação/resolução) que as tools do agente sobre o mesmo estado, em ≥ 95% dos casos de teste cobertos.
- **SC-003**: 100% das mensagens de diagnóstico emitidas pelo server em cenários de falha de bootstrap vão para stderr; stdout permanece utilizável pelo protocolo (zero `console.log` no server).
- **SC-004**: A suíte de testes do server valida a listagem de tools e passa sem rede externa e sem LLM.
- **SC-005**: Desenvolvedor sobe o server com um único comando npm (`mcp`) documentado/presente no projeto.

## Assumptions

- Escopo v1 do catálogo MCP = apenas as três tools pedidas; demais tools do agente entram em features futuras.
- “Mesma fonte de verdade” implica exportar ou extrair schemas/handlers compartilhados se hoje estiverem fechados em `src/agents/tools.ts` — detalhe de refactor fica para o plano, desde que não haja duplicação de schema.
- O server MCP é um entrypoint separado do HTTP/chat; não substitui o grafo LangGraph nesta feature.
- Persistência: o server pode usar `SqliteOpsStore` + seed no mesmo espírito de `src/index.ts`, ou store injetável para testes; testes MUST preferir `:memory:` / injeção.
- Script `mcp`: se env for necessário, alinhar ao padrão `node --env-file-if-exists=.env --import tsx src/mcp/server.ts` em vez de `tsx` puro.
- Transporte apenas stdio nesta feature (sem HTTP/SSE MCP).
- Autenticação/autorização de clientes MCP fica fora de escopo v1 (stdio local confiável).
