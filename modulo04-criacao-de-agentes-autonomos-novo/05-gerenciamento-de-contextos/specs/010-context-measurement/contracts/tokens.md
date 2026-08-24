# Contract: tokens (`src/context/tokens.ts`)

**Phase 1 output for** `specs/010-context-measurement/plan.md`

Referência: [data-model.md](../data-model.md), [research.md](../research.md).

---

## API pública

```ts
export function estimateTokens(text: string): number;

export interface LlmUsage {
  promptTokens: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** Parse defensivo; undefined se ausente/malformado. */
export function readLlmUsage(source: unknown): LlmUsage | undefined;

/**
 * Soma promptTokens de mensagens com usage (ex.: AIMessage[]).
 * undefined se nenhuma mensagem contribuir.
 */
export function sumPromptTokensFromMessages(messages: Iterable<unknown>): number | undefined;

export interface ContextBreakdown {
  system: number;
  history: number;
  memories: number;
  message: number;
}

export function buildContextBreakdown(parts: {
  system: string;
  history: string;
  memories: string;
  message: string;
}): ContextBreakdown;
```

---

## Regras

| Função | Contrato |
|--------|----------|
| `estimateTokens` | `Math.floor(text.length / 4)` |
| `readLlmUsage` | Preferir `usage_metadata.input_tokens`; fallback `tokenUsage.promptTokens` / aliases; nunca throw |
| `sumPromptTokensFromMessages` | Soma só contribuições válidas; `undefined` se zero contribuições |
| `buildContextBreakdown` | Cada chave = `estimateTokens` do texto correspondente |

---

## Testes mínimos

1. `estimateTokens("") === 0`, `"abcd" === 1`, `"abcde" === 1`, `"abc" === 0`
2. `readLlmUsage({ usage_metadata: { input_tokens: 10, output_tokens: 2, total_tokens: 12 } })` → `{ promptTokens: 10, ... }`
3. `readLlmUsage(undefined)` / `{}` → `undefined`
4. Duas mensagens com 10 e 5 → soma `15`; sem usage → `undefined`
5. `buildContextBreakdown` com strings conhecidas bate com `estimateTokens` por chave

Módulo: `src/context/tokens.ts` + `tokens.test.ts`.
