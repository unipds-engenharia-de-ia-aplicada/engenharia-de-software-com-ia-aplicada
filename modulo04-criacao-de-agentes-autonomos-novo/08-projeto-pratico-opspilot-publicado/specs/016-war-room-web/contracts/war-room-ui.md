# Contract: War Room UI

**Phase 1 output for** `specs/016-war-room-web/plan.md`

Contrato de superfície da SPA (comportamento observável), alinhado às design instructions `web/**`.

---

## Deploy / base

| Item | Valor |
|------|-------|
| Vite `base` | `/opspilot/` |
| Entry URL | `http://localhost:5173/opspilot/` (dev) |
| Rotas v1 | Somente `/` relativo à base (SPA single view) |

Reload em `/opspilot/` deve servir `index.html` (Vite dev ok). Em preview/static atrás de nginx, configure fallback SPA para `/opspilot/*` → `index.html` se hospedar o build de `web/dist`.

---

## Shell

1. **Header**: marca/produto “OpsPilot” (hierarquia forte) + botão engrenagem (aria-label “Configurações”).
2. **Main**: fio da conversa + composer.
3. **Um CTA primário** por seção (enviar no composer; Aprovar no cartão).

---

## Composer

| Controle | Comportamento |
|----------|---------------|
| Campo mensagem | `label` visível; submit com Enter (Shift+Enter = nova linha) |
| Enviar | `POST {api}/chat` com `message`, `userId: "war-room"`, `conversationId?`, `awaitHumanApproval` do toggle |
| Toggle “Exigir aprovação” | Default off; quando on, body `awaitHumanApproval: true` |
| Abort | Botão cancelar durante `sending` aborta `fetch` |
| Bloqueio | Desabilitado se `pendingApproval.status === "pending"` |

### Respostas

| HTTP | UI |
|------|-----|
| `200` | Bolha assistant com `answer`; botão “Ver raciocínio” se `trace.length > 0` |
| `202` | Cartão Aprovar/Negar (`pending.summary`); sem tratar como erro |
| Rede / 4xx / 5xx | Banner/erro inline no chat + “Tentar de novo” quando recuperável |
| `200` sem `answer` | Erro de contrato |

---

## Approval card

- Título: “Ação pendente”
- Corpo: `summary`
- Ações: **Aprovar** (primário), **Negar** (secundário/danger quiet)
- `POST {api}/approvals/{approvalId}` `{ decision, userId }`
- Sucesso: atualiza status do cartão + adiciona bolha assistant com `answer`; se approve trouxe trace, “Ver raciocínio” disponível
- Teclado: Tab entre ações; Enter ativa foco

---

## Ver raciocínio

- Controle secundário na bolha assistant (não compete com Enviar)
- Abre drawer/dialog modal: lista de eventos tipados (`type` em destaque, `content`, `node` em caption)
- Empty: “Sem eventos de raciocínio” + fechar
- Escape fecha; foco preso enquanto aberto; restaura foco ao botão que abriu

---

## Engrenagem (settings)

- Campo “URL da API” (`label` + `aria-describedby` para erro)
- Salvar valida URL; persiste localStorage
- Default `http://localhost:3000`
- Cancelar/Escape fecha sem salvar rascunho inválido

---

## Empty / error states

| Estado | Título (ex.) | Ação |
|--------|--------------|------|
| Conversa vazia | “Nenhuma mensagem ainda” | Foco no composer |
| Falha de rede | “Não foi possível falar com a API” | Tentar de novo / abrir engrenagem |
| Trace vazio | “Sem eventos de raciocínio” | Fechar |

---

## A11y / design (obrigatório)

- Tokens CSS semânticos; escala de espaçamento 4px
- Contraste AA; foco visível; alvos ≥ 44px
- `prefers-reduced-motion` respeitado
- Não sinalizar erro só com cor
