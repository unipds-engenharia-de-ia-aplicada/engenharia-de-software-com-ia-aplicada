# Feature Specification: Refletor de Aprendizado

**Feature Branch**: `009-learning-reflector`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Refletor de aprendizado: após cada resposta, um withStructuredOutput({ hasLearning, fact }) lê a ultima mensagem do usuário e destila fatos duráveis (nunca pedido pontual, nunca segredo) -> memories.remeber assíncrono; tool forget_preference"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Sistema Aprende Preferências Duráveis Após o Turno (Priority: P1)

Depois que o agente responde a um `POST /chat`, um refletor de aprendizado analisa a **última mensagem do usuário** daquele turno e, via saída estruturada (`hasLearning`, `fact`), decide se há um fato **durável** a guardar. Se `hasLearning` for verdadeiro e o fato for elegível, o sistema chama `MemoryStore.remember` para aquele `userId` de forma **assíncrona** — sem atrasar nem alterar a resposta HTTP já produzida.

**Why this priority**: Sem destilação automática, a memória semântica (`008`) só cresce por seeding manual; o valor do plantão é o OpsPilot lembrar preferências/contexto operacional entre turnos.

**Independent Test**: Com critic/refletor fake (determinístico) e `MemoryStore` em `:memory:`, executar um turno cujo usuário declara preferência durável; assertar que `remember` é agendado/chamado com o fato esperado **após** a resposta; turno pontual ou com segredo **não** chama `remember` (ou chama com `hasLearning: false`).

**Acceptance Scenarios**:

1. **Given** um turno `/chat` bem-sucedido com `userId` e mensagem do usuário contendo preferência durável (ex.: “sempre priorize o serviço checkout”), **When** o refletor retorna `{ hasLearning: true, fact: "..." }`, **Then** `memories.remember(userId, fact)` é invocado de forma assíncrona e o fato fica disponível para recall futuro.
2. **Given** a mesma mensagem do usuário, **When** a resposta HTTP `200` é montada, **Then** o cliente recebe `answer` / `trace` / `metrics` normalmente **sem esperar** a conclusão do `remember` (latência do turno não inclui o persist assíncrono).
3. **Given** o refletor com `hasLearning: false`, **When** o turno termina, **Then** `remember` **não** é chamado.

---

### User Story 2 — Só Fatos Duráveis — Nunca Pedido Pontual nem Segredo (Priority: P1)

O refletor MUST recusar aprender: (a) pedidos pontuais / one-shot (“liste alertas agora”, “abra incidente X”); (b) segredos ou dados sensíveis (tokens, senhas, chaves API, credenciais). Nesses casos `hasLearning` é falso (ou equivalente) e nada é gravado.

**Why this priority**: Evita poluir a memória e reduz risco de persistir informação sensível — alinhado a “segurança por padrão”.

**Independent Test**: Suite com fake structured-output (ou prompts de fixture) cobrindo: preferência durável → aprende; pergunta operacional pontual → não aprende; mensagem com segredo → não aprende.

**Acceptance Scenarios**:

1. **Given** mensagem do usuário que é só um pedido pontual de plantão, **When** o refletor avalia, **Then** `hasLearning` é falso e nenhum fato é persistido.
2. **Given** mensagem contendo segredo (ex.: API key / senha), **When** o refletor avalia, **Then** `hasLearning` é falso e nenhum fato é persistido.
3. **Given** mensagem com preferência ou fato operacional durável sem segredo, **When** o refletor avalia, **Then** `hasLearning` é verdadeiro e `fact` é um enunciado estável (não a pergunta bruta pontual).

---

### User Story 3 — Plantonista Esquece Preferência via Tool (Priority: P2)

O catálogo de tools do agente inclui `forget_preference`, que permite ao plantonista (via diálogo) pedir para esquecer uma preferência/fato previamente memorizado. A tool usa o `MemoryStore` (tipicamente `recall` + `forget`, ou id — detalhe no plano) escopado ao `userId` da sessão.

**Why this priority**: Completa o ciclo de privacidade/controle do usuário sobre o que o sistema aprendeu.

**Independent Test**: Seed de memória → invocar `forget_preference` (fake model/tool invoke) → recall subsequente não retorna o fato.

**Acceptance Scenarios**:

1. **Given** um fato memorizado para o `userId`, **When** o agente invoca `forget_preference` com descrição/consulta suficiente, **Then** o fato deixa de aparecer em `recall` daquele usuário.
2. **Given** preferência inexistente, **When** `forget_preference` roda, **Then** responde de forma segura (no-op / mensagem clara) sem afetar memórias de outros usuários.
3. **Given** a descrição da tool, **When** o modelo escolhe tools, **Then** `forget_preference` aparece no catálogo com as 6 regras (nome, o quê, quando usar / não usar, campos descritos).

---

### Edge Cases

