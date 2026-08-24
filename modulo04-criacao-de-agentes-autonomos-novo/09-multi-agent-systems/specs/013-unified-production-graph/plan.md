# Implementation Plan: Grafo Unificado de Produção

**Branch**: `013-unified-production-graph` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-unified-production-graph/spec.md`

## Summary

Introduzir `src/graph/production-graph.ts` como **orquestrador único** do turno HTTP `/chat`: nós **contexto → roteador → (react | plan-and-execute | reflect) → resposta**. O roteador classifica com `withStructuredOutput({ route, reason })` e tabela de decisão no prompt; `strategy` no body vira **override** (visível no evento `route`). Todo `TraceEvent` ganha `node` obrigatório; novo tipo `"route"`. `runChat` / borda HTTP deixam de escolher estratégia via default `react` + registry isolado — passam a invocar o grafo.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM `strict: true`

**Primary Dependencies**: LangGraph (`StateGraph`, `Annotation`, conditional edges); LangChain `withStructuredOutput` + zod; Express/`runChat` wire; ContextBuilder (`012`); strategies existentes (`react`, `plan-and-execute`, `withReflection`)

**Storage**: N/A nova — reusa ConversationStore / MemoryStore já usados em `runChat`

**Testing**: `node:test` via `tsx`; grafo com router/strategies fakes (sem rede); contrato HTTP override/`422`/`node`/`route`

**Target Platform**: Node.js processo local (HTTP `/chat`)

**Project Type**: Web service + agente; fatia `graph/` + extensão de `TraceEvent` + wire HTTP/`runChat`

**Performance Goals**: Um turno = 1 chamada de classificação (se sem override) + 1 ramo de estratégia; latência dominada pelo LLM como hoje

**Constraints**: Uma estratégia por turno; Arena fora de escopo; retry/fallback/ondas fora de escopo; `strategy` desconhecida → `422` antes do grafo; fallback `react` se rota LLM inválida/falha

**Scale/Scope**: Novo módulo `src/graph/` + domínio trace + schema HTTP + testes; ~10–15 arquivos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | Capacidade vira nós do grafo LangGraph (`production-graph.ts`) |
| 2 | **Camadas explícitas** | ✅ PASS | `http → graph → strategies/context/tools → store`; sem I/O de domínio nos nós de classificação pura além do LLM |
| 3 | **Validação na fronteira** | ✅ PASS | Body zod (`strategy?`); saída do roteador zod/`withStructuredOutput` |
| 4 | **Erros são de domínio** | ✅ PASS | `UnknownStrategyError` → `422`; falha do roteador → fallback `react` + rastros no trace |
| 5 | **Teste é parte da tarefa** | ✅ PASS | FR-013 / SC-001–005 |
| 6 | **Segurança por padrão** | ✅ PASS | Sem segredos novos; override só nomes allowlisted |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | Feature aditiva; Arena permanece no caminho antigo |

**Stack**: ✅ LangGraph já no projeto (plan-execute); sem ORM novo.

**Gate result: ALL PASS** — Complexity Tracking não necessário.

**Re-check pós Phase 1**: contratos mantêm grafo como orquestrador `/chat`, `node`/`route` no trace, override sem default rígido `react`. Gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/013-unified-production-graph/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── production-graph.md
│   ├── chat-http.md
│   └── trace.md
└── tasks.md                # /speckit.tasks — NÃO gerado aqui
```

### Source Code (repository root)

```text
src/
├── graph/
│   ├── production-graph.ts       # NOVO: StateGraph contexto→router→estratégia→resposta
│   ├── production-graph.test.ts  # NOVO: fakes — fluxo, override, route, node
│   ├── router.ts                 # NOVO: schema zod + withStructuredOutput + prompt com tabela
│   ├── router-prompt.ts          # NOVO: tabela de decisão (texto estável / testável)
│   └── stamp-node.ts             # NOVO: helper stamp `node` em TraceEvent[]
├── domain/
│   └── types.ts                  # ← TraceEventType +"route"; TraceEvent.node obrigatório; route?/override?
├── trace/
│   └── builder.ts                # ← stamp node (param) em buildTraceFromMessages / plan-execute
├── chat/
│   └── run-chat.ts               # ← invoca grafo (ou thin wrap); não resolve strategy sozinho
├── http/
│   ├── chat-schema.ts            # ← strategy opcional (sem default "react"); enum allowlist
│   ├── server.ts                 # ← valida strategy conhecida → grafo; 422 early
│   └── server.test.ts            # ← override, auto-route fake, node/route no trace
├── strategies/
│   ├── react.ts / plan-execute.ts / reflect.ts  # ← eventos com node da estratégia
│   └── (reflect node = withReflection(react) no wire do grafo)
├── agents/
│   └── index.ts                  # registry ainda útil p/ Arena; /chat usa nós do grafo
└── index.ts                      # bootstrap: monta grafo com as 3 strategies + router model
```

**Structure Decision**: Orquestração de produção em `src/graph/` (camada agente/grafo da constitution). Strategies existentes viram **nós** que delegam a `ReasoningStrategy.run`, carimbando `node`. HTTP valida override allowlisted e chama o grafo; ContextBuilder (`012`) permanece no nó **contexto**.

## Complexity Tracking

> Nenhuma violação — seção vazia de propósito.
