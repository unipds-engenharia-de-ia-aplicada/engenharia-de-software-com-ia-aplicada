# Feature Specification: OpsPilot Reasoning Nucleus

**Feature Branch**: `001-reasoning-nucleus`

**Created**: 2026-07-27

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Detectar e escalar alertas ativos via agente (Priority: P1)

Um engenheiro de operações envia uma pergunta em linguagem natural perguntando quais serviços têm alertas ativos. O agente raciocina sobre o estado atual, consulta a base de alertas e responde com uma síntese clara dos serviços em alerta, incluindo severidade — tudo em uma única chamada ao sistema.

**Why this priority**: É o fluxo de maior valor operacional imediato. Sem ele, nenhuma outra capacidade do agente faz sentido. Define o contrato mínimo entre o agente e o ambiente de produção.

**Independent Test**: Pode ser testado isoladamente invocando o agente com a pergunta "Quais serviços têm alertas ativos?" contra um store in-memory pré-populado e verificando se a resposta cita os serviços corretos.

**Acceptance Scenarios**:

1. **Given** o store contém 3 alertas `firing` e 3 alertas `resolved`, **When** o usuário pergunta "Quais alertas estão ativos?", **Then** o agente retorna uma resposta mencionando apenas os 3 alertas `firing` com seus serviços e severidades.
2. **Given** todos os alertas estão `resolved`, **When** o usuário pergunta sobre alertas ativos, **Then** o agente responde que não há alertas ativos no momento.
3. **Given** o agente recebe uma pergunta ambígua sobre "problemas", **When** processa a consulta, **Then** interpreta como busca por alertas `firing` e responde de forma coerente.

---

### User Story 2 - Abrir e resolver incidentes via agente (Priority: P1)

Um engenheiro de plantão pede ao agente que abra um incidente para um serviço com alertas críticos e, após confirmação de remediação, resolve o incidente — tudo via linguagem natural, sem acessar diretamente o sistema de gerenciamento de incidentes.

**Why this priority**: Reduz o tempo de resposta a incidentes ao eliminar a necessidade de navegar manualmente entre ferramentas. Junto com a listagem de alertas, forma o MVP operacional completo.

**Independent Test**: Pode ser testado pedindo ao agente "Abra um incidente crítico para o serviço payment-api" e depois "Resolva o incidente que acabou de ser criado", verificando que o store reflete as mudanças esperadas.

**Acceptance Scenarios**:

1. **Given** um serviço `payment-api` com alerta `firing` de severidade `critical`, **When** o usuário pede ao agente para abrir um incidente, **Then** o agente cria o incidente com título, serviço e severidade corretos e confirma ao usuário o identificador gerado.
2. **Given** um incidente aberto com id conhecido, **When** o usuário pede ao agente para resolvê-lo, **Then** o agente chama a ferramenta de resolução, o incidente muda de estado e o agente confirma o encerramento.
3. **Given** o usuário tenta resolver um incidente com id inexistente, **When** o agente processa o pedido, **Then** o agente reporta que o incidente não foi encontrado sem travar o fluxo.

---

### User Story 3 - Comparar estratégias de raciocínio na arena (Priority: P2)

Um desenvolvedor ou pesquisador quer entender qual estratégia de raciocínio (ReAct ou Plan-and-Execute) resolve melhor um determinado problema operacional. Ele executa a arena com um input fixo e recebe, lado a lado, os traces de execução e as métricas de cada estratégia — número de chamadas ao modelo e latência total.

**Why this priority**: Essencial para evolução e validação do sistema. Sem a arena, não é possível tomar decisões informadas sobre qual estratégia usar em produção nem detectar regressões de qualidade.

**Independent Test**: Pode ser testado executando `src/arena.ts` com `--strategies react,plan-and-execute` e uma pergunta sobre alertas, verificando que ambos os traces aparecem e que as métricas são exibidas para cada estratégia.

**Acceptance Scenarios**:

