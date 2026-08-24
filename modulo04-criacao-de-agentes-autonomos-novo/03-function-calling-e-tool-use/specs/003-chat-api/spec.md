# Feature Specification: Chat HTTP API

**Feature Branch**: `003-chat-api`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "POST /chat em src/http/server.ts (ou padrão do express): body { message, strategy?, reflect? } validado com zod; default react. 200 { answer, trace, metrics }; 400 body inválido (issues do zod); 422 estratégia desconhecida; timeout 180s -> 504. Registry em src/agents/index.ts (nome -> estratégia; reflect aplica withReflection). Teste de integração com estratégia fake determinística, sem rede."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Plantonista Conversa com o Agente via HTTP (Priority: P1)

Um plantonista de operações envia uma mensagem em linguagem natural para o endpoint de chat e recebe a resposta do agente junto com o rastreio das decisões e as métricas de custo/latência daquela execução — para poder agir no incidente e auditar o que o agente fez.

**Why this priority**: É o contrato público do OpsPilot. Sem ele, estratégias e reflexão só existem via CLI/Arena; o produto não atende o plantonista.

**Independent Test**: Com uma estratégia falsa registrada (resposta fixa, sem rede), um cliente HTTP envia `POST /chat` com `{"message":"..."}` e valida status 200 e o formato `{ answer, trace, metrics }`.

**Acceptance Scenarios**:

1. **Given** o servidor de chat ativo e a estratégia `react` registrada, **When** o cliente envia `POST /chat` com `{"message":"liste alertas ativos"}` sem `strategy`, **Then** o sistema usa `react` por padrão e responde `200` com `answer` (string), `trace` (lista de eventos) e `metrics` (incluindo chamadas ao modelo e latência).
2. **Given** o servidor ativo, **When** o cliente envia `POST /chat` com `{"message":"...","strategy":"plan-and-execute"}`, **Then** a execução usa a estratégia `plan-and-execute` e a resposta `200` reflete o resultado dessa estratégia.
3. **Given** o servidor ativo, **When** o cliente envia `POST /chat` com `{"message":"...","reflect":true}`, **Then** a estratégia escolhida é executada sob reflexão (`withReflection`) e a resposta inclui o custo acumulado no `metrics`.

---

### User Story 2 — Fronteira Rejeita Entrada Inválida e Estratégia Desconhecida (Priority: P2)

Um cliente (humano ou integração) que manda um corpo malformado ou pede uma estratégia inexistente precisa receber um erro claro e tipado — sem disparar o agente — para corrigir a requisição imediatamente.

**Why this priority**: Validação na fronteira é princípio da constitution; protege custo e evita comportamento indefinido.

**Independent Test**: Enviar corpos inválidos e nomes de estratégia fora do registry; assertar status e formato do erro sem chamar LLM.

**Acceptance Scenarios**:

1. **Given** o servidor ativo, **When** o cliente envia um corpo que falha a validação (ex.: campo `message` ausente ou nome errado), **Then** o sistema responde `400` com as issues da validação (sem executar estratégia).
2. **Given** o servidor ativo e um body com `message` válido, **When** `strategy` é um nome não presente no registry, **Then** o sistema responde `422` indicando estratégia desconhecida (sem executar estratégia).
3. **Given** o servidor ativo, **When** o cliente omite `strategy` e `reflect`, **Then** defaults aplicados são `strategy=react` e `reflect=false` (ou equivalente a não decorar).

---

### User Story 3 — Timeout Protege o Cliente de Execuções Travadas (Priority: P3)

Um plantonista não pode ficar esperando indefinidamente se o agente travar ou o modelo demorar demais. Após o teto de tempo, a API sinaliza falha de gateway.

**Why this priority**: Guardrail de produção; completa o harness HTTP sem depender de tetos internos das estratégias.

**Independent Test**: Registrar uma estratégia falsa que demora mais que o timeout e assertar `504` na integração (sem rede externa).

**Acceptance Scenarios**:

1. **Given** timeout configurado em 180 segundos, **When** a execução da estratégia excede esse limite, **Then** o sistema responde `504` e não deixa a conexão pendente.
2. **Given** uma estratégia falsa que responde em milissegundos, **When** `POST /chat` é chamado, **Then** a resposta chega `200` bem antes do teto de 180s.

---

### User Story 4 — Registry Permite Trocar Estratégia sem Mudar a Rota (Priority: P4)

Um desenvolvedor adiciona ou troca estratégias no registry nome→estratégia; a rota `/chat` continua igual. O flag `reflect` aplica o decorator de reflexão sobre a estratégia resolvida.

**Why this priority**: Extensibilidade — “estratégia nova = uma linha no registry”; o grafo futuro entra pelo mesmo ponto.

**Independent Test**: Registrar uma estratégia fake no registry, chamar `/chat` com o nome dela; com `reflect:true`, verificar que a resolução passa por reflexão (evento/métrica coerente ou spy no decorator).

**Acceptance Scenarios**:

