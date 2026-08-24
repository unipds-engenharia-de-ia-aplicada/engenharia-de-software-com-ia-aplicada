# Feature Specification: Persistência Real de Operações

**Feature Branch**: `004-sqlite-ops-store`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "Persistência real de operações: SqliteOpsStore (src/store/sqlite-ops-store.ts) implementa a interface OpsStore existente via node:sqlite (DatabaseSync); caminho em OPSPILOT_DB (default ./data/opspilot.db); \":memory:\" nos testes; 4 tabelas — services, alerts, incidents, runbooks — espelhando os tipos atuais do domínio (incidents ganha resolved_at e summary, anuláveis); DDL idempotente no construtor; CHECK em todo campo de domínio fechado (tier, severity, status); seed idempotente = cenário Mercadinho do mock (5 serviços, 6 alertas: 3 firing, 3 resolved; runbooks de checkout/payments/auth); prepared statements em toda query; Sem SQL concatenado; tools novas: list_incidents(status open | resolved | all, default open) e consultar_runbook(service) — descrições pelas 6 regras; composição injeta o SqliteOpsStore; mock in memory fica para testes e para o bench (cenarios possam ser reproduzidos); data/ no .gitignore; revisar descrições de src/agents/tools.ts pelas 6 regras (dívida do open_incident: quando usar; .describe() em todo campo; enums); testes \":memory:\" seed, abrir/listar/resolver, filtros e CHECKS; testes das tools existentes passam a rodar sobre \":memory:\"."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Plantonista Mantém Estado Entre Reinícios (Priority: P1)

Um plantonista abre e resolve incidentes durante o plantão. Ao reiniciar o OpsPilot, serviços, alertas, incidentes e runbooks do cenário operacional continuam disponíveis — o estado não some com o processo.

**Why this priority**: Sem persistência real, o copiloto de plantão não é utilizável em sessão contínua; é o valor central desta feature.

**Independent Test**: Subir o sistema apontando para um arquivo de dados, abrir um incidente, reiniciar o processo com o mesmo arquivo e listar incidentes — o incidente aberto ainda existe.

**Acceptance Scenarios**:

1. **Given** o OpsPilot iniciado com persistência em arquivo e seed aplicado, **When** o plantonista lista alertas, **Then** vê o cenário Mercadinho (5 serviços; 6 alertas, sendo 3 disparando e 3 resolvidos).
2. **Given** o sistema com seed aplicado, **When** o plantonista abre um incidente e depois reinicia o processo no mesmo arquivo de dados, **Then** o incidente permanece listável com o mesmo identificador e status.
3. **Given** um incidente aberto persistido, **When** o plantonista o resolve, **Then** o status passa a resolvido, com momento de resolução e resumo opcional registrados, e essa resolução sobrevive a um novo reinício.

---

### User Story 2 — Agente Lista Incidentes e Consulta Runbooks (Priority: P2)

Durante o raciocínio, o agente precisa listar incidentes por status e consultar o runbook de um serviço (checkout, payments ou auth) para orientar a resposta operacional.

**Why this priority**: Amplia as ferramentas do grafo (princípio “agente no centro”) e desbloqueia fluxos de plantão além de alertas/abrir/resolver.

**Independent Test**: Invocar as ferramentas `list_incidents` e `consultar_runbook` contra um store seedado em memória; assertar filtros e conteúdo sem rede.

**Acceptance Scenarios**:

1. **Given** incidentes abertos e resolvidos no store, **When** o agente chama `list_incidents` sem status (ou com default), **Then** recebe apenas incidentes `open`.
2. **Given** o mesmo store, **When** o agente chama `list_incidents` com `resolved` ou `all`, **Then** o resultado respeita o filtro pedido.
3. **Given** seed Mercadinho com runbooks, **When** o agente chama `consultar_runbook` para um serviço coberto (checkout, payments ou auth), **Then** recebe o texto do runbook daquele serviço.
4. **Given** um serviço sem runbook, **When** o agente consulta o runbook, **Then** recebe erro descritivo (sem falha não tratada no grafo).

