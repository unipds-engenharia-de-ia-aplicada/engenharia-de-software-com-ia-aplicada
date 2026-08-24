# Spec 002 - Persistência de tarefas da CLI em JSON

## 1. Contexto / problema

Atualmente, a CLI inicia com estado vazio a cada execução porque usa apenas persistência in-memory no processo. Isso impede que tarefas criadas em uma sessão de linha de comando estejam disponíveis na sessão seguinte. É necessário introduzir persistência em arquivo `.json` para a CLI, preservando as tarefas entre execuções sem alterar as regras de negócio existentes.

## 2. User stories

- Como pessoa usuária da CLI, quero que tarefas criadas em uma execução sejam mantidas para a próxima, para não perder meu histórico ao fechar o terminal.
- Como pessoa usuária da CLI, quero continuar usando os comandos `task create`, `task list`, `task complete` e `task remove` sem mudanças de sintaxe.
- Como mantenedora do projeto, quero manter a API HTTP com o comportamento atual, para que essa evolução seja isolada ao fluxo da CLI.

## 3. Requisitos funcionais

- RF-1. A CLI deve carregar tarefas de um arquivo JSON local ao iniciar a execução.
- RF-2. A CLI deve persistir no arquivo JSON qualquer mutação de estado causada por `create`, `complete` e `remove`.
- RF-3. O formato persistido deve representar `id`, `title` e `status` de cada tarefa.
- RF-4. Se o arquivo de persistência ainda não existir, a CLI deve criá-lo automaticamente no primeiro uso.
- RF-5. Se o arquivo existir e estiver vazio, a CLI deve tratá-lo como coleção vazia.
- RF-6. A listagem via CLI deve refletir o estado persistido no arquivo entre execuções diferentes do comando.
- RF-7. A semântica de negócio atual deve ser preservada: criação com status `open`, filtro `all/open/done`, conclusão idempotente e erro para `id` inexistente.
- RF-8. A API HTTP deve permanecer usando o store atual in-memory, sem depender do arquivo da CLI.
- RF-9. Falhas de leitura ou escrita do arquivo JSON devem ser reportadas com mensagem de erro legível na CLI e código de saída não zero.

## 4. Critérios de aceite (EARS)

- CA-1. Quando a pessoa usuária criar uma tarefa pela CLI e encerrar o processo, então em uma nova execução de `task list` o sistema deve mostrar a tarefa criada anteriormente.
- CA-2. Quando a pessoa usuária concluir uma tarefa pela CLI e iniciar nova execução, então a tarefa deve aparecer com status `done`.
- CA-3. Quando a pessoa usuária remover uma tarefa pela CLI e iniciar nova execução, então a tarefa removida não deve mais aparecer.
- CA-4. Quando o arquivo de persistência não existir, então a primeira execução de comando mutável deve criar o arquivo automaticamente.
- CA-5. Quando ocorrer erro de leitura/escrita do arquivo de persistência, então a CLI deve encerrar com erro explícito e código de saída não zero.
- CA-6. Quando a pessoa usuária usar os filtros `all`, `open` e `done`, então o comportamento de listagem deve permanecer equivalente ao comportamento atual.
- CA-7. Quando a API HTTP for executada, então seu comportamento de persistência deve continuar restrito ao ciclo de vida do processo HTTP.

## 5. Fora de escopo

- Migração para banco de dados relacional ou NoSQL.
- Sincronização automática entre múltiplos processos de CLI executando em paralelo.
- Versionamento avançado de schema do arquivo JSON.
- Alteração do contrato público dos comandos da CLI.
- Persistência da API HTTP em arquivo JSON.

## 6. Questões em aberto

- Definir o caminho padrão do arquivo de persistência da CLI (por exemplo: diretório do projeto, diretório do usuário, ou caminho configurável por variável de ambiente).
