# Módulo 04 — Criação de Agentes Autônomos

Este módulo constrói, do zero, dois projetos:

- **Unidade 1** — `notas-api`: uma API/CLI de tarefas usada para aprender a **operar agentes de código** (GitHub Copilot) com método: instructions, permissões, spec-driven development, guardrails, revisor e delegação.
- **Unidades 2 a 9** — **OpsPilot**: um copiloto de plantão / incident commander de um e-commerce fictício ("Mercadinho"). É **um único projeto que evolui unidade a unidade**, com LangChain/LangGraph sobre OpenRouter, desenvolvido com Spec Kit (specs numeradas em `specs/NNN-slug/`).

## Como este diretório está organizado

Cada pasta é um **snapshot completo e funcional** do projeto ao final da unidade correspondente. Como o OpsPilot é um projeto único e evolutivo, os snapshots são cumulativos: a pasta da unidade N contém tudo o que foi construído nas unidades 2..N. O arquivo `UNIDADE.md` dentro de cada pasta diz **o que é novo naquela unidade** (specs, arquivos-chave) e registra os desvios entre o roteiro planejado e o que foi de fato implementado.

| Pasta | Unidade | Specs novas do OpsPilot |
| --- | --- | --- |
| [01-arquitetura-de-agentes-de-codigo](./01-arquitetura-de-agentes-de-codigo/) | U1 — Arquitetura de Agentes de Código (GitHub Copilot) | — (projeto `notas-api`) |
| [02-padroes-de-raciocinio-e-execucao](./02-padroes-de-raciocinio-e-execucao/) | U2 — Padrões de Raciocínio e Execução | 001-reasoning-nucleus, 002-reflection-layer |
| [03-function-calling-e-tool-use](./03-function-calling-e-tool-use/) | U3 — Function Calling e Tool Use | 003-chat-api, 004-sqlite-ops-store, 005-provider-status-tool, 006-mcp-ops-server |
| [04-memoria-e-reflexao-em-agentes-autonomos](./04-memoria-e-reflexao-em-agentes-autonomos/) | U4 — Memória e Reflexão em Agentes Autônomos | 007-persistent-conversation, 008-semantic-memory, 009-learning-reflector |
| [05-gerenciamento-de-contextos](./05-gerenciamento-de-contextos/) | U5 — Gerenciamento de Contextos | 010-context-measurement, 011-history-summarization, 012-context-builder-budget |
| [06-langgraph-e-workflows-complexos](./06-langgraph-e-workflows-complexos/) | U6 — LangGraph e Workflows Complexos | 013-unified-production-graph, 014-model-resilience |
| [07-observabilidade-e-limites-de-autonomia](./07-observabilidade-e-limites-de-autonomia/) | U7 — Observabilidade e Limites de Autonomia | 015-persistent-trace-logs (+ aprovação humana) |
| [08-projeto-pratico-opspilot-publicado](./08-projeto-pratico-opspilot-publicado/) | U8 — Projeto Prático: o OpsPilot de ponta a ponta, publicado | 016-war-room-web, 017-pages-web-deploy |
| [09-multi-agent-systems](./09-multi-agent-systems/) | U9 — Multi-Agent Systems | 018-team-mode |

## Como rodar o OpsPilot (unidades 2–9)

Em qualquer snapshot:

```bash
npm ci
cp .env.example .env   # preencha OPENROUTER_API_KEY (modelos :free custam zero)
npm run dev            # sobe a API (POST /chat a partir da U3)
npm test               # testes com fakes (não chamam a rede)
npm run typecheck
```

Scripts que aparecem ao longo do módulo: `npm run arena` e `npm run bench` (U2+), `npm run mcp` (U3+), `scripts/conversa-longa.sh` (U5+). Na U8+, o frontend fica em `web/` (`npm ci && npm run dev` dentro de `web/`).

## Referências

- https://openrouter.ai/ — gateway de modelos usado em todo o módulo (a fábrica de modelo do OpsPilot aponta para ele)
- https://openrouter.ai/models?max_price=0 — filtro de modelos `:free` (o módulo inteiro roda com custo zero)

## Nota sobre fidelidade aos roteiros

Os planos de aula estão em HTML no material do módulo (arquivos `unidade-N-plano-de-aula.html`). Nem tudo que foi planejado foi implementado, e alguns commits agruparam conteúdo de unidades vizinhas — cada `UNIDADE.md` registra essas diferenças. Os snapshots vêm do histórico git real do projeto gravado em aula, sem retoques no código.
