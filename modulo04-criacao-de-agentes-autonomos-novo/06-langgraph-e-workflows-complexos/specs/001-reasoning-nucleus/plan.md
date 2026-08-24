# Implementation Plan: OpsPilot Reasoning Nucleus

**Branch**: `001-reasoning-nucleus` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-reasoning-nucleus/spec.md`

## Summary

Build the reasoning nucleus of OpsPilot: a TypeScript/LangGraph system that exposes two reasoning strategies (ReAct and Plan-and-Execute) over three operational tools (list alerts, open incident, resolve incident), backed by an in-memory seed store. An arena CLI runner executes any combination of strategies on the same input and prints side-by-side traces and metrics.

Technical approach: `createReactAgent` from `@langchain/langgraph/prebuilt` for the ReAct strategy; a custom three-node `StateGraph` (planner → executor → replanner) for Plan-and-Execute. Iteration limits are enforced via LangGraph's `recursionLimit`. Custom `TraceEvent` objects are reconstructed from the message history after each execution. All tool inputs are validated with `zod`.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM (`"type": "module"`, `strict: true`, `moduleResolution: NodeNext`)

**Primary Dependencies**: `@langchain/langgraph` v0.2.74, `@langchain/openai`, `@langchain/core`, `zod` v3.23

**Storage**: In-memory store (this feature); MySQL/Sequelize already in `package.json` for future features — not used here

**Testing**: `node:test` nativo executado com `tsx` (`node --import tsx --test "src/**/*.test.ts"`)

**Target Platform**: Node.js 22 CLI (`tsx src/arena.ts`) + server skeleton (`tsx src/index.ts`)

**Project Type**: CLI tool (arena) + server skeleton

**Performance Goals**: Any strategy completes an alert query in < 30 s (SC-001)

**Constraints**: Max iterations enforced via `recursionLimit` in LangGraph's invoke/stream config; Plan-and-Execute capped at 8 steps (FR-012); unit tests must run without network

**Scale/Scope**: Single-agent in-process; in-memory seed data (5 services, 6 alerts); two strategies

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| 1. Agente no centro | ✅ PASS | LangGraph graph is the core; Express and MySQL are out-of-scope infrastructure here |
| 2. Camadas explícitas | ✅ PASS | Dependency flow: `arena.ts/index.ts → ReasoningStrategy (graph) → tools → InMemoryStore` |
| 3. Validação na fronteira | ✅ PASS | zod schemas on all tool inputs (FR-015); env vars read directly from `process.env` in `llm/factory.ts` |
| 4. Erros são de domínio | ✅ PASS | `IncidentNotFoundError` propagated by resolve tool (FR-008); arena catches and formats at the edge |
| 5. Teste é parte da tarefa | ✅ PASS | Store CRUD tests + trace serialization tests; no network calls in unit tests (SC-004, SC-006) |
| 6. Segurança por padrão | ✅ PASS | `OPENROUTER_API_KEY` from env var only; no hardcoded secrets; guardrails deferred per spec Assumption |
| 7. Spec antes de código | ✅ PASS | Planning phase; no implementation started |
| 8. Pequeno e reversível | ✅ PASS | Tasks will be decomposed commit-by-commit in `tasks.md` |

**Post-design re-check**: No new violations introduced by the design artifacts (data model, contracts, quickstart).

## Project Structure

### Documentation (this feature)

```text
specs/001-reasoning-nucleus/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── tools.md         # Operational tool schemas (list-alerts, open-incident, resolve-incident)
│   └── arena-cli.md     # Arena CLI interface contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── index.ts                    # Existing entry point (CLI/server bootstrap)
├── arena.ts                    # Arena runner — parses --strategies, --max-iterations, prints results
├── domain/
│   ├── types.ts                # Alert, Incident, Service, TraceEvent, ExecutionMetrics, ReasoningStrategy interface
│   └── errors.ts               # IncidentNotFoundError (domain error class)
├── store/
│   ├── in-memory-store.ts      # InMemoryStore: alerts (list/filter) + incidents (create/resolve)
│   └── seed.ts                 # Seed: 5 services, 6 alerts (3 firing, 3 resolved)
├── tools/
│   ├── list-alerts.ts          # listAlertsTool — DynamicStructuredTool, schema: { status }
│   ├── open-incident.ts        # openIncidentTool — schema: { title, service, severity }
│   └── resolve-incident.ts     # resolveIncidentTool — schema: { id }
├── llm/
│   └── factory.ts              # createModel(): ChatOpenAI → OpenRouter from process.env
├── strategies/
│   ├── react.ts                # ReactStrategy: wraps createReactAgent, builds TraceEvent[] from messages
│   └── plan-execute.ts         # PlanExecuteStrategy: StateGraph(planner → executor → replanner)
└── trace/
    └── builder.ts              # buildTraceFromMessages(), TraceEvent construction helpers

src/**/*.test.ts                # Co-located unit tests (node:test)
```

**Structure Decision**: Single project (Option 1). All agent logic lives in `src/`; no separate `backend/` or `frontend/` directories needed. Tests are co-located alongside source files following the project's existing `npm test` glob pattern.

## Complexity Tracking

> No Constitution Check violations — this section is intentionally left blank.
