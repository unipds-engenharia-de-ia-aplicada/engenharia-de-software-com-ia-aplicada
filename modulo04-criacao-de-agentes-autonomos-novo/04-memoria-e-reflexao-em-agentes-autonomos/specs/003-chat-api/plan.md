# Implementation Plan: Chat HTTP API

**Branch**: `003-chat-api` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-chat-api/spec.md`

## Summary

Expor `POST /chat` via Express em `src/http/server.ts`: body `{ message, strategy?, reflect? }` validado com zod (default `strategy=react`, `reflect=false`); sucesso `200` com `{ answer, trace, metrics }`; `400` com issues zod; `422` se o nome não estiver no registry; timeout 180s → `504`. Registry nome→estratégia em `src/agents/index.ts`; `reflect:true` aplica `withReflection`. Integração testada com estratégia fake determinística (sem rede). `src/index.ts` sobe o servidor (`npm run dev`).

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM `strict: true`

**Primary Dependencies**: Express ^4.19, zod ^3.23, `withReflection` (`src/strategies/reflect.ts`), estratégias existentes (`react`, `plan-and-execute`)

**Storage**: N/A — request/response em memória; reutiliza store in-memory do bootstrap para produção

**Testing**: `node:test` via `tsx`; integração HTTP com `createApp` + porta efêmera + `fetch` (sem rede LLM); timeout injetável nos testes

**Target Platform**: Node.js 22 LTS (servidor HTTP local / processo `dev`)

**Project Type**: Web service (API HTTP) sobre biblioteca de estratégias existente

**Performance Goals**: Happy path com fake strategy < 5s (SC-004); timeout de produção 180s

**Constraints**: Testes de contrato/integração sem rede; `typecheck` + `test` verdes; validação zod na fronteira; sem autenticação/SSE nesta fatia

**Scale/Scope**: 1 rota; ~4–6 arquivos novos; < 300 LOC estimados

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | HTTP só resolve registry e chama `ReasoningStrategy.run`; não introduz lógica operacional fora do grafo/estratégia |
| 2 | **Camadas explícitas** | ✅ PASS | `http` → registry/agents → strategies → tools/store; domínio sem I/O HTTP |
| 3 | **Validação na fronteira** | ✅ PASS | Body validado com zod antes de qualquer `run()` (FR-002, FR-006) |
| 4 | **Erros são de domínio** | ✅ PASS | `UnknownStrategyError`, `ChatTimeoutError` (e mapeamento de `ZodError`) traduzidos na borda HTTP |
| 5 | **Teste é parte da tarefa** | ✅ PASS | FR-011 / SC-002–SC-005 — integração com fake strategy sem rede |
| 6 | **Segurança por padrão** | ✅ PASS | Sem novos segredos; reutiliza `--env-file` / `OPENROUTER_API_KEY` só no bootstrap de produção |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | Fatia única: schema + registry + server + wire `index` + testes |

**Gate result: ALL PASS** — Complexity Tracking não necessário.

**Re-check pós Phase 1**: design mantém as mesmas evidências (contratos HTTP + erros de domínio + app factory testável). Gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/003-chat-api/
├── plan.md                 # Este arquivo
├── research.md             # Phase 0
├── data-model.md           # Phase 1
├── quickstart.md           # Phase 1
├── contracts/
│   ├── chat-http.md        # Contrato REST POST /chat
│   └── agents-registry.md  # API do registry + resolve
└── tasks.md                # Phase 2 (/speckit.tasks — NÃO gerado aqui)
```

### Source Code (repository root)

```text
src/
├── agents/
│   └── index.ts              # NOVO: createRegistry, resolveStrategy, tipos do registry
├── domain/
│   ├── errors.ts             # ← UnknownStrategyError, ChatTimeoutError
│   └── types.ts              # existente (StrategyResult, ReasoningStrategy)
├── http/
│   ├── chat-schema.ts        # NOVO: chatRequestSchema (zod)
│   ├── server.ts             # NOVO: createApp / startServer
│   └── server.test.ts        # NOVO: integração HTTP com fake strategy
├── strategies/
│   └── reflect.ts            # existente — withReflection
└── index.ts                  # ← bootstrap + listen (alvo npm run dev)
```

**Structure Decision**: Projeto único. Camada `http/` nova (ainda não existe). Registry em `src/agents/index.ts` conforme spec. Testes co-localizados (`server.test.ts`), padrão do repositório. Sem pasta `tests/` separada.

## Complexity Tracking

> Nenhuma violação — seção vazia de propósito.
