# Unidade 5 — Gerenciamento de Contextos

O OpsPilot aprende a **caber no contexto**: medir tokens por fonte, sumarizar histórico "em rolo" e montar o prompt com orçamento por seção em um ponto único. Snapshot do commit `b297569` ("corte de contextos") — estado exato do fim da unidade.

## O que é novo nesta unidade

- **Spec `010-context-measurement`** — `src/context/tokens.ts` (estimativa chars/4 + usage real do LangChain); métricas `promptTokens` e `contextBreakdown` por fonte (system/memories/history/tools/message); evento `context` no trace.
- **Spec `011-history-summarization`** — `src/chat/history-summarizer.ts` + tabela `conversation_summaries`: sumarização em rolo (resumo curto preservando decisões/fatos/pendências, mesclado ao anterior e refeito apenas quando mensagens saem da janela); evento `summarize` no trace.
- **Spec `012-context-builder-budget`** — `src/context/context-builder.ts`: teto de tokens por seção via env `CONTEXT_BUDGET_*` (system intocável; resumo, janela e memórias cortados por prioridade) — o ponto único de montagem do contexto.
- `src/context/conversa-longa.script.test.ts` + refinos no `scripts/conversa-longa.sh` (demonstração do context rot e da recuperação da decisão "freeze de deploys" após a sumarização).

## Diferenças em relação ao roteiro

- O exercício de memória global × local (coluna `scope` user × shared + tool `remember_for_team`) ficou como exercício e **não** foi implementado (é retomado conceitualmente na U9).
- A medição de tokens (spec 010) foi pedida direto ao agente, sem cerimônia completa de spec — a pasta `specs/010-context-measurement/` registra o que o Spec Kit gerou.

## Como rodar

```bash
npm ci && cp .env.example .env
npm run dev
./scripts/conversa-longa.sh    # 30 turnos; observe contextBreakdown e o evento summarize
npm test && npm run typecheck
```
