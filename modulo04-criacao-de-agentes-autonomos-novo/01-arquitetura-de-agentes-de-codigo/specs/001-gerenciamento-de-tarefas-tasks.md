# Tarefas - Spec 001 - Gerenciamento de tarefas

1. - [x] Modelar o domínio e o contrato de persistência de tarefas
   - Escopo: criar os tipos de tarefa, schemas zod compartilhados, interface do store e implementação in-memory básica.
   - Arquivos esperados: `src/domain/task.ts`, `src/store/task-store.ts`, `src/store/in-memory-task-store.ts`.
   - Dependências: nenhuma.
   - Pronto quando: os tipos e contratos permitem representar criar/listar/concluir/remover tarefas sem acoplamento com HTTP ou CLI, e os testes de store/domínio planejados para essa base estiverem passando.

2. - [x] Implementar o service de tarefas com regras de negócio e erros de domínio
   - Escopo: criar erros previsíveis e os casos de uso de criar, listar, concluir com idempotência e remover.
   - Arquivos esperados: `src/service/task-errors.ts`, `src/service/task-service.ts`.
   - Dependências: tarefa 1.
   - Pronto quando: houver testes cobrindo criação válida, rejeição de título inválido, filtros `all/open/done`, conclusão idempotente e erros para ids inexistentes.

3. - [x] Expor o gerenciamento de tarefas via HTTP
   - Escopo: compor a aplicação, traduzir validações/erros para HTTP e publicar as rotas `POST /tasks`, `GET /tasks`, `PATCH /tasks/:id/complete` e `DELETE /tasks/:id`.
   - Arquivos esperados: `src/http/task-routes.ts`, `src/http/http-errors.ts`, `src/factories/task-app.ts`, ajuste em `src/index.ts`.
   - Dependências: tarefa 2.
   - Pronto quando: os testes HTTP cobrirem sucesso e falhas de validação/not found para criação, listagem, conclusão e remoção.

4. - [x] Expor o gerenciamento de tarefas via CLI
   - Escopo: criar a entrada de CLI e os comandos `task create`, `task list`, `task complete` e `task remove`, reutilizando o mesmo service da API.
   - Arquivos esperados: `src/cli.ts`, `src/cli/commands.ts`, eventuais ajustes em `src/factories/task-app.ts`.
   - Dependências: tarefa 2.
   - Pronto quando: os testes de CLI cobrirem execução bem-sucedida, filtros, mensagens de erro legíveis e código de saída diferente de zero para entradas inválidas.

5. - [x] Integrar, documentar e validar a feature de ponta a ponta
   - Escopo: revisar composição compartilhada entre HTTP e CLI, atualizar a documentação de uso e garantir que a suíte final reflita os contratos da spec.
   - Arquivos esperados: `README.md`, ajustes finais nos arquivos já criados se necessário.
   - Dependências: tarefas 3 e 4.
   - Pronto quando: `npm run typecheck` e `npm test` estiverem verdes e a documentação descrever corretamente os endpoints HTTP e comandos de CLI da feature.
