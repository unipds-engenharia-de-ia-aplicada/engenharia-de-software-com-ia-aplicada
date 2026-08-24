# Implementation Plan: Status de Provedores Externos

**Branch**: `005-provider-status-tool` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-provider-status-tool/spec.md`

## Summary

Adicionar a tool `check_provider_status` ao catálogo do agente para consultar statuspages públicas (GitHub / Cloudflare) via API statuspage.io sem chave. Núcleo de fetch com timeout 5s, uma retentativa em rede/5xx/timeout, validação zod e retorno compacto (ou erro legível como observação). Fetch injetável para testes offline. Capacidade nova no grafo; sem mudanças em store, HTTP `/chat` ou persistência.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM `strict: true`

**Primary Dependencies**: `zod` (schema da resposta statuspage + schema da tool), `@langchain/core/tools` (`tool`), `globalThis.fetch` / `AbortSignal.timeout` (nativos)

**Storage**: N/A — sem persistência; consulta efêmera a statuspage pública

**Testing**: `node:test` via `tsx`; fake `fetch` injetável; sem rede real

**Target Platform**: Node.js processo local (dev / arena / bench / HTTP)

**Project Type**: Biblioteca de agente + web service; esta feature é camada `tools/services` + registro em `agents/tools`

**Performance Goals**: Cada tentativa ≤ 5s; pior caso com 1 retry ≈ 10s wall-clock; retorno de sucesso em 1 linha

**Constraints**: Sem API key; erro nunca escapa da tool (string observação); retry exatamente 1× só para rede/5xx/timeout; 4xx e validação sem retry; camadas `http/cli → agent → tools → store`

**Scale/Scope**: 2 provedores (github | cloudflare); 1 tool nova; ~4–6 arquivos tocados

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | Capacidade operacional vira tool do grafo (`check_provider_status`) |
| 2 | **Camadas explícitas** | ✅ PASS | I/O HTTP externo em `src/tools/`; wrapper LangChain em `src/agents/tools.ts`; domínio sem fetch |
| 3 | **Validação na fronteira** | ✅ PASS | Schema zod do parâmetro `provider`; schema zod do JSON statuspage antes de formatar retorno |
| 4 | **Erros são de domínio** | ✅ PASS | Falhas finais → string `Error: ...` (observação); sem throw para o grafo |
| 5 | **Teste é parte da tarefa** | ✅ PASS | FR-012 — sucesso, timeout, inválido com fake fetch |
| 6 | **Segurança por padrão** | ✅ PASS | Sem chave/secrets; só GET público; timeout evita hang |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | Uma tool + testes + wire em `createTools`; sem migration/store |

**Stack**: ✅ Sem nova dependência npm; fetch nativo Node 22.

**Gate result: ALL PASS** — Complexity Tracking não necessário.

**Re-check pós Phase 1**: contratos + data-model mantêm I/O em `tools/` e registro no grafo. Gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/005-provider-status-tool/
├── plan.md                 # Este arquivo
├── research.md             # Phase 0
├── data-model.md           # Phase 1
├── quickstart.md           # Phase 1
├── contracts/
│   └── check-provider-status.md  # Contrato da tool + payload statuspage
└── tasks.md                # Phase 2 (/speckit.tasks — NÃO gerado aqui)
```

### Source Code (repository root)

```text
src/
├── tools/
│   ├── check-provider-status.ts       # NOVO: URLs, schema zod, fetchProviderStatus (fetch injetável)
│   ├── check-provider-status.test.ts  # NOVO: sucesso / timeout / inválido / retry (fake fetch)
│   └── index.ts                       # ← re-export opcional do factory se já padrão
├── agents/
│   ├── tools.ts                       # ← createCheckProviderStatusTool + incluir em createTools
│   └── tools.test.ts                  # ← registro da 6ª tool; smoke invoke com fake se útil
├── arena.ts / index.ts / bench.ts     # sem mudança de API se createTools(store) já compõe tudo
└── (sem mudanças em store/, http/, domain/)
```

**Structure Decision**: Projeto único. Lógica de rede + validação em `src/tools/check-provider-status.ts` (camada tools/services). Factory LangChain em `src/agents/tools.ts` alinhada às tools existentes. Testes co-localizados. Sem pasta `tests/` separada.

## Complexity Tracking

> Nenhuma violação — seção vazia de propósito.
