# Feature Specification: Modo Equipe (Supervisor + Papéis)

**Feature Branch**: `018-team-mode`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Modo equipe em src/team/: supervisor com withStructuredOutput({ next, brief }) sobre um blackboard no estado. Papéis: analista (só leitura, não propõe), planejador (sem tools), executor (incidentes, sem bypass). Evento \"handoff\" no trace, renderizado no \"ver raciocínio\". Rota \"team\", teto 8"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Supervisor Coordena a Equipe sobre um Blackboard (Priority: P1)

Para pedidos operacionais complexos, o plantonista quer que o turno seja resolvido por uma **equipe de agentes** coordenada por um **supervisor**. A cada rodada, o supervisor lê o **blackboard** (quadro compartilhado no estado do turno, onde cada papel registra suas contribuições) e decide de forma **estruturada** quem age em seguida: `next` (o próximo papel, ou encerrar) + `brief` (instrução curta e específica para esse papel). O papel escolhido trabalha, escreve sua contribuição no blackboard e devolve o controle ao supervisor — até o supervisor decidir encerrar e produzir a resposta final.

**Why this priority**: É o núcleo da feature; sem o ciclo supervisor → papel → blackboard → supervisor, não existe modo equipe.

**Independent Test**: Invocar o modo equipe com supervisor fake/determinístico (sem rede) que devolve uma sequência fixa de decisões `{ next, brief }`; assertar que os papéis executam na ordem decidida, que cada contribuição aparece no blackboard e que o turno termina com `answer` não vazio.

**Acceptance Scenarios**:

1. **Given** o modo equipe ativo em um turno, **When** o supervisor decide `{ next: "analista", brief: "..." }`, **Then** o papel analista executa com esse brief e sua contribuição é registrada no blackboard antes de o controle voltar ao supervisor.
2. **Given** o blackboard com contribuições acumuladas, **When** o supervisor decide em uma nova rodada, **Then** a decisão é tomada com visibilidade do conteúdo atual do blackboard (não apenas da mensagem original).
3. **Given** o supervisor decide encerrar, **When** o turno finaliza, **Then** a resposta final ao plantonista é produzida a partir do que foi consolidado no blackboard.
4. **Given** a saída do supervisor, **When** inspecionada, **Then** é estruturada com pelo menos `next` (papel válido ou encerramento) e `brief` (string), validada na fronteira do LLM.

---

### User Story 2 — Três Papéis com Poderes Distintos (Priority: P1)

A equipe tem exatamente três papéis, cada um com um contrato claro de capacidades:

- **Analista** — investiga o cenário usando **apenas leitura** (alertas, incidentes existentes, runbooks, status de provedor). **Não propõe** plano nem ações; entrega fatos e diagnóstico ao blackboard.
- **Planejador** — raciocina **sem nenhuma ferramenta**: lê o blackboard (fatos do analista) e produz um plano de ação em passos.
- **Executor** — executa ações de **incidentes** (abrir/resolver/listar) seguindo o plano; **não tem passe livre**: as salvaguardas existentes de ações destrutivas (guardrails/aprovação humana quando aplicável) continuam valendo dentro do modo equipe.

**Why this priority**: A separação de poderes é o valor didático e de segurança da feature; sem ela, o modo equipe vira um ReAct disfarçado.

**Independent Test**: Com harness fake por papel, assertar o conjunto de ferramentas efetivamente disponível a cada papel: analista sem ferramentas de mutação, planejador com zero ferramentas, executor apenas com ferramentas de incidente.

**Acceptance Scenarios**:

1. **Given** o papel analista ativo, **When** ele trabalha, **Then** só consegue invocar ferramentas de leitura (ex.: listar alertas, listar incidentes, consultar runbook, checar provedor) e sua contribuição no blackboard não contém proposta de ação/plano.
2. **Given** o papel analista, **When** ele tenta qualquer ação de mutação (abrir/resolver incidente), **Then** a ação é impossível por construção (a ferramenta não está disponível ao papel).
3. **Given** o papel planejador ativo, **When** ele trabalha, **Then** nenhuma ferramenta é invocada e sua contribuição é um plano em passos derivado do blackboard.
4. **Given** o papel executor ativo, **When** ele trabalha, **Then** só tem acesso às ferramentas de incidente e cada ação executada fica registrada no blackboard e no trace.
5. **Given** uma ação do executor coberta por salvaguarda existente (ex.: fluxo de aprovação humana ativo para ações destrutivas), **When** o executor tenta executá-la, **Then** a salvaguarda é respeitada — o modo equipe não cria caminho de bypass.

