---
mode: agent
description: Quebra o plano em tarefas pequenas, ordenadas e testáveis.
---

Gere o arquivo de tarefas da feature indicada (o texto após o comando é o número ou caminho).

- Resolva primeiro a spec da feature:
 - se receber um número como `001`, use o arquivo `specs/001-*-spec.md`;
 - se receber um caminho, use esse arquivo de spec diretamente.
- A partir da spec resolvida, derive os arquivos irmãos:
 - spec: `specs/<NNN>-<slug>-spec.md`
 - plan: `specs/<NNN>-<slug>-plan.md`
 - tasks: `specs/<NNN>-<slug>-tasks.md`
- Leia a spec e o plano dessa mesma feature.
- Escreva as tarefas em `specs/<NNN>-<slug>-tasks.md`.
- Nunca escreva um `tasks.md` genérico solto.
- Lista numerada em cada tarefa:
 - é pequena o suficiente para um único commit;
 - tem critério claro de "pronto" (ex: teste X passa);
 - declara dependências, quando houver;
 - começa com "-[ ]" para marcarmos o progresso.
- Ordene por dependência. Não implemente nada. 