---

### User Story 3 — Desenvolvedor Valida Persistência e Tools Sem Rede (Priority: P3)

Quem desenvolve a feature precisa de testes determinísticos: seed, abrir/listar/resolver, filtros, restrições de domínio fechado, e as tools existentes/novas rodando sobre store em memória — sem depender de arquivo em disco nem de LLM.

**Why this priority**: Princípio “teste é parte da tarefa”; garante regressão segura e cenários de bench reproduzíveis.

**Independent Test**: Executar a suíte de testes do store e das tools com store em memória; bench continua usando o mock in-memory.

**Acceptance Scenarios**:

1. **Given** um store em memória inicializado, **When** o seed idempotente roda duas vezes, **Then** o cenário Mercadinho permanece consistente (sem duplicar entidades-chave).
2. **Given** o store em memória, **When** se abre, lista e resolve incidentes, **Then** os resultados batem com o contrato do store e os filtros de status.
3. **Given** tentativa de gravar valor fora do domínio fechado (tier, severity ou status inválidos), **When** a operação é tentada, **Then** a persistência rejeita o valor (restrição de integridade).
4. **Given** a suíte de tools, **When** os testes das tools existentes e novas rodam, **Then** usam store em memória e passam sem rede.
5. **Given** o bench, **When** os cenários C1–C3 são executados, **Then** continuam usando o store in-memory para poderem ser reproduzidos.

---

### Edge Cases

- O que acontece se `OPSPILOT_DB` apontar para um caminho cujo diretório pai ainda não existe? O sistema MUST criar o diretório necessário ou falhar com erro claro na inicialização.
- O que acontece se o arquivo de dados já existir com o schema esperado? O DDL idempotente MUST não destruir dados existentes; o seed idempotente MUST não duplicar o cenário base.
- O que acontece se `consultar_runbook` receber nome de serviço desconhecido ou sem runbook? MUST retornar mensagem descritiva ao agente.
- O que acontece se `list_incidents` receber status inválido? MUST falhar na validação de fronteira (schema da tool) antes de consultar o store.
- O que acontece se SQL dinâmico for tentado via concatenação de strings? Fora de escopo / proibido — toda query MUST usar prepared statements.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST persistir operações (serviços, alertas, incidentes, runbooks) em SQLite via `node:sqlite` (`DatabaseSync`), implementando o contrato de store operacional existente (`OpsStore` / equivalente atual).
- **FR-002**: O caminho do arquivo de dados MUST ser lido de `OPSPILOT_DB`, com default `./data/opspilot.db`. Testes MUST usar `:memory:`.
- **FR-003**: O store SQLite MUST criar, de forma idempotente na construção, quatro tabelas — `services`, `alerts`, `incidents`, `runbooks` — alinhadas aos tipos de domínio atuais.
- **FR-004**: Incidentes MUST incluir `resolved_at` e `summary` anuláveis, além dos campos já existentes do domínio.
- **FR-005**: Todo campo de domínio fechado (`tier`, `severity`, `status` e equivalentes) MUST ter restrição CHECK no schema.
- **FR-006**: O seed MUST ser idempotente e materializar o cenário Mercadinho do mock: 5 serviços; 6 alertas (3 firing, 3 resolved); runbooks para checkout, payments e auth.
- **FR-007**: Toda query MUST usar prepared statements; SQL concatenado com valores de entrada é proibido.
- **FR-008**: O sistema MUST expor a tool `list_incidents` com parâmetro `status` ∈ {`open`, `resolved`, `all`} e default `open`.
- **FR-009**: O sistema MUST expor a tool `consultar_runbook` com parâmetro `service`, retornando o runbook do serviço ou erro descritivo.
- **FR-010**: Descrições de tools (existentes e novas) em `src/agents/tools.ts` MUST seguir as 6 regras de descrição (ver Assumptions); em especial, `open_incident` MUST declarar quando usar, e todo campo do schema MUST ter `.describe()`, com enums nos domínios fechados.
- **FR-011**: A composição de produção (bootstrap / servidor) MUST injetar o `SqliteOpsStore`. O store in-memory MUST permanecer disponível para testes e para o bench, para cenários reproduzíveis.
- **FR-012**: O diretório `data/` MUST constar no `.gitignore`.
- **FR-013**: Testes do store SQLite MUST cobrir seed, abrir/listar/resolver, filtros de status e rejeição por CHECK, sempre com `:memory:`.
- **FR-014**: Testes das tools existentes MUST passar a executar contra store `:memory:` (SQLite), sem rede.