---

### User Story 3 — Evento `handoff` Visível no "Ver raciocínio" (Priority: P1)

Cada vez que o supervisor passa o bastão a um papel (ou encerra), o `trace` do turno registra um evento **`handoff`** com quem recebeu o controle e o brief da tarefa. No War Room web, ao abrir **"Ver raciocínio"**, o plantonista enxerga esses handoffs na linha do tempo do raciocínio, distinguíveis dos demais tipos de evento.

**Why this priority**: Sem observabilidade dos handoffs, o modo equipe é uma caixa-preta; o trace é o contrato de auditoria do produto.

**Independent Test**: Executar um turno de equipe com supervisor fake; assertar que o `trace` contém um evento `handoff` por decisão do supervisor (com papel de destino e brief) e que o drawer "Ver raciocínio" renderiza esses eventos.

**Acceptance Scenarios**:

1. **Given** um turno de equipe com N decisões do supervisor, **When** o cliente lê o `trace`, **Then** existem N eventos `type: "handoff"`, cada um identificando o papel de destino (ou encerramento) e o brief.
2. **Given** os eventos de trace produzidos pelos papéis, **When** inspecionados, **Then** carregam `node` identificando o papel/nó produtor (consistente com a assinatura de nós de `013`).
3. **Given** um turno de equipe concluído no War Room web, **When** o plantonista clica "Ver raciocínio", **Then** os eventos `handoff` aparecem na timeline com apresentação própria (tipo visível e brief legível).

---

### User Story 4 — Rota `team` no Grafo de Produção (Priority: P2)

O modo equipe entra no grafo de produção como a rota **`team`**, ao lado de `react`, `planExecute` e `reflect`. O roteador pode classificá-la automaticamente (pedidos complexos que se beneficiam de investigação + plano + execução coordenadas), e o cliente pode forçá-la via `strategy` no body de `/chat`, com a mesma semântica de override já existente.

**Why this priority**: Integra o modo equipe ao caminho de produção; sem rota, a feature não é alcançável pelo plantonista. É P2 porque o núcleo (US1–US3) pode ser validado por harness antes da integração.

**Independent Test**: Com classificador fake devolvendo `team`, assertar que o nó de equipe executa; com `strategy: "team"` no body, assertar override registrado no evento `route`.

**Acceptance Scenarios**:

1. **Given** `POST /chat` sem `strategy`, **When** o roteador classifica `{ route: "team", reason: "..." }`, **Then** o nó de equipe executa e o evento `route` registra a escolha.
2. **Given** `POST /chat` com `strategy: "team"`, **When** o turno roda, **Then** o modo equipe executa com marca de override no evento `route`.
3. **Given** a tabela de decisão do roteador, **When** inspecionada, **Then** inclui critérios descrevendo quando preferir `team` frente às demais rotas.
4. **Given** as rotas existentes, **When** um pedido simples chega, **Then** as rotas atuais continuam funcionando sem regressão (contratos HTTP e de trace preservados).

---

### User Story 5 — Teto de 8 Handoffs por Turno (Priority: P2)

Para conter custo e latência, um turno de equipe tem **teto de 8 handoffs** do supervisor. Ao atingir o teto sem encerramento voluntário, o supervisor é forçado a encerrar e produzir a melhor resposta possível com o que há no blackboard — o turno **não** falha nem trava.

**Why this priority**: Guardrail de custo/latência essencial para produção, mas só é exercitável depois que o ciclo básico (US1) existe.

**Independent Test**: Supervisor fake que nunca encerra; assertar que o turno termina após exatamente 8 handoffs, com resposta final derivada do blackboard e trace consistente.

