# Data Model: Medição de Contexto

**Phase 1 output for** `specs/010-context-measurement/plan.md`

---

## Entities

### TokenEstimate

Valor inteiro derivado de texto. Não persistido.

| Campo | Tipo | Regras |
|-------|------|--------|
| (valor) | `number` (int ≥ 0) | `Math.floor(text.length / 4)` |

---

### LlmUsage

Contagem real reportada pelo provedor/LangChain. Não persistido.

| Campo | Tipo | Regras |
|-------|------|--------|
| `promptTokens` | `number` (int ≥ 0) | Obrigatório quando o objeto existe |
| `completionTokens` | `number?` | Se disponível |
| `totalTokens` | `number?` | Se disponível |

Fontes de parse (ordem): `usage_metadata` → `response_metadata.tokenUsage` → campos flat.

---

### ContextBreakdown

Contribuição **estimada** por fonte no turno `/chat`.

| Campo | Tipo | Texto fonte |
|-------|------|-------------|
| `system` | `number` | `OPSPILOT_SYSTEM_PROMPT` |
| `history` | `number` | Mensagens de histórico injetadas (sem mensagem atual) |
| `memories` | `number` | Fatos recordados (conteúdo dos facts) |
| `message` | `number` | Mensagem crua do usuário |

Todas as chaves sempre presentes; `0` se fonte vazia.

---

### ExecutionMetrics (estendido)

| Campo | Tipo | Notas |
|-------|------|-------|
| `llmCalls` | `number` | existente |
| `latencyMs` | `number` | existente |
| `historyMessages` | `number?` | existente (`/chat`) |
| `recalledMemories` | `number?` | existente (`/chat`) |
| **`promptTokens`** | `number?` | **NOVO** — usage real; omitir se indisponível |
| **`contextBreakdown`** | `ContextBreakdown?` | **NOVO** — sempre setado por `runChat` |

---

## Fluxo de estado (turno /chat)

```text
runChat:
  history, recalled, enrichedMessage = ...
  result = strategy.run(...)   // metrics.promptTokens? da strategy
  breakdown = {
    system:   estimateTokens(OPSPILOT_SYSTEM_PROMPT),
    history:  estimateTokens(formatHistoryText(history)),
    memories: estimateTokens(formatMemoriesText(recalled)),
    message:  estimateTokens(input.message),
  }
  return metrics = {
    ...result.metrics,
    historyMessages, recalledMemories,
    contextBreakdown: breakdown,
    // promptTokens only if result.metrics.promptTokens !== undefined
  }
```

```text
ReactStrategy / PlanExecute:
  messages = agent.invoke / graph
  promptTokens = sumPromptTokensFromMessages(messages)  // undefined se nenhum usage
```

```text
withReflection:
  totalPrompt = sum defined promptTokens across base runs (+ critic se disponível)
  se nenhum definido → omitir promptTokens
```

---

## Validation rules

| Regra | Onde |
|-------|------|
| `estimateTokens` nunca negativo | `tokens.ts` |
| `readLlmUsage` não lança | `tokens.ts` |
| `promptTokens` omitido se usage ausente | `runChat` / HTTP |
| `contextBreakdown` 4 chaves | `runChat` |
| `message` = raw user text | `runChat` (não enriched) |
| Learning reflector fora da soma | pós-`200` |

---

## Persistence

Nenhuma. Métricas são efêmeras na resposta HTTP / retorno de strategy.
