# Feature Specification: Grafo Unificado de Produção

**Feature Branch**: `013-unified-production-graph`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Grafo unificado: production-graph.ts: nós contexto, roteador, as 3 estratégias como nós e resposta. Roteador: withStructuredOutput (route, reason); tabela no prompt; evento \"route\" e campo node em todo evento de trace. /chat: strategy opcional (se vier, é override no trace)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Um Único Grafo Orquestra o Turno de Chat (Priority: P1)

Hoje o turno de chat resolve estratégia via registry e executa caminhos separados. O operador precisa de **um grafo de produção único** que, a cada `POST /chat`, percorra nós explícitos: **contexto → roteador → uma das três estratégias → resposta**. Toda capacidade operacional do turno vive nesse grafo — não em if/else espalhado na borda HTTP.

**Why this priority**: É a espinha dorsal da feature; sem o grafo unificado, roteador, override e assinatura de nós no trace não têm onde viver.

**Independent Test**: Invocar o grafo de produção com harness determinístico (sem rede) e assertar a sequência de nós e o resultado `{ answer, trace, metrics }` (e campos HTTP já existentes, ex. `conversationId`).

**Acceptance Scenarios**:

1. **Given** o grafo de produção ativo, **When** um turno de chat é executado, **Then** a execução passa pelo nó de **contexto**, depois pelo **roteador** (ou override), depois por **exatamente um** nó de estratégia entre as três, e encerra no nó de **resposta**.
2. **Given** as três estratégias registradas como nós (`react`, `plan-and-execute`, `reflect`), **When** a rota escolhida (ou override) aponta para uma delas, **Then** só esse nó de estratégia produz a resposta operacional do turno.
3. **Given** o módulo do grafo em `src/.../production-graph.ts` (caminho canônico fixado no plano), **When** o servidor de chat processa um turno, **Then** usa esse grafo como orquestrador (não um caminho paralelo ad hoc fora do grafo).

---

### User Story 2 — Roteador Classifica a Estratégia Automaticamente (Priority: P1)

Quando o cliente **não** envia `strategy`, o nó **roteador** lê o pedido (e o contexto já montado) e escolhe sozinho qual das três estratégias executar. A decisão é **estruturada**: `route` (nome da estratégia) + `reason` (justificativa curta). O prompt do roteador inclui uma **tabela de decisão** que descreve quando preferir cada rota.

**Why this priority**: Elimina a necessidade do cliente conhecer nomes de estratégia; é o valor de produto do classificador.

**Independent Test**: Com um classificador fake/determinístico (ou LLM mockado) que devolve `{ route, reason }` fixos, assertar que o nó de estratégia correspondente roda e que o trace registra o evento `route`.

**Acceptance Scenarios**:

1. **Given** `POST /chat` com `message` e **sem** `strategy`, **When** o roteador devolve `{ route: "react", reason: "..." }`, **Then** o nó `react` executa e a resposta `200` reflete essa execução.
2. **Given** o mesmo, **When** o roteador devolve `plan-and-execute` ou `reflect`, **Then** o nó correspondente executa (e não os outros).
3. **Given** o prompt do roteador, **When** inspecionado, **Then** contém uma tabela (ou equivalente tabular) mapeando critérios → rota entre as três estratégias.
4. **Given** a saída do roteador, **When** o trace é montado, **Then** existe um evento com `type: "route"` cujo conteúdo/campos permitem inspecionar a rota escolhida e o motivo (`reason`).

---

### User Story 3 — `strategy` Opcional como Override (Priority: P1)

O body de `/chat` continua aceitando `strategy` **opcional**. Se vier, **substitui** a decisão do roteador: a estratégia pedida é a executada, e o trace deixa claro que houve **override** (não uma classificação livre do modelo).

**Why this priority**: Mantém controle explícito para demos, testes e plantão; compatível com clientes que já enviam `strategy`.