- O que acontece se o refletor LLM falhar (timeout, JSON inválido, erro de rede)? MUST **não** falhar o `/chat` já respondido; logar/ignorar de forma observável; nenhum `remember` parcial enganoso.
- O que acontece se `remember` assíncrono rejeitar (dedup, embedding error)? MUST engolir/logar sem afetar turnos futuros além da ausência do fato.
- O que acontece em turno sem `userId`? Fora de escopo se `008` já exige `userId`; se ausente, refletor MUST não rodar.
- O que acontece se `fact` vier vazio com `hasLearning: true`? MUST tratar como não-aprendizado (não chamar `remember`).
- O que acontece com reflexão de estratégia (`reflect: true` da feature `002`)? MUST permanecer independente: o refletor de **aprendizado** roda após a resposta final do turno, não substitui o critique loop.
- Concorrência: múltiplos turns do mesmo `userId` — `remember` assíncrono pode completar fora de ordem; dedup de `008` mitiga duplicatas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Após cada resposta bem-sucedida de `POST /chat`, o sistema MUST executar um refletor de aprendizado que lê a última mensagem do usuário daquele turno.
- **FR-002**: O refletor MUST produzir saída estruturada com pelo menos `hasLearning` (boolean) e `fact` (string), via `withStructuredOutput` (ou equivalente LangChain no stack do projeto).
- **FR-003**: Quando `hasLearning === true` e `fact` não vazio/elegível, o sistema MUST chamar `memories.remember(userId, fact)` de forma **assíncrona** (não bloqueia o envio da resposta HTTP).
- **FR-004**: Quando `hasLearning === false` ou fato inelegível, o sistema MUST NÃO chamar `remember`.
- **FR-005**: O refletor MUST instruir/garantir que **não** aprende pedidos pontuais (one-shot operacional) nem segredos (credenciais, tokens, senhas, chaves).
- **FR-006**: Falhas do refletor ou do `remember` assíncrono MUST NÃO alterar o status HTTP nem o corpo da resposta bem-sucedida do turno.
- **FR-007**: O sistema MUST expor a tool `forget_preference` no catálogo de tools do agente, permitindo remover preferência/fato da memória do usuário atual.
- **FR-008**: `forget_preference` MUST respeitar isolamento por `userId` e as regras de tool do projeto (zod + descrições).
- **FR-009**: DEVE existir suíte de testes com refletor fake/determinístico cobrindo: aprende preferência; rejeita pontual; rejeita segredo; `forget_preference` remove fato; `/chat` não espera o `remember`.
- **FR-010**: A feature MUST reutilizar o `MemoryStore` da feature `008` (sem segundo store de preferências).

### Key Entities

- **LearningReflection**: Resultado estruturado do refletor — `hasLearning`, `fact` (e opcionalmente motivo interno só no prompt, não persistido).
- **DurableFact**: Texto estável elegível a `remember` (preferência, contexto operacional duradouro).
- **LearningReflector**: Componente que, dado a última mensagem do usuário (e opcionalmente a resposta), produz `LearningReflection`.
- **forget_preference** (tool): Entrada tipada (consulta/descrição da preferência a esquecer); efeito colateral em `MemoryStore`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos testes com preferência durável + refletor fake positivo, `remember` é chamado exatamente uma vez com o fato esperado.
- **SC-002**: Em 100% dos testes de pedido pontual e de segredo, `remember` não é chamado.
- **SC-003**: Latência medida do handler até `200` (harness fake) não inclui await do `remember` — assertável via spy que a promise de remember ainda está pendente ou foi agendada após o status.
- **SC-004**: Após `forget_preference`, `recall` do mesmo usuário não retorna o fato removido nos testes.
- **SC-005**: `npm test` e `npm run typecheck` permanecem verdes após a feature.

## Assumptions

- “remeber” no input significa **`remember`** do `MemoryStore` (`008`).
- O refletor usa o mesmo stack LLM do projeto (OpenRouter / `createModel`); em testes, critic/refletor é **fake** injetável (sem rede).
- Escopo HTTP: integração no fluxo `runChat` / borda `/chat` após sucesso da estratégia; CLI/Arena/MCP podem reutilizar o refletor depois — default desta feature = `/chat` + tools do agente.
- `forget_preference` resolve o alvo por **texto/consulta** (recall + forget do melhor match acima do limiar) salvo o plano escolher `memoryId` explícito; default = consulta textual.
- Segredos: heurística via instruções do schema/prompt do refletor + testes de fixture; sem DLP externo nesta feature.
- Pedido pontual vs durável: definido nas instruções do refletor (exemplos no plano); aceite via fixtures fake.
- `withStructuredOutput({ hasLearning, fact })` é o contrato canônico da saída; nomes de campos exatos em camelCase.
- O refletor de aprendizado é **distinto** do decorator `withReflection` (critique) da feature `002`.