1. **Given** o registry com entradas nomeadas (ex.: `react`, `plan-and-execute`), **When** `strategy` corresponde a um nome, **Then** essa estratégia é a executada.
2. **Given** `reflect:true` e uma estratégia base no registry, **When** `/chat` é chamado, **Then** a execução usa a estratégia base decorada com reflexão.
3. **Given** uma estratégia fake registrada só para teste, **When** o teste de integração chama `/chat` com o nome dela, **Then** o fluxo HTTP completo (parse → resolve → run → resposta) passa sem rede.

---

### Edge Cases

- O que acontece quando `message` é string vazia? Deve falhar validação (`400`) se a regra exigir não-vazio.
- O que acontece quando o body não é JSON? `400` (ou equivalente de parse) sem executar estratégia.
- O que acontece quando a estratégia lança erro de domínio/runtime antes do timeout? Erro traduzido na borda (não vazar stack crua); detalhe de status fica para o plano se não especificado aqui.
- O que acontece quando `reflect:true` e a estratégia base é desconhecida? `422` na resolução do nome base, antes da reflexão.
- O que acontece quando `strategy` é omitido com `reflect:true`? Default `react` + reflexão.
- O que acontece com método diferente de POST ou path diferente? Fora do contrato desta feature (pode 404 do framework).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE expor `POST /chat` como ponto de entrada HTTP para conversar com o agente.
- **FR-002**: O corpo da requisição DEVE ser validado na fronteira com schema contendo `message` (obrigatório, string), `strategy` (opcional) e `reflect` (opcional, boolean).
- **FR-003**: Quando `strategy` estiver ausente, o sistema DEVE usar `react` como padrão.
- **FR-004**: Quando `reflect` estiver ausente, o sistema DEVE tratar como `false` (sem decorator de reflexão).
- **FR-005**: Em sucesso, o sistema DEVE responder `200` com corpo `{ answer, trace, metrics }` alinhado ao resultado da estratégia (`StrategyResult`).
- **FR-006**: Quando a validação do body falhar, o sistema DEVE responder `400` incluindo as issues da validação (formato legível pelo cliente).
- **FR-007**: Quando `strategy` não existir no registry, o sistema DEVE responder `422` (estratégia desconhecida) sem executar o agente.
- **FR-008**: A execução DEVE respeitar timeout de 180 segundos; ao estourar, responder `504`.
- **FR-009**: O sistema DEVE manter um registry nome → estratégia; a resolução de `strategy` consulta apenas esse registry.
- **FR-010**: Quando `reflect` for `true`, o sistema DEVE aplicar `withReflection` sobre a estratégia resolvida antes de executar.
- **FR-011**: DEVE existir teste de integração do fluxo `/chat` usando estratégia fake determinística, sem chamadas de rede.
- **FR-012**: O processo de desenvolvimento (`dev`) DEVE subir o servidor HTTP; o bootstrap existente passa a alimentar o registry/servidor em vez de ser o único ponto de uso.

### Key Entities

- **ChatRequest**: Entrada do plantonista. Campos: `message`, `strategy?`, `reflect?`.
- **ChatResponse**: Saída em sucesso. Campos: `answer`, `trace`, `metrics`.
- **StrategyRegistry**: Mapa nome → instância de estratégia de raciocínio; ponto único de extensão.
- **ValidationFailure**: Representação das issues de validação devolvidas em `400`.
- **UnknownStrategyFailure**: Falha de resolução de nome no registry, mapeada para `422`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um cliente consegue obter resposta útil (answer + trace + metrics) com uma única requisição `POST /chat` e body mínimo `{ "message": "..." }`.
- **SC-002**: 100% dos corpos inválidos no teste de integração retornam `400` com issues, sem execução de estratégia.
- **SC-003**: 100% dos nomes de estratégia fora do registry no teste de integração retornam `422`.
- **SC-004**: O teste de integração com estratégia fake completa o caminho feliz (`200`) em menos de 5 segundos, sem rede.
- **SC-005**: Execução que excede 180s no teste (estratégia fake atrasada) resulta em `504`.
- **SC-006**: Com `reflect:true`, o custo reportado em `metrics` inclui o overhead da reflexão quando a estratégia real/fake + decorator estão no caminho (verificável no teste com spies/mocks).

## Assumptions

- Stack alinhada à constitution: Express (padrão do projeto) em `src/http/server.ts`; validação com `zod`; testes com `node:test` via `tsx`.
- Nomes de estratégia no registry alinham-se aos já usados na Arena: `react` e `plan-and-execute` (não `plan-execute`).
- `withReflection` e a interface `ReasoningStrategy` / `StrategyResult` já existem (features `001-reasoning-nucleus` e `002-reflection-layer`).
- O registry vive em `src/agents/index.ts` (ou módulo equivalente exportado dali), conforme pedido da feature.
- `src/index.ts` torna-se bootstrap do servidor HTTP (alvo do script `dev`), reutilizando criação de store/tools/estratégias.
- Autenticação, rate limiting, streaming/SSE e persistência de conversas ficam fora de escopo.
- Porta padrão de desenvolvimento: 3000 (ou a já convencionada no projeto), a menos que env configure outra.
- Conteúdo de `trace` e `metrics` segue o modelo de domínio já existente (`TraceEvent[]`, `{ llmCalls, latencyMs }`).
- Em erro de timeout (`504`), o corpo de erro pode ser mínimo (mensagem); detalhe exato no plano.
)