**Independent Test**: Enviar `strategy: "plan-and-execute"` com classificador que *escolheria* outra rota; assertar que só `plan-and-execute` roda e que o evento `route` (ou metadados do override) indica override.

**Acceptance Scenarios**:

1. **Given** body com `strategy` válido (uma das três), **When** o turno roda, **Then** o nó dessa estratégia executa **sem** depender da classificação livre do roteador.
2. **Given** override presente, **When** o trace é inspecionado, **Then** o evento de roteamento registra a rota usada e marca que foi **override** (campo ou conteúdo inequívoco).
3. **Given** `strategy` com nome desconhecido, **When** a requisição chega, **Then** o sistema responde `422` (estratégia desconhecida) sem executar o grafo de raciocínio — comportamento alinhado a `003-chat-api`.
4. **Given** `strategy` omitido, **When** o turno roda, **Then** o roteador decide e **não** há marca de override no evento `route`.

---

### User Story 4 — Todo Evento de Trace Assinado pelo Nó (Priority: P1)

Cada evento do `trace` carrega um campo **`node`** identificando qual nó do grafo o produziu (ex.: `context`, `router`, `react`, `plan-and-execute`, `reflect`, `response`). Isso dá o “raio-X” do grafo para depuração e para persistência futura.

**Why this priority**: Observabilidade do grafo é requisito explícito do input; sem `node`, o trace não distingue origem dos eventos.

**Independent Test**: Executar um turno com harness fake e assertar que **todo** item de `trace` possui `node` string não vazia e coerente com o nó ativo.

**Acceptance Scenarios**:

1. **Given** um turno bem-sucedido, **When** o cliente lê `trace`, **Then** cada evento tem o campo `node`.
2. **Given** o evento `route`, **When** inspecionado, **Then** `node` identifica o roteador (ex.: `router`) e `type` é `"route"`.
3. **Given** eventos gerados dentro de uma estratégia (thought/action/observation/answer/etc.), **When** inspecionados, **Then** `node` é o nome do nó daquela estratégia.
4. **Given** eventos do nó de contexto ou de resposta (se emitirem trace), **When** presentes, **Then** também trazem `node` correspondente.

---

### Edge Cases

- O que acontece se o roteador devolver uma `route` fora do conjunto das três? MUST rejeitar/sanitizar e cair em fallback documentado (default sugerido: tratar como erro de domínio e usar `react`, **ou** falhar o turno com erro claro) — default: **fallback para `react` + registrar no trace**.
- O que acontece se o roteador falhar (timeout/erro de modelo)? MUST degradar de forma controlada: fallback para `react` (ou override se houver) e registrar falha no trace; não quebrar o contrato HTTP `200` se a estratégia fallback completar.
- O que acontece com `strategy` válido mas o nó correspondente indisponível? MUST `422` ou erro de domínio equivalente — default: mesma semântica de estratégia desconhecida/`422`.
- Relação com o flag `reflect` do body (`003`): se `strategy` omitido e `reflect: true`, MUST tratar como override para o nó `reflect` (compatibilidade); se ambos `strategy` e `reflect` conflitarem, `strategy` prevalece.
- Eventos legados sem `node` em testes antigos: a suíte nova MUST exigir `node`; migração de helpers de teste faz parte da feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST expor um grafo de produção unificado em `production-graph.ts` (caminho sob `src/` fixado no plano) com nós: **contexto**, **roteador**, **três estratégias** (`react`, `plan-and-execute`, `reflect`) e **resposta**.
- **FR-002**: O fluxo canônico MUST ser: contexto → roteador (ou bypass por override) → exatamente um nó de estratégia → resposta.
- **FR-003**: O nó de contexto MUST montar o prompt/contexto do turno (reutilizando o ContextBuilder da feature `012` quando disponível) antes da decisão de rota.
- **FR-004**: O nó roteador MUST produzir saída estruturada com pelo menos `route` (enum das três estratégias) e `reason` (string), via `withStructuredOutput` (ou equivalente LangChain no stack do projeto).
- **FR-005**: O prompt do roteador MUST incluir uma **tabela de decisão** descrevendo critérios para cada uma das três rotas.
- **FR-006**: Após a decisão de rota (classificada ou override), o `trace` MUST incluir um evento com `type: "route"` contendo a rota efetiva e o motivo (e indicação de override quando aplicável).
- **FR-007**: Todo evento em `TraceEvent` MUST incluir o campo `node: string` identificando o nó produtor.
- **FR-008**: O tipo de evento `route` MUST ser adicionado ao conjunto de tipos de trace do domínio (`TraceEventType`).
- **FR-009**: Em `POST /chat`, `strategy` permanece **opcional**; se presente e válida, MUST atuar como **override** da classificação do roteador e MUST ficar visível no evento `route` do trace.
- **FR-010**: Se `strategy` estiver ausente, o roteador MUST escolher a rota; o default rígido `strategy=react` da borda HTTP (`003`) deixa de aplicar-se como seleção automática — a seleção passa a ser o roteador (exceto fallbacks de erro).
- **FR-011**: `strategy` desconhecida MUST continuar respondendo `422` sem executar o grafo de raciocínio.
- **FR-012**: Apenas um nó de estratégia MUST executar por turno (sem fan-out das três em produção).
- **FR-013**: DEVE existir suíte de testes sem rede cobrindo: fluxo completo do grafo com fakes; override de `strategy`; evento `route`; presença de `node` em todos os eventos; rejeição `422`.

