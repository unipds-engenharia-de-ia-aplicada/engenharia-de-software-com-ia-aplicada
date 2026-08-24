# Feature Specification: ContextBuilder com Orçamento por Seção

**Feature Branch**: `012-context-builder-budget`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "ContextBuilder com orçamento por seção: src/context/context-builder.ts monta o prompt de TODAS as estratégias com teto por seção via env CONTEXT_BUDGET_*: system e mensagem intocáveis, resumo 200, janela 1200 (corta as mais antigas), memórias 300 (corta menor score). Teste: tetos baixos cortam na ordem certa"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Montagem Única do Prompt para Todas as Estratégias (Priority: P1)

Hoje cada caminho de raciocínio (ReAct, reflect, plan-execute, etc.) recebe contexto montado de forma dispersa. O operador do produto precisa de um **único montador de contexto** que, a cada turno, assemble as seções do prompt (system, resumo, janela de histórico, memórias, mensagem atual) e entregue o texto final a **qualquer** estratégia — sem duplicar regras de composição.

**Why this priority**: Sem ponto único, orçamentos e cortes ficam inconsistentes entre estratégias; é a base de todas as outras histórias.

**Independent Test**: Invocar o montador com as mesmas seções de entrada e assertar o mesmo prompt estruturado, independentemente de qual estratégia consumirá o resultado (harness sem LLM).

**Acceptance Scenarios**:

1. **Given** seções de contexto disponíveis (system, resumo opcional, histórico, memórias, mensagem), **When** o montador roda, **Then** produz um prompt único contendo essas seções na ordem canônica documentada.
2. **Given** qualquer estratégia suportada pelo produto, **When** um turno de chat usa essa estratégia, **Then** o prompt que ela recebe veio do mesmo montador (não de um caminho paralelo ad hoc).
3. **Given** seções ausentes (sem resumo, sem histórico, sem memórias), **When** o montador roda, **Then** omite blocos vazios (ou equivalente documentado) e ainda inclui system + mensagem atual.

---

### User Story 2 — Tetos por Seção Configuráveis (Priority: P1)

Cada seção opcional do contexto tem um **teto de tokens estimados** configurável por variável de ambiente `CONTEXT_BUDGET_*`. Defaults: **resumo 200**, **janela 1200**, **memórias 300**. As seções **system** e **mensagem atual** são **intocáveis**: nunca são truncadas nem removidas pelo orçamento.

**Why this priority**: Controlar o tamanho do contexto por fonte é o valor central da feature; evita explosão silenciosa do prompt em plantões longos.

**Independent Test**: Com tetos default e conteúdos que cabem, o prompt resultante respeita cada teto (medido com a estimativa canônica de tokens do projeto); com system/mensagem longos, eles permanecem íntegros mesmo se somados excederem qualquer teto de seção opcional.

**Acceptance Scenarios**:

1. **Given** defaults ativos, **When** o montador aplica orçamento, **Then** resumo ≤ 200, janela ≤ 1200 e memórias ≤ 300 tokens estimados (ou omitidos se vazios).
2. **Given** `CONTEXT_BUDGET_*` definidos com valores customizados, **When** o montador roda, **Then** usa esses tetos no lugar dos defaults.
3. **Given** system e/ou mensagem atual maiores que qualquer teto de seção opcional, **When** o orçamento é aplicado, **Then** system e mensagem permanecem **completos** (sem corte).

---

### User Story 3 — Cortes Determinísticos na Ordem Certa (Priority: P1)

Quando uma seção excede o teto, o montador corta de forma previsível:

- **Janela (histórico)**: remove as mensagens **mais antigas** primeiro, até caber no orçamento.
- **Memórias**: remove as de **menor score** primeiro, até caber no orçamento.
- **Resumo**: reduz o texto do resumo até caber no orçamento (sem alterar system/mensagem).

**Why this priority**: “Tetos baixos cortam na ordem certa” é o critério de aceite explícito do input; comportamento determinístico é essencial para testes e demos.

**Independent Test**: Com tetos artificialmente baixos e entradas controladas (histórico ordenado por tempo, memórias com scores distintos, resumo longo), assertar exatamente quais itens/trechos sobrevivem.

**Acceptance Scenarios**:

1. **Given** janela com N mensagens cuja soma estimada > teto, **When** o orçamento aplica, **Then** as mensagens mais recentes que cabem permanecem e as mais antigas são descartadas primeiro.
2. **Given** memórias com scores distintos cuja soma > teto, **When** o orçamento aplica, **Then** as de maior score que cabem permanecem e as de menor score saem primeiro (empate: plano fixa desempate estável).
3. **Given** resumo cujo tamanho estimado > teto, **When** o orçamento aplica, **Then** o texto do resumo é encurtado até ≤ teto e system + mensagem atual permanecem intactos.
4. **Given** tetos baixos em todas as seções opcionais, **When** o montador roda, **Then** os cortes respeitam as regras acima **simultaneamente** (ordem correta por seção).

---

### User Story 4 — Testes de Orçamento e Ordem de Corte (Priority: P1)

Desenvolvedores validam tetos e ordem de corte **sem rede LLM**: fixtures com textos/scores conhecidos, estimativa de tokens do projeto, tetos baixos forçados.

**Why this priority**: Constitution — teste é parte da tarefa; o input exige teste explícito da ordem de corte.

