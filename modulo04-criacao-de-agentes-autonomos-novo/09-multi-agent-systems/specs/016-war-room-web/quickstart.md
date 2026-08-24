# Quickstart: War Room Web

**Phase 1 output for** `specs/016-war-room-web/plan.md`

Validação ponta a ponta após implementação. Contratos: [chat-http](./contracts/chat-http.md), [approvals](./contracts/approvals-http.md), [cors](./contracts/cors.md), [ui](./contracts/war-room-ui.md).

---

## Prerequisites

- Node.js 22+
- Dependências root: `npm install`
- Dependências web: `npm install --prefix web`
- `.env` (ou defaults): `PORT=3000`; CORS liberado por padrão (opcional `OPSPILOT_CORS_ORIGINS` para allowlist)

---

## Setup

```bash
# Terminal A — API
npm run dev

# Terminal B — War Room
npm run web:dev   # → http://localhost:5173/opspilot/
```

Engrenagem: confirmar URL `http://localhost:3000`.

---

## Validation scenarios

### 1. Chat feliz (SC-001)

1. Abrir `http://localhost:5173/opspilot/`.
2. Enviar mensagem (toggle “Exigir aprovação” **off**).
3. **Esperado**: bolha do usuário + resposta do agente; sem erro CORS no DevTools.

### 2. Ver raciocínio (SC-002)

1. Após um `200` com trace.
2. Clicar “Ver raciocínio”.
3. **Esperado**: drawer com eventos tipados (`type` / `content` / `node`).

### 3. Cartão 202 (SC-003)

1. Ligar “Exigir aprovação”.
2. Enviar mensagem.
3. **Esperado**: cartão Aprovar/Negar (não erro).
4. **Aprovar** → resposta `200` no fio; **ou Negar** → “Ação cancelada…”.
5. Composer bloqueado enquanto `pending`.

### 4. Engrenagem (SC-004)

1. Alterar URL da API para um host inválido → erro de campo.
2. Salvar `http://localhost:3000` → próximo envio usa essa base (Network tab).

### 5. Base path (SC-005)

1. Abrir `/opspilot/` e recarregar.
2. **Esperado**: app e assets carregam (sem 404 de `/assets/...` na raiz errada).

### 6. CORS (SC-006)

```bash
curl -i -X OPTIONS "http://localhost:3000/chat" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
# Esperado: 204 + Access-Control-Allow-Origin: http://localhost:5173
```

### 7. Empty / error (SC-007)

1. Conversa nova → empty “Nenhuma mensagem ainda”.
2. Parar a API → enviar → erro acionável + tentar de novo / engrenagem.
3. Turno sem trace → raciocínio vazio explícito (ou botão ausente).

---

## Automated checks

```bash
npm run typecheck
npm test                          # inclui CORS + 202 + approvals
npm run web:test                  # Vitest War Room
npm run web:typecheck             # se script existir
```

---

## Notes

- Pendências vivem só na memória do processo API — restart limpa approvals.
- Reload do browser descarta cartão pendente (spec v1).
- Sem LLM: usar suíte com strategies fake já wired nos testes HTTP; demo real precisa de `OPENROUTER_API_KEY` (ou env do projeto).
