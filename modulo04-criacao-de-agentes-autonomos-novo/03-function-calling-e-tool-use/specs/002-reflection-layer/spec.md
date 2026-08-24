# Feature Specification: Reflection Layer

**Feature Branch**: `002-reflection-layer`

**Created**: 2026-07-31

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Reflection Decorator Melhora Resposta Insatisfatória (Priority: P1)

Um desenvolvedor que usa o OpsPilot configura uma estratégia com reflexão. Quando o agente produz uma resposta que não satisfaz os critérios do crítico, a reflexão entra em ação automaticamente: o crítico analisa a resposta contra as observações do trace, gera feedback estruturado, e o agente regenera a resposta com esse contexto adicional — tudo de forma transparente, sem mudança na interface de chamada.

**Why this priority**: É o núcleo funcional da feature. Sem esse comportamento, o decorator não entrega valor algum.

**Independent Test**: Pode ser testado de forma determinística passando um mock de `ReasoningStrategy` que retorna uma resposta fixa e um mock de crítico que retorna `{ approved: false, feedback: "..." }` na primeira chamada e `{ approved: true }` na segunda. Valida-se que a estratégia base foi chamada duas vezes e que o evento `critique` aparece no trace.

**Acceptance Scenarios**:

1. **Given** uma estratégia base que retorna uma resposta inicial, **When** o crítico retorna `{ approved: false, feedback: "Resposta incompleta" }`, **Then** a estratégia base é reinvocada com o feedback injetado no contexto e o trace registra um evento `critique` contendo o feedback.
2. **Given** uma estratégia base que retorna uma resposta inicial, **When** o crítico retorna `{ approved: true }`, **Then** a resposta é retornada imediatamente sem nova invocação da estratégia base.
3. **Given** o limite `maxReflections` atingido (default 2), **When** o crítico ainda retorna `{ approved: false }`, **Then** a última resposta gerada é retornada sem novas iterações e o trace reflete todas as rodadas.

---

### User Story 2 — Métricas Acumulam Chamadas de Reflexão (Priority: P2)

Um operador que monitora o custo e latência do agente precisa que as chamadas extras feitas durante a reflexão sejam contabilizadas nos campos `llmCalls` e `latencyMs` do resultado — para que o dashboard de custo reflita o consumo real, incluindo as rodadas de crítica e regeneração.

**Why this priority**: Sem métricas corretas, o operador não pode calcular custo real nem detectar regressões de performance causadas pela reflexão.

**Independent Test**: Usando mocks determinísticos, mede-se que após N rodadas de reflexão o `result.metrics.llmCalls` é igual às chamadas da estratégia base mais as chamadas do crítico, e `latencyMs` é a soma de todas as durações parciais.

**Acceptance Scenarios**:

1. **Given** 1 rodada de reflexão (base + 1 ciclo crítico + 1 regeneração), **When** o resultado é retornado, **Then** `metrics.llmCalls` soma as chamadas da estratégia base original, do crítico e da regeneração.
2. **Given** aprovação na primeira avaliação (sem reflexão), **When** o resultado é retornado, **Then** `metrics.llmCalls` é igual ao da estratégia base mais 1 (a chamada do crítico).
3. **Given** `maxReflections: 2` e o crítico sempre reprova, **When** o resultado é retornado, **Then** `metrics.llmCalls` contabiliza exatamente 3 chamadas de estratégia base + 2 chamadas de crítico (= 5 total).

---

### User Story 3 — Arena Expõe Estratégias Refletidas via `--strategies` (Priority: P3)

Um pesquisador que usa o modo Arena do OpsPilot quer comparar `reflect:react` e `reflect:plan-and-execute` com suas versões sem reflexão, passando os novos nomes via flag `--strategies`. O sistema deve reconhecer e instanciar os decoradores corretamente.

**Why this priority**: A Arena é o ponto de entrada principal para comparação de estratégias. Sem integração aqui, o decorator só é acessível via API programática.

**Independent Test**: Pode ser testado de forma determinística instanciando a Arena com `strategies: ["reflect:react"]` e validando que a estratégia resultante possui `name === "reflect:react"` e encapsula uma `ReactStrategy`.

**Acceptance Scenarios**:

1. **Given** `--strategies reflect:react`, **When** a Arena inicializa, **Then** uma estratégia com `name === "reflect:react"` é registrada e invocável.
2. **Given** `--strategies reflect:plan-and-execute`, **When** a Arena inicializa, **Then** uma estratégia com `name === "reflect:plan-and-execute"` é registrada e invocável.
3. **Given** `--strategies react,reflect:react,plan-and-execute`, **When** a Arena executa, **Then** as três estratégias rodam em paralelo e seus resultados — incluindo os eventos `critique` no trace — são comparados normalmente.

---

### Edge Cases

