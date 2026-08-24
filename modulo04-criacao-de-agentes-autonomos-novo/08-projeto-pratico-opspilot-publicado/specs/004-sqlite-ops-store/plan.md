# Implementation Plan: Persistência Real de Operações

**Branch**: `004-sqlite-ops-store` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-sqlite-ops-store/spec.md`

## Summary

Substituir o store efêmero de produção por `SqliteOpsStore` (`node:sqlite` / `DatabaseSync`), com schema idempotente de 4 tabelas, seed Mercadinho idempotente (incl. runbooks), prepared statements only, e composição via `OPSPILOT_DB`. Ampliar o contrato `OpsStore` (ex-`IStore`) com listagem de incidentes e consulta de runbook; expor tools `list_incidents` e `consultar_runbook`; alinhar todas as descrições em `src/agents/tools.ts` às 6 regras. In-memory permanece para bench e testes de reprodução; testes de store/tools SQLite usam `:memory:`.

## Technical Context

**Language/Version**: Node.js 22+ LTS (módulo `node:sqlite` experimental), TypeScript ESM `strict: true`

**Primary Dependencies**: `node:sqlite` (`DatabaseSync`, `StatementSync`), zod ^3.23, LangChain tools existentes; **remover** `mysql2` / `sequelize` (fora da constitution v2.0.0)

**Storage**: SQLite arquivo (`OPSPILOT_DB`, default `./data/opspilot.db`); `:memory:` em testes automatizados do store/tools SQLite; `InMemoryStore` para bench

**Testing**: `node:test` via `tsx`; sem rede; CHECKs exercitados via INSERT inválido no `:memory:`

**Target Platform**: Node.js processo local (dev / arena / bench / HTTP)

**Project Type**: Biblioteca de agente + web service; esta feature é camada `store` + tools

**Performance Goals**: Seed + queries de listagem em `:memory:` < 1s na suíte; sem meta de throughput multi-writer

**Constraints**: Prepared statements only; DDL/seed idempotentes; `data/` no `.gitignore`; camadas `http/cli → agent → tools → store`; validação zod nas tools; constitution stack SQLite

**Scale/Scope**: 1 implementação SQLite nova; extensão de domínio/tools/seed; ~8–12 arquivos tocados; 4 tabelas; 2 tools novas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | Capacidades novas viram tools do grafo (`list_incidents`, `consultar_runbook`); SQLite é infra de suporte |
| 2 | **Camadas explícitas** | ✅ PASS | `SqliteOpsStore` em `store/`; tools consomem `OpsStore`; domínio sem `DatabaseSync` direto |
| 3 | **Validação na fronteira** | ✅ PASS | Schemas zod nas tools (enums + `.describe()`); CHECK no SQL como segunda linha de defesa |
| 4 | **Erros são de domínio** | ✅ PASS | `IncidentNotFoundError`, `RunbookNotFoundError` (novo); tools devolvem string descritiva ao agente |
| 5 | **Teste é parte da tarefa** | ✅ PASS | FR-013/FR-014 — `:memory:`, filtros, CHECKs, tools |
| 6 | **Segurança por padrão** | ✅ PASS | Sem secrets; path via env; sem SQL concatenado (FR-007) |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | Fatia store + tools + seed + wire bootstrap; bench inalterado em estratégia |

**Stack**: ✅ SQLite via `node:sqlite`; sem Sequelize/MySQL.

**Gate result: ALL PASS** — Complexity Tracking não necessário.

**Re-check pós Phase 1**: contratos de tools + data-model mantêm store atrás da interface e tools no grafo. Gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/004-sqlite-ops-store/
├── plan.md                 # Este arquivo
├── research.md             # Phase 0
├── data-model.md           # Phase 1
├── quickstart.md           # Phase 1
├── contracts/
│   ├── ops-store.md        # Contrato OpsStore
│   └── tools.md            # Contratos das 5 tools (3 existentes + 2 novas)
└── tasks.md                # Phase 2 (/speckit.tasks — NÃO gerado aqui)
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── types.ts              # ← OpsStore (ex-IStore), Runbook, Service.tier, Incident.summary
│   └── errors.ts             # ← RunbookNotFoundError
├── store/
│   ├── sqlite-ops-store.ts   # NOVO: SqliteOpsStore (DDL, prepared stmts, seed)
│   ├── sqlite-ops-store.test.ts  # NOVO: :memory: seed/CRUD/filtros/CHECK
│   ├── in-memory-store.ts    # ← implementa OpsStore (bench + parity)
│   ├── in-memory-store.test.ts
│   ├── seed.ts               # ← seed idempotente OpsStore-agnostic + runbooks
│   └── seed-data.json        # ← Mercadinho (services+tier, alerts, runbooks)
├── agents/
│   └── tools.ts              # ← 5 tools; descrições 6 regras; .describe() + enums
├── tools/                    # re-exports existentes (opcional: novos re-exports)
├── index.ts                  # ← bootstrap injeta SqliteOpsStore + seed
├── arena.ts                  # pode permanecer InMemoryStore (CLI efêmero) OU SQLite — ver research
└── bench.ts                  # MUST permanecer InMemoryStore

.gitignore                    # ← data/
package.json                  # ← remover mysql2, sequelize
```

**Structure Decision**: Projeto único. Persistência nova em `src/store/sqlite-ops-store.ts`. Interface e tipos em `domain/`. Tools continuam canônicas em `src/agents/tools.ts`. Testes co-localizados. Sem pasta `tests/` separada.

## Complexity Tracking

> Nenhuma violação — seção vazia de propósito.
