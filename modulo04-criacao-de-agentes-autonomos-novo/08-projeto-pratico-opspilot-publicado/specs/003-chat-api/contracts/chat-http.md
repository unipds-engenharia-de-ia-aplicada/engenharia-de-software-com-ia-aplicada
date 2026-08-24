# Contract: POST /chat

**Phase 1 output for** `specs/003-chat-api/plan.md`

---

## Endpoint

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/chat` |
| **Content-Type** | `application/json` |

---

## Request body

```json
{
  "message": "liste alertas ativos",
  "strategy": "react",
  "reflect": false
}
```

| Campo | Obrigatório | Default | Descrição |
|-------|-------------|---------|-----------|
| `message` | sim | — | Pedido em linguagem natural; string com length ≥ 1 |
| `strategy` | não | `"react"` | Nome no registry (`react`, `plan-and-execute`, …) |
| `reflect` | não | `false` | Se `true`, executa sob `withReflection` |

---

## Responses

### 200 OK

```json
{
  "answer": "...",
  "trace": [
    { "type": "thought", "content": "..." }
  ],
  "metrics": {
    "llmCalls": 2,
    "latencyMs": 1234
  }
}
```

Alinha-se a `StrategyResult`.

### 400 Bad Request — validação

```json
{
  "error": "validation_error",
  "issues": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["message"],
      "message": "Required"
    }
  ]
}
```

`issues` = array de `ZodIssue` (ou serialização equivalente via `error.flatten()` / `error.issues`).

Exemplos que geram 400: `message` ausente, `message: ""`, `reflect: "yes"`, body não-JSON, campo tipado errado.

### 422 Unprocessable Entity — estratégia desconhecida

```json
{
  "error": "unknown_strategy",
  "strategy": "nope"
}
```

Body zod-válido, mas `strategy` não está no registry.

### 504 Gateway Timeout

```json
{
  "error": "timeout",
  "message": "Chat timed out after 180000ms"
}
```

### 500 Internal Server Error

```json
{
  "error": "internal_error",
  "message": "..."
}
```

Sem stack trace na resposta.

---

## Comportamento de timeout

- Default de produção: **180_000 ms**
- Implementação: `Promise.race` entre `strategy.run(message)` e o timer
- Testes: `timeoutMs` injetável em `createApp`

---

## Exemplos curl (produção)

```bash
# default react
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"liste alertas ativos"}' | jq '{answer, llmCalls: .metrics.llmCalls}'

# plan-and-execute + reflect
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"abra um incidente sev2 para o catalog","strategy":"plan-and-execute","reflect":true}' \
  | jq '{answer, llmCalls: .metrics.llmCalls}'

# 400
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"mensagem":"campo errado"}' | jq
```

---

## Fora deste contrato

- Auth, rate limit, SSE/streaming
- Outros paths/métodos
- Alias `plan-execute` (usar `plan-and-execute`)
