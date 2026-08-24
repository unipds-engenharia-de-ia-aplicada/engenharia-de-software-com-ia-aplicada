# Quickstart — Validação do Modo Equipe

Guia de validação end-to-end. Contratos em [contracts/](./contracts/); entidades em [data-model.md](./data-model.md).

## Pré-requisitos

```bash
npm install                 # raiz (backend)
npm install --prefix web    # SPA War Room
cp .env.example .env        # OPENROUTER_API_KEY para validação manual (testes não usam rede)
```

## 1. Suíte automatizada (sem rede)

```bash
npm run typecheck
npm test
```

Cobertura esperada da feature (tudo com fakes, `:memory:`):

- `src/team/supervisor.test.ts` — schema `{ next, brief }`; malformado ⇒ done com handoff de anomalia.
- `src/team/roles.test.ts` — partição estrutural: analista sem mutação, planejador `tools = []`, executor só incidentes.
- `src/team/team-graph.test.ts` — ciclo supervisor⇄papéis com blackboard; 1 handoff por decisão; teto 8 com supervisor que nunca encerra (termina controlado, `answer` não vazio); falha de papel vira `kind: "error"` e volta ao supervisor.
- `src/graph/production-graph.test.ts` — rota `team` classificada (fake) e override; branch team preserva `node` dos papéis (sem re-stamp).
- `src/http/server.test.ts` — `strategy: "team"` aceito; desconhecida segue `422`; `awaitHumanApproval` + team fica pendente sem executar papéis.

```bash
npm test --prefix web
```

- `TraceDrawer.test.tsx` — item handoff renderiza tipo, `para: <destino>` e brief.

## 2. Validação manual — HTTP

```bash
npm run dev   # terminal 1
```

Override explícito:

```bash
curl -s localhost:3000/chat -H 'content-type: application/json' -d '{
  "message": "Temos alertas críticos no checkout; investigue, monte um plano e abra incidente se precisar.",
  "userId": "oncall-1",
  "strategy": "team"
}' | jq '{route: .metrics.route, handoffs: [.trace[] | select(.type=="handoff") | {to, content}]}'
```

Esperado: `route == "team"`; lista de handoffs com destino e brief; eventos de papéis com `node` ∈ {`supervisor`,`analista`,`planejador`,`executor`}; `answer` não vazio.

Classificação automática (sem `strategy`): pedido complexo multi-papel deve poder rotear para `team` (evento `route` com `override: false`).

Guardrail (sem bypass):

```bash
curl -s localhost:3000/chat -H 'content-type: application/json' -d '{
  "message": "Resolva o incidente inc-123",
  "userId": "oncall-1",
  "strategy": "team",
  "awaitHumanApproval": true
}' | jq
```

Esperado: resposta pendente de aprovação — nenhum papel executado antes do `/approvals/:id`.

## 3. Validação manual — War Room

```bash
npm run dev             # terminal 1 (API)
npm run dev --prefix web  # terminal 2 (SPA)
```

1. Enviar mensagem complexa (ou forçar team) no chat.
2. Clicar **"Ver raciocínio"** no turno.
3. Verificar: eventos `handoff` na timeline com destino (`para: analista` etc.) e brief legível, distinguíveis dos demais tipos; tipos antigos inalterados; dark/light legíveis.

## 4. Critérios de aceite (espelho da spec)

- [x] SC-001 — 1 handoff por decisão do supervisor (destino + brief presentes) — `team-graph.test.ts`
- [x] SC-002 — partição de tools por papel confere estruturalmente — `roles.test.ts`
- [x] SC-003 — supervisor que nunca encerra ⇒ turno termina em ≤ 8 delegações, controlado — `team-graph.test.ts`
- [x] SC-004 — nenhuma ação destrutiva contorna salvaguardas (`awaitHumanApproval` cobre team) — `server.test.ts`
- [x] SC-005 — handoffs visíveis no "Ver raciocínio" — `TraceDrawer.test.tsx`
- [x] SC-006 — suíte existente das rotas atuais permanece verde — 216 testes backend + 13 web verdes
