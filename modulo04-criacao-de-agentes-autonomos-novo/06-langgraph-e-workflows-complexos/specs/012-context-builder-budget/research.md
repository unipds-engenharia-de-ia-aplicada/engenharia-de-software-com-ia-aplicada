# Research: ContextBuilder com Orçamento por Seção

**Phase 0 output for** `specs/012-context-builder-budget/plan.md`

---

## Contexto

Hoje `runChat` monta resumo + memórias no `message` e passa `history` bruto (≤8). Strategies anexam `OPSPILOT_SYSTEM_PROMPT` por conta própria. Não há teto por tokens nas seções — só contagem de mensagens e top-K de recall. Spec 012 exige montador único + `CONTEXT_BUDGET_*`.

---

## Decisão 1: Env vars canônicas + defaults

**Decisão**:

| Env | Default | Seção |
|-----|---------|--------|
| `CONTEXT_BUDGET_SUMMARY` | `200` | texto do resumo |
| `CONTEXT_BUDGET_WINDOW` | `1200` | mensagens da janela (soma estimada) |
| `CONTEXT_BUDGET_MEMORIES` | `300` | fatos recallados (soma estimada) |

- Sem `CONTEXT_BUDGET_SYSTEM` / `CONTEXT_BUDGET_MESSAGE` — intocáveis.
- Parse: inteiro finito; se ausente, NaN, não-numérico ou não-finito → **default**.
- Valor **≤ 0** → seção opcional **vazia** (sem itens / resumo `""`).
- Budgets também injetáveis via parâmetro `budgets?: Partial<SectionBudgets>` no builder (testes não dependem de mutar `process.env`).

**Rationale**: Nomes alinhados à spec; fallback seguro; injeção facilita testes.

**Alternatives considered**:

- Prefixo `OPSPILOT_CONTEXT_BUDGET_*` — mais verboso; input pede `CONTEXT_BUDGET_*`.
- Falhar hard em env inválida — pior DX em demos; defaults são fail-safe.

---

## Decisão 2: API do builder + ordem canônica

**Decisão**:

```ts
buildContext(input: ContextBuildInput, options?: { budgets?: Partial<SectionBudgets> }): ContextBuildResult
```

**Entrada** (já selecionada por 008/011 — builder não re-busca store):

- `system: string`
- `summary: string | null`
- `history: ConversationMessage[]` (ordem cronológica ASC ou como `lastMessages` devolve — mais antigas primeiro)
- `memories: RecalledMemory[]`
- `message: string` (mensagem atual **crua**)

**Saída**:

- Seções **após** orçamento: `system`, `summary`, `history`, `memories`, `message` (system/message iguais à entrada)
- `enrichedMessage: string` — envelope para strategies (summary + memories + current), só com seções pós-corte
- Contagens: `historyMessages`, `recalledMemories`
- Textos para breakdown: `historyText`, `memoriesText`, `summaryText` (pós-corte)

**Ordem do envelope `enrichedMessage`** (estável, compatível com 011):

1. `Conversation summary:\n…` (se summary pós-corte não vazio)
2. `Relevant memories:\n- …` (se memórias pós-corte)
3. `Current message:\n…` **ou** só a mensagem se não houver summary nem memories

System **não** entra no `enrichedMessage` — strategies continuam usando `OPSPILOT_SYSTEM_PROMPT` no agente LangChain (system message separado). O builder ainda recebe `system` para métricas/breakdown e para documentar “intocável”.

**Rationale**: Minimiza churn em ReAct/plan-execute/reflect; unifica corte e envelope; FR-002 = único caminho que produz o que a strategy vê no `/chat`.

**Alternatives considered**:

- Builder devolve um único string com system embutido — quebra ReAct (system vs messages).
- Cada strategy chama o builder — duplicaria wire; `runChat` já é o orquestrador.

---

## Decisão 3: Algoritmos de corte

**Unidade**: `estimateTokens` = `Math.floor(text.length / 4)` (010).

### Resumo

- Se `estimateTokens(summary) <= budget` → intacto.
- Senão truncar para no máximo `budget * 4` caracteres (prefixo). Resultado com `estimateTokens <= budget`.

