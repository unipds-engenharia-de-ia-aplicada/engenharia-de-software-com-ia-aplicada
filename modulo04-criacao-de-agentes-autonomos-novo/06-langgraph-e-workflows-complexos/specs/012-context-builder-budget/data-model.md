# Data Model: ContextBuilder com Orçamento por Seção

**Phase 1 output for** `specs/012-context-builder-budget/plan.md`

Sem persistência nova. Entidades são estruturas em memória na composição do turno.

---

## Entities

### SectionBudgets

| Field | Type | Default | Constraints |
|-------|------|---------|-------------|
| `summary` | `number` | `200` | Inteiro; ≤0 ⇒ resumo vazio no prompt |
| `window` | `number` | `1200` | Inteiro; ≤0 ⇒ janela vazia |
| `memories` | `number` | `300` | Inteiro; ≤0 ⇒ sem memórias no prompt |

Origem: `CONTEXT_BUDGET_SUMMARY` / `CONTEXT_BUDGET_WINDOW` / `CONTEXT_BUDGET_MEMORIES`, ou override em options.

---

### ContextBuildInput

| Field | Type | Notes |
|-------|------|-------|
| `system` | `string` | Tipicamente `OPSPILOT_SYSTEM_PROMPT` — intocável |
| `summary` | `string \| null` | Texto persistido (011); null/blank ⇒ omitir |
| `history` | `ConversationMessage[]` | Já limitado a ≤8 (011); ordem mais antiga → mais recente |
| `memories` | `RecalledMemory[]` | Já recallados (008); incluem `score` |
| `message` | `string` | Mensagem atual crua — intocável |

---

### ContextBuildResult

| Field | Type | Notes |
|-------|------|-------|
| `system` | `string` | Igual à entrada |
| `message` | `string` | Igual à entrada (crua) |
| `summary` | `string` | Pós-orçamento (possivelmente `""`) |
| `history` | `ConversationMessage[]` | Pós-corte (conteúdo pode estar truncado na última) |
| `memories` | `RecalledMemory[]` | Pós-corte (fact pode estar truncado) |
| `enrichedMessage` | `string` | Envelope summary → memories → current |
| `historyMessages` | `number` | `history.length` pós-corte |
| `recalledMemories` | `number` | `memories.length` pós-corte |
| `historyText` | `string` | Para breakdown |
| `memoriesText` | `string` | Para breakdown |
| `summaryText` | `string` | Alias de `summary` pós-corte para breakdown |

---

### Context Section (conceitual)

| Section | Budgeted? | Cut rule |
|---------|-----------|----------|
| system | Não | Nunca corta |
| message | Não | Nunca corta |
| summary | Sim | Truncar prefixo até ≤ budget tokens |
| window | Sim | Dropar mais antigas; truncar remanescente se preciso |
| memories | Sim | Dropar menor score (empate: maior índice); truncar fact se preciso |

---

## Validation rules

- Tokens: sempre `estimateTokens` (chars/4 floor).
- Truncamento de string: `text.slice(0, budget * 4)` (garante `estimateTokens <= budget` para budget ≥ 0).
- Env inválida → default da seção.
- Builder **não** reintroduz mensagens fora da janela 8 nem memórias não recalladas.

---

## State / flow (turno)

```text
[008/011 selection]
  history ≤ 8, summary?, recalled[]
        │
        ▼
buildContext(input, budgets)
  → cut summary / window / memories
  → enrichedMessage
        │
        ▼
strategy.run({ message: enrichedMessage, history })
metrics from pós-corte
```

---

## Relationships

```text
ContextBuildInput
  ├── uses ConversationMessage (007)
  ├── uses RecalledMemory (008)
  └── uses summary text (011)

ContextBuildResult ──► StrategyRunInput (message + history)
                   └──► ExecutionMetrics (historyMessages, recalledMemories, contextBreakdown)
```
