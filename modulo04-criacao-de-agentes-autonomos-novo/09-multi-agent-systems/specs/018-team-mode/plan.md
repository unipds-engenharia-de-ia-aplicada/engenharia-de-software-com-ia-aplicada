# Implementation Plan: Modo Equipe (Supervisor + Papéis)

**Branch**: `018-team-mode` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/018-team-mode/spec.md`

## Summary

Introduzir o **modo equipe** em `src/team/`: um sub-grafo LangGraph com nó **supervisor** que decide `withStructuredOutput({ next, brief })` sobre um **blackboard** mantido no estado, delegando a três papéis com poderes estruturalmente distintos — **analista** (só ferramentas de leitura, não propõe), **planejador** (zero ferramentas) e **executor** (só ferramentas de incidente, sob as salvaguardas existentes). Cada decisão do supervisor gera evento de trace **`handoff`** (novo `TraceEventType`), renderizado no drawer "Ver raciocínio" do War Room. O modo entra no grafo de produção como a rota **`team`** (classificável + override), com **teto de 8 handoffs** por turno e encerramento forçado controlado.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM `strict: true`

**Primary Dependencies**: LangGraph (`StateGraph`, `Annotation`, conditional edges; `createReactAgent` para papéis com tools); LangChain `withStructuredOutput` + zod (supervisor); ferramentas existentes de `src/agents/tools.ts` particionadas por papel; grafo de produção `013`; React/Vite (War Room `016`) para render do `handoff`

**Storage**: N/A nova — blackboard vive no estado do sub-grafo (efêmero por turno); persistência do turno continua sendo trace + audit (`015`) via nó `resposta` do grafo de produção

**Testing**: `node:test` via `tsx`; supervisor fake injetável (sem rede); harness por papel assertando o conjunto de tools; teto 8 com supervisor que nunca encerra; contrato HTTP rota/override; Vitest + Testing Library para o drawer web

**Target Platform**: Node.js processo local (HTTP `/chat`) + SPA War Room

**Project Type**: Web service + agente; fatia nova `src/team/` + extensão de domínio/roteador/schema HTTP + render web

**Performance Goals**: Turno de equipe = 1 chamada LLM por decisão do supervisor + 1..N chamadas por papel delegado + 1 chamada de fechamento; limitado pelo teto de 8 handoffs

**Constraints**: Teto rígido de 8 handoffs (delegações) por turno; restrição de tools por papel é **estrutural** (o papel não recebe a ferramenta), não prompt; `next` inválido/malformado → encerramento controlado; salvaguardas de ações destrutivas (`awaitHumanApproval`, deny list) intocadas — nenhum caminho novo de execução fora delas; rotas existentes sem regressão

**Scale/Scope**: Novo módulo `src/team/` (~6 arquivos + testes), toques pontuais em `domain/types`, `graph/router(+prompt)`, `graph/production-graph`, `http/chat-schema`, `index.ts`, e web (`api/types` + `TraceDrawer`); ~15 arquivos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | Modo equipe é um sub-grafo LangGraph (`src/team/team-graph.ts`) plugado como nó/rota do grafo de produção |
| 2 | **Camadas explícitas** | ✅ PASS | `http → graph (produção) → team (sub-grafo) → tools → store`; papéis não fazem I/O fora das tools |
| 3 | **Validação na fronteira** | ✅ PASS | Saída do supervisor validada com zod (`withStructuredOutput` + `parse`); body HTTP já validado; `next` inválido degrada controlado |
| 4 | **Erros são de domínio** | ✅ PASS | Falha de papel vira observação no blackboard/trace e volta ao supervisor; teto atingido → encerramento forçado sem erro HTTP |
| 5 | **Teste é parte da tarefa** | ✅ PASS | FR-015 / SC-001–006; supervisor fake, harness por papel, teto, drawer |
| 6 | **Segurança por padrão** | ✅ PASS | Restrição estrutural de tools por papel; executor herda salvaguardas existentes (sem bypass); sem segredos novos |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | Feature aditiva: rota nova + módulo novo; rotas existentes intactas |

**Stack**: ✅ LangGraph/zod/node:test já no projeto; sem dependência nova.

**Gate result: ALL PASS** — Complexity Tracking não necessário.

**Re-check pós Phase 1**: contratos mantêm o sub-grafo como única orquestração da equipe, tools particionadas por construção, `handoff` no domínio do trace e rota `team` allowlisted. Gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/018-team-mode/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── team-mode.md
│   ├── trace-handoff.md
│   ├── chat-http.md
│   └── war-room-ui.md
└── tasks.md                # /speckit.tasks — NÃO gerado aqui
```

### Source Code (repository root)

```text
src/
├── team/
│   ├── blackboard.ts            # NOVO: tipos de entrada do blackboard + render p/ prompt
│   ├── supervisor.ts            # NOVO: schema zod { next, brief } + withStructuredOutput + fn injetável
│   ├── supervisor-prompt.ts     # NOVO: prompt com tabela de papéis (texto estável/testável)
│   ├── roles.ts                 # NOVO: runners analista/planejador/executor + partição de tools
│   ├── team-graph.ts            # NOVO: StateGraph supervisor ⇄ papéis; teto 8; eventos handoff
│   ├── team-strategy.ts         # NOVO: adapter ReasoningStrategy { name: "team", run }
│   ├── supervisor.test.ts       # NOVO
│   ├── roles.test.ts            # NOVO: conjunto de tools por papel (estrutural)
│   └── team-graph.test.ts       # NOVO: ciclo, blackboard, teto 8, handoffs
├── domain/
│   └── types.ts                 # ← TraceEventType +"handoff"; TraceEvent.to? (destino do handoff)
├── graph/
│   ├── router.ts                # ← PRODUCTION_ROUTES +"team"; parseOverrideStrategy aceita "team"
│   ├── router-prompt.ts         # ← linha "team" na tabela de decisão
│   └── production-graph.ts      # ← nó "team" + aresta condicional; branch team preserva node dos papéis
├── http/
│   └── chat-schema.ts           # ← "team" entra automaticamente via PRODUCTION_ROUTES (verificar teste)
├── index.ts                     # ← bootstrap: cria TeamStrategy com partições de tools + createModel
└── (testes tocados: production-graph.test.ts, server.test.ts)

web/src/
├── api/types.ts                 # ← traceEventSchema +"handoff"; campo to? opcional
└── components/
    ├── TraceDrawer.tsx          # ← render próprio p/ handoff (destino + brief legível)
    └── TraceDrawer.test.tsx     # ← caso handoff
```

**Structure Decision**: A equipe vive em `src/team/` como **sub-grafo autocontido** exposto via adapter `ReasoningStrategy` (`team-strategy.ts`) — assim o grafo de produção (`013`) a integra como quarta rota sem caso especial, exceto **não re-carimbar** `node` no branch team (os eventos já saem assinados por `supervisor`/`analista`/`planejador`/`executor`). Partição de tools é feita no bootstrap (`index.ts`) usando as factories existentes de `src/agents/tools.ts` — nenhum tool novo.

## Complexity Tracking

> Nenhuma violação — seção vazia de propósito.