1. **Given** ambas as estratégias estão disponíveis, **When** a arena é executada com `--strategies react,plan-and-execute` e um input de consulta de alertas, **Then** o terminal exibe o trace completo e as métricas (chamadas ao LLM, latência) para cada estratégia, identificadas pelo nome.
2. **Given** a arena é executada com `--max-iterations 3`, **When** uma estratégia ultrapassaria o limite, **Then** ela para no limite e registra o número real de iterações no trace.
3. **Given** apenas uma estratégia é especificada via flag, **When** a arena é executada, **Then** apenas aquela estratégia é executada e exibida.

---

### User Story 4 - Rastrear o raciocínio passo a passo (Priority: P2)

Um desenvolvedor depurando o comportamento do agente precisa ver exatamente o que o modelo pensou, quais ferramentas chamou e o que observou a cada passo, incluindo o plano gerado pela estratégia Plan-and-Execute e eventuais revisões do plano.

**Why this priority**: Sem rastreabilidade, falhas de raciocínio são invisíveis. O trace tipado é o principal instrumento de observabilidade e depuração do sistema.

**Independent Test**: Pode ser testado verificando que o trace retornado por qualquer estratégia contém eventos com os tipos corretos (`thought`, `action`, `observation`, `plan`, `critique`, `answer`) e que eventos `action` carregam nome da ferramenta e argumentos.

**Acceptance Scenarios**:

1. **Given** o agente ReAct executa com sucesso, **When** o trace é inspecionado, **Then** cada passo de raciocínio é representado por um evento tipado na sequência correta: `thought → action → observation → ... → answer`.
2. **Given** o agente Plan-and-Execute executa com sucesso, **When** o trace é inspecionado, **Then** o trace inclui ao menos um evento `plan` com a lista de passos, eventos `action`/`observation` por passo executado e um evento `answer` ao final.
3. **Given** um evento de ação é gerado, **When** o trace é serializado, **Then** o evento carrega o nome da ferramenta invocada e os argumentos exatos passados a ela.

---

### Edge Cases

- O que acontece quando o agente é chamado com uma pergunta totalmente fora do domínio operacional (ex.: "Qual é a capital do Brasil?")?
- Como o sistema se comporta quando o limite de iterações é atingido antes de uma resposta final?
- O que ocorre quando uma chamada à ferramenta retorna lista vazia (nenhum alerta encontrado)?
- Como o agente lida com chamadas repetidas à mesma ferramenta com os mesmos argumentos em um único turno?
- O que acontece se `OPENROUTER_API_KEY` não estiver configurada ao iniciar o sistema?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE expor uma interface de estratégia de raciocínio com método `run(input)` que retorna `(answer, trace, metrics)` para qualquer estratégia implementada.
- **FR-002**: O trace DEVE conter eventos tipados com os seguintes tipos: `thought`, `action`, `observation`, `plan`, `critique`, `answer`; eventos do tipo `action` DEVEM incluir nome da ferramenta e argumentos.
- **FR-003**: As métricas DEVEM incluir contagem de chamadas ao modelo de linguagem (`llmCalls`) e latência total em milissegundos (`latencyMs`).
- **FR-004**: O sistema DEVE fornecer uma fábrica de modelo de linguagem que lê as configurações de acesso ao provedor a partir de variáveis de ambiente, sem valores fixos no código.
- **FR-005**: O sistema DEVE disponibilizar três ferramentas operacionais: listagem de alertas por status, abertura de incidente e resolução de incidente.
- **FR-006**: A ferramenta de listagem de alertas DEVE aceitar um parâmetro de status (`firing` ou `resolved`) e retornar apenas os alertas correspondentes.
- **FR-007**: A ferramenta de abertura de incidente DEVE aceitar título, serviço e severidade, persistir o incidente no store e retornar o identificador gerado.
- **FR-008**: A ferramenta de resolução de incidente DEVE aceitar um identificador e alterar o estado do incidente para resolvido, retornando erro descritivo se o id não existir.
- **FR-009**: O store in-memory DEVE ser inicializado com dados de seed: 5 serviços e 6 alertas (3 `firing`, 3 `resolved`), carregados por um script de seed dedicado.
- **FR-010**: A estratégia ReAct DEVE utilizar o agente ReAct pré-construído disponível na biblioteca de grafos de agentes, com as ferramentas operacionais disponíveis.
- **FR-011**: A estratégia Plan-and-Execute DEVE funcionar como um grafo com três nós: planejador (gera lista estruturada de passos), executor (executa um passo por vez com as ferramentas) e replanejador (revisa os passos restantes após cada execução; encerra quando não há mais passos).
- **FR-012**: A estratégia Plan-and-Execute DEVE respeitar um limite máximo de 8 passos por execução.
- **FR-013**: Toda estratégia DEVE respeitar um limite configurável de iterações e interromper a execução ao atingi-lo, registrando o estado no trace.
- **FR-014**: A arena DEVE aceitar como parâmetros a lista de estratégias a executar (`--strategies`) e o limite de iterações (`--max-iterations`), executar todas as estratégias sobre o mesmo input e exibir traces e métricas de cada uma.
- **FR-015**: Os schemas de entrada e saída de todas as ferramentas DEVEM ser validados antes de qualquer processamento.