- O que acontece quando a estratégia base já lança um erro? O decorator deve propagar o erro sem tentar reflexão.
- O que acontece quando o crítico retorna JSON inválido (falha de parsing)? A rodada deve ser tratada como `approved: true` (fail-safe) ou o erro deve ser logado e a iteração encerrada sem crash.
- O que acontece quando `maxReflections: 0` é configurado? A estratégia base executa normalmente sem nenhuma rodada de crítica.
- O que acontece quando o feedback do crítico é uma string vazia? O contexto injetado deve omitir o campo ou injetar uma mensagem padrão, evitando prompt confuso ao modelo.
- O que acontece quando o mesmo feedback é retornado repetidamente? O decorator deve respeitar `maxReflections` e não entrar em loop infinito.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE prover a função `withReflection(strategy, opts?)` que aceita qualquer objeto que implemente `ReasoningStrategy` e retorna uma nova `ReasoningStrategy` decorada.
- **FR-002**: A estratégia decorada DEVE executar a estratégia base e então invocar o crítico com a resposta produzida e as observações do trace como contexto de avaliação.
- **FR-003**: O crítico DEVE retornar saída estruturada com o schema `{ approved: boolean, feedback: string }`, validado via `zod` antes de ser usado.
- **FR-004**: Quando `approved: false`, o sistema DEVE reinvocar a estratégia base injetando o feedback do crítico no contexto da próxima geração.
- **FR-005**: O ciclo de reflexão DEVE se repetir até `approved: true` ou até atingir `maxReflections` (padrão: 2), o que ocorrer primeiro.
- **FR-006**: A cada rodada de reflexão, o sistema DEVE adicionar um evento do tipo `critique` ao trace da execução, contendo o feedback do crítico e o número da rodada.
- **FR-007**: Os campos `metrics.llmCalls` e `metrics.latencyMs` do resultado final DEVEM acumular todas as chamadas extras realizadas durante as rodadas de crítica e regeneração.
- **FR-008**: A propriedade `name` da estratégia decorada DEVE ser `reflect:<nome-da-estratégia-base>` (ex: `reflect:react`).
- **FR-009**: A Arena DEVE reconhecer os identificadores `reflect:react` e `reflect:plan-and-execute` via `--strategies` e instanciar os decoradores correspondentes.
- **FR-010**: Quando `maxReflections: 0`, o decorator DEVE executar a estratégia base sem nenhuma chamada ao crítico.
- **FR-011**: Erros lançados pela estratégia base DEVEM ser propagados sem modificação; o decorator não DEVE engolir exceções.
- **FR-012**: Falhas no parsing da resposta do crítico DEVEM ser tratadas como fail-safe (`approved: true`), encerrando a reflexão sem crash.

### Key Entities

- **ReflectionDecorator**: Wrapper funcional que encapsula uma `ReasoningStrategy` e orquestra o ciclo crítico–regeneração. Atributos-chave: `strategy` (base), `maxReflections`, `name`.
- **CritiqueEvent**: Evento adicionado ao trace a cada rodada. Campos: `type: "critique"`, `round: number`, `feedback: string`, `approved: boolean`, `timestampMs: number`.
- **CritiqueResult**: Schema zod da saída estruturada do crítico. Campos: `approved: boolean`, `feedback: string`.
- **ReflectionOpts**: Opções do decorator. Campos: `maxReflections?: number` (default 2).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A suite de testes determinísticos (sem rede) cobre aprovação imediata, reprovação com 1 ciclo, reprovação até `maxReflections`, e `maxReflections: 0` — todos passando em `npm test`.
- **SC-002**: `npm run typecheck` passa sem erros com `strict: true` após a adição do decorator e seus tipos.
- **SC-003**: Em cenários com aprovação na primeira avaliação, o overhead de `llmCalls` é de exatamente +1 (a chamada do crítico) em relação à estratégia base isolada.
- **SC-004**: O trace de uma execução com N rodadas de reflexão contém exatamente N eventos do tipo `critique`, cada um com `round` incrementado corretamente.
- **SC-005**: A Arena inicializa corretamente com `reflect:react` e `reflect:plan-and-execute` sem erros de tipo ou de runtime, verificável por teste unitário.

## Assumptions

- O crítico usa o mesmo modelo configurado para a estratégia base (sem necessidade de configurar modelo separado para o crítico nesta versão).
- O feedback injetado no contexto de regeneração é adicionado como mensagem de sistema ou instrução de usuário antes da reinvocação — o mecanismo exato de injeção é decisão de implementação, desde que o modelo receba o feedback de forma visível.
- A interface `ReasoningStrategy` da feature `001-reasoning-nucleus` inclui `name: string`, `run(input): Promise<StrategyResult>`, e `StrategyResult` inclui `trace: TraceEvent[]` e `metrics: { llmCalls: number, latencyMs: number }`.
- O modo Arena já existe e aceita uma lista de estratégias instanciadas; a integração requer apenas que os novos nomes `reflect:*` sejam mapeados para `withReflection(baseStrategy, opts)`.
- Não há requisito de persistência do histórico de reflexão entre execuções diferentes — o trace de reflexão é volátil, existindo apenas no resultado em memória.
- Testes são 100% determinísticos: usam mocks de LLM, sem chamadas de rede.
