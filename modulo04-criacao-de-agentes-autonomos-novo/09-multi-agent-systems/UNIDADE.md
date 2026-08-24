# Unidade 9 — Multi-Agent Systems

O OpsPilot vira **equipe**: um supervisor coordena papéis especializados sobre um blackboard compartilhado, com handoffs limitados e rastreáveis. Fechamento do módulo.

> **Sobre este snapshot:** é o **estado de trabalho mais recente do projeto** (o modo equipe ainda não havia sido commitado no repositório original quando este snapshot foi tirado). O código passa no `typecheck` e nos testes com fakes.

## O que é novo nesta unidade

- **Spec `018-team-mode`** — o modo equipe em `src/team/`:
  - `supervisor.ts` + `supervisor-prompt.ts` — supervisor com saída estruturada (`{next, brief}`) decidindo o próximo papel;
  - `blackboard.ts` — memória de trabalho compartilhada no estado do grafo;
  - `roles.ts` — papéis restritos com prompts de personalidade: **analista** (só leitura), **planejador** (sem tools) e **executor** (age em incidentes, sem contornar a aprovação humana da U7);
  - `team-graph.ts` — o grafo da equipe (supervisor ⇄ papéis) com teto de handoffs;
  - `team-strategy.ts` — o modo equipe plugado como estratégia/rota;
  - rota `team` no roteador da U6 e evento `handoff` (from/to/brief) no trace — renderizável no "ver raciocínio" do war room.

## Diferenças em relação ao roteiro

- O exercício final de **consenso** (2 pareceres independentes + juiz estruturado) não foi implementado.
- O roteiro previa fechar com branch `feat/team` + PR mergeado; no repositório original o modo equipe ficou como alterações não commitadas — este snapshot as preserva.
- O custo comparativo (rota `team` vs `react` no `GET /stats`) depende do `/stats` da U7, que existe sem o cálculo em dólares.

## Como rodar

```bash
npm ci && cp .env.example .env
npm run dev
# POST /chat com um pedido que exija análise + plano + ação → rota team, eventos handoff no trace
npm test && npm run typecheck
```
