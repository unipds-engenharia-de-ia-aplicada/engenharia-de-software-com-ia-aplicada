# Implementation Plan: Sumarização de Histórico (Pruning)

**Branch**: `011-history-summarization` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-history-summarization/spec.md`

## Summary

Pruning de histórico longo: janela bruta **`HISTORY_LIMIT = 8`**; o que sai da janela é condensado (~150 tokens, decisões/fatos/pendências) por um **Summarizer** injetável, **mesclado** ao resumo anterior e persistido em **`conversation_summaries`** com watermark `covered_count`. Recompute **somente** quando ≥ 8 mensagens novas saíram da janela desde o watermark (máx. 1 lote/turno). Resumo entra no contexto do `/chat`; evento de trace **`summarize`**. Testes com fake (sem LLM).

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM `strict: true`

**Primary Dependencies**: zod, `@langchain/openai` (sumarizador LLM opcional em prod), SQLite `node:sqlite` (`DatabaseSync`)

**Storage**: Tabela nova `conversation_summaries` no mesmo DB/`OPSPILOT_DB` que `SqliteConversationStore`

**Testing**: `node:test` via `tsx`; summarizer fake + `:memory:`; estratégia fake; sem rede LLM no aceite

**Target Platform**: Node.js processo local (HTTP `/chat`)

**Project Type**: Web service + agente; fatia `chat/summarize` + extensão do conversation store

**Performance Goals**: Sumarização no máximo 1×/turno e só em lote completo; caminho sem disparo = 1–2 reads SQLite extras

**Constraints**: Fail-safe (erro do summarizer não quebra 200; watermark só avança após upsert OK); não sumarizar a cada request; coexistir com 008–010

**Scale/Scope**: Extensão store + módulo summarizer + wire `runChat` + ajuste HISTORY_LIMIT/tests; ~10–14 arquivos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | Resumo alimenta contexto do agente; não substitui tools |
| 2 | **Camadas explícitas** | ✅ PASS | Store em `store/`; summarizer em `chat/`; orquestração em `run-chat` |
| 3 | **Validação na fronteira** | ✅ PASS | Schema/zod na saída LLM do summarizer (prod); fake tipado |
| 4 | **Erros são de domínio** | ✅ PASS | Fail-safe no turno; ConversationNotFoundError inalterado |
| 5 | **Teste é parte da tarefa** | ✅ PASS | FR-010 / fake obrigatório |
| 6 | **Segurança por padrão** | ✅ PASS | Sem segredos; prompt de resumo evita copiar credenciais (prod) |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | DDL idempotente; HISTORY_LIMIT 12→8; porta injetável |

**Stack**: ✅ Sem ORM; SQLite `node:sqlite`; LLM via OpenRouter já no projeto.

**Gate result: ALL PASS** — Complexity Tracking não necessário.

**Re-check pós Phase 1**: contratos mantêm summarizer injetável, watermark e evento `summarize`. Gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/011-history-summarization/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── conversation-summary.md
│   └── chat-http.md
└── tasks.md                # /speckit.tasks — NÃO gerado aqui
```

### Source Code (repository root)

```text
src/
├── domain/
│   └── types.ts                 # ← TraceEventType + "summarize"; ConversationStore APIs; ContextBreakdown.summary?
├── store/
│   ├── sqlite-conversation-store.ts  # ← DDL conversation_summaries + count/getBatch/get/upsert summary
│   └── sqlite-conversation-store.test.ts
├── chat/
│   ├── history-summarizer.ts    # NOVO: porta + createLLMSummarizer + maybeSummarize helpers
│   ├── history-summarizer.test.ts
│   ├── run-chat.ts              # ← HISTORY_LIMIT=8; maybeSummarize; inject summary; trace
│   └── compose-prompt.test.ts   # ← janela 8 + fake summarize
├── context/
│   └── tokens.ts                # ← (opcional) breakdown.summary
├── http/
│   ├── server.ts                # ← deps.summarizer?
│   └── server.test.ts           # ← historyMessages ≤ 8; summarize event
└── index.ts                     # ← wire LLM summarizer em prod
```

**Structure Decision**: Lógica de watermark/lote em `chat/history-summarizer.ts` (puro + I/O via store). Persistência na mesma classe `SqliteConversationStore` (mesmo arquivo DB). `runChat` orquestra no **início** do turno (mensagens já persistidas), antes do append da mensagem atual.

## Complexity Tracking

> Nenhuma violação — seção vazia de propósito.
