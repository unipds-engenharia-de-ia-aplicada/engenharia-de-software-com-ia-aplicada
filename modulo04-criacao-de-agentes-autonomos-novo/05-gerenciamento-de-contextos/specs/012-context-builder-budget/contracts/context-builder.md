# Contract: ContextBuilder (`src/context/context-builder.ts`)

**Phase 1 output for** `specs/012-context-builder-budget/plan.md`

Referência: [data-model.md](../data-model.md), [research.md](../research.md).

---

## Env

| Variable | Default | Meaning |
|----------|---------|---------|
| `CONTEXT_BUDGET_SYSTEM` | ∞ (intocável) | Lido, mas system nunca é cortado |
| `CONTEXT_BUDGET_SUMMARY` | `200` | Max estimated tokens for summary section |
| `CONTEXT_BUDGET_HISTORY` | `1200` | Max estimated tokens for history window |
| `CONTEXT_BUDGET_MEMORIES` | `300` | Max estimated tokens for memories section |

Alias legado: `CONTEXT_BUDGET_WINDOW` → mesmo que `CONTEXT_BUDGET_HISTORY` (só se `HISTORY` ausente).

Parse rules: see research — invalid → default; `≤ 0` → empty optional section.

---

## API pública

```ts
export interface SectionBudgets {
  system: number;
  summary: number;
  history: number;
  memories: number;
}

export const DEFAULT_SECTION_BUDGETS: SectionBudgets;

/** Resolve budgets from env with defaults; optional overrides win. */
export function resolveSectionBudgets(
  overrides?: Partial<SectionBudgets>,
  env?: NodeJS.ProcessEnv,
): SectionBudgets;

export interface ContextBuildInput {
  system: string;
  summary: string | null;
  history: ConversationMessage[];
  memories: RecalledMemory[];
  message: string;
}

export interface ContextBuildResult {
  system: string;
  message: string;
  summary: string;
  history: ConversationMessage[];
  memories: RecalledMemory[];
  enrichedMessage: string;
  historyMessages: number;
  recalledMemories: number;
  historyText: string;
  memoriesText: string;
  summaryText: string;
}

export function buildContext(
  input: ContextBuildInput,
  options?: { budgets?: Partial<SectionBudgets>; env?: NodeJS.ProcessEnv },
): ContextBuildResult;
```

---

## Regras

| Aspecto | Contrato |
|---------|----------|
| System / message | Sempre idênticos à entrada |
| Summary cut | Prefixo até `budget * 4` chars se exceder |
| Window cut | Drop oldest first; truncate sole remaining content if needed |
| Memories cut | Drop lowest score first; tie → drop higher input index; truncate sole fact if needed |
| `enrichedMessage` | summary block → memories block → current message (omit empty blocks) |
| Purity | Sem I/O; sem LLM |

---

## Testes mínimos

1. Defaults: summary/window/memories respeitam 200/1200/300.
2. Tetos baixos: ordem de corte correta (antigas / menor score / resumo truncado).
3. System + message intactos com tetos 0 nas opcionais.
4. Conteúdo que cabe → sem remoção.
5. Env inválida → defaults; override em options prevalece.
6. Empate de score → desempate estável (maior índice sai primeiro).