### Key Entities

- **Production Graph**: Orquestrador único do turno de chat em produção; contém nós e arestas condicionais de rota.
- **Router Decision**: Saída estruturada `{ route, reason }` (+ flag/metadado de override quando a rota veio do body).
- **TraceEvent** (estendido): Eventos de execução com `type` (incluindo `"route"`), `content` e **`node`** obrigatório.
- **Strategy Node**: Um dos três ramos de raciocínio (`react` | `plan-and-execute` | `reflect`) encapsulado como nó do grafo.
- **ChatRequest** (comportamento): `strategy?` opcional passa a significar override de rota, não apenas lookup de registry com default `react`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos turnos de teste bem-sucedidos, o `trace` contém ≥ 1 evento `type: "route"` e 100% dos eventos possuem `node` não vazio.
- **SC-002**: Com `strategy` omitido e roteador fake fixo, a estratégia executada coincide com `route` em 100% dos casos de teste.
- **SC-003**: Com `strategy` explícito divergente do roteador fake, 100% dos casos executam o override e o evento `route` indica override.
- **SC-004**: Cliente que envia só `{ "message": "..." }` obtém resposta útil (`answer` + `trace` + `metrics`) sem precisar conhecer nomes de estratégia.
- **SC-005**: `strategy` inválida continua resultando em `422` em 100% dos testes de contrato HTTP existentes para esse caso.

## Assumptions

- As três estratégias-nó são `react`, `plan-and-execute` e `reflect` (alinhado ao grafo-alvo do material da unidade / preview).
- O nó de contexto reutiliza o montador de `012-context-builder-budget` (ou a composição atual equivalente até `012` estar implementada).
- O nó de resposta concentra efeitos de borda do turno já existentes (persistir histórico, métricas, disparos assíncronos como learning reflector) — detalhe no plano.
- Arena / comparação multi-estratégia (`001`) permanece fora deste grafo de produção; esta feature cobre o caminho HTTP `/chat`.
- Retry/fallback de modelo e paralelismo em ondas (mencionados no material da unidade) estão **fora de escopo** desta spec — só o grafo unificado + roteador + override + `node`/`route` no trace.
- Nomes canônicos dos `node` strings (`context`, `router`, `react`, `plan-and-execute`, `reflect`, `response`) são fixados no plano e usados de forma estável nos testes.
- `withStructuredOutput({ route, reason })` é o contrato canônico da saída do roteador; schema zod na fronteira LLM.
