# Feature Specification: Medição de Contexto

**Feature Branch**: `010-context-measurement`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Instrumente a medição de contexto: src/context/tokens.ts com estimateTokens (chars/4) e o usage real do LangChain; métricas do /chat com promptTokens real e contextBreakdown estimado por fontes; conversa-longa.sh imprime o promptTokens por turno. Com testes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Estimar e Ler Uso de Tokens (Priority: P1)

Um desenvolvedor (ou qualquer camada do produto) precisa medir o tamanho do contexto de duas formas: (1) estimativa rápida e determinística a partir do texto (`chars / 4`), e (2) leitura do uso real reportado pelo provedor/LLM via LangChain quando a chamada existir. Isso permite comparar estimativa vs. realidade sem adivinhar totais no console.

**Why this priority**: Sem utilitário central, cada script e métrica inventa sua própria conta; a estimativa e o uso real são a base de todas as outras histórias.

**Independent Test**: Testes unitários de `estimateTokens` com strings conhecidas; teste que extrai `promptTokens` (e campos correlatos) a partir de um objeto de usage no formato LangChain, sem rede.

**Acceptance Scenarios**:

1. **Given** um texto de comprimento N caracteres, **When** se chama a estimativa, **Then** o resultado é `floor(N / 4)` (ou a regra canônica documentada no plano, consistente em todo o projeto).
2. **Given** um usage LangChain com contagem de tokens de prompt, **When** o utilitário lê o usage, **Then** devolve o número real de prompt tokens (e, se disponível, completion/total) sem recalcular pelo texto.
3. **Given** usage ausente ou malformado, **When** a leitura roda, **Then** o comportamento é seguro e testável (retorno vazio/`undefined`/zeros — plano fixa; não lança de forma não tratada).

---

### User Story 2 — Métricas de Contexto no `/chat` (Priority: P1)

Cada resposta bem-sucedida de `POST /chat` inclui, em `metrics`, o total real de tokens de prompt da execução (`promptTokens`) e um `contextBreakdown` estimado por fonte do contexto montado para aquele turno (ex.: system prompt, histórico, memórias recordadas, mensagem atual). O plantonista ou o operador de demo vê quanto cada fonte “pesa” sem abrir o provedor.

**Why this priority**: É o valor observável da feature para quem usa o HTTP; alimenta o script longo e regressões de composição.

**Independent Test**: Com estratégia fake (ou harness que injeta usage), executar `/chat` e assertar presença e formato de `promptTokens` e `contextBreakdown`; com estratégia real/mock de LLM, assertar que `promptTokens` reflete o usage reportado.

**Acceptance Scenarios**:

1. **Given** um turno `/chat` bem-sucedido com usage de prompt disponível, **When** a resposta `200` é devolvida, **Then** `metrics.promptTokens` é o inteiro ≥ 0 proveniente do usage real (não da estimativa chars/4).
2. **Given** um turno com fontes de contexto conhecidas (histórico, memórias, mensagem, system), **When** as métricas são montadas, **Then** `metrics.contextBreakdown` lista contribuições estimadas por fonte (tokens ≈ chars/4), e a soma das partes é coerente com o texto estimado daquelas fontes.
3. **Given** turno sem histórico e sem memórias, **When** `/chat` responde, **Then** as entradas correspondentes no breakdown são `0` (ou omitidas de forma documentada) e as demais fontes ainda aparecem quando aplicáveis.
4. **Given** as métricas já existentes (`llmCalls`, `latencyMs`, `historyMessages`, `recalledMemories`), **When** a feature entra, **Then** elas permanecem e os novos campos são aditivos.

---

### User Story 3 — Script Longo Mostra `promptTokens` por Turno (Priority: P2)

O script `scripts/conversa-longa.sh` (demo de muitos turnos no mesmo `conversationId`) imprime, a cada turno, o `promptTokens` real vindo de `metrics` da resposta `/chat`, além das informações já úteis (histórico, memórias). Quem roda a demo vê o crescimento do contexto ao longo do plantão.

**Why this priority**: Fecha o loop de observabilidade operacional; depende das métricas HTTP.

**Independent Test**: Com servidor mock ou resposta JSON fixa contendo `metrics.promptTokens`, o script (ou trecho documentado) imprime o valor por turno; regressão manual/CI opcional conforme plano.

**Acceptance Scenarios**:

1. **Given** uma resposta `/chat` com `metrics.promptTokens` numérico, **When** o script processa o turno, **Then** a linha do turno inclui esse valor (rótulo claro, ex. `promptTokens=`).
2. **Given** `promptTokens` ausente na resposta, **When** o script processa o turno, **Then** imprime um fallback legível (ex. `n/a` ou `0`) sem abortar o loop só por métrica faltante.

---

### User Story 4 — Testes Cobrem Estimativa, Usage e Métricas (Priority: P1)

Nenhuma lógica nova entra sem teste: estimativa chars/4, parsing de usage LangChain, e exposição de `promptTokens` + `contextBreakdown` no fluxo `/chat` (fake/harness, sem rede quando possível).

**Why this priority**: Constitution — teste é parte da tarefa; evita regressão silenciosa nas métricas.

**Independent Test**: `npm test` cobre os módulos de tokens e asserções de métricas no chat; `npm run typecheck` verde.

**Acceptance Scenarios**:

1. **Given** a suíte da feature, **When** `npm test` roda, **Then** passam testes de `estimateTokens`, leitura de usage, e presença/formato das métricas de contexto no `/chat`.
2. **Given** strings de tamanho 0, 1, 3, 4, 5, **When** a estimativa roda, **Then** os resultados batem com a regra `chars/4` canônica.

