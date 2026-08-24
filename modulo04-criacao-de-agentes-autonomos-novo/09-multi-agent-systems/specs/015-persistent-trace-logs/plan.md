# Implementation Plan: Trace Persistido + Logs JSON

**Branch**: `015-persistent-trace-logs` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/015-persistent-trace-logs/spec.md`

## Summary

Persistir cada turno de `POST /chat` em SQLite (`requests` + `trace_events`), expor correlação via `requestId` (corpo + `X-Request-Id`), consultar com `GET /requests/:id`, e emitir logs estruturados em `src/obs/logger.ts` (1 linha JSON / só metadados). Store dedicado no mesmo `OPSPILOT_DB`, padrão dos stores 004/007; gravação best-effort pós-turno.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM `strict: true`

**Primary Dependencies**: Express (borda HTTP); `node:sqlite` (`DatabaseSync`); `zod` (validação `:id`); `crypto.randomUUID()`; domínio `TraceEvent` / `ExecutionMetrics`

**Storage**: SQLite via `OPSPILOT_DB` (default `./data/opspilot.db`); testes `:memory:`; tabelas novas `requests` e `trace_events` no mesmo arquivo que ops/conversations/memories

**Testing**: `node:test` via `tsx`; store + logger unitários; HTTP integração com turn fake / deps injetadas (sem rede)

**Target Platform**: Node.js processo local (HTTP `/chat` + auditoria)

**Project Type**: Web service + agente; fatia store + obs + HTTP

**Performance Goals**: Persistência pós-turno não bloqueia UX além de write local; `GET /requests/:id` ≤ 2s em teste local (SC-002)

**Constraints**: Logs sem payloads/mensagem completa; falha de write não vira 5xx se o turno já tem resposta; sem auth/TTL v1; um `DatabaseSync` por store (padrão atual)

**Scale/Scope**: Novo store + logger + 2 rotas HTTP estendidas; ~8–12 arquivos + testes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | Auditoria/obs são infra de suporte ao grafo; não movem lógica do agente |
| 2 | **Camadas explícitas** | ✅ PASS | `http → RequestStore / logger`; store não chama HTTP; domínio tipa entidades |
| 3 | **Validação na fronteira** | ✅ PASS | `GET /requests/:id` valida id (zod/uuid); `/chat` já validado |
| 4 | **Erros são de domínio** | ✅ PASS | `404` request ausente; `400` id inválido; persist fail → log, não 5xx de sucesso |
| 5 | **Teste é parte da tarefa** | ✅ PASS | FR-011 / SC-001–005 |
| 6 | **Segurança por padrão** | ✅ PASS | Logs só metadados; sem secrets; sem auth nova (mesmo nível `/chat`) |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | Store + logger + wire HTTP |

**Stack**: ✅ `node:sqlite` / sem ORM; alinhado à constitution 2.0.0.

**Gate result: ALL PASS** — Complexity Tracking não necessário.

**Re-check pós Phase 1**: contratos separam RequestStore, logger metadata-only, extensão `/chat` + `GET /requests/:id`. Gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/015-persistent-trace-logs/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── chat-http.md
│   ├── request-store.md
│   └── logger.md
└── tasks.md                # /speckit.tasks — NÃO gerado aqui
```

### Source Code (repository root)

```text
src/
├── obs/
│   ├── logger.ts                 # NOVO: 1 linha JSON / metadados
│   └── logger.test.ts            # NOVO
├── store/
│   ├── sqlite-request-store.ts   # NOVO: requests + trace_events
│   └── sqlite-request-store.test.ts
├── domain/
│   ├── types.ts                  # ← RequestRecord / RequestStore interface (+ status)
│   └── errors.ts                 # ← RequestNotFoundError (ou equivalente)
├── http/
│   ├── server.ts                 # ← requestId, X-Request-Id, persist, GET /requests/:id
│   ├── chat-schema.ts            # ← requestIdParamSchema (ou sibling)
│   └── server.test.ts            # ← correlação, GET, 404, logger spy
└── index.ts                      # ← SqliteRequestStore(dbPath) → createApp
```

**Structure Decision**: Quarto store SQLite no mesmo `dbPath` (espelha conversation/memory), interface `RequestStore` no domínio, logger puro em `src/obs/` sem I/O de banco. HTTP orquestra mint id → turn → log → best-effort save → resposta.

## Complexity Tracking

> Nenhuma violação — seção vazia de propósito.
