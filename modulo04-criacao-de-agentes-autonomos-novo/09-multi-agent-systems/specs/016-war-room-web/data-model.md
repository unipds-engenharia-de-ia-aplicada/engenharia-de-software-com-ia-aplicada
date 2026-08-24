# Data Model: War Room Web

**Phase 1 output for** `specs/016-war-room-web/plan.md`

Entidades de UI (browser) e de borda HTTP (pending approval). Sem novas tabelas SQLite.

---

## ApiEndpointConfig (browser)

| Campo | Tipo | Regras |
|-------|------|--------|
| `baseUrl` | string (URL) | Obrigatório ao salvar; `http:`/`https:`; sem path de `/chat` embutido (só origem + path base opcional); trim; strip trailing `/` ao persistir |
| `updatedAt` | number (ms) | Setado ao salvar |

**Persistência**: `localStorage` key `opspilot.warRoom.apiBaseUrl` (string URL). Default: `http://localhost:3000` (porta documentada no quickstart; alinhar ao `PORT`/`listen` atual do `src/index.ts`).

**Validação**: URL parseável; rejeitar vazio; erro de campo na engrenagem.

---

## WarRoomSession (browser, React state)

| Campo | Tipo | Regras |
|-------|------|--------|
| `apiConfig` | ApiEndpointConfig | Carregado do localStorage no boot |
| `userId` | string | Default `war-room` |
| `conversationId` | string \| null | UUID retornado pela API; null até primeiro 200/202 que traga id |
| `turns` | ChatTurn[] | Ordem cronológica |
| `pendingApproval` | ApprovalCardState \| null | No máx. um; bloqueia novo envio se `status === "pending"` |
| `awaitHumanApproval` | boolean | Toggle composer; default `false` |
| `traceOpenForTurnId` | string \| null | Controla drawer de raciocínio |
| `settingsOpen` | boolean | Modal engrenagem |
| `sending` | boolean | Loading do envio / decisão |

**Relacionamentos**: Session 1—N ChatTurn; 0—1 ApprovalCardState ativo.

---

## ChatTurn (browser)

| Campo | Tipo | Regras |
|-------|------|--------|
| `id` | string | Id local (uuid) |
| `role` | `"user"` \| `"assistant"` \| `"system"` | |
| `content` | string | Texto exibido no fio |
| `httpStatus` | `200` \| `202` \| `error` \| null | null para bolha user |
| `requestId` | string \| null | Correlação API |
| `trace` | TraceEventView[] | Vazio se ausente |
| `approvalId` | string \| null | Se turno veio de 202 |
| `errorMessage` | string \| null | Se falha |

---

## TraceEventView (browser — espelho de `TraceEvent`)

| Campo | Tipo | Notas |
|-------|------|-------|
| `type` | enum | `thought` \| `action` \| `observation` \| `plan` \| `critique` \| `answer` \| `summarize` \| `route` \| `fallback` |
| `content` | string | |
| `node` | string | |
| `tool` | string? | |
| `toolArgs` | Record? | Exibir subordinado / colapsável |
| `round` | number? | |
| `approved` | boolean? | |
| `timestampMs` | number? | |
| `route` | string? | |
| `override` | boolean? | |
| `reason` | string? | |

**Validação UI**: schema zod; eventos inválidos → omitir ou bucket “desconhecido” sem crash.

---

## ApprovalCardState (browser)

| Campo | Tipo | Regras |
|-------|------|--------|
| `approvalId` | string (uuid) | Da API |
| `summary` | string | Texto do cartão |
| `createdAt` | number | |
| `status` | `"pending"` \| `"approved"` \| `"denied"` \| `"error"` | Transições abaixo |
| `errorMessage` | string? | Se decision falhar |

### Transições

```text
(none) --202--> pending --approve OK--> approved
                     \--deny OK------> denied
                     \--API error----> error (permanece acionável retry ou deny local)
reload page ----> (none)   // v1: não restaura
```

Enquanto `pending`: composer desabilitado (FR / US3.4).

---

## PendingApproval (API — memória)

| Campo | Tipo | Regras |
|-------|------|--------|
| `approvalId` | string (uuid) | PK |
| `requestId` | string (uuid) | Do `POST /chat` que criou a pendência |
| `createdAt` | number | ms |
| `summary` | string | Preview da mensagem (truncar ~240 chars na API) |
| `chatRequest` | ChatRequestSnapshot | Body validado a reexecutar no approve |
| `conversationId` | string \| null | Se cliente já tinha conversa |

### ChatRequestSnapshot

Campos do `chatRequestSchema` no momento do 202: `message`, `userId`, `strategy?`, `reflect`, `conversationId?`.  
`awaitHumanApproval` **não** é reenviado na reexecução (evita loop 202).

### ApprovalStore (interface domínio)

```text
save(pending: PendingApproval): void
get(approvalId: string): PendingApproval | null
take(approvalId: string): PendingApproval | null   // get + delete atômico para approve/deny
```

---

## ApprovalDecision (API input)

| Campo | Tipo | Regras |
|-------|------|--------|
| `decision` | `"approve"` \| `"deny"` | Obrigatório |
| `userId` | string min 1 | Obrigatório; SHOULD coincidir com o da pendência (v1: avisar em log se divergir, ainda executa) |

---

## Chat HTTP shapes (referência)

Ver [contracts/chat-http.md](./contracts/chat-http.md) e [contracts/approvals-http.md](./contracts/approvals-http.md).

---

## Fora de escopo do modelo v1

- Persistência SQLite de approvals
- Restaurar `pendingApproval` após F5
- Contas / auth / múltiplos plantonistas concorrentes na mesma pendência
