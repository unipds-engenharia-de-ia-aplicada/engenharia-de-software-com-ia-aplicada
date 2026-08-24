# Arena CLI Contract — Reflection Layer Extension

**Phase 1 output for** `specs/002-reflection-layer/plan.md`

Complementa o contrato base em `specs/001-reasoning-nucleus/contracts/arena-cli.md`.

---

## Novos valores válidos para `--strategies`

Os seguintes nomes são adicionados ao conjunto de estratégias reconhecidas pela Arena:

| Nome | Estratégia base | Decorator |
|------|----------------|-----------|
| `reflect:react` | `ReactStrategy` | `withReflection` |
| `reflect:plan-and-execute` | `PlanExecuteStrategy` | `withReflection` |

---

## Flags atualizadas

| Flag | Valores válidos (após esta feature) |
|------|-------------------------------------|
| `--strategies` | `react`, `plan-and-execute`, `reflect:react`, `reflect:plan-and-execute` |

Nenhuma flag nova é adicionada. Os nomes `reflect:*` são simplesmente aceitos como valores válidos do `--strategies` existente.

---

## Exemplos de uso

```bash
# Comparar React com sua versão refletida
npm run arena -- --strategies react,reflect:react --input "Quais serviços têm alertas críticos?"

# Comparar todas as quatro estratégias
npm run arena -- --strategies react,reflect:react,plan-and-execute,reflect:plan-and-execute

# Usar apenas a versão refletida do plan-and-execute
npm run arena -- --strategies reflect:plan-and-execute --input "Abra um incidente para o payment-api"
```

---

## Comportamento de validação

- Nomes desconhecidos continuam sendo silenciosamente filtrados (comportamento existente em `parseArgs`).
- Se `--strategies` contiver apenas nomes inválidos (incluindo parcialmente corretos como `reflect:` sem base), a Arena exibe:
  ```
  No valid strategies. Use: react, plan-and-execute, reflect:react, reflect:plan-and-execute
  ```
  e sai com código não-zero.

---

## Formato de saída para estratégias refletidas

O cabeçalho de cada estratégia exibe o `name` da instância:

```
════════════════════════════════════════
Strategy: reflect:react
════════════════════════════════════════

── Trace ──────────────────────────────
[thought]      Os alertas ativos são...
[action]       list_alerts({ "status": "firing" })
[observation]  Found 3 firing alert(s): ...
[answer]       Os serviços com alertas ativos são: payment-api, auth-service, order-service.
[critique]     Round 1: Resposta incompleta — faltou severidade. (approved: false)
[thought]      Vou detalhar por severidade...
[action]       list_alerts({ "status": "firing" })
[observation]  Found 3 firing alert(s): ...
[answer]       payment-api (critical), auth-service (high), order-service (critical).
[critique]     Round 2: Resposta completa. (approved: true)

── Metrics ────────────────────────────
LLM calls:   5
Latency:     8471 ms

── Answer ─────────────────────────────
payment-api (critical), auth-service (high), order-service (critical).
```

**Nota**: O `formatTraceEvent` existente em `arena.ts` já lida com eventos `critique` via o branch `default` (renderiza `[critique] {content}`). Nenhuma mudança no formato de display é necessária; os novos campos `round`, `approved`, `timestampMs` não aparecem no output do terminal.

---

## Fonte

`src/arena.ts` — alterações necessárias:
1. Adicionar `"reflect:react"` e `"reflect:plan-and-execute"` ao array `validNames` em `parseArgs`
2. Adicionar tipo `"reflect:react" | "reflect:plan-and-execute"` ao union `StrategyName`
3. Adicionar branches em `createStrategy` para instanciar `withReflection(base, { modelFactory: createModel })`
