# Feature Specification: Conversa Persistente

**Feature Branch**: `007-persistent-conversation`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Conversa persistente: ConversationStore (append/lastMessages/create) + tabela messages como no SqliteOpsStore; /chat: conversationId opcional, devolvido na resposta; 12 últimas mensagens no prompt via composição; métrica historyMessages; testes \":memory:\" + fake"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Plantonista Continua a Mesma Conversa (Priority: P1)

Um plantonista troca várias mensagens com o OpsPilot sobre o mesmo incidente. Em cada `POST /chat` ele pode omitir ou reenviar o identificador da conversa; o sistema cria uma conversa nova quando necessário, persiste as mensagens e devolve o `conversationId` na resposta para a próxima rodada — o contexto operacional não se perde entre turnos.

**Why this priority**: Sem continuidade de conversa, cada chamada a `/chat` é isolada; o plantonista precisa repetir contexto e o agente não acompanha o fio do plantão.

**Independent Test**: Com estratégia fake e store de conversa em memória, enviar duas mensagens reutilizando o `conversationId` da primeira resposta e assertar que a segunda execução vê o histórico e a resposta inclui o mesmo id.

**Acceptance Scenarios**:

1. **Given** o servidor de chat ativo sem `conversationId` no body, **When** o cliente envia `POST /chat` com `{"message":"..."}`, **Then** o sistema cria uma conversa, persiste a mensagem do usuário e a resposta do agente, e responde `200` com `conversationId` além de `answer`, `trace` e `metrics`.
2. **Given** um `conversationId` válido já existente, **When** o cliente envia outra mensagem com esse id, **Then** o sistema reutiliza a conversa, anexa o novo turno e devolve o mesmo `conversationId` na resposta.
3. **Given** o fluxo feliz com estratégia fake, **When** a suíte de integração roda sem rede, **Then** criação + continuação da conversa passam com asserções verdes.

---

### User Story 2 — Agente Recebe as Últimas Mensagens no Prompt (Priority: P1)

Antes de executar a estratégia, a composição carrega as últimas mensagens da conversa (até 12) e as inclui no prompt enviado ao agente. A métrica `historyMessages` reporta quantas mensagens de histórico foram efetivamente injetadas naquela execução.

**Why this priority**: Persistência sem injeção no prompt não muda o comportamento do agente; o valor está em raciocinar com o fio recente da conversa.

**Independent Test**: Popular uma conversa com N mensagens (N ≤ 12 e N > 12), executar um turno via composição/fake e assertar o conteúdo do prompt e o valor de `historyMessages`.

**Acceptance Scenarios**:

1. **Given** uma conversa com menos de 12 mensagens persistidas, **When** um novo turno é executado, **Then** todas as mensagens existentes entram no prompt e `metrics.historyMessages` iguala esse total.
2. **Given** uma conversa com mais de 12 mensagens, **When** um novo turno é executado, **Then** apenas as 12 mais recentes entram no prompt e `metrics.historyMessages` é `12`.
3. **Given** uma conversa recém-criada (sem histórico prévio), **When** a primeira mensagem é processada, **Then** `historyMessages` é `0` (nenhum turno anterior injetado) e a mensagem atual ainda é processada normalmente.

---

### User Story 3 — Desenvolvedor Valida Store e Chat Sem Rede (Priority: P2)

Quem implementa a feature precisa de testes determinísticos do `ConversationStore` em `:memory:` (create, append, lastMessages) e do fluxo HTTP `/chat` com estratégia fake — sem LLM nem arquivo em disco.

**Why this priority**: Princípio “teste é parte da tarefa”; garante regressão segura alinhada às features `003` e `004`.

**Independent Test**: Rodar testes do store com `:memory:` e testes de `/chat` com fake registry + store de conversa em memória.

**Acceptance Scenarios**:

1. **Given** um `ConversationStore` em `:memory:`, **When** se cria uma conversa, anexa mensagens e consulta `lastMessages`, **Then** a ordem e o limite (ex.: últimas 12) estão corretos.
2. **Given** o endpoint `/chat` com estratégia fake, **When** os testes de integração rodam, **Then** validam `conversationId` opcional na entrada, presença na resposta e `historyMessages` em `metrics`, sem rede.
3. **Given** implementação SQLite do store de conversa, **When** os testes usam `:memory:`, **Then** o DDL idempotente e as operações passam sem depender de `./data/`.

---

### Edge Cases