### Janela (histórico)

1. Enquanto `estimateTokens(formatHistoryText(history)) > budget` e `history.length > 1`: remover a mensagem **mais antiga** (`history[0]` se ASC).
2. Se resta 1 mensagem e ainda excede: truncar o **`content`** dessa mensagem para `budget * 4` chars (mensagem “recente preferida”).
3. Budget ≤ 0 → `history = []`.

Custo da seção = `formatHistoryText` (`role: content` por linha), igual ao breakdown atual.

### Memórias

1. Enquanto soma de `formatMemoriesText` > budget e length > 1: remover a de **menor `score`**.
2. Empate de score: remover a de **maior índice na lista de entrada** (desempate estável: preserva as que chegaram primeiro no recall / ordem original).
3. Se resta 1 e ainda excede: truncar o **`fact`** para caber.
4. Budget ≤ 0 → `memories = []`.

Implementação equivalente aceitável: ordenar por `(score DESC, index ASC)` e greedily incluir até não caber — desde que o conjunto final seja o mesmo que “dropar menor score”.

**Rationale**: Spec edge cases; truncar remanescente única evita janela/memória “tudo ou nada” com tetos baixos de teste.

**Alternatives considered**:

- Omitir a mensagem única oversized sem truncar — pior para tetos de teste e perde a mais recente.
- Cortar chars no meio do bloco formatado — menos previsível que cortar itens.

---

## Decisão 4: Onde encaixa no `runChat`

**Decisão** — ordem do turno (011 preservada):

1. resolve conversationId  
2. `maybeSummarize`  
3. `history = lastMessages(8)`; `summary`; `recall`  
4. **`built = buildContext({ system: OPSPILOT_SYSTEM_PROMPT, summary, history, memories: recalled, message })`**  
5. append user (raw)  
6. `strategy.run({ message: built.enrichedMessage, history: built.history })`  
7. append assistant; learning  
8. metrics: `historyMessages = built.historyMessages`, `recalledMemories = built.recalledMemories`, `contextBreakdown` a partir dos textos **pós-corte** (`built.summary`, `built.historyText`, …); `message` no breakdown = mensagem **crua** (intocável), como hoje

Mover `formatMemoriesForPrompt` / uso de `formatSummaryForPrompt` para dentro do builder (ou o builder chama esses helpers). `run-chat` pode reexportar helpers por compatibilidade de testes existentes.

**Rationale**: Orçamento depois da seleção por contagem/recall (spec); métricas FR-010.

**Alternatives considered**: Orçar antes do recall — não faz sentido (ainda não há memórias). Orçar só no breakdown sem cortar prompt — não atende a feature.

---

## Decisão 5: Escopo de “todas as estratégias”

**Decisão**: Qualquer strategy invocada **via `runChat` / HTTP `/chat`** recebe input já orçado. Arena/bench que chamam `strategy.run` direto **fora** de `runChat` continuam sem builder (já pulam enrich 008/011) — fora de escopo desta feature, documentado.

Reflect que re-envolve `message` com feedback de crítica: aplica-se **sobre** o `enrichedMessage` já orçado (comportamento atual); não reabre orçamento na retry.

**Rationale**: Spec fala do caminho de chat; não reescrever arena.

---

## Decisão 6: Relação SUMMARY_TOKEN_TARGET (150) vs CONTEXT_BUDGET_SUMMARY (200)

**Decisão**: Mantêm-se **independentes**.

- `SUMMARY_TOKEN_TARGET ≈ 150` = alvo de **produção** do summarizer (011).
- `CONTEXT_BUDGET_SUMMARY = 200` = teto duro na **composição** (folga se o resumo crescer um pouco).

Se o texto persistido > 200, o builder trunca na montagem (não reescreve o DB).

**Rationale**: Separar “gerar curto” de “nunca injetar acima do teto”.

---

## Resolução de NEEDS CLARIFICATION

Nenhum restante no Technical Context — defaults da spec + decisões acima cobrem env, algoritmos, wire e métricas.
