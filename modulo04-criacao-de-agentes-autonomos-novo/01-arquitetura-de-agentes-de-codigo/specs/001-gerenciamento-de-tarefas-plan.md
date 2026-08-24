# Plano técnico - Spec 001 - Gerenciamento de tarefas

## 1. Arquitetura

Fluxo de dependências: `http/cli -> service -> store`.

### Arquivos a criar

- `src/domain/task.ts`
  - Tipos de domínio para tarefa e status.
  - Schemas `zod` reutilizados nas fronteiras.
- `src/service/task-service.ts`
  - Casos de uso: criar, listar, concluir e remover tarefas.
  - Tradução de regras de negócio para erros de domínio.
- `src/service/task-errors.ts`
  - Erros previsíveis do domínio, como tarefa não encontrada.
- `src/store/task-store.ts`
  - Interface do repositório de tarefas.
  - Contrato mínimo para persistência em memória.
- `src/store/in-memory-task-store.ts`
  - Implementação in-memory do contrato de store.
- `src/http/task-routes.ts`
  - Rotas e handlers HTTP de tarefas.
  - Validação de entrada e serialização de saída.
- `src/http/http-errors.ts`
  - Tradução de erros de domínio/validação para status HTTP.
- `src/cli.ts`
  - Ponto de entrada da CLI.
  - Parse dos comandos e renderização de saída.
- `src/cli/commands.ts`
  - Mapeamento dos comandos de tarefa para chamadas de service.
- `src/factories/task-app.ts`
  - Composição compartilhada entre HTTP e CLI para garantir mesmas regras.

### Arquivos a alterar

- `src/index.ts`
  - Inicializar o store in-memory.
  - Subir servidor HTTP e registrar rotas de tarefas.
- `README.md`
  - Documentar endpoints HTTP e comandos de CLI após a implementação.

## 2. Modelo de dados

### Entidades e tipos

- `TaskId`: identificador textual gerado pelo sistema.
- `TaskStatus`: união restrita a `open | done`.
- `Task`:
  - `id: string`
  - `title: string`
  - `status: "open" | "done"`

### Schemas Zod

- `taskTitleSchema`
  - string obrigatória.
  - normalizada com `trim`.
  - rejeita string vazia após normalização.
- `taskIdSchema`
  - string obrigatória e não vazia.
- `taskStatusSchema`
  - enum `open | done`.
- `taskListFilterSchema`
  - enum `all | open | done`.
- `createTaskInputSchema`
  - `{ title: string }`
- `taskOutputSchema`
  - `{ id: string, title: string, status: "open" | "done" }`
- `taskListOutputSchema`
  - array de `taskOutputSchema`

### Regras de negócio centrais

- Toda tarefa nova nasce com status `open`.
- Concluir uma tarefa `open` muda seu status para `done`.
- Concluir uma tarefa `done` retorna sucesso idempotente.
- Remover uma tarefa a elimina do store.
- Operações sobre `id` inexistente falham com erro de domínio específico.

## 3. Contratos

### HTTP

#### `POST /tasks`

- Entrada:
  - body JSON `{ "title": "..." }`
- Saída de sucesso:
  - status `201`
  - body `{ "id": "...", "title": "...", "status": "open" }`
- Falhas previstas:
  - `400` para body inválido ou título inválido

#### `GET /tasks?status=<all|open|done>`

- Entrada:
  - query `status`, opcional; default planejado: `all`
- Saída de sucesso:
  - status `200`
  - body `[{ "id": "...", "title": "...", "status": "open" | "done" }]`
- Falhas previstas:
  - `400` para filtro inválido

#### `PATCH /tasks/:id/complete`

- Entrada:
  - parâmetro de rota `id`
- Saída de sucesso:
  - status `200`
  - body da tarefa já concluída no estado final `done`
- Falhas previstas:
  - `404` para tarefa inexistente
  - `400` para `id` inválido

#### `DELETE /tasks/:id`

- Entrada:
  - parâmetro de rota `id`
- Saída de sucesso:
  - status `204`
  - sem body