### Key Entities

- **ReasoningStrategy**: Unidade de raciocínio do agente. Possui nome identificador e método de execução que recebe um input em linguagem natural e produz resposta, trace e métricas.
- **TraceEvent**: Evento discreto do processo de raciocínio. Possui tipo (`thought | action | observation | plan | critique | answer`) e conteúdo associado. Eventos de ação carregam ferramenta invocada e argumentos.
- **ExecutionMetrics**: Medidas de desempenho de uma execução: número total de chamadas ao modelo e latência total em milissegundos.
- **Alert**: Registro de um problema detectado em um serviço. Atributos: identificador, serviço, descrição, severidade, status (`firing` | `resolved`).
- **Incident**: Registro de um evento operacional formalizado. Atributos: identificador, título, serviço, severidade, estado (aberto/resolvido).
- **Service**: Entidade de sistema monitorado. Possui nome único e é referenciado por alertas e incidentes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Qualquer estratégia de raciocínio completa uma consulta sobre alertas em menos de 30 segundos em condições normais de conectividade.
- **SC-002**: O trace produzido por uma execução bem-sucedida contém ao menos 3 eventos, sempre terminando com um evento do tipo `answer`.
- **SC-003**: A arena exibe resultado para todas as estratégias solicitadas sem erros não tratados em 100% das execuções com input válido.
- **SC-004**: Os testes determinísticos do store e da formatação de trace passam em 100% das execuções sem dependência de rede.
- **SC-005**: O sistema interrompe qualquer execução que atinja o limite de iterações configurado, sem deixar o processo travado indefinidamente.
- **SC-006**: A cobertura de testes abrange todos os comportamentos do store in-memory e toda a lógica de serialização do trace sem chamadas reais ao modelo.

## Assumptions

- O store in-memory não persiste entre reinicializações do processo; persistência real em MySQL é infraestrutura futura fora do escopo desta feature.
- O modelo de linguagem externo (OpenRouter) estará disponível durante execuções manuais e de integração, mas os testes unitários não dependem de conexão de rede.
- O formato de saída da arena é texto para terminal; nenhuma interface web ou API HTTP faz parte deste escopo.
- A validação de schemas com zod cobre apenas as entradas das ferramentas; a saída do modelo de linguagem é tratada como texto livre a ser interpretado pelo agente.
- A estratégia ReAct é considerada a implementação de referência; Plan-and-Execute é o segundo modo suportado — outros modos podem ser adicionados no futuro respeitando a mesma interface.
- Ações destrutivas (abrir/resolver incidentes) não possuem guardrails nesta fase inicial; controle de acesso será adicionado em feature separada.