---

### Edge Cases

- O que acontece quando o provedor não devolve usage? MUST NÃO falhar o turno; `promptTokens` omisso/`undefined`/null conforme contrato do plano; breakdown estimado ainda MUST ser calculável a partir do texto das fontes.
- O que acontece com texto vazio ou só whitespace? MUST estimar `0` tokens (ou floor coerente) sem erro.
- O que acontece com múltiplas chamadas LLM no mesmo turno (ReAct, reflect, plan-execute)? MUST definir no plano se `promptTokens` é soma de todas as chamadas do turno, só a última, ou só a chamada “principal”; default desta spec: **soma de todos os prompt tokens reportados nas chamadas LLM daquele turno**.
- O que acontece se uma fonte de breakdown for desconhecida no futuro? MUST permitir extensão do mapa de fontes sem quebrar clientes (campos aditivos).
- O que acontece se chars não forem ASCII (UTF-8 multibyte)? MUST usar comprimento em caracteres do runtime do utilitário de forma documentada e testada (default: contagem de code units da string JS, alinhada ao restante do projeto).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST disponibilizar um módulo de medição de contexto (`src/context/tokens.ts`) com `estimateTokens(text)` usando a regra **caracteres / 4** (inteiro, regra de arredondamento única e testada).
- **FR-002**: O mesmo módulo MUST oferecer leitura do usage real LangChain (prompt / completion / total quando presentes) a partir do objeto de usage ou da mensagem/resposta do modelo.
- **FR-003**: Em sucesso, `POST /chat` MUST incluir em `metrics` o campo `promptTokens` (inteiro ≥ 0 quando usage disponível) refletindo o uso **real** do LLM, não a estimativa chars/4.
- **FR-004**: Em sucesso, `POST /chat` MUST incluir em `metrics` o campo `contextBreakdown`: mapa (ou objeto equivalente) de fontes de contexto → tokens **estimados** via `estimateTokens` sobre o texto de cada fonte.
- **FR-005**: O `contextBreakdown` MUST cobrir, no mínimo, as fontes já presentes na composição do turno: **system** (prompt de sistema), **history** (mensagens de histórico injetadas), **memories** (fatos recordados injetados), **message** (mensagem atual do usuário, antes ou depois do envelope de memórias — plano fixa uma definição e os testes a cobrem).
- **FR-006**: As métricas existentes (`llmCalls`, `latencyMs`, `historyMessages`, `recalledMemories`) MUST continuar presentes e corretas; novos campos são aditivos.
- **FR-007**: `scripts/conversa-longa.sh` MUST imprimir `promptTokens` por turno a partir de `metrics` da resposta JSON.
- **FR-008**: DEVE existir suíte de testes cobrindo `estimateTokens`, parsing/agregação de usage, e métricas `promptTokens` + `contextBreakdown` no fluxo `/chat` (estratégia fake / usage injetável, sem rede quando o harness permitir).
- **FR-009**: Quando usage real estiver indisponível, o turno MUST completar normalmente; o contrato de `promptTokens` ausente vs. `0` MUST ser documentado no plano e coberto por teste.

### Key Entities

- **TokenEstimate**: Valor inteiro derivado de texto pela regra chars/4.
- **LlmUsage**: Contagem real reportada pelo provedor (prompt, completion, total) via LangChain.
- **ContextBreakdown**: Contribuição estimada por fonte de contexto (`system`, `history`, `memories`, `message`, …).
- **ExecutionMetrics** (estendido): Campos atuais mais `promptTokens?` e `contextBreakdown?`.
- **ChatResponse.metrics** (estendido): Espelha as métricas de execução do turno para o cliente HTTP e o script de demo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos casos de teste da estimativa, `estimateTokens` coincide com a regra chars/4 canônica (incluindo bordas 0 e comprimentos não múltiplos de 4).
- **SC-002**: Em turnos de teste com usage injetado/conhecido, `metrics.promptTokens` na resposta `/chat` iguala o total real esperado (soma do turno) em 100% dos casos cobertos.
- **SC-003**: Em turnos de teste com fontes controladas, cada chave do `contextBreakdown` bate com `estimateTokens` do texto daquela fonte; a soma das partes não contradiz as fontes montadas.
- **SC-004**: Executando o fluxo do `conversa-longa.sh` (ou equivalente documentado) contra respostas com `promptTokens`, cada linha de turno exibe o valor correspondente sem falha por parsing.
- **SC-005**: `npm test` e `npm run typecheck` permanecem verdes com a suíte desta feature incluída.

## Assumptions

- A regra de estimativa é **chars / 4** com truncamento para inteiro (`Math.floor`), salvo se o plano alinhar explicitamente ao arredondamento para cima já usado no script bash — nesse caso a regra canônica do módulo TypeScript prevalece e o script/comentários se alinham a ela.
- Fontes mínimas do breakdown: `system`, `history`, `memories`, `message`; fontes extras (tools schema, critique, etc.) são opcionais nesta versão.
- `promptTokens` agrega **todas** as chamadas LLM do turno quando houver mais de uma.
- Estratégias fake em teste podem injetar usage sintético; produção obtém usage do LangChain/OpenRouter quando o provedor o envia.
- Não muda o comportamento do agente nem o conteúdo das respostas — apenas observabilidade/métricas e o script de demo.
- Dependências: composição atual de `/chat` (histórico 007, memórias 008, system prompt compartilhado) e `ExecutionMetrics` existente.
