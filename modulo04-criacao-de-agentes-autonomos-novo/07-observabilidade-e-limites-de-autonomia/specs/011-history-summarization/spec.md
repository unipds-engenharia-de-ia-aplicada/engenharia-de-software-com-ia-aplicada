# Feature Specification: Sumarização de Histórico (Pruning)

**Feature Branch**: `011-history-summarization`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Sumarização de histórico (pruning): tabela conversation_summaries; o que sai das 8 mensagens recentes vira resumo de ˜150 tokens preservando decisões, fatos e pendencias, MESCLADO ao resumo anterior e persistido - refeito só quando 8 novas saem da janela, nunca a cada request. Resumo entra no contexto; evento \"summarize\". Com teste fake"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Janela Recente de 8 + Resumo do Que Saiu (Priority: P1)

Em conversas longas de plantão, o agente deixa de carregar o histórico bruto completo. Mantém só as **8 mensagens mais recentes** no prompt e, quando houver conteúdo mais antigo, inclui um **resumo persistido** daquilo que já saiu da janela — preservando decisões, fatos e pendências relevantes (~150 tokens).

**Why this priority**: Sem pruning, o contexto explode (já observável via medição de tokens); o valor imediato é contexto estável e útil em conversas longas.

**Independent Test**: Com store `:memory:` e sumarizador fake, popular > 8 mensagens, executar um turno e assertar: exatamente 8 mensagens brutas no input da estratégia + bloco de resumo presente quando houver summary persistido.

**Acceptance Scenarios**:

1. **Given** conversa com ≤ 8 mensagens de histórico (antes do turno), **When** `/chat` roda, **Then** todas entram como histórico bruto, **sem** obrigatoriedade de resumo, e `historyMessages` reflete esse total (≤ 8).
2. **Given** conversa com resumo persistido e > 8 mensagens, **When** um turno roda, **Then** o prompt/contexto da estratégia inclui o texto do resumo **e** as 8 mensagens mais recentes.
3. **Given** conversa sem resumo ainda (nada saiu da janela em lote elegível), **When** o turno roda com ≤ 8 msgs fora da janela acumuladas de forma insuficiente, **Then** não inventa resumo vazio obrigatório no prompt (omite bloco ou equivalente documentado).

---

### User Story 2 — Resumo Só Quando 8 Novas Saem da Janela (Priority: P1)

O sistema **não** regenera o resumo a cada request. Só produz/atualiza o resumo quando **8 mensagens novas** tiverem saído da janela recente desde a última sumarização. O lote que saiu é condensado (~150 tokens, decisões/fatos/pendências), **mesclado** ao resumo anterior (se existir) e gravado na tabela `conversation_summaries`.

**Why this priority**: Evita custo LLM e churn a cada turno; o “pruning em lotes de 8” é o coração da feature.

**Independent Test**: Fake summarizer com contador de chamadas: após N turnos que ainda não completam 8 saídas, `summarize` **0** vezes; ao completar o lote de 8 fora da janela, **1** chamada; turnos seguintes sem novo lote completo → ainda **0** chamadas adicionais.

**Acceptance Scenarios**:

1. **Given** conversa com exatamente 8 mensagens no histórico (janela cheia, nada fora), **When** vários turnos ocorrem sem completar 8 saídas, **Then** o sumarizador **não** é invocado.
2. **Given** 8 mensagens acabaram de sair da janela (há 8+8 = 16 msgs no total, watermark zerado), **When** o turno que completa essa condição roda, **Then** o sumarizador é chamado **uma** vez com o lote saído (+ resumo anterior se houver), o resultado é persistido, e um evento de trace `summarize` é registrado.
3. **Given** resumo já existente cobrindo o primeiro lote, **When** ainda não há 8 novas saídas, **Then** requests reutilizam o resumo persistido **sem** nova chamada ao sumarizador.
4. **Given** segundo lote de 8 saídas, **When** a condição dispara, **Then** o novo texto é **mesclado** ao resumo anterior (entrada = anterior + lote) e o registro em `conversation_summaries` é atualizado.

