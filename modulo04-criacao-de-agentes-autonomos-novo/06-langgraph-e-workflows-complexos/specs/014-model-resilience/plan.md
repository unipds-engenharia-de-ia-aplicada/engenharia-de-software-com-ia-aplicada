# Implementation Plan: Resiliência de Modelo (Retry + Fallback)

**Branch**: `014-model-resilience` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-model-resilience/spec.md`

## Summary

Blindar a fábrica única `createModel` em `src/agents/model.ts`: **retry no primário** (`withRetry`) e, se `OPENROUTER_MODEL_FALLBACK` estiver definido e distinto, **`withFallbacks([reserva])`**. Observabilidade via evento de trace `"fallback"` + `metrics.modelUsed`. Esgotamento total → erro de domínio → HTTP **503**. Todos os consumidores (grafo, strategies, reflector, summarizer, arena/bench) herdam a blindagem sem lógica por nó.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM `strict: true`

**Primary Dependencies**: `@langchain/openai` (`ChatOpenAI`), `@langchain/core` (`withRetry` / `withFallbacks`); Express borda `/chat`; domínio `TraceEvent` / `ExecutionMetrics`

**Storage**: N/A

**Testing**: `node:test` via `tsx`; fakes de modelo/runnable (sem rede); HTTP 503 + métricas/trace

**Target Platform**: Node.js processo local (HTTP `/chat` + arena/bench)

**Project Type**: Web service + agente; fatia `agents/model.ts` + erros/domínio + wire HTTP/grafo

**Performance Goals**: Retry/fallback só sob falha; latência de sucesso ≈ hoje; custo sobe só nos degraus da escada

**Constraints**: Um reserva; sem circuit breaker; fábrica única; tipagem de `modelFactory` pode alargar de `ChatOpenAI` para tipo resiliente compatível com `invoke` / `withStructuredOutput` / agents

**Scale/Scope**: `model.ts` + telemetry helper + erro 503 + testes; ~8–12 arquivos + assinaturas `modelFactory`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | Blindagem na fábrica que alimenta o grafo/nós |
| 2 | **Camadas explícitas** | ✅ PASS | `agents/model` → strategies/graph; HTTP só traduz 503 |
| 3 | **Validação na fronteira** | ✅ PASS | Env parseada (trim / igualdade primário); saída LLM inalterada |
| 4 | **Erros são de domínio** | ✅ PASS | `ModelUnavailableError` → 503 |
| 5 | **Teste é parte da tarefa** | ✅ PASS | FR-010 / SC-001–004 |
| 6 | **Segurança por padrão** | ✅ PASS | Sem secrets no repo; `.env.example` só nomes |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | Mudança centrada na fábrica + telemetria |

**Stack**: ✅ Sem ORM novo; LangChain já presente.

**Gate result: ALL PASS** — Complexity Tracking não necessário.

**Re-check pós Phase 1**: contratos mantêm fábrica única, evento `fallback`, `modelUsed`, 503. Gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/014-model-resilience/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── model-factory.md
│   ├── chat-http.md
│   └── trace.md
└── tasks.md                # /speckit.tasks — NÃO gerado aqui
```

### Source Code (repository root)

```text
src/
├── agents/
│   ├── model.ts                 # ← withRetry + withFallbacks + telemetry hooks
│   └── model.test.ts            # NOVO: retry / fallback / sem rede
├── llm/
│   └── factory.ts               # reexport createModel (inalterado ou tipagem)
├── domain/
│   ├── types.ts                 # ← TraceEventType +"fallback"; metrics.modelUsed
│   └── errors.ts                # ← ModelUnavailableError
├── graph/
│   └── production-graph.ts      # ← anexa evento fallback + modelUsed nas metrics do turno
├── http/
│   ├── server.ts                # ← 503 model_unavailable
│   └── server.test.ts           # ← 503 + modelUsed / fallback no 200
├── strategies/ agents/ chat/ memory/  # ← tipagem modelFactory se necessário
└── .env.example                 # ← OPENROUTER_MODEL_FALLBACK=
```

**Structure Decision**: Toda resiliência em `src/agents/model.ts` (+ helper de telemetria no mesmo módulo ou `src/llm/model-telemetry.ts` se ficar grande). HTTP/grafo só observam e traduzem erros — não reimplementam retry.

## Complexity Tracking

> Nenhuma violação — seção vazia de propósito.
