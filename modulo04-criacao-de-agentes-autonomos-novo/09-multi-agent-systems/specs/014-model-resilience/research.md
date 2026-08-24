# Research: Resiliência de Modelo

**Phase 0 output for** `specs/014-model-resilience/plan.md`

---

## Contexto

`createModel()` hoje devolve `ChatOpenAI` “nu”. O material da unidade e o sketch em `specs/002-reflection-layer/example.ts` pedem retry no primário + fallback para reserva. Spec 014 exige ainda evento `fallback`, `metrics.modelUsed` e HTTP 503.

---

## Decisão 1: Composição na fábrica

**Decisão**:

```ts
function baseModel(modelId: string): ChatOpenAI { /* OpenRouter opts + callbacks de telemetria */ }

const primaryId = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
const fallbackId = normalizeFallback(process.env.OPENROUTER_MODEL_FALLBACK, primaryId);

const primary = baseModel(primaryId).withRetry({ stopAfterAttempt: 3 });

if (!fallbackId) {
  return primary;
}

const reserve = baseModel(fallbackId).withRetry({ stopAfterAttempt: 3 });
return primary.withFallbacks({ fallbacks: [reserve] });
// Se a API aceitar forma posicional no stack instalado, equivalente documentado nos testes.
```

- `normalizeFallback`: trim; vazio / igual ao primário → `undefined`.
- Ordem: **retry(primário) → fallback(reserva com seu próprio retry)** → erro.
- Alinhado ao user input (`withRetry` + `withFallbacks`) e ao example da 002 (ajustando `withFallback` singular → `withFallbacks`).

**Rationale**: Um ponto de configuração; herança automática por todos os `modelFactory: createModel`.

**Alternatives considered**:

- Só `maxRetries` do ChatOpenAI — não atende `withFallbacks` explícito.
- Retry/fallback em cada nó do grafo — viola FR-004 / constitution “fábrica única”.

---

## Decisão 2: Tipagem do retorno (`ChatOpenAI` → modelo resiliente)

**Decisão**: `createModel()` deixa de garantir retorno `ChatOpenAI` concreto; passa a um tipo de projeto, ex.:

```ts
export type OpsChatModel = ReturnType<ChatOpenAI["withRetry"]> // ou BaseChatModel / Runnable interface
```

Atualizar assinaturas `modelFactory: () => ChatOpenAI` em react, plan-execute, reflect, summarizer, learning-reflector, router, server deps para `() => OpsChatModel` (ou `BaseChatModel` se cobrir `withStructuredOutput` + uso em `createReactAgent`).

Se `withStructuredOutput` / `bindTools` falharem no tipo Runnable empacotado, extrair helper:

```ts
createResilientModel(raw: ChatOpenAI): OpsChatModel
```

e garantir nos testes de tipo/runtime que `createReactAgent` e `.withStructuredOutput(schema)` continuam funcionando com o objeto retornado (smoke com fake).

**Rationale**: `withRetry`/`withFallbacks` não preservam a classe `ChatOpenAI`; mentir o tipo quebra em runtime.

**Alternatives considered**:

- Wrapper class estendendo ChatOpenAI — frágil.
- Aplicar resiliência só em `invoke` manual — duplica API.

---

## Decisão 3: Telemetria (`modelUsed` + evento `fallback`)

**Decisão**: Callbacks LangChain (ou tags) em cada `baseModel(id)` gravam em **AsyncLocalStorage** (módulo `model-telemetry`):

| Campo | Semântica |
|-------|-----------|
| `primaryModel` | id primário da fábrica |
| `fallbackModel` | id reserva ou omitido |
| `modelUsed` | último modelo que completou `handleLLMEnd` com sucesso no turno |
| `fallbackUsed` | `true` se houve sucesso no modelo reserva após falha do primário |

No fim do turno em `runProductionTurn`:

1. Ler telemetria → `metrics.modelUsed` (default: id primário se ninguém gravou e houve sucesso).
2. Se `fallbackUsed` → append `TraceEvent { type: "fallback", node: "resposta" | nó ativo, content: "...", ... }` (ids primário→reserva no content ou campos dedicados).
3. Reset/clear do ALS no fim do turno (ou escopo `runWithModelTelemetry(() => ...)` envolvendo o invoke do grafo).

Mínimo obrigatório no `200`: `metrics.modelUsed` preenchido. Evento `fallback` só quando a reserva atendeu.

**Rationale**: `withFallbacks` não emite nosso `TraceEvent`; telemetria lateral evita fork do LangChain.

**Alternatives considered**:

- Parsear mensagens de erro — frágil.
- Métricas só no factory sem ALS — race entre requests concorrentes.

---

## Decisão 4: Erros → 503

**Decisão**:

```ts
class ModelUnavailableError extends Error {
  name = "ModelUnavailableError";
}
```

- Após esgotar primário (+ reserva se houver), a falha propagada do runnable é capturada na borda do turno (`runProductionTurn` / server) e normalizada para `ModelUnavailableError` quando for falha de provedor/LLM (não `UnknownStrategyError`, não timeout de chat, etc.).
- `server.ts`: `ModelUnavailableError` → **503** `{ error: "model_unavailable", message }`.
- Timeout de chat (**504**) permanece distinto.

**Rationale**: Contrato FR-008; degradação controlada da escada.

**Alternatives considered**:

- 500 genérico — pior para o cliente.
- 200 com desculpa — proibido pela spec.

---

## Decisão 5: Política de retry

**Decisão**: `stopAfterAttempt: 3` no primário e na reserva. Usar defaults do LangChain para quais erros são retryable (transitórios); não customizar lista na v1 salvo se testes exigirem. Auth 401 falha rápido via comportamento padrão.

**Rationale**: Spec sugere ~3; example usava 2 — preferimos 3 documentado; fácil de tornar env depois (`OPENROUTER_RETRY_ATTEMPTS`) fora de escopo.

---

## Decisão 6: Escopo Arena / bench

**Decisão**: Herdam fábrica automaticamente. Contrato canônico de degradação é HTTP 503; CLI pode imprimir o erro e exit ≠ 0 sem mapear status HTTP.

---

## NEEDS CLARIFICATION

Nenhum — defaults acima fecham o design.