---

### User Story 3 — Persistência `conversation_summaries` + Trace `summarize` (Priority: P1)

Cada conversa pode ter um resumo persistido (SQLite, padrão do projeto) com metadados suficientes para saber até onde o histórico já foi coberto (watermark). Quando a sumarização ocorre no turno, o `trace` da resposta inclui um evento do tipo **`summarize`** (conteúdo = resumo produzido ou resumo do merge, conforme contrato do plano).

**Why this priority**: Sem persistência e observabilidade, o pruning não sobrevive entre requests nem é auditável.

**Independent Test**: Após disparo com fake, ler o store da conversa e ver linha em `conversation_summaries`; resposta `/chat` ou resultado de `runChat` contém evento `type: "summarize"`.

**Acceptance Scenarios**:

1. **Given** sumarização disparada com sucesso, **When** o turno completa, **Then** existe registro em `conversation_summaries` para aquele `conversationId` com texto do resumo e watermark atualizado.
2. **Given** o mesmo `conversationId` em request seguinte, **When** carrega contexto, **Then** reutiliza o resumo gravado (mesmo texto, sem recompute).
3. **Given** disparo de sumarização no turno, **When** a resposta é montada, **Then** `trace` contém ≥ 1 evento `summarize`.

---

### User Story 4 — Testes com Sumarizador Fake (Priority: P1)

Desenvolvedores validam a lógica de janela, watermark, merge e injeção **sem LLM real**: sumarizador injetável/fake (determinístico), store `:memory:`, estratégia fake.

**Why this priority**: Constitution — teste é parte da tarefa; “Com teste fake” no input.

**Independent Test**: `npm test` cobre fake summarizer + não-disparo + disparo em lote de 8 + merge + evento `summarize` + injeção no contexto.

**Acceptance Scenarios**:

1. **Given** fake que concatena/marca o lote, **When** o primeiro lote de 8 sai, **Then** o texto persistido reflete o fake e o contador do fake = 1.
2. **Given** segundo lote, **When** merge ocorre, **Then** a entrada do fake inclui o resumo anterior + o novo lote (ou contrato equivalente documentado).
3. **Given** turnos sem lote completo, **When** a suíte roda, **Then** fake não é chamado.

---

### Edge Cases

- O que acontece se o sumarizador falhar (throw / timeout)? MUST NÃO quebrar o turno de chat: manter resumo anterior (se houver), seguir com as 8 recentes; plano documenta se o evento `summarize` registra falha ou se omite — default: **não falhar o 200**; watermark **não** avança se o merge não persistiu.
- O que acontece com exatamente 8 mensagens fora da janela? MUST disparar sumarização (limiar inclusivo: lote de **8**).
- O que acontece com 9–15 mensagens fora desde o watermark? MUST sumarizar apenas quando o acumulado de saídas ≥ 8; o plano fixa se processa de 8 em 8 (só o próximo lote de 8) ou espera — default: **processar o próximo lote contíguo de 8** a partir do watermark, no máximo um lote por turno (simples e previsível).
- O que acontece na primeira mensagem de conversa nova? MUST sem resumo, `historyMessages` 0, sem evento `summarize`.
- O que acontece com o limite antigo de 12 (`007`)? MUST esta feature **substituir** a janela bruta injetada para **8** mensagens (+ resumo); `historyMessages` passa a contar só as brutas injetadas (≤ 8). Memória semântica (`008`) e métricas de tokens (`010`) continuam; breakdown/history text refletem a nova composição.
- O que é “~150 tokens”? MUST o sumarizador mirar resumo curto (~150 tokens; ex. via instrução ao LLM ou truncamento/`estimateTokens` no fake) — plano detalha enforcement; testes fake podem fixar tamanho aproximado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST persistir resumos por conversa na tabela **`conversation_summaries`** (SQLite `node:sqlite` / `DatabaseSync`, DDL idempotente, prepared statements), no mesmo DB/`OPSPILOT_DB` do projeto.
- **FR-002**: A composição de `/chat` MUST injetar no contexto as **até 8** mensagens mais recentes (janela bruta) e, quando existir, o **resumo persistido** da conversa.
- **FR-003**: `metrics.historyMessages` MUST continuar significando quantas mensagens **brutas** foram injetadas (agora teto **8**).
- **FR-004**: O sistema MUST manter um **watermark** (ex.: contagem ou id de mensagens já cobertas pelo resumo) para saber o que já saiu e foi sumarizado.
- **FR-005**: O sumarizador MUST ser invocado **somente** quando ≥ **8** mensagens novas tiverem saído da janela desde o watermark — **nunca** a cada request por padrão.
- **FR-006**: Ao sumarizar, o sistema MUST produzir um resumo de ~**150 tokens** preservando **decisões, fatos e pendências**, **mesclar** com o resumo anterior (se houver), e **persistir** o resultado em `conversation_summaries` atualizando o watermark.
- **FR-007**: Quando a sumarização ocorrer com sucesso no turno, o `trace` MUST incluir um evento com `type: "summarize"`.
- **FR-008**: O sumarizador MUST ser injetável; testes MUST usar implementação **fake** (sem rede LLM).
- **FR-009**: Falha do sumarizador MUST ser fail-safe para o turno (resposta do agente segue; watermark só avança após persistência bem-sucedida).
- **FR-010**: DEVE existir suíte de testes `:memory:` + fake cobrindo: sem disparo, disparo no lote de 8, merge com resumo anterior, evento `summarize`, injeção do resumo no contexto da estratégia.