### Key Entities

- **Service**: Componente monitorado do Mercadinho. Atributos: nome; `tier` (domínio fechado, restrito por CHECK).
- **Alert**: Problema detectado em um serviço. Atributos: identificador, serviço, descrição, severidade, status (`firing` | `resolved`).
- **Incident**: Evento operacional formalizado pelo agente. Atributos: identificador, título, serviço, severidade, status (`open` | `resolved`), `created_at`, `resolved_at` (anulável), `summary` (anulável).
- **Runbook**: Procedimento operacional associado a um serviço (checkout, payments, auth no seed). Atributos: serviço (chave), conteúdo textual do procedimento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Após reinício do processo no mesmo arquivo de dados, 100% dos incidentes abertos/resolvidos na sessão anterior permanecem listáveis com o mesmo identificador e status.
- **SC-002**: O seed Mercadinho é observável em uma única inicialização: exatamente 5 serviços, 6 alertas (3 firing + 3 resolved) e runbooks para os 3 serviços cobertos; reaplicar o seed não duplica esses registros-base.
- **SC-003**: Em testes sem rede, abrir → listar (filtros `open` / `resolved` / `all`) → resolver um incidente completa o ciclo com asserções verdes.
- **SC-004**: Tentativas de gravar `tier`, `severity` ou `status` inválidos são rejeitadas em 100% dos casos cobertos pelos testes de integridade.
- **SC-005**: As tools `list_incidents` e `consultar_runbook` respondem corretamente aos cenários de aceite da US2 nos testes automatizados.
- **SC-006**: `npm test` e `npm run typecheck` permanecem verdes; o bench continua reproduzível via store in-memory.

## Assumptions

- O contrato de store atual (`IStore`) será nomeado/estendido como `OpsStore` na implementação, preservando as operações já usadas pelas tools e ampliando para listagem de incidentes e consulta de runbook.
- “Cenário Mercadinho do mock” corresponde ao seed operacional já usado no projeto (5 serviços / 6 alertas), acrescido de runbooks para checkout, payments e auth; nomes canônicos de serviço no seed/runbooks serão alinhados no plano se houver divergência entre mock atual e nomes do bench.
- **6 regras de descrição de tools** (norma desta feature):
  1. Nome estável e específico da ferramenta.
  2. Descrição diz o que a tool faz em uma frase clara.
  3. Descrição inclui **quando usar**.
  4. Descrição inclui **quando não usar** (ou o equivalente que evita uso indevido).
  5. Todo campo do schema Zod tem `.describe()` acionável para o modelo.
  6. Domínios fechados usam `z.enum(...)` (nunca string livre quando o conjunto é finito).
- Valores concretos de `tier` por serviço serão definidos no plano a partir do domínio Mercadinho; a spec exige apenas que `tier` seja domínio fechado com CHECK.
- Conteúdo textual dos runbooks pode ser stub operacional suficiente para o agente (passos curtos); redação fina é detalhe de implementação desde que idempotente e consultável por serviço.
- MySQL/Sequelize saem da stack obrigatória (constitution v2.0.0); remover dependências órfãs pode ser feito nesta feature ou imediatamente após, sem bloquear o aceite da persistência SQLite.
- Arquivo em `data/` é ambiente local/dev; backup, migrações versionadas e multi-processo concorrente ficam fora de escopo.
