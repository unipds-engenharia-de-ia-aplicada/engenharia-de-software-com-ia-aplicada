# Implementation Plan: Reflection Layer

**Branch**: `002-reflection-layer` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-reflection-layer/spec.md`

## Summary

Adiciona a função `withReflection(strategy, opts?)` — um decorator funcional que envolve qualquer `ReasoningStrategy` com um ciclo crítico–regeneração. Um crítico (LLM em produção, mock injetável em testes) avalia cada resposta; `approved: false` injeta o feedback no próximo `run()`; o ciclo repete até `approved: true` ou `maxReflections` (padrão: 2). Métricas acumulam todas as chamadas extras. A Arena reconhece `reflect:react` e `reflect:plan-and-execute` via `--strategies`.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM `strict: true`

**Primary Dependencies**: `zod` ^3.23, `@langchain/core` ^0.3, `@langchain/openai` ^0.3 (reutilização da factory de modelo existente)

**Storage**: N/A — estado de reflexão em memória, volátil por execução

**Testing**: `node:test` nativo via `tsx` — 100% determinístico com mocks de estratégia e crítico (sem rede)

**Target Platform**: Node.js 22 LTS (CLI + API)

**Project Type**: Extensão de biblioteca (decorator) + integração CLI (Arena)

**Performance Goals**: Zero overhead com `maxReflections: 0`; +1 `llmCalls` de overhead para aprovação imediata do crítico

**Constraints**: Testes sem rede; `npm run typecheck` e `npm test` sempre verdes; `strict: true` sem erros

**Scale/Scope**: Extensão de projeto único; < 200 LOC novos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** — nova capacidade vira nó/ferramenta do grafo | ✅ PASS | `withReflection` envolve a `ReasoningStrategy` (unidade de execução do grafo); sem Express/MySQL novo |
| 2 | **Camadas explícitas** — dependências fluem em uma única direção | ✅ PASS | Decorator vive em `src/strategies/`; consome apenas `domain/types.ts`; sem I/O direto |
| 3 | **Validação na fronteira** — toda saída do LLM validada com `zod` | ✅ PASS | `CritiqueResult` validado via zod antes de qualquer branch de lógica (FR-003, FR-012) |
| 4 | **Erros são de domínio** — falhas propagadas sem modificação | ✅ PASS | Erros da estratégia base propagam sem modificação (FR-011); fail-safe no crítico não gera exceção |
| 5 | **Teste é parte da tarefa** — nenhuma lógica nova sem teste | ✅ PASS | SC-001 exige suite determinística cobrindo todos os cenários de reflexão |
| 6 | **Segurança por padrão** — sem segredos, ações destrutivas com guardrails | ✅ PASS | Reutiliza model factory existente; sem novas env vars ou segredos |
| 7 | **Spec antes de código** — fase atual | ✅ PASS | — |
| 8 | **Pequeno e reversível** — cada tarefa cabe em um commit | ✅ PASS | Decorator pattern: 1 arquivo novo, sem migrações DB, sem mudanças em esquemas existentes |

**Gate result: ALL PASS** — sem violações; Complexity Tracking não é necessário.

## Project Structure

### Documentation (this feature)

```text
specs/002-reflection-layer/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── reflect-decorator.md   # Phase 1 output — API TypeScript do decorator
│   └── arena-cli.md           # Phase 1 output — extensão do CLI da Arena
└── tasks.md             # Phase 2 output (speckit.tasks — NOT gerado por speckit.plan)
```

### Source Code (repository root)

```text
src/
├── domain/
│   └── types.ts              # ← adicionar campos opcionais a TraceEvent (round, approved, timestampMs)
├── strategies/
│   ├── react.ts              # existente — sem alterações
│   ├── plan-execute.ts       # existente — sem alterações
│   ├── reflect.ts            # NOVO: withReflection, CriticFn, createLLMCritic
│   └── reflect.test.ts       # NOVO: testes unitários (node:test, 100% determinístico)
└── arena.ts                  # ← estender StrategyName + createStrategy para reflect:*
```

**Structure Decision**: Projeto único existente. O decorator é co-localizado com as outras estratégias em `src/strategies/`. Testes inline com o código de produção (`reflect.test.ts` ao lado de `reflect.ts`), seguindo o padrão já usado em `store/in-memory-store.test.ts` e `trace/builder.test.ts`.