### Key Entities

- **ConversationSummary**: Resumo persistido de uma conversa. Atributos: `conversationId`, texto do resumo, watermark (mensagens cobertas), `updatedAt` (ou equivalente).
- **Summarizer** (porta): Função/serviço `(previousSummary, messagesBatch) => newSummary` — LLM em produção, fake em teste.
- **RecentWindow**: As 8 mensagens mais recentes injetadas em bruto.
- **TraceEvent `summarize`**: Evento de auditoria quando um merge/resumo foi produzido no turno.
- **ChatTurn context** (estendido): resumo opcional + history ≤ 8 (+ memórias semânticas existentes).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em testes com fake, o sumarizador é chamado **0** vezes em turnos sem lote completo de 8 saídas, e **1** vez ao completar o primeiro lote.
- **SC-002**: Após o primeiro lote, o resumo persistido reaparece no contexto dos turnos seguintes **sem** nova chamada ao fake até o próximo lote de 8.
- **SC-003**: No disparo, `trace` contém evento `summarize` e `conversation_summaries` tem o texto esperado do fake (incluindo merge no segundo lote).
- **SC-004**: Com histórico longo, a estratégia fake recebe no máximo **8** mensagens brutas de histórico por turno (`historyMessages` ≤ 8) e o texto de resumo quando aplicável.
- **SC-005**: `npm test` e `npm run typecheck` permanecem verdes com a suíte desta feature.

## Assumptions

- Janela bruta desta feature = **8** mensagens (substitui o teto 12 de `007` na injeção de histórico bruto).
- “~150 tokens” = alvo de tamanho do texto do resumo (heurística chars/4 / instrução ao modelo); o plano fixa enforcement.
- Um lote processado por turno no máximo; watermark avança só após persistência OK.
- Sumarização roda no caminho do turno (antes ou depois do append — plano escolhe; default sugerido: **após** ter o histórico estável / ao montar contexto do turno seguinte ao acumular saídas, tipicamente **no início** do turno quando a condição já é verdadeira com as mensagens já persistidas).
- Fake summarizer obrigatório nos testes; LLM real opcional no bootstrap de produção.
- Coexiste com memória semântica (`008`), learning reflector (`009`) e métricas de contexto (`010`); o resumo é fonte adicional de contexto (breakdown pode ganhar chave `summary` no plano, opcional nesta spec).
- Extensão do union `TraceEventType` com `"summarize"` é esperada.