**Acceptance Scenarios**:

1. **Given** um supervisor que sempre delega, **When** o 8º handoff se completa, **Then** o turno encerra de forma controlada com resposta final (sem erro para o cliente).
2. **Given** o teto atingido, **When** o trace é inspecionado, **Then** há no máximo 8 eventos `handoff` de delegação e o encerramento forçado é identificável no trace.
3. **Given** um turno que encerra naturalmente antes do teto, **When** o trace é inspecionado, **Then** o número de handoffs reflete apenas as delegações reais.

---

### Edge Cases

- O que acontece se o supervisor devolver `next` fora do conjunto de papéis válidos (ou saída malformada)? MUST validar na fronteira e degradar de forma controlada — default: tratar como decisão de encerramento e responder com o conteúdo atual do blackboard, registrando a anomalia no trace.
- O que acontece se um papel falhar (erro de modelo/ferramenta) no meio do ciclo? MUST devolver o controle ao supervisor com a falha registrada no blackboard/trace, para que ele decida (repassar, tentar outro papel ou encerrar) — sem estourar o teto.
- O que acontece se o supervisor encerrar na primeira decisão, sem delegar a nenhum papel? Turno válido: resposta produzida diretamente, trace com um evento `handoff` de encerramento (ou zero delegações), sem exigência de papel executado.
- E se o blackboard ficar vazio ao encerrar (nenhuma contribuição)? A resposta final MUST ainda ser produzida (a partir da mensagem original), sem quebra de contrato `200`.
- Executor recebe brief para ação já resolvida (ex.: incidente já fechado)? A ferramenta responde o erro de domínio como observação; o executor registra no blackboard e o supervisor decide o próximo passo.
- Turnos das rotas existentes (`react`, `planExecute`, `reflect`) MUST permanecer sem eventos `handoff`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST oferecer um modo equipe implementado como módulo próprio em `src/team/` (caminho canônico fixado no plano), orquestrado por um **supervisor** que decide o próximo passo a cada rodada.
- **FR-002**: A decisão do supervisor MUST ser saída estruturada com pelo menos `next` (enum: papéis válidos + encerramento) e `brief` (string com a instrução ao próximo papel), via `withStructuredOutput` (ou equivalente do stack), com validação `zod` na fronteira.
- **FR-003**: O estado do turno de equipe MUST conter um **blackboard** compartilhado onde cada papel registra suas contribuições; o supervisor MUST decidir com base no blackboard atual.
- **FR-004**: O papel **analista** MUST ter acesso apenas a ferramentas de leitura (sem mutação de incidentes) e MUST limitar-se a fatos/diagnóstico — sem propor plano ou ações.
- **FR-005**: O papel **planejador** MUST operar sem nenhuma ferramenta, produzindo um plano em passos a partir do blackboard.
- **FR-006**: O papel **executor** MUST ter acesso apenas às ferramentas de incidente (abrir, resolver, listar) e MUST operar sob as salvaguardas existentes de ações destrutivas — o modo equipe MUST NOT criar caminho que as contorne.
- **FR-007**: A restrição de ferramentas por papel MUST ser estrutural (o papel não recebe a ferramenta), não apenas instrução de prompt.
- **FR-008**: Cada decisão do supervisor MUST gerar um evento de trace `type: "handoff"` contendo o papel de destino (ou encerramento) e o brief; o tipo `handoff` MUST ser adicionado ao conjunto de tipos de trace do domínio.
- **FR-009**: Todos os eventos de trace do modo equipe MUST carregar `node` identificando o produtor (supervisor ou papel), consistente com `013`.
- **FR-010**: O drawer "Ver raciocínio" do War Room web MUST renderizar eventos `handoff` de forma distinguível (tipo visível + brief legível), sem quebrar a renderização dos tipos existentes.
- **FR-011**: A rota **`team`** MUST ser adicionada ao conjunto de rotas de produção: classificável pelo roteador (com critérios na tabela de decisão) e aceita como override via `strategy` no body de `/chat`.
- **FR-012**: Um turno de equipe MUST respeitar o teto de **8 handoffs**; atingido o teto, o supervisor MUST encerrar de forma forçada e produzir resposta final a partir do blackboard, sem erro para o cliente.
- **FR-013**: Saída malformada ou `next` inválido do supervisor MUST degradar de forma controlada (default: encerramento com o conteúdo disponível), registrando a anomalia no trace.
- **FR-014**: O turno de equipe MUST devolver o contrato existente de turno (`answer`, `trace`, `metrics`, `conversationId`), com métricas agregadas (chamadas de LLM somando supervisor + papéis).
- **FR-015**: DEVE existir suíte de testes sem rede cobrindo: ciclo supervisor→papel→blackboard com fakes; restrição de ferramentas por papel; eventos `handoff`; teto de 8; rota `team` (classificada e override); renderização do `handoff` no drawer web.

