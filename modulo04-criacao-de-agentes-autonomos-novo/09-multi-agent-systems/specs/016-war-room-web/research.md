# Research: War Room Web

**Phase 0 output for** `specs/016-war-room-web/plan.md`

---

## Contexto

OpsPilot hoje expõe `POST /chat` (200 + trace tipado) sem SPA, sem CORS e sem HTTP `202` de aprovação humana. A spec pede War Room em `web/`, design instructions, base `/opspilot/`, engrenagem de URL, “Ver raciocínio” e cartão Aprovar/Negar para `202`.

---

## Decisão 1: Pacote `web/` separado (Vite + React + TS)

**Decisão**: Criar `web/` com Vite, React, TypeScript e `base: '/opspilot/'`. Scripts no root (`web:dev`, `web:build`, `web:test`) delegam via `npm --prefix web`.

**Rationale**: Isola React do runtime do agente (constitution Node/Express/SQLite). Base path atende FR-001/US5. Vite é o default pedido no brief.

**Alternatives considered**:

- React no `package.json` root — mistura deps e typecheck do grafo.
- `create-react-app` / Next.js — mais pesado; base path e SPA simples não precisam de SSR.
- HTML+htmx sem React — contradiz o brief.

---

## Decisão 2: HITL v1 = pedido adiado na borda (não LangGraph interrupt)

**Decisão**:

1. Estender `POST /chat` com flag opcional `awaitHumanApproval` (boolean, default `false`).
2. Quando `true`, **não** executa o grafo: cria `PendingApproval` em store em memória, responde `202` com `{ requestId, conversationId?, pending: { approvalId, summary, createdAt } }`.
3. `POST /approvals/:approvalId` com `{ decision: "approve" | "deny", userId }` :
   - `approve` → executa o `ChatRequest` armazenado via `runProductionTurn` → `200` com answer/trace/metrics (mesmo shape do chat).
   - `deny` → remove pendência → `200` com answer de cancelamento + trace mínimo (evento `answer`) + metrics zeradas/latência.
4. War Room: toggle discreto “Exigir aprovação” no composer (default **off**). Quickstart/demo liga o toggle para exercitar o cartão 202.

**Rationale**: Entrega FR-005/006 e SC-003 sem redesign do production graph. Alinha à constitution (“pequeno e reversível”). Interrupt LangGraph fica para feature futura reutilizando o mesmo contrato HTTP.

**Alternatives considered**:

- Interrupt nativo LangGraph — escopo grande; fora do “na medida necessária à War Room”.
- Sempre 202 — piora UX do plantão (toda mensagem pede clique).
- Só mock no front sem API — falha SC-006 e Independent Test da US3.

---

## Decisão 3: Approval store em memória

**Decisão**: `MemoryApprovalStore` no processo (`Map<approvalId, PendingApproval>`). Sem TTL além do lifetime do processo. Spec já assume pendência não sobrevive a reload da UI; restart da API também limpa (documentar no quickstart).

**Rationale**: Zero DDL; suficiente para demo/HITL v1. SQLite seria overkill e contradiz expectativa de não-persistência.

**Alternatives considered**:

- SQLite pending table — útil se multi-instance; fora de escopo v1.
- Só client-side fake 202 — não valida CORS/approvals reais.

---

## Decisão 4: CORS por allowlist em env

**Decisão**: Middleware `src/http/cors.ts` lendo `OPSPILOT_CORS_ORIGINS` (lista separada por vírgula). Default de desenvolvimento: `http://localhost:5173`. Responde `OPTIONS` com `204` + headers; em requests reais seta `Access-Control-Allow-Origin` (eco da origin se allowlisted), `Allow-Methods: GET,POST,OPTIONS`, `Allow-Headers: Content-Type, X-Request-Id`, `Expose-Headers: X-Request-Id`. Sem credentials v1.

**Rationale**: FR-009 / US6; middleware curto sem pacote extra; allowlist evita `*`.

**Alternatives considered**:

- `Access-Control-Allow-Origin: *` — permissivo demais.
- Proxy só no Vite — ajuda no dev mas não cobre URL customizada via engrenagem; CORS na API continua necessário.

---

## Decisão 5: Cliente HTTP + schemas zod no front

**Decisão**: `web/src/api/client.ts` monta URLs com `joinBase(apiUrl, '/chat')` (normaliza trailing slash). Schemas zod para `ChatSuccess`, `ChatPending202`, `ApprovalResponse`, `TraceEvent`. Erros de rede/HTTP viram estados de UI tipados.

**Rationale**: Validação na fronteira também no browser. Evita `packages/shared` v1 e import de código Node no Vite.

**Alternatives considered**:

- Importar `src/domain/types.ts` no Vite — risco de puxar código Node.
- `any` no fetch — frágil para “trace tipado”.

---

## Decisão 6: UI shell — uma composição War Room

**Decisão**: Página única sob `/opspilot/`: header (marca OpsPilot + engrenagem), `main` com fio + composer, drawer/dialog para raciocínio, cartão de aprovação inline no fio. Tokens em CSS (`tokens.css`); dark via `color-scheme` + preferência do sistema. Seguir design instructions (escala 4px, empty/error, a11y).

**Rationale**: Spec v1 exclui telas de alertas/incidentes; chat é o centro.

**Alternatives considered**:

- Router multi-página — desnecessário v1.
- Sidebar dashboard — conflita com “uma composição / um propósito”.

---

## Decisão 7: Testes

**Decisão**:

- API: estender `server.test.ts` — CORS preflight + headers; `awaitHumanApproval: true` → 202; approve → 200; deny → 200 cancel; id inválido → 404/400.
- Web: Vitest + Testing Library — composer → client mock; 202 → ApprovalCard; “Ver raciocínio” → TraceDrawer; settings persiste URL; empty states.

**Rationale**: SC-001–007 verificáveis sem rede LLM (fake strategies já existem na API).

---

## Decisão 8: `userId` na War Room

**Decisão**: Default fixo de demo `war-room`, sempre enviado no body `/chat` e `/approvals` (contrato atual exige `userId`).

**Rationale**: API exige `userId`; auth fora de escopo.

**Alternatives considered**:

- Prompt de login — fora de escopo.
- Omitir userId — quebra zod do `/chat`.

---

## Resolução de NEEDS CLARIFICATION

Nenhum restante no Technical Context — defaults acima fecham HITL, CORS, packaging e UI.
