# Implementation Plan: Refletor de Aprendizado

**Branch**: `009-learning-reflector` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-learning-reflector/spec.md`

## Summary

Após cada turno bem-sucedido de `/chat`, um **LearningReflector** (LangChain `withStructuredOutput` → `{ hasLearning, fact }`) analisa a última mensagem do usuário e, se houver fato **durável** (não pedido pontual, não segredo), agenda `MemoryStore.remember` de forma **assíncrona** (fire-and-forget) sem atrasar o `200`. Nova tool `forget_preference` (recall + forget, escopo `userId` via AsyncLocalStorage) no catálogo do agente. Distinto do critique `withReflection` (`002`). Reutiliza memória semântica (`008`).

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM `strict: true`

**Primary Dependencies**: zod, `@langchain/openai` (`withStructuredOutput` — mesmo padrão de `createLLMCritic` / plan-execute), `@langchain/core/tools`, `node:async_hooks` (`AsyncLocalStorage`)

**Storage**: Reutiliza `MemoryStore` / `SqliteMemoryStore` (`008`); sem tabela nova

**Testing**: `node:test` via `tsx`; refletor fake injetável; FakeEmbedder + `:memory:` memory store; HTTP fake strategy; sem rede LLM nos testes de aceite

**Target Platform**: Node.js processo local (HTTP `/chat` + tools do agente)

**Project Type**: Web service + agente; fatia `memory/learning` + tool + wire em `runChat`

**Performance Goals**: Caminho `/chat` até `200` não awaits remember; refletor LLM roda em background (best-effort)

**Constraints**: Fail-safe (erro do refletor/remember não quebra resposta); isolamento por `userId`; MCP **não** expõe `forget_preference` (allowlist atual); distinto de reflection critique

**Scale/Scope**: 1 módulo refletor + 1 tool + ALS context + wire `runChat`/`createTools`/`index`; ~8–12 arquivos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | Aprendizado alimenta memória do agente; `forget_preference` é tool do grafo |
| 2 | **Camadas explícitas** | ✅ PASS | Refletor em `src/memory/`; tool wrapper em `agents/tools`; orquestração em `chat/run-chat` |
| 3 | **Validação na fronteira** | ✅ PASS | Schema zod `learningReflectionSchema`; schema da tool; parse da saída LLM |
| 4 | **Erros são de domínio** | ✅ PASS | Falhas do refletor/remember engolidas no caminho assíncrono; tool retorna string observação |
| 5 | **Teste é parte da tarefa** | ✅ PASS | FR-009 — fake reflector + forget + não-bloqueio |
| 6 | **Segurança por padrão** | ✅ PASS | Prompt/schema proíbe segredos e pontuais; `userId` via ALS (tool não aceita userId arbitrário do modelo) |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | Sem migration; reusa MemoryStore; fire-and-forget |

**Stack**: ✅ Sem ORM; LLM via OpenRouter já no projeto.

**Gate result: ALL PASS** — Complexity Tracking não necessário.

**Re-check pós Phase 1**: contratos mantêm refletor atrás de interface injetável e forget com ALS. Gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/009-learning-reflector/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── learning-reflector.md
│   └── forget-preference.md
└── tasks.md                # /speckit.tasks — NÃO gerado aqui
```

### Source Code (repository root)

```text
src/
├── memory/
│   ├── learning-reflector.ts      # NOVO: schema + createLearningReflector + scheduleLearning
│   ├── learning-reflector.test.ts # NOVO
│   ├── chat-user-context.ts       # NOVO: AsyncLocalStorage<{ userId }>
│   ├── memory-store.ts            # (008) reusado
│   └── ...
├── tools/   # OU só em agents/tools
│   └── (opcional helper forget-preference.ts se I/O extrair)
├── agents/
│   ├── tools.ts                   # ← createForgetPreferenceTool; createTools(+ memories)
│   └── tools.test.ts              # ← 7 tools; forget_preference
├── chat/
│   └── run-chat.ts                # ← após sucesso: enter ALS + scheduleLearning (não await)
├── http/
│   ├── server.ts                  # ← deps.learningReflector? (ou via runChat options / bootstrap)
│   └── server.test.ts
├── index.ts                       # ← wire reflector + memories em createTools
└── mcp/                           # intocado (allowlist sem forget_preference)
```

**Structure Decision**: Refletor em `src/memory/` (junto à memória semântica). Tool registrada em `createTools` com `MemoryStore`. `userId` de request via `AsyncLocalStorage` setado em `runChat` durante `strategy.run` e no schedule pós-turno. Estratégias e critique (`002`) intocados.

## Complexity Tracking

> Nenhuma violação — seção vazia de propósito.
