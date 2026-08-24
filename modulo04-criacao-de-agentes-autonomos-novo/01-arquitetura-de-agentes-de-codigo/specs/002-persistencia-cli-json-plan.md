# Plano técnico - Spec 002 - Persistência de tarefas da CLI em JSON

## 1. Arquitetura

Fluxo de dependências proposto: `cli -> service -> store(file-backed)`.

HTTP continua em `http -> service -> store(in-memory)`.

### Arquivos a criar

- `src/store/json-file-task-store.ts`
  - Implementação de `TaskStore` baseada em arquivo JSON.
  - Carrega tarefas do disco na inicialização e mantém índice em memória.
  - Persiste mutações (`create`, `complete`, `remove`) em escrita atômica.
- `src/store/json-file-task-store.test.ts`
  - Testes de unidade do store com fixtures temporárias.
  - Cobertura para bootstrap, persistência, idempotência e remoção.

### Arquivos a alterar

- `src/cli.ts`
  - Compor a CLI com `JsonFileTaskStore` em vez de `InMemoryTaskStore`.
  - Definir caminho do arquivo de persistência e instanciar o app.
- `src/factories/task-app.ts`
  - Permitir composição explícita do store sem alterar o contrato atual.
  - (Se necessário) exportar helpers de criação para reduzir duplicação.
- `src/cli/commands.test.ts`
  - Ajustar/adicionar testes para erro de infraestrutura de store na CLI.
- `README.md`
  - Documentar persistência da CLI em arquivo `.json` entre execuções.
  - Documentar comportamento da API HTTP in-memory sem mudança.

## 2. Modelo de dados

### Estrutura do arquivo

Formato JSON planejado:

```json
{
  "tasks": [
    { "id": "1", "title": "Comprar leite", "status": "open" }
  ]
}
```

### Schemas de validação

- Reuso de `taskSchema` e `taskListSchema` de `src/domain/task.ts`.
- Novo schema local para arquivo:
  - `z.object({ tasks: taskListSchema })`.

### Regras de consistência

- Sempre persistir o snapshot completo de tarefas após mutação.
- Estado em memória é a fonte durante a execução; arquivo é fonte no bootstrap.
- Se arquivo não existir, iniciar com coleção vazia e criar no primeiro write.
- Se arquivo existir vazio (0 bytes), tratar como coleção vazia.

## 3. Contratos e comportamento

### Store file-backed

- `create(input)`:
  - cria tarefa `open`, salva em memória e grava no arquivo.
- `list(filter)`:
  - lê do estado em memória, sem IO por chamada.
- `complete(id)`:
  - comportamento idempotente preservado, com persistência quando houver tarefa.
- `remove(id)`:
  - remove em memória; se removida, grava novo snapshot.
- Falhas de IO/parsing:
  - erro é propagado (sem swallow), para a borda da CLI traduzir saída.

### CLI

- Comandos e flags permanecem iguais.
- Em erro inesperado de store/IO:
  - imprimir mensagem legível em `stderr`;
  - retornar código de saída `1`.

### Escopo por entrada

- CLI usa store em JSON.
- HTTP mantém `InMemoryTaskStore` como hoje.

## 4. Decisões e trade-offs

- Persistência síncrona com `node:fs`:
  - pró: integra com contrato síncrono atual de `TaskStore` sem refatoração assíncrona ampla.
  - contra: bloqueia event loop durante escrita (aceitável no contexto CLI).
- Snapshot completo por escrita:
  - pró: implementação simples e robusta para volume pequeno.
  - contra: custo de escrita cresce com número de tarefas.
- Arquivo dedicado da CLI (oculto no projeto):
  - pró: comportamento previsível e fácil inspeção local.
  - contra: pode gerar conflitos se múltiplos processos de CLI escreverem simultaneamente.
- Escrita atômica via arquivo temporário + rename:
  - pró: reduz risco de corrupção parcial.
  - contra: adiciona pequeno custo e complexidade.

### Riscos e pontos que exigem atenção humana

- Definir nome/caminho final do arquivo persistido (ex.: `.tasks-cli-store.json` na raiz do projeto).
- Concorrência entre execuções paralelas da CLI não será tratada nesta fase.
- Decidir estratégia para arquivo inválido/corrompido: falhar explicitamente (proposta) vs resetar conteúdo.

## 5. Estratégia de testes (node:test)

### Testes do store JSON

- carregar estado existente de arquivo válido.
- iniciar vazio quando arquivo inexistente.
- tratar arquivo vazio como coleção vazia.
- persistir criação entre duas instâncias do store.
- persistir conclusão idempotente entre instâncias.
- persistir remoção entre instâncias.
- propagar erro de JSON inválido.
- propagar erro de escrita.

### Testes de CLI

- comandos atuais seguem funcionando com store file-backed.
- `task create` em uma execução e `task list` em outra (mesmo arquivo) preservam estado.
- erro de infraestrutura (ex.: arquivo inválido) gera mensagem legível e saída não zero.

### Verificações finais

- `npm run typecheck`
- `npm test`
