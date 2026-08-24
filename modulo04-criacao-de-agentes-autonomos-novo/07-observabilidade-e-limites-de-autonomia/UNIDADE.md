# Unidade 7 — Observabilidade e Limites de Autonomia

O OpsPilot ganha **instrumentos e freios**: trace persistido para auditoria forense, logs estruturados que nunca vazam conteúdo, estatísticas agregadas e aprovação humana (human-in-the-loop) para ações destrutivas.

> **Sobre este snapshot:** mesma base da pasta 06 (commit `2d60133`, sem a parte web/deploy da U8) — o conteúdo das unidades 6–8 foi commitado junto. O foco DESTA unidade são os arquivos abaixo.

## O que é novo nesta unidade

- **Spec `015-persistent-trace-logs`**:
  - `src/store/sqlite-request-store.ts` — tabelas `requests` e `trace_events` no SQLite; `requestId` na resposta;
  - `GET /requests/:id` — auditoria forense de uma decisão passada (o "porquê" da decisão);
  - `src/obs/logger.ts` — logger JSON estruturado que registra **só metadados, nunca conteúdo** (a regra virou teste);
  - `GET /stats` — agregados de requisições/tokens por rota e por modelo (`src/obs/request-stats.ts`).
- **Human-in-the-loop** — aprovação humana antes de executar:
  - `src/store/memory-approval-store.ts` + endpoint `POST /approvals/:approvalId` — um chat enviado com `awaitHumanApproval: true` **não executa**: é guardado como pendência e o `/chat` responde `202` com `approvalId` e um resumo; a aprovação (`POST /approvals/:id {approve: true}`) executa a requisição guardada, e a negação a descarta. *(O contrato HTTP das aprovações ficou documentado na spec `016-war-room-web`, na pasta 08, onde a UI de aprovar/negar é construída.)*

## Diferenças em relação ao roteiro

- O HIL do roteiro usava `interrupt()` do LangGraph + checkpointer, pausando o grafo **no meio** quando a tool destrutiva `silence_all_alerts` fosse chamada. A implementação real é mais simples: a aprovação é decidida **antes** de executar, via flag `awaitHumanApproval` no request — não existe a tool `silence_all_alerts` nem uso de `interrupt()`.
- O **teto de custo** (budget guard com `BUDGET_TOKENS_PER_CONVERSATION` e resposta 429), a tabela de preços (`src/obs/pricing.ts`) e o `AUTONOMIA.md` (contrato de autonomia em 4 faixas) **não** foram implementados.
- O `GET /stats` existe, mas sem o cálculo de custo em dólares previsto no plano.

## Como rodar

```bash
npm ci && cp .env.example .env
npm run dev
# POST /chat com {"message": "...", "awaitHumanApproval": true} → 202 com approvalId
# aprove com: curl -X POST localhost:3000/approvals/<id> -d '{"approve":true}'
# audite depois: curl localhost:3000/requests/<requestId> ; curl localhost:3000/stats
npm test && npm run typecheck
```
