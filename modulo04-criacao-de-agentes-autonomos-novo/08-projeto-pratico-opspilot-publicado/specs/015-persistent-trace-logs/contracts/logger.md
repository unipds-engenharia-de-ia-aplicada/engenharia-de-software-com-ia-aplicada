# Contract: Logger JSON (`src/obs/logger.ts`)

**Phase 1 output for** `specs/015-persistent-trace-logs/plan.md`

---

## API

```ts
type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, string | number | boolean | null | undefined>;

interface Logger {
  info(event: string, meta?: LogMeta): void;
  warn(event: string, meta?: LogMeta): void;
  error(event: string, meta?: LogMeta): void;
}

function createLogger(opts?: { write?: (line: string) => void }): Logger;
```

Default `write`: append uma linha a `process.stdout` (ou `console.log` desde que seja **uma** linha JSON).

---

## Formato da linha

Uma linha = `JSON.stringify({ ts, level, event, ...meta }) + "\n"`.

| Campo | Obrigatório | Notas |
|-------|-------------|-------|
| `ts` | sim | Epoch ms |
| `level` | sim | `info` \| `warn` \| `error` |
| `event` | sim | Nome estável |
| `requestId` | quando houver | Correlação |
| demais | opcional | Só escalares em `LogMeta` |

---

## Campos proibidos em `meta`

Não incluir (nem aliases): `message` (texto user), `answer`, `trace`, `content`, `payload`, `toolArgs`, `body`, `prompt`.

Contagens OK: `traceEventCount`, `latencyMs`, `httpStatus`, `llmCalls`, `route`, `errorCode`.

---

## Eventos canônicos (HTTP)

| `event` | level típico | Meta sugerida |
|---------|--------------|---------------|
| `chat_request_start` | info | `requestId` |
| `chat_request_end` | info | `requestId`, `httpStatus`, `latencyMs`, `traceEventCount` |
| `chat_request_error` | error/warn | `requestId`, `httpStatus`, `errorCode` |
| `request_persist_failed` | error | `requestId`, `errorCode` / `errorName` |

---

## Testes mínimos

| # | Caso | Esperado |
|---|------|----------|
| 1 | `info("chat_request_end", { requestId, latencyMs })` | 1 linha; `JSON.parse` ok |
| 2 | Meta sem campos proibidos | assert deny-list |
| 3 | Duas chamadas | duas linhas (sem concatenar no mesmo write) |
