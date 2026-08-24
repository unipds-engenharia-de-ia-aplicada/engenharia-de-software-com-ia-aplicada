---
mode: agent
description: Gera o plano técnico (COMO) a partir de uma spec existente.
---

Gera o PLANO TÉCNICO da feature indicada (o texto após o comando é o número ou o caminho).

- Resolva primeiro a spec da feature:
  - se receber um número como `001`, use o arquivo `specs/001-*-spec.md`;
  - se receber um caminho, use esse arquivo de spec diretamente.
- Leia a spec resolvida e `specs/constitution.md`.
- Crie o arquivo de plano ao lado da spec, reutilizando o mesmo prefixo e slug, trocando apenas o sufixo:
  - spec: `specs/<NNN>-<slug>-spec.md`
  - plan: `specs/<NNN>-<slug>-plan.md`
- Nunca escreva um `plan.md` genérico solto.
- O conteúdo do plano deve conter:
 1. Arquitetura - camadas/arquivos criados ou alterados (http/cli -> service -> store).
 2. Modelo de dados - tipos e schemads zod.
 3 . Constratos - rotas HTTP e/ou comandos de CLI, com entrada/saída.
 4. Decisões e trade-offs.
 5. Estratégia de testes (node:test).
- Não implemente nada ainda.
- Aponte riscos e pontos que precisão de decisão humana.
