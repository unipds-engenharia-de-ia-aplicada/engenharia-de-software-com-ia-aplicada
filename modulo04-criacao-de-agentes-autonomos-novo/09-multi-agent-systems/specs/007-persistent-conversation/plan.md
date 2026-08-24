# Implementation Plan: Conversa Persistente

**Branch**: `007-persistent-conversation` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-persistent-conversation/spec.md`

## Summary

Persistir o fio de chat do plantonista: `ConversationStore` (`create` / `append` / `lastMessages`) com tabelas `conversations` + `messages` em SQLite (`node:sqlite`, mesmo padrão do `SqliteOpsStore`, mesmo `OPSPILOT_DB`). Estender `POST /chat` com `conversationId` opcional (devolvido na resposta); composição injeta até 12 mensagens prévias no prompt da estratégia; `metrics.historyMessages` reporta quantas foram injetadas. Testes `:memory:` do store + integração HTTP com estratégia fake.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM `strict: true`

**Primary Dependencies**: Express ^4.19, zod ^3.23, `node:sqlite` (`DatabaseSync`); estratégias existentes sem mudança de interface `run(input: string)`

**Storage**: SQLite via `SqliteConversationStore` no mesmo path `OPSPILOT_DB` (default `./data/opspilot.db`); `:memory:` nos testes do store e nos testes HTTP de conversa

**Testing**: `node:test` via `tsx`; store `:memory:`; `/chat` com fake strategy + `SqliteConversationStore(":memory:")`; sem rede LLM

**Target Platform**: Node.js processo local (HTTP `/chat` + bootstrap)

**Project Type**: Web service sobre agente existente; fatia `store` + composição HTTP

**Performance Goals**: `lastMessages(12)` e turno fake em `:memory:` < 1s na suíte; sem meta multi-writer

**Constraints**: Prepared statements only; DDL idempotente; validação zod na fronteira; camadas `http → composition → strategy`; limite fixo 12; CLI/Arena/bench fora de escopo

**Scale/Scope**: 1 store novo; extensão de `/chat` + schema + métricas; ~8–12 arquivos; 2 tabelas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | Histórico alimenta o prompt da estratégia; persistência é infra de suporte |
| 2 | **Camadas explícitas** | ✅ PASS | `ConversationStore` em `store/`; composição em `http` (ou helper); domínio sem `DatabaseSync` |
| 3 | **Validação na fronteira** | ✅ PASS | `conversationId` no schema zod de `/chat`; id inexistente → erro de domínio antes de `run` |
| 4 | **Erros são de domínio** | ✅ PASS | `ConversationNotFoundError` → `404` na borda |
| 5 | **Teste é parte da tarefa** | ✅ PASS | FR-011/FR-012 — `:memory:` + fake |
| 6 | **Segurança por padrão** | ✅ PASS | Sem secrets novos; prepared statements; path via `OPSPILOT_DB` |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | Store + compose + wire `/chat` + métrica; estratégias intocadas |

**Stack**: ✅ SQLite via `node:sqlite`; sem ORM.

**Gate result: ALL PASS** — Complexity Tracking não necessário.

**Re-check pós Phase 1**: contratos HTTP + data-model mantêm store atrás da interface e composição na borda HTTP. Gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/007-persistent-conversation/
├── plan.md                 # Este arquivo
├── research.md             # Phase 0
├── data-model.md           # Phase 1
├── quickstart.md           # Phase 1
├── contracts/
│   ├── conversation-store.md  # Contrato ConversationStore
│   └── chat-http.md           # Extensão POST /chat (conversationId + historyMessages)
└── tasks.md                # Phase 2 (/speckit.tasks — NÃO gerado aqui)
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── types.ts                 # ← ConversationStore, ConversationMessage, ExecutionMetrics.historyMessages?
│   └── errors.ts                # ← ConversationNotFoundError
├── store/
│   ├── sqlite-conversation-store.ts      # NOVO
│   └── sqlite-conversation-store.test.ts # NOVO (:memory:)
├── chat/   # OU http/ — helper de composição
│   └── compose-prompt.ts        # NOVO: formatHistoryPrompt + HISTORY_LIMIT=12
├── http/
│   ├── chat-schema.ts           # ← conversationId opcional (uuid)
│   ├── server.ts                # ← deps.conversations; fluxo create/load → compose → run → append
│   └── server.test.ts           # ← fake + :memory: conversation store
├── index.ts                     # ← instancia SqliteConversationStore(mesmo path) e injeta em createApp
└── (estratégias intocadas — continuam run(string))
```

**Structure Decision**: Projeto único. `SqliteConversationStore` separado do `SqliteOpsStore` (interfaces distintas), mesmo arquivo DB via `OPSPILOT_DB`. Composição de prompt na camada HTTP/helper — sem alterar `ReasoningStrategy`. Testes co-localizados.

## Complexity Tracking

> Nenhuma violação — seção vazia de propósito.
