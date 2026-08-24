# Spec 001 - Gerenciamento de tarefas

## 1. Contexto / problema

O projeto possui apenas o esqueleto inicial da aplicação e ainda não oferece uma forma padronizada de gerenciar tarefas. É necessário introduzir uma capacidade mínima de gerenciamento de tarefas que possa ser usada tanto por integrações HTTP quanto por uso local via CLI, mantendo o mesmo comportamento funcional nas duas entradas.

## 2. User stories

- Como pessoa usuária da API HTTP, quero criar uma tarefa informando um título, para registrar algo que preciso fazer.
- Como pessoa usuária da API HTTP, quero listar tarefas por status (`all`, `open`, `done`), para consultar rapidamente o que está pendente ou concluído.
- Como pessoa usuária da API HTTP, quero concluir uma tarefa existente, para marcar que ela foi finalizada.
- Como pessoa usuária da API HTTP, quero remover uma tarefa existente, para excluir itens que não fazem mais sentido.
- Como pessoa usuária da CLI, quero executar as mesmas operações de criação, listagem, conclusão e remoção, para gerenciar tarefas sem depender de chamadas HTTP diretas.

## 3. Requisitos funcionais

- RF-1. O sistema deve permitir criar uma tarefa a partir de um título informado pela pessoa usuária.
- RF-2. O sistema deve gerar um identificador para cada tarefa criada, para que ela possa ser consultada, concluída e removida posteriormente.
- RF-3. Toda tarefa criada deve nascer com status `open`.
- RF-4. O sistema deve permitir listar tarefas com os modos `all`, `open` e `done`, via HTTP e via CLI.
- RF-5. No modo `all`, o sistema deve retornar todas as tarefas cadastradas.
- RF-6. No modo `open`, o sistema deve retornar apenas tarefas em aberto.
- RF-7. No modo `done`, o sistema deve retornar apenas tarefas concluídas.
- RF-8. O sistema deve permitir concluir uma tarefa existente por identificador, via HTTP e via CLI.
- RF-9. Ao concluir uma tarefa em aberto, o sistema deve alterar seu status para `done`.
- RF-10. Ao solicitar a conclusão de uma tarefa já concluída, o sistema deve responder com sucesso idempotente, sem criar efeitos adicionais.
- RF-11. O sistema deve permitir remover uma tarefa existente por identificador, via HTTP e via CLI.
- RF-12. Após a remoção, a tarefa não deve mais aparecer em listagens nem aceitar novas operações.
- RF-13. O sistema deve rejeitar tentativas de criação sem título válido.
- RF-14. O sistema deve rejeitar filtros de listagem diferentes de `all`, `open` e `done`.
- RF-15. O sistema deve informar erro quando uma operação de concluir ou remover referenciar uma tarefa inexistente.
- RF-16. HTTP e CLI devem expor o mesmo conjunto de capacidades e respeitar as mesmas regras de negócio e validação.

## 4. Critérios de aceite (EARS)

- CA-1. Quando a pessoa usuária criar uma tarefa com título válido, o sistema deve registrar a tarefa com status `open` e devolver seu identificador.
- CA-2. Quando a pessoa usuária tentar criar uma tarefa sem título válido, o sistema deve rejeitar a solicitação com erro de validação.
- CA-3. Quando a pessoa usuária solicitar a listagem em modo `all`, o sistema deve retornar todas as tarefas cadastradas.
- CA-4. Quando a pessoa usuária solicitar a listagem em modo `open`, o sistema deve retornar somente tarefas com status `open`.
- CA-5. Quando a pessoa usuária solicitar a listagem em modo `done`, o sistema deve retornar somente tarefas com status `done`.
- CA-6. Quando a pessoa usuária concluir uma tarefa existente em aberto, o sistema deve marcar essa tarefa como `done`.
- CA-7. Quando a pessoa usuária concluir uma tarefa já concluída, o sistema deve responder com sucesso sem alterar o estado final da tarefa.
- CA-8. Quando a pessoa usuária tentar concluir uma tarefa inexistente, o sistema deve informar que a tarefa não foi encontrada.
- CA-9. Quando a pessoa usuária remover uma tarefa existente, o sistema deve excluir a tarefa do conjunto de tarefas disponíveis.
- CA-10. Quando a pessoa usuária tentar remover uma tarefa inexistente, o sistema deve informar que a tarefa não foi encontrada.
- CA-11. Quando a pessoa usuária informar um filtro de listagem inválido, o sistema deve rejeitar a solicitação com erro de validação.
- CA-12. Quando a pessoa usuária executar uma operação equivalente por HTTP e por CLI, o sistema deve aplicar a mesma regra de negócio.

## 5. Fora de escopo

- Edição de título de tarefa.
- Priorização, etiquetas, categorias ou datas.
- Reabertura de tarefa concluída.
- Autenticação, autorização ou múltiplos usuários.
- Persistência definitiva ou integração com banco de dados.

## 6. Questões em aberto

- Nenhuma no momento.
