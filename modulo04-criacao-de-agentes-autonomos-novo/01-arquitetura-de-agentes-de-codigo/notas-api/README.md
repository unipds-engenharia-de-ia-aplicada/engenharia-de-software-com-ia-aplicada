# notas-api

API Node.js com TypeScript para gerenciamento de tarefas, com interface HTTP e CLI.

## Requisitos

- Node.js 20+ (recomendado)
- npm

## Como inicializar o projeto

1. Instale as dependencias:

```bash
npm install
```

2. (Opcional) valide os tipos:

```bash
npm run typecheck
```

## Como executar

### Modo desenvolvimento (HTTP)

```bash
npm run dev
```

Executa o arquivo `src/index.ts` com `tsx`.

O servidor sobe em `http://localhost:3000`.

#### Endpoints HTTP

##### Criar tarefa

```bash
curl -X POST http://localhost:3000/tasks \
  -H "content-type: application/json" \
  -d '{"title":"Comprar leite"}'
```

##### Listar tarefas

```bash
curl http://localhost:3000/tasks
curl http://localhost:3000/tasks?status=open
curl http://localhost:3000/tasks?status=done
```

##### Concluir tarefa

```bash
curl -X PATCH http://localhost:3000/tasks/<task-id>/complete
```

##### Remover tarefa

```bash
curl -X DELETE http://localhost:3000/tasks/<task-id>
```

### Executar CLI

```bash
npm run cli
```

Executa o arquivo `src/cli.ts` com `tsx`.

#### Comandos da CLI

```bash
npm run cli -- task create --title "Comprar leite"
npm run cli -- task list
npm run cli -- task list --status done
npm run cli -- task complete --id <task-id>
npm run cli -- task remove --id <task-id>
```

### Rodar testes

```bash
npm test
```

Executa testes Node (`node --test`) em arquivos `src/**/*.test.ts`.

## Scripts disponíveis

- `npm run dev`: inicia o ponto de entrada principal (`src/index.ts`)
- `npm run cli`: inicia o ponto de entrada da CLI (`src/cli.ts`)
- `npm test`: executa os testes em `src/**/*.test.ts`
- `npm run typecheck`: valida tipagem TypeScript sem gerar build

## Regras da feature

- Toda tarefa nasce com status `open`.
- Os filtros suportados são `all`, `open` e `done`.
- Concluir uma tarefa já concluída é uma operação idempotente.
- Remover ou concluir uma tarefa inexistente retorna erro.

## Estrutura atual

```txt
notas-api/
├── src/
├── package.json
├── tsconfig.json
└── .gitignore
```

## Observações

- A CLI persiste tarefas em `.tasks-cli-store.json` no diretório atual de execução.
- Para customizar o caminho do arquivo da CLI, use a variável de ambiente `TASK_CLI_STORE_PATH`.
- O servidor HTTP mantém estado apenas enquanto o processo estiver em execução.
- A pasta `dist/` é destinada ao output de build TypeScript.
