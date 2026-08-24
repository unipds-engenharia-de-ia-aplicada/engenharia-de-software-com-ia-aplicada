---
mode: agent
description: Implemente as tarefas pendendes uma a uma, com testes.
---

Implemente as tarefas da feature indicada (texto após o comando).

- Resolva primeiro a spec da feature:
  - se receber um número como `001`, use o arquivo `specs/001-*-spec.md`;
  - se receber um caminho, use esse arquivo de spec diretamente.
- A partir da spec resolvida, derive os arquivos irmãos:
  - plan: `specs/<NNN>-<slug>-plan.md`
  - tasks: `specs/<NNN>-<slug>-tasks.md`
- Leia e atualize sempre os arquivos numerados da mesma feature; nunca use `plan.md` ou `tasks.md` genéricos soltos.

uma tarefa por vez:

1. Escolha a próxima "- [ ]" cujas dependências já estão prontas.
2. Implemente seguindo o plano numerado da feature, as instructions e a constitution.
3. Escreva/atualize testes e rode npm run test e npm run typecheck.
4. Só marque " - [x]" quando estiver verde.
5. Pare ao concluir uma fatia coesa e peça revisão.
Nunca desative testes/tipos para "passar". Se a spec estiver errada, pare e avise.
