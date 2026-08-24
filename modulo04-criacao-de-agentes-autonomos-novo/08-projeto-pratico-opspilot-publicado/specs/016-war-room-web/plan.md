# Implementation Plan: War Room Web

**Branch**: `016-war-room-web` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/016-war-room-web/spec.md`

## Summary

War Room SPA em `web/` (Vite + React + TypeScript, base `/opspilot/`): chat contra `POST /chat`, “Ver raciocínio” sobre trace tipado, cartão Aprovar/Negar para HTTP `202`, engrenagem com URL da API (localStorage). Na borda Express: CORS configurável + contrato mínimo de aprovação humana (pendência → `POST /approvals/:id`). UI segue design instructions de `web/**`.

## Technical Context

**Language/Version**: Node.js 22 LTS + TypeScript ESM `strict` (API); TypeScript + React 19 (web)

**Primary Dependencies**: Express + `zod` (API/CORS/approvals); Vite + React + React DOM (War Room); validação de respostas na UI com `zod` (espelho fino dos tipos de chat/trace)

**Storage**: API — pending approvals em memória no processo (v1; não sobrevive a restart, alinhado à spec de reload); UI — `localStorage` para URL da API; conversa só em estado React (sem persistência local do fio)

**Testing**: API — `node:test` via `tsx` (CORS, 202, approvals); Web — Vitest + Testing Library para componentes/cliente HTTP com `fetch` mock; typecheck separado (`tsc` root + `web`)

**Target Platform**: Browser moderno (War Room) + processo Node local (API OpsPilot)

**Project Type**: Web app (`web/`) + extensão da borda HTTP existente (`src/http/`)

**Performance Goals**: Envio de mensagem com feedback imediato (loading); chat pode levar até timeout da API (~180s) com abort na UI; abrir raciocínio < 1s após resposta em memória

**Constraints**: Base path `/opspilot/`; sem auth v1; design tokens + a11y; CORS obrigatório em origens distintas; não acoplar React ao pacote root do agente; HITL v1 = pedido adiado (não interrupt LangGraph completo)

**Scale/Scope**: 1 tela War Room (chat + drawer raciocínio + modal config + cartão 202); ~2 rotas HTTP novas/estendidas (CORS middleware + approvals); pacote `web/` novo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Agente no centro** | ✅ PASS | War Room é cliente; lógica do grafo inalterada. HITL v1 adia execução do turno na borda HTTP, não move raciocínio para a UI |
| 2 | **Camadas explícitas** | ✅ PASS | `web → HTTP API`; `http → ApprovalStore (memória) → runProductionTurn`; domínio tipa pending/decision |
| 3 | **Validação na fronteira** | ✅ PASS | Body `/chat` e `/approvals/:id` com zod; UI valida URL e responses com zod |
| 4 | **Erros são de domínio** | ✅ PASS | Approval não encontrado → erro de domínio → 404; decisão inválida → 400 |
| 5 | **Teste é parte da tarefa** | ✅ PASS | SC/FR cobertos por testes API + UI |
| 6 | **Segurança por padrão** | ✅ PASS | CORS por allowlist env; sem secrets no front; HITL para gate humano; auth fora de escopo v1 (assumption) |
| 7 | **Spec antes de código** | ✅ PASS | — |
| 8 | **Pequeno e reversível** | ✅ PASS | SPA isolada + CORS + approval store em memória |

**Stack**: ✅ API permanece na constitution 2.0.0. Frontend Vite+React é pacote separado pedido pelo brief (ver Complexity Tracking).

**Gate result: ALL PASS** (frontend justificado abaixo).

**Re-check pós Phase 1**: contratos separam CORS, chat 202, approvals e UI client; data-model sem SQLite novo. Gate permanece PASS.

## Project Structure

### Documentation (this feature)

```text
specs/016-war-room-web/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── chat-http.md          # 200 + 202 + extensão body
│   ├── approvals-http.md     # POST /approvals/:id
│   ├── cors.md               # política CORS
│   └── war-room-ui.md        # contrato de UI / rotas SPA
└── tasks.md                  # /speckit.tasks — NÃO gerado aqui
```

### Source Code (repository root)

```text
web/                          # NOVO pacote Vite+React+TS
├── package.json
├── vite.config.ts            # base: '/opspilot/'
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx               # shell War Room
│   ├── styles/
│   │   └── tokens.css        # tokens semânticos + dark
│   ├── api/
│   │   ├── client.ts         # fetch chat + approvals
│   │   ├── types.ts          # zod schemas espelho
│   │   └── config.ts         # localStorage URL
│   ├── components/
│   │   ├── ChatThread.tsx
│   │   ├── Composer.tsx
│   │   ├── ApprovalCard.tsx
│   │   ├── TraceDrawer.tsx
│   │   ├── SettingsGear.tsx
│   │   └── EmptyState.tsx
│   └── …tests (Vitest)
└── …

src/
├── domain/
│   ├── types.ts              # ← PendingApproval, ApprovalDecision
│   └── errors.ts             # ← ApprovalNotFoundError
├── store/
│   ├── memory-approval-store.ts      # NOVO (process-local)
│   └── memory-approval-store.test.ts
├── http/
│   ├── cors.ts               # NOVO middleware allowlist
│   ├── cors.test.ts
│   ├── chat-schema.ts        # ← awaitHumanApproval?
│   ├── server.ts             # ← CORS, 202 branch, POST /approvals/:id
│   └── server.test.ts        # ← CORS, 202→approve/deny
└── index.ts                  # ← wire ApprovalStore + CORS env
```

**Structure Decision**: Monorepo leve — `web/` com `package.json` próprio (evita React no grafo Node). API estende `src/http` existente. Sem `packages/shared` v1: tipos de trace espelhados com zod no client.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Segundo stack (Vite+React) fora da stack obrigatória do agente | Brief explícito da War Room; UI browser não cabe em Express-only | Servir HTML estático sem React — rejeitado pelo pedido Vite+React+TS e pelas design instructions |
| Pacote `web/` separado do root `package.json` | Isola deps de UI; CI/typecheck do agente permanece estável | Workspace único com React no root — polui runtime do agente e typecheck |
