# Contract — Trace `handoff`

## Domínio (`src/domain/types.ts`)

- `TraceEventType` ganha o literal `"handoff"`.
- `TraceEvent` ganha campo opcional `to?: string` — presente quando `type === "handoff"`; valores: `"analista" | "planejador" | "executor" | "done"`.

## Forma canônica

```jsonc
// delegação
{ "type": "handoff", "node": "supervisor", "to": "planejador", "content": "monte um plano com base nos fatos do analista" }

// encerramento voluntário — brief é o resumo final (vira o answer do turno)
{ "type": "handoff", "node": "supervisor", "to": "done", "content": "incidente aberto e mitigação em curso" }

// encerramento forçado (teto) — prefixo estável (CAP_REACHED_PREFIX)
{ "type": "handoff", "node": "supervisor", "to": "done", "content": "teto de handoffs atingido: encerrando com o conteúdo do blackboard" }

// encerramento por anomalia — prefixo estável (INVALID_DECISION_PREFIX)
{ "type": "handoff", "node": "supervisor", "to": "done", "content": "decisão inválida do supervisor: <detalhe>" }
```

## Regras

1. `node` do evento handoff é sempre `"supervisor"`.
2. `content` carrega o `brief` da decisão (legível sem parsing).
3. Um turno de equipe com N decisões do supervisor tem exatamente N eventos `handoff`; destes, no máximo 8 são delegações (`to != "done"`).
4. Eventos produzidos pelos papéis (thought/action/observation/answer) são assinados com `node` = nome do papel; o branch `team` do grafo de produção não re-carimba (`stampNode` não aplicado).
5. Turnos das rotas `react`, `planExecute` e `reflect` não contêm eventos `handoff`.
6. Persistência: nenhum toque em `015` — `handoff` é serializado como qualquer `TraceEvent` no audit store.