**Independent Test**: `npm test` cobre montador + orçamento; `npm run typecheck` verde.

**Acceptance Scenarios**:

1. **Given** tetos baixos e fixtures controladas, **When** a suíte roda, **Then** passa asserções de: system/mensagem intactos; janela sem as mais antigas; memórias sem as de menor score; resumo ≤ teto.
2. **Given** conteúdos que já cabem nos tetos, **When** a suíte roda, **Then** nenhum item é removido desnecessariamente.

---

### Edge Cases

- O que acontece se o teto da janela for 0 (ou inválido negativo)? MUST tratar como “sem mensagens de janela” (ou rejeitar config inválida de forma documentada); default seguro: **valores ≤ 0 ⇒ seção opcional vazia**.
- O que acontece se uma única mensagem recente sozinha excede o teto da janela? MUST ainda preferir a mais recente: incluir o máximo possível dessa mensagem (truncar conteúdo) **ou** omitir a janela se truncamento por mensagem for fora de escopo — default: **truncar o conteúdo da mensagem remanescente** até caber.
- O que acontece com empate de score em memórias? MUST desempate **estável e documentado** (ex.: manter ordem de entrada / id).
- O que acontece se `CONTEXT_BUDGET_*` for não-numérico? MUST cair nos defaults (ou falhar na borda com erro claro); default: **fallback para defaults**.
- O que acontece sem resumo / sem memórias / sem histórico? MUST omitir a seção; não inventar texto.
- Relação com a janela de 8 msgs (`011`) e recall de memórias (`008`): o orçamento por tokens **aplica-se depois** (ou em conjunto documentado) da seleção por contagem/recall — o montador nunca reintroduz mensagens já fora da janela de 8 nem memórias não recalladas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST expor um montador de contexto em `src/context/context-builder.ts` que assemble o prompt a partir das seções: system, resumo, janela de histórico, memórias e mensagem atual.
- **FR-002**: **Todas** as estratégias de chat MUST obter o prompt de usuário/contexto via esse montador (ponto único de composição).
- **FR-003**: O montador MUST aplicar tetos por seção via variáveis de ambiente `CONTEXT_BUDGET_*`, com defaults: resumo **200**, janela **1200**, memórias **300** (tokens estimados pela regra canônica do projeto — `estimateTokens` / chars÷4).
- **FR-004**: As seções **system** e **mensagem atual** MUST ser **intocáveis**: o orçamento NÃO as trunca nem remove.
- **FR-005**: Quando a janela exceder o teto, o montador MUST remover mensagens **mais antigas primeiro** até caber (e truncar a remanescente se uma só ainda exceder — ver Edge Cases).
- **FR-006**: Quando as memórias excederem o teto, o montador MUST remover as de **menor score primeiro** até caber.
- **FR-007**: Quando o resumo exceder o teto, o montador MUST encurtar o texto do resumo até caber no orçamento.
- **FR-008**: Nomes exatos das env vars (`CONTEXT_BUDGET_SUMMARY`, `CONTEXT_BUDGET_WINDOW`, `CONTEXT_BUDGET_MEMORIES` ou equivalente) MUST ser fixados no plano e documentados; leitura na inicialização/composição com fallback aos defaults.
- **FR-009**: DEVE existir suíte de testes sem rede cobrindo: defaults; tetos baixos com ordem de corte correta (antigas / menor score / resumo); system e mensagem intactos; conteúdos que cabem sem corte indevido.
- **FR-010**: Métricas existentes (`contextBreakdown`, `historyMessages`, `recalledMemories`) MUST refletir o que **de fato** entrou no prompt após o orçamento (não o pré-corte).

### Key Entities

- **Context Section**: Uma das partes do prompt (system, summary, window, memories, message) com conteúdo e, quando aplicável, teto de tokens.
- **Section Budget**: Limite de tokens estimados por seção opcional, vindo de env ou default.
- **Built Prompt**: Resultado do montador após aplicação de orçamentos — entrada comum de todas as estratégias.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em fixtures com tetos baixos, 100% dos casos de teste da ordem de corte passam (janela: antigas primeiro; memórias: menor score primeiro; system/mensagem intactos).
- **SC-002**: Com defaults, resumo/janela/memórias no prompt nunca ultrapassam 200 / 1200 / 300 tokens estimados respectivamente.
- **SC-003**: Toda estratégia suportada consome o mesmo montador — zero caminhos paralelos de composição de prompt após a feature.
- **SC-004**: Conteúdos que já cabem nos tetos permanecem completos (0 remoções desnecessárias nos testes de regressão).

## Assumptions

- A estimativa de tokens reutiliza `estimateTokens` da feature `010-context-measurement` (chars/4).
- Coexiste com `011-history-summarization` (janela de 8 + resumo) e `008-semantic-memory` (recall por score): o orçamento é uma camada de teto sobre o que já foi selecionado.
- Nomes canônicos sugeridos das env: `CONTEXT_BUDGET_SUMMARY`, `CONTEXT_BUDGET_WINDOW`, `CONTEXT_BUDGET_MEMORIES` (plano confirma).
- System não tem `CONTEXT_BUDGET_SYSTEM` de corte — intocável por requisito.
- Ordem canônica das seções no prompt final fica para o plano (ex.: system → summary → window → memories → message), desde que estável e testável.
- Fora de escopo: orçamento global único (só por seção); compressão semântica avançada além de truncar/remover; UI para editar tetos.