- Falhas previstas:
  - `404` para tarefa inexistente
  - `400` para `id` inválido

### CLI

#### `task create --title "<texto>"`

- Entrada:
  - título obrigatório
- Saída de sucesso:
  - confirmação textual com `id`, `title` e `status`
- Falhas previstas:
  - erro de validação com mensagem legível e código de saída não zero

#### `task list [--status all|open|done]`

- Entrada:
  - filtro opcional; default planejado: `all`
- Saída de sucesso:
  - lista textual ou tabular com `id`, `title` e `status`
- Falhas previstas:
  - erro de validação para filtro inválido

#### `task complete --id "<task-id>"`

- Entrada:
  - `id` obrigatório
- Saída de sucesso:
  - confirmação textual da tarefa em estado `done`
- Falhas previstas:
  - tarefa inexistente
  - `id` inválido

#### `task remove --id "<task-id>"`

- Entrada:
  - `id` obrigatório
- Saída de sucesso:
  - confirmação textual de remoção
- Falhas previstas:
  - tarefa inexistente
  - `id` inválido

## 4. Decisões e trade-offs

- Persistência in-memory:
  - pró: implementação simples, aderente ao estado atual do projeto e ao fora de escopo da spec.
  - contra: dados se perdem ao reiniciar o processo.
- Serviço compartilhado entre HTTP e CLI:
  - pró: garante regras consistentes e evita duplicação.
  - contra: exige uma etapa extra de composição da aplicação.
- `PATCH /tasks/:id/complete` em vez de atualização genérica:
  - pró: deixa explícita a ação de domínio suportada.
  - contra: reduz flexibilidade para futuras transições de estado.
- Filtro `status` com default `all`:
  - pró: melhora usabilidade e reduz verbosidade.
  - contra: cria comportamento implícito que precisa ser documentado.
- Resposta idempotente ao concluir tarefa já concluída:
  - pró: simplifica clientes e evita erro desnecessário.
  - contra: clientes não distinguem facilmente uma conclusão nova de uma repetida sem comparar estado anterior.

### Riscos e pontos que exigem atenção humana

- O formato textual da saída da CLI ainda não está padronizado no projeto; será preciso validar se o time prefere texto simples ou tabela.
- O formato do identificador de tarefa pode afetar legibilidade e previsibilidade em testes; a decisão entre `crypto.randomUUID()` e um gerador determinístico encapsulado deve ser revisada na implementação.
- Como a persistência é in-memory, HTTP e CLI só compartilharão estado se forem executados dentro do mesmo processo composto; rodar `npm run cli` separadamente não verá tarefas criadas por um servidor já em execução.

## 5. Estratégia de testes (node:test)

### Testes de service

- criar tarefa com título válido
- rejeitar criação com título vazio
- listar todas as tarefas
- listar apenas `open`
- listar apenas `done`
- concluir tarefa existente
- concluir tarefa já `done` com sucesso idempotente
- falhar ao concluir tarefa inexistente
- remover tarefa existente
- falhar ao remover tarefa inexistente
- garantir que tarefa removida não aparece mais na listagem

### Testes de HTTP

- `POST /tasks` retorna `201` com payload esperado
- `POST /tasks` retorna `400` para título inválido
- `GET /tasks` retorna todas as tarefas
- `GET /tasks?status=open` filtra corretamente
- `GET /tasks?status=done` filtra corretamente
- `GET /tasks?status=invalid` retorna `400`
- `PATCH /tasks/:id/complete` retorna `200` e estado `done`
- `PATCH /tasks/:id/complete` retorna `404` para id inexistente
- `DELETE /tasks/:id` retorna `204`
- `DELETE /tasks/:id` retorna `404` para id inexistente

### Testes de CLI

- `task create --title` imprime confirmação e termina com sucesso
- `task list` imprime tarefas compatíveis com o filtro
- `task complete --id` conclui e informa sucesso
- `task remove --id` remove e informa sucesso
- comandos inválidos retornam erro legível e código de saída não zero

### Verificações finais

- `npm run typecheck`
- `npm test`
