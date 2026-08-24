# Research: Medição de Contexto

**Phase 0 output for** `specs/010-context-measurement/plan.md`

---

## Contexto

`/chat` já expõe `llmCalls`, `latencyMs`, `historyMessages`, `recalledMemories`. Falta medir **quanto** de contexto entra no turno (estimativa por fonte) e **quantos prompt tokens** o provedor cobrou (usage real). O script `conversa-longa.sh` estima só message+answer localmente e não lê métricas reais.

---

## Decisão 1: Regra canônica `estimateTokens` = `Math.floor(chars / 4)`

**Decisão**:

```ts
export function estimateTokens(text: string): number {
  return Math.floor(text.length / 4);
}
```

- Comprimento = `string.length` (UTF-16 code units JS) — documentado e testado (ASCII + acentos PT).
- Texto vazio / só whitespace: `floor(n/4)` natural (whitespace conta; string `""` → `0`).
- O módulo TypeScript é a fonte da verdade. O bash de `conversa-longa.sh` pode manter estimativa local só para req/res de demo, mas o valor principal por turno passa a ser `metrics.promptTokens`; alinhar comentários do script à regra floor se a estimativa local permanecer.

**Rationale**: Assumption da spec; determinístico; alinhado a heurística comum chars/4.

**Alternatives considered**:

- `Math.ceil` como no bash atual — rejeitado para o módulo canônico; script se alinha ao TS.
- Tokenizer real (tiktoken) — fora de escopo; custo e dependência.

---

## Decisão 2: Usage real via `AIMessage.usage_metadata` (+ fallback)

**Decisão**:

Ler nesta ordem a partir de um objeto/mensagem:

1. `usage_metadata.input_tokens` (LangChain `UsageMetadata` — preferido)
2. Fallback: `response_metadata.tokenUsage.promptTokens` (estilo OpenAI wrapper)
3. Objeto “cru” com `input_tokens` / `promptTokens` / `prompt_tokens`

```ts
export interface LlmUsage {
  promptTokens: number;
  completionTokens?: number;
  totalTokens?: number;
}

export function readLlmUsage(source: unknown): LlmUsage | undefined;
export function sumPromptTokensFromMessages(messages: unknown[]): number | undefined;
```

- `sumPromptTokensFromMessages`: soma `promptTokens` de cada `AIMessage` (ou shape compatível) que tiver usage; se **nenhuma** mensagem tiver usage → retorna `undefined` (não `0`).
- Parsing **nunca** lança; malformado → trata como ausente.

**Rationale**: `@langchain/core` tipa `AIMessage.usage_metadata`; OpenRouter/ChatOpenAI preenche em produção.

**Alternatives considered**:

- Callbacks LangChain globais — mais invasivo.
- Só `tokenUsage` legado — incompleto frente a `usage_metadata`.

---

## Decisão 3: Onde agregar `promptTokens` no turno

**Decisão**:

| Camada | Comportamento |
|--------|----------------|
| `ReactStrategy` | Após `agent.invoke`, `promptTokens = sumPromptTokensFromMessages(result.messages)` |
| `PlanExecuteStrategy` | Somar usage das AIMessages do agent + mensagens de planner/replanner `invoke` quando forem `AIMessage` com usage |
| `withReflection` | Somar `promptTokens` das runs base (quando definidos); critic via `withStructuredOutput` **best-effort** (geralmente não devolve AIMessage — pode não contribuir); não inventar estimativa no lugar do real |
| Learning reflector (`009`) | **Fora** da soma — roda após o `200`, fire-and-forget |
| Fake strategy (testes) | Pode setar `metrics.promptTokens` diretamente |

`runChat` propaga `result.metrics.promptTokens` para a resposta; se `undefined`, **omite** o campo no objeto de métricas HTTP (não serializa `0` falso).

**Rationale**: Spec — soma de todas as chamadas LLM **do turno**; omitir ≠ zero (FR-009).

**Alternatives considered**:

- Sempre `promptTokens: 0` quando ausente — confunde “barato” com “desconhecido”.
- Incluir learning reflector — distorce métrica do turno e race com async.

---

## Decisão 4: `contextBreakdown` sempre em `runChat`

**Decisão**:

Calculado **só** em `runChat` (conhece as fontes), sempre presente no `/chat`:

| Chave | Texto estimado |
|-------|----------------|
| `system` | `OPSPILOT_SYSTEM_PROMPT` (mesmo string do ReAct / executor) |
| `history` | Concatenação das mensagens injetadas (`role: content` por linha, mesmo espírito de `formatHistoryForPrompt` sem a mensagem atual) |
| `memories` | Texto dos fatos recordados (linhas `- fact` **sem** o envelope “Relevant memories” / “Current message”) |
| `message` | **Mensagem crua** do usuário (`input.message`), **antes** do envelope de memórias |

- Chaves **sempre** presentes; valor `0` quando fonte vazia.
- Estimativa ≠ `promptTokens` real (tools schema, formatação LangGraph, etc. não entram no breakdown v1).

Helper sugerido: `buildContextBreakdown({ system, history, memories, message })` em `tokens.ts` ou `run-chat.ts`.

**Rationale**: Spec FR-005; `message` crua evita double-count com `memories`.

**Alternatives considered**:

- `message` = enriched (com memories) — double-count com chave `memories`.
- Omitir chaves zeradas — preferimos mapa estável para o cliente/script.

---

## Decisão 5: Extensão de `ExecutionMetrics` e resposta HTTP

**Decisão**:

```ts
export interface ContextBreakdown {
  system: number;
  history: number;
  memories: number;
  message: number;
}

export interface ExecutionMetrics {
  llmCalls: number;
  latencyMs: number;
  historyMessages?: number;
  recalledMemories?: number;
  promptTokens?: number;
  contextBreakdown?: ContextBreakdown;
}
```

- Strategies: podem setar `promptTokens`; **não** precisam setar `contextBreakdown`.
- `runChat` / HTTP: sempre anexam `contextBreakdown`; anexam `promptTokens` só se definido.

**Rationale**: Campos aditivos (FR-006); camadas explícitas.

---

## Decisão 6: `conversa-longa.sh`

**Decisão**:

Na linha por turno, incluir:

```text
promptTokens=<n|n/a>
```

via `jq -r '.metrics.promptTokens // "n/a"'`.

Não abortar o loop se a métrica faltar. Estimativa local req/res pode permanecer como informação secundária.

**Rationale**: US3 / FR-007.

---

## Decisão 7: Test harness

| Caso | Como |
|------|------|
| `estimateTokens` | Unit: `""`, `"a"`, 3 chars, 4, 5, acentos |
| `readLlmUsage` | Objetos com `usage_metadata`, `tokenUsage`, malformado, `undefined` |
| `sumPromptTokensFromMessages` | 2 AIMessages com usage → soma; nenhum usage → `undefined` |
| `/chat` fake com `promptTokens: 42` | Assert JSON |
| `/chat` fake sem `promptTokens` | Campo ausente; `contextBreakdown` presente com chaves |
| Breakdown | history/memories conhecidos → valores = `estimateTokens` dos textos |
| Reflect | Soma promptTokens de duas runs fake (se setados) |

Sem rede LLM nos testes de aceite.

---

## Decisão 8: Escopo fora

- Tokenizer oficial / billing exato além do que o provedor reporta.
- Breakdown de tool schemas / critique prompt.
- Métricas de completion tokens na resposta HTTP (podem existir em `LlmUsage` interno; HTTP foca `promptTokens` + breakdown).
- Alterar Arena/bench além do que `ExecutionMetrics` já carrega (opcional polish: imprimir `promptTokens` no arena — **não** obrigatório nesta feature).

---

## Resolução de NEEDS CLARIFICATION

Nenhum item do Technical Context ficou como NEEDS CLARIFICATION — decisões 1–8 fecham regra floor, parsing LangChain, agregação, breakdown, omit-vs-zero e script.
