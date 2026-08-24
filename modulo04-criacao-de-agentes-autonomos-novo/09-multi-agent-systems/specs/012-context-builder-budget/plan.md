# Implementation Plan: ContextBuilder com Orçamento por Seção

**Branch**: `012-context-builder-budget` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-context-builder-budget/spec.md`

## Summary

Introduzir `src/context/context-builder.ts` como **ponto único** que monta as seções do prompt (system, resumo, janela, memórias, mensagem) para **todas** as estratégias via `runChat`, aplicando tetos por seção (`CONTEXT_BUDGET_*`, defaults 200 / 1200 / 300). System e mensagem atual são intocáveis; janela corta as mais antigas; memórias cortam menor score; resumo trunca texto. Métricas (`contextBreakdown`, `historyMessages`, `recalledMemories`) refletem o **pós-corte**. Testes com tetos baixos validam a ordem.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM `strict: true`

**Primary Dependencies**: zod (parse de env na borda do builder); `estimateTokens` de `src/context/tokens.ts`; sem novas deps externas

**Storage**: N/A (só composição em memória; lê dados já carregados por `runChat` / 008 / 011)

**Testing**: `node:test` via `tsx`; fixtures determinísticas; tetos injetáveis (opts > env); sem rede LLM

**Target Platform**: Node.js processo local (HTTP `/chat` + strategies)

**Project Type**: Web service + agente; fatia `context/` + wire em `run-chat`

**Performance Goals**: Composição O(n) na janela (≤8) e memórias (≤3 recall); negligível vs LLM

**Constraints**: Não alterar system/mensagem; coexistir com HISTORY_LIMIT=8 e recall top-K; métricas pós-orçamento; strategies continuam recebendo `StrategyRunInput` (conteúdo já orçado)

**Scale/Scope**: Novo módulo + testes + refator de enrich em `runChat`; ~8–12 arquivos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | Builder alimenta o prompt do agente; não substitui tools/grafo |
| 2 | **Camadas explícitas** | ✅ PASS | `context/` puro; `run-chat` orquestra; strategies consomem resultado |
| 3 | **Validação na fronteira** | ✅ PASS | Env `CONTEXT_BUDGET_*` parseada com fallback (zod/number) |
| 4 | **Erros são de domínio** | ✅ PASS | Config inválida → defaults; sem quebrar turno |
| 5 | **Teste é parte da tarefa** | ✅ PASS | FR-009 / SC-001 ordem de corte |
| 6 | **Segurança por padrão** | ✅ PASS | Sem segredos; env via `--env-file` |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | Camada aditiva; enrich atual migra para o builder |

**Stack**: ✅ Sem ORM novo; reusa tokens/estimateTokens.

**Gate result: ALL PASS** — Complexity Tracking não necessário.

**Re-check pós Phase 1**: contratos mantêm builder puro, env canônicas, métricas pós-corte, strategies via `runChat`. Gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/012-context-builder-budget/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── context-builder.md
│   └── chat-http.md
└── tasks.md                # /speckit.tasks — NÃO gerado aqui
```

### Source Code (repository root)

```text
src/
├── context/
│   ├── tokens.ts                    # (existente) estimateTokens / buildContextBreakdown
│   ├── context-builder.ts           # NOVO: budgets + cortes + assemble
│   └── context-builder.test.ts      # NOVO: tetos baixos / ordem / intocáveis
├── chat/
│   ├── run-chat.ts                  # ← usa buildContext; métricas pós-corte
│   ├── history-summarizer.ts        # formatSummaryForPrompt pode ser reexportado/usado pelo builder
│   └── compose-prompt.test.ts       # ← asserts pós-orçamento
├── agents/
│   ├── react.ts                     # inalterado no contrato StrategyRunInput (recebe já orçado)
│   └── system-prompt.ts             # OPSPILOT_SYSTEM_PROMPT (intocável)
├── strategies/
│   ├── plan-execute.ts              # idem — history/message já orçados
│   └── reflect.ts                   # idem
└── domain/
    └── types.ts                     # opcional: tipos ContextBuildInput/Result se exportados do domínio
```

**Structure Decision**: Lógica de orçamento em `src/context/context-builder.ts` (puro, testável). `runChat` deixa de montar envelopes ad hoc e chama o builder após `lastMessages` + `getSummary` + `recall`. Strategies **não** leem env de budget — só consomem `StrategyRunInput` já cortado (FR-002 satisfeito no caminho `/chat`).

## Complexity Tracking

> Nenhuma violação — seção vazia de propósito.
