# OpsPilot — Copilot Instructions

**OpsPilot** é um copiloto de plantão que gerencia alertas e incidentes de produção.
O núcleo é um agente LangChain/LangGraph servido sobre OpenRouter.

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 22 LTS |
| Linguagem | TypeScript ESM (`"type": "module"`, `strict: true`) |
| Agente IA | LangChain + LangGraph → OpenRouter |
| Validação | `zod` em toda fronteira (HTTP, CLI, saída do agente) |
| API | Express |
| Banco | MySQL via Sequelize |
| Testes | `node:test` nativo executado com `tsx` |

## Comandos

```bash
npm run dev        # tsx src/index.ts
npm run arena      # tsx src/arena.ts
npm run bench      # tsx src/bench.ts
npm test           # node --import tsx --test "src/**/*.test.ts"
npm run typecheck  # tsc --noEmit
```

## Convenções

- **Arquitetura MVC**: Model → Service → Controller; nada salta camadas.
- **Validação obrigatória**: toda entrada externa (HTTP body, params, env, saída LLM) passa por `zod`.
- **Erros de domínio**: classes próprias lançadas nos serviços, traduzidas para HTTP na borda (controller/middleware).
- **Testes primeiro**: lógica nova nasce com pelo menos um teste em `node:test`.
- **CI local sempre verde**: `npm run typecheck` e `npm test` devem passar antes de qualquer commit.
- **Sem secrets**: nunca commitar `.env`; usar `.env.example` como referência. Carregar variáveis via `--env-file` do Node (sem dotenv).
- **Funções puras**: preferir funções puras e imutabilidade; efeitos colaterais isolados nas bordas.

## Fluxo de desenvolvimento

Seguir o **Spec Kit** do GitHub Copilot em quatro etapas obrigatórias e em ordem:

```
speckit.specify → speckit.plan → speckit.tasks → speckit.implement
```

1. **`speckit.specify`** — escreve ou atualiza a spec da feature (markdown versionado em `specs/`).
2. **`speckit.plan`** — gera o plano de design e decisões técnicas a partir da spec.
3. **`speckit.tasks`** — decompõe o plano em tarefas ordenadas por dependência.
4. **`speckit.implement`** — executa as tarefas: código, testes verdes, typecheck verde, commit.

Specs são artefatos de primeira classe — criadas, revisadas e versionadas junto com o código. Nenhuma implementação começa sem spec aprovada.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at `specs/002-reflection-layer/plan.md`.
<!-- SPECKIT END -->