- O que acontece quando `conversationId` é enviado mas não existe? MUST responder erro de cliente claro (`404` ou equivalente de domínio na borda) sem executar a estratégia.
- O que acontece quando `conversationId` falha a validação de formato (tipo errado / string vazia)? MUST falhar na validação do body (`400`) com issues zod.
- O que acontece se a estratégia falhar após append da mensagem do usuário? MUST documentar no plano a política de consistência; default razoável: não gravar a resposta do agente se a execução falhar; a mensagem do usuário pode já ter sido anexada ou o turno ser atômico — o plano escolhe uma política e os testes a cobrem.
- O que acontece em conversa com exatamente 12 mensagens ao adicionar a 13ª? MUST injetar só as 12 mais recentes *antes* do turno atual (ou o conjunto canônico definido no plano), com `historyMessages === 12`.
- O que acontece se o cliente omitir `conversationId` em toda chamada? MUST criar conversa nova a cada request (comportamento explícito; sem “sessão implícita” por cookie/IP).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST oferecer um `ConversationStore` com operações `create`, `append` e `lastMessages` (obter as N mensagens mais recentes de uma conversa).
- **FR-002**: A persistência MUST incluir tabela `messages` (e o necessário para conversas) no mesmo estilo do `SqliteOpsStore`: SQLite via `node:sqlite` (`DatabaseSync`), DDL idempotente na construção, prepared statements only.
- **FR-003**: Testes do store MUST usar `:memory:`; produção MUST reutilizar o mesmo mecanismo de caminho de dados do projeto (`OPSPILOT_DB` / default de arquivo) ou compartilhar a conexão/arquivo do store operacional, conforme detalhado no plano — sem segundo arquivo mágico não documentado.
- **FR-004**: `POST /chat` MUST aceitar `conversationId` opcional no body (validado com zod junto aos campos já existentes).
- **FR-005**: Em sucesso, a resposta `200` MUST incluir `conversationId` (criado ou reutilizado) além de `answer`, `trace` e `metrics`.
- **FR-006**: Quando `conversationId` estiver ausente, o sistema MUST criar uma nova conversa antes de executar o turno.
- **FR-007**: Quando `conversationId` estiver presente e for válido, o sistema MUST carregar essa conversa; id desconhecido MUST resultar em erro de cliente sem executar a estratégia.
- **FR-008**: A composição (bootstrap / wiring de `/chat`) MUST injetar no prompt as até 12 mensagens mais recentes da conversa via `lastMessages` antes de executar a estratégia.
- **FR-009**: `metrics` MUST incluir `historyMessages` (número inteiro ≥ 0) indicando quantas mensagens de histórico foram injetadas no prompt naquela execução.
- **FR-010**: Após execução bem-sucedida, o sistema MUST persistir o turno (mensagem do usuário e resposta do agente) via `append`.
- **FR-011**: DEVE existir suíte de testes do `ConversationStore` em `:memory:` cobrindo `create`, `append` e `lastMessages` (incluindo limite 12).
- **FR-012**: DEVE existir teste de integração de `/chat` com estratégia fake e store de conversa em memória, sem rede, cobrindo criação, continuação e métrica `historyMessages`.

### Key Entities

- **Conversation**: Fio de diálogo com o plantonista. Atributos: identificador estável (`conversationId`), momento de criação.
- **Message**: Turno persistido numa conversa. Atributos: identificador, `conversationId`, papel (`user` | `assistant` ou equivalente do domínio), conteúdo textual, ordem/timestamp para recuperar as mais recentes.
- **ChatRequest** (estendido): Campos existentes (`message`, `strategy?`, `reflect?`) mais `conversationId?`.
- **ChatResponse** (estendido): Campos existentes (`answer`, `trace`, `metrics`) mais `conversationId`; `metrics` inclui `historyMessages`.
- **ConversationStore**: Contrato de persistência de conversas/mensagens (`create`, `append`, `lastMessages`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um cliente completa dois turnos reutilizando o `conversationId` da primeira resposta e observa continuidade (histórico injetado / mesma conversa) em 100% dos testes de integração cobertos.
- **SC-002**: Com mais de 12 mensagens na conversa, exatamente 12 entram no prompt e `historyMessages` reporta `12` nos testes.
- **SC-003**: Request sem `conversationId` sempre devolve um novo id; request com id inválido/inexistente não executa a estratégia (assertado nos testes).
- **SC-004**: A suíte `:memory:` do store e o teste fake de `/chat` passam sem rede; `npm test` e `npm run typecheck` permanecem verdes após a feature.
- **SC-005**: Plantonista consegue retomar o contexto operacional entre turnos HTTP sem reenviar o histórico manualmente no body.

## Assumptions

- Esta feature estende o contrato de `003-chat-api` (campos e status existentes permanecem; autenticação e streaming continuam fora de escopo).
- Papéis de mensagem alinham-se ao domínio LangChain já usado (`HumanMessage` / `AIMessage` ou strings `user` / `assistant` na persistência); o plano fixa o mapeamento.
- Limite de histórico é fixo em **12** mensagens (não configurável nesta feature).
- `historyMessages` conta apenas mensagens de histórico injetadas, não a mensagem atual do request (salvo se o plano unificar a contagem — default: só histórico prévio).
- Implementação SQLite do `ConversationStore` segue o padrão do `SqliteOpsStore` (sem ORM); pode viver no mesmo arquivo DB ou módulo irmão — decisão de co-localização no plano.
- Estratégia fake determinística dos testes de `/chat` (feature `003`) continua sendo o harness HTTP; não exige OpenRouter.
- CLI/Arena/bench não precisam expor `conversationId` nesta feature (somente HTTP `/chat` + store + composição).
- Política de falha no meio do turno (usuário já appendado vs. transação) é detalhe de plano; a spec exige apenas comportamento testável e sem resposta `200` parcial enganosa.
