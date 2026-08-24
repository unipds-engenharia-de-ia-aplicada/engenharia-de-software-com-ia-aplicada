# Arena CLI Contract

**Phase 1 output for** `specs/001-reasoning-nucleus/plan.md`

The arena runner (`src/arena.ts`) is the primary interface for exercising and comparing reasoning strategies. It is invoked via `npm run arena` (which calls `tsx src/arena.ts`).

---

## Command Signature

```
npm run arena -- --strategies <strategy-list> [--input <text>] [--max-iterations <n>]
```

Or directly:
```
tsx src/arena.ts --strategies <strategy-list> [--input <text>] [--max-iterations <n>]
```

---

## Flags

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--strategies` | `string` (comma-separated) | Yes | — | Strategies to run. Valid values: `react`, `plan-and-execute`. Example: `react,plan-and-execute` |
| `--input` | `string` | No | `"Quais serviços têm alertas ativos?"` | Natural-language query passed to all strategies |
| `--max-iterations` | `number` (integer ≥ 1) | No | `10` | Maximum reasoning iterations per strategy |

---

## Validation

- `--strategies` must contain at least one known strategy name; unknown names cause an early exit with a descriptive error message and non-zero exit code
- `--max-iterations` must be a positive integer; non-numeric or ≤ 0 values cause early exit with error
- If `OPENROUTER_API_KEY` is not set in the environment, the process exits before executing any strategy with: `Error: OPENROUTER_API_KEY environment variable is required`

---

## Output Format

For each strategy (in the order listed in `--strategies`), the arena prints:

```
════════════════════════════════════════
Strategy: react
════════════════════════════════════════

── Trace ──────────────────────────────
[thought]     The user wants to know which services have active alerts...
[action]      list_alerts({ "status": "firing" })
[observation] Found 3 firing alert(s): ...
[answer]      Os serviços com alertas ativos são: payment-api (critical), auth-service (high), order-service (critical).

── Metrics ────────────────────────────
LLM calls:   2
Latency:     4231 ms

── Answer ─────────────────────────────
Os serviços com alertas ativos são: payment-api (critical), auth-service (high), order-service (critical).
```

When all requested strategies have been printed, the arena exits with code `0`.

---

## Error Output Format

If a strategy fails with an unhandled error:
```
════════════════════════════════════════
Strategy: react
════════════════════════════════════════
ERROR: <error message>
```
The arena continues to the next strategy and exits with code `1` at the end if any strategy failed.

---

## Iteration Limit Output

When a strategy is interrupted by the iteration limit:
```
[answer]      [Iteration limit reached after 10 steps. Partial result: ...]
```

---

## Source file

`src/arena.ts`

---

## ReasoningStrategy Interface Contract

Every strategy must satisfy this TypeScript interface (see [data-model.md](../data-model.md)):

```typescript
interface ReasoningStrategy {
  readonly name: string;
  run(input: string): Promise<{
    answer: string;
    trace: TraceEvent[];
    metrics: ExecutionMetrics;
  }>;
}
```

Strategies are instantiated with:
- A model factory function (from `src/llm/factory.ts`)
- A tools array (from `src/tools/index.ts`)
- A `maxIterations` number (from the `--max-iterations` flag)