### Key Entities

- **Supervisor**: Coordenador do turno de equipe; a cada rodada emite decisão estruturada `{ next, brief }` com base no blackboard.
- **Blackboard**: Quadro compartilhado no estado do turno; acumula contribuições rotuladas por papel (fatos do analista, plano do planejador, resultados do executor) e alimenta a decisão do supervisor e a resposta final.
- **Papel (Role)**: Um dos três agentes especializados — `analista` (leitura, sem propostas), `planejador` (sem ferramentas), `executor` (ferramentas de incidente sob salvaguardas).
- **Handoff**: Evento de trace registrado a cada decisão do supervisor; carrega destino (papel ou encerramento) e brief.
- **Rota `team`**: Quarto destino do roteador de produção; selecionável por classificação ou override.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos turnos de equipe de teste, cada decisão do supervisor corresponde a exatamente um evento `handoff` no trace, com destino e brief presentes.
- **SC-002**: Em 100% dos casos de teste por papel, o conjunto de ferramentas acessível confere com o contrato: analista sem mutação, planejador com zero ferramentas, executor apenas incidentes.
- **SC-003**: Com supervisor que nunca encerra, 100% dos turnos de teste terminam de forma controlada em no máximo 8 handoffs, com resposta final não vazia.
- **SC-004**: Nenhuma ação destrutiva do executor contorna as salvaguardas existentes em 100% dos testes de guardrail.
- **SC-005**: No War Room web, um turno de equipe exibe seus handoffs no "Ver raciocínio" — verificável pela suíte de componentes em 100% dos casos.
- **SC-006**: As rotas existentes (`react`, `planExecute`, `reflect`) permanecem verdes na suíte atual (zero regressão de contrato HTTP e de trace).

## Assumptions

- "Teto 8" refere-se ao número máximo de **handoffs do supervisor por turno** (delegações a papéis); o encerramento forçado ao atingir o teto produz resposta com o conteúdo do blackboard.
- As ferramentas de leitura do analista são as já existentes sem mutação: listar alertas, listar incidentes, consultar runbook, checar status de provedor. As ferramentas do executor são as de incidente: abrir, resolver e listar incidentes.
- "Sem bypass" do executor significa respeitar as salvaguardas já existentes do produto para ações destrutivas (ex.: fluxo de aprovação humana `awaitHumanApproval` quando ativo e guardrails de deny list da constitution); esta feature não introduz salvaguarda nova, apenas não as contorna.
- A rota `team` segue a mesma semântica de override/`422` de `013-unified-production-graph` (valor `strategy: "team"` aceito no body; valores desconhecidos continuam `422`).
- O supervisor usa o mesmo provedor de modelo do produto (com resiliência primário/reserva de `014`); um supervisor fake injetável é o mecanismo de teste sem rede.
- O blackboard vive no estado do grafo do turno (não persiste entre turnos); a persistência do turno continua sendo trace + audit de `015`.
- A renderização no "Ver raciocínio" reutiliza o drawer existente de `016-war-room-web`, adicionando apresentação para o novo tipo `handoff`.
- Nomes canônicos dos nós/papéis no trace (`supervisor`, `analista`, `planejador`, `executor`) são fixados no plano e usados de forma estável nos testes.
