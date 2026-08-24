# Implementation Plan: Memória Semântica

**Branch**: `008-semantic-memory` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-semantic-memory/spec.md`

## Summary

Adicionar memória semântica por `userId`: `MemoryStore` (`remember` / `recall` / `forget`) com tabela `memories` em SQLite (mesmo `OPSPILOT_DB`), embeddings locais **all-MiniLM-L6-v2** via `@huggingface/transformers` (pooling mean + normalize, lazy singleton), BLOB Float32. `remember` deduplica se similaridade (produto escalar) **> 0,92**; `recall` devolve top-3 com score **≥ 0,3**. `POST /chat` passa a exigir `userId`, faz recall da mensagem e injeta os fatos no prompt (junto ao histórico de `007`). Teste obrigatório: recall acha fato sem palavra em comum.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM `strict: true`

**Primary Dependencies**: Express ^4.19, zod ^3.23, `node:sqlite` (`DatabaseSync`); **novo** `@huggingface/transformers` (pipeline `feature-extraction`, modelo `Xenova/all-MiniLM-L6-v2`)

**Storage**: SQLite tabela `memories` via `SqliteMemoryStore` no path `OPSPILOT_DB` (default `./data/opspilot.db`); `:memory:` nos testes do store; embedding 384-d em BLOB (`Float32Array` ↔ `Buffer`)

**Testing**: `node:test` via `tsx`; store `:memory:` + embedder injetável para unitários; **um** teste de integração semântica com modelo real (timeout generoso; cache HF); `/chat` com fake strategy + memory store + embedder fake ou real conforme caso

**Target Platform**: Node.js processo local (HTTP `/chat` + bootstrap)

**Project Type**: Web service sobre agente existente; fatia `memory/` + extensão composição `/chat`

**Performance Goals**: recall sobre dezenas de memórias/usuário < 1s em `:memory:` (brute-force OK); cold start do modelo aceitável na 1ª chamada (lazy)

**Constraints**: Prepared statements; DDL idempotente; validação zod na fronteira; camadas `http → chat → memory/store`; limiares fixos 0,92 / 0,3; top-3; sem ORM; CLI/Arena/MCP/tools de remember fora de escopo nesta feature

**Scale/Scope**: 1 store + 1 módulo embeddings; extensão `/chat` + schema + métrica opcional `recalledMemories`; ~8–12 arquivos; 1 tabela

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | Recall alimenta o prompt da estratégia; embeddings/store são infra |
| 2 | **Camadas explícitas** | ✅ PASS | `src/memory/` + interface em domínio; HTTP/chat orquestra; domínio sem `DatabaseSync` direto |
| 3 | **Validação na fronteira** | ✅ PASS | `userId` no schema zod de `/chat`; fact/query vazios rejeitados no store |
| 4 | **Erros são de domínio** | ✅ PASS | Falha de carga do modelo → erro de domínio; traduzido na borda se atingir HTTP |
| 5 | **Teste é parte da tarefa** | ✅ PASS | FR-009/FR-010 — store + teste semântico + `/chat` |
| 6 | **Segurança por padrão** | ✅ PASS | Sem secrets novos; prepared statements; isolamento por `user_id`; path via `OPSPILOT_DB` |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | memory + wire chat; estratégias intocadas (só enriquecimento do `message` na composição) |

**Stack**: ✅ SQLite via `node:sqlite`; `@huggingface/transformers` é dependência explícita da spec (embeddings locais).

**Gate result: ALL PASS** — Complexity Tracking não necessário.

**Re-check pós Phase 1**: contratos MemoryStore + chat-http + data-model mantêm embedder atrás de interface, store sob `src/memory/`, injeção no `runChat`. Gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/008-semantic-memory/
├── plan.md                 # Este arquivo
├── research.md             # Phase 0
├── data-model.md           # Phase 1
├── quickstart.md           # Phase 1
├── contracts/
│   ├── memory-store.md     # Contrato MemoryStore + Embedder
│   └── chat-http.md        # Extensão POST /chat (userId + recall no prompt)
└── tasks.md                # Phase 2 (/speckit.tasks — NÃO gerado aqui)
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── types.ts                 # ← MemoryStore, MemoryFact, RecalledMemory, Embedder?, metrics.recalledMemories?
│   └── errors.ts                # ← EmbeddingError (falha carga/inferência)
├── memory/
│   ├── embeddings.ts            # NOVO: lazy singleton Xenova/all-MiniLM-L6-v2
│   ├── embeddings.test.ts       # NOVO: smoke opcional / unit do wrapper se útil
│   ├── memory-store.ts          # NOVO: SqliteMemoryStore
│   └── memory-store.test.ts     # NOVO: :memory: + fake embedder + 1 teste semântico real
├── chat/
│   └── run-chat.ts              # ← userId + recall + formatMemoriesForPrompt; métrica
├── http/
│   ├── chat-schema.ts           # ← userId: z.string().min(1)
│   ├── server.ts                # ← deps.memories; passa userId a runChat
│   └── server.test.ts           # ← fake + memory :memory: + userId
├── index.ts                     # ← instancia SqliteMemoryStore(mesmo path) e injeta
└── (estratégias intocadas — recebem message já enriquecido e history)
```

**Structure Decision**: Projeto único. Módulo `src/memory/` separado de `src/store/` (contrato semântico + embeddings, não ops/conversa). Mesmo arquivo DB via `OPSPILOT_DB`. Composição de memórias em `runChat` (prefixo no `message`); `history` de `007` permanece. Agent tools `remember`/`forget` **fora** desta feature.

## Complexity Tracking

> Nenhuma violação — seção vazia de propósito.
