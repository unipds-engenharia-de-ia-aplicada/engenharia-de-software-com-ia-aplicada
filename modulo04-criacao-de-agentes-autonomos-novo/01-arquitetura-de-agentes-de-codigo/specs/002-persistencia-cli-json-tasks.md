# Tarefas - Spec 002 - Persistência de tarefas da CLI em JSON

1. - [x] Modelar o contrato de persistência em arquivo JSON para tarefas
   - Escopo: definir o formato `{ tasks: Task[] }`, validar com schema e preparar utilitários de leitura/escrita com erro explícito.
   - Arquivos esperados: `src/store/json-file-task-store.ts`.
   - Dependências: nenhuma.
   - Pronto quando: o store consegue inicializar estado a partir de arquivo inexistente, vazio e válido sem quebrar os contratos de domínio.

2. - [x] Implementar mutações persistentes no store file-backed
   - Escopo: implementar `create`, `list`, `complete` (idempotente) e `remove`, persistindo snapshot completo em disco após mutações.
   - Arquivos esperados: `src/store/json-file-task-store.ts`.
   - Dependências: tarefa 1.
   - Pronto quando: operações preservam semântica atual do `TaskStore` e alterações permanecem entre novas instâncias do store.

3. - [x] Integrar a CLI ao novo store JSON mantendo HTTP in-memory
   - Escopo: alterar composição da CLI para usar `JsonFileTaskStore` com caminho padrão de arquivo; manter `src/index.ts` e fluxo HTTP com `InMemoryTaskStore`.
   - Arquivos esperados: `src/cli.ts`, eventuais ajustes em `src/factories/task-app.ts`.
   - Dependências: tarefa 2.
   - Pronto quando: comandos da CLI funcionam sem mudar sintaxe e passam a carregar/salvar tarefas entre execuções.

4. - [x] Cobrir persistência e falhas de infraestrutura com testes
   - Escopo: adicionar testes do store JSON e ajustar testes da CLI para cenários entre execuções e erro de arquivo inválido/IO.
   - Arquivos esperados: `src/store/json-file-task-store.test.ts`, `src/cli/commands.test.ts`.
   - Dependências: tarefas 2 e 3.
   - Pronto quando: testes cobrem bootstrap, persistência de create/complete/remove e propagação de erro com saída não zero na CLI.

5. - [x] Documentar e validar a feature de ponta a ponta
   - Escopo: atualizar README sobre persistência da CLI em `.json`, manter observação de HTTP in-memory e rodar validações finais.
   - Arquivos esperados: `README.md`.
   - Dependências: tarefas 3 e 4.
   - Pronto quando: `npm run typecheck` e `npm test` estiverem verdes e a documentação refletir o novo comportamento.
