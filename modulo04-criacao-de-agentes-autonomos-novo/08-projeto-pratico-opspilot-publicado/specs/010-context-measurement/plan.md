# Implementation Plan: Medição de Contexto

**Branch**: `010-context-measurement` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-context-measurement/spec.md`

## Summary

Instrumentar observabilidade de contexto: módulo `src/context/tokens.ts` com `estimateTokens` (chars/4, `Math.floor`) e leitura do usage real LangChain (`AIMessage.usage_metadata` / fallback `tokenUsage`); estender `ExecutionMetrics` e a resposta de `POST /chat` com `promptTokens` (soma real das chamadas LLM do turno) e `contextBreakdown` estimado por fonte (`system` | `history` | `memories` | `message`); atualizar `scripts/conversa-longa.sh` para imprimir `promptTokens` por turno. Sem mudança de comportamento do agente — só métricas + script + testes.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM `strict: true`

**Primary Dependencies**: `@langchain/core` (`AIMessage.usage_metadata`), zod (métricas/tipos existentes), Express `/chat` já existente

**Storage**: N/A (sem persistência nova)

**Testing**: `node:test` via `tsx`; fake strategy com `promptTokens` injetável; testes unitários de `tokens.ts` sem rede; HTTP `/chat` com fake registry

**Target Platform**: Node.js processo local (HTTP `/chat` + script bash de demo)

**Project Type**: Web service + agente; fatia `context/` + wire em strategies / `runChat` / script

**Performance Goals**: Cálculo de estimativa/breakdown O(tamanho do texto das fontes); sem I/O extra; zero impacto perceptível no `200`

**Constraints**: Não alterar answer/trace; `promptTokens` omitido quando usage indisponível (não forçar `0`); learning reflector async (`009`) fora da soma do turno; breakdown sempre presente no `/chat`

**Scale/Scope**: 1 módulo `tokens` + extensão de métricas + wire ReAct/plan-execute/reflect + `runChat` + script; ~8–12 arquivos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | Métricas observam o grafo; não substituem nós/tools |
| 2 | **Camadas explícitas** | ✅ PASS | `src/context/` utilitário; strategies reportam usage; `chat/run-chat` monta breakdown; HTTP só espelha |
| 3 | **Validação na fronteira** | ✅ PASS | Tipos de domínio; parsing defensivo de usage (sem throw); resposta HTTP tipada |
| 4 | **Erros são de domínio** | ✅ PASS | Usage ausente → omitir `promptTokens`, não falhar turno |
| 5 | **Teste é parte da tarefa** | ✅ PASS | FR-008 — unit + `/chat` fake |
| 6 | **Segurança por padrão** | ✅ PASS | Só contagens; sem logar conteúdo sensível nas métricas |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | Campos aditivos; script demo; sem migration |

**Stack**: ✅ Sem ORM; LLM via OpenRouter/LangChain já no projeto.

**Gate result: ALL PASS** — Complexity Tracking não necessário.

**Re-check pós Phase 1**: contratos separam estimativa vs usage real; breakdown em `runChat`; strategies só preenchem `promptTokens`. Gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/010-context-measurement/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── tokens.md
│   └── chat-http.md
└── tasks.md                # /speckit.tasks — NÃO gerado aqui
```

### Source Code (repository root)

```text
src/
├── context/
│   ├── tokens.ts              # NOVO: estimateTokens, readLlmUsage, sumPromptTokensFromMessages
│   └── tokens.test.ts         # NOVO
├── domain/
│   └── types.ts               # ← ExecutionMetrics: promptTokens?, contextBreakdown?
├── chat/
│   ├── run-chat.ts            # ← monta contextBreakdown; merge promptTokens da strategy
│   └── compose-prompt.test.ts # ← assert breakdown / promptTokens
├── agents/
│   └── react.ts               # ← soma usage_metadata.input_tokens das AIMessages
├── strategies/
│   ├── plan-execute.ts        # ← idem nas AIMessages / invokes que expõem usage
│   ├── reflect.ts             # ← soma promptTokens das runs + best-effort critic
│   └── reflect.test.ts        # ← métricas agregadas
├── http/
│   └── server.test.ts         # ← metrics.promptTokens + contextBreakdown
└── scripts/
    └── conversa-longa.sh      # ← imprime promptTokens por turno
```

**Structure Decision**: Utilitário puro em `src/context/` (sem I/O). Strategies preenchem `metrics.promptTokens` a partir do usage LangChain. `runChat` é a única camada que calcula `contextBreakdown` (conhece system, history, memories, message crua). HTTP e script só consomem.

## Complexity Tracking

> Nenhuma violação — seção vazia de propósito.
