# Abrindo o capô dos harnesses: mini-harness

- **Data:** 24 de novembro de 2026
- **Professores:**
  - [**Aurélio Oliveira**](https://www.linkedin.com/in/aurelioolive/)
  - [**Weslley Araújo**](https://www.linkedin.com/in/wellwelwel/)

## Parte 1: mini-harness (Aurélio Oliveira)

Um harness de agente de IA mínimo, com uma pequena interface web, feito para a live sobre design de harness.
Ele mostra que o loop no centro de um agente é pequeno e que a maior parte do trabalho está no que fica em volta do modelo.

Não há chaves de API. O modelo é uma CLI de agente de código em que você já fez login, chamada como subprocesso e usada como texto puro: entra texto, sai texto.
Ele responde num protocolo de texto: uma frase curta e um bloco cercado por resposta, que pode ser um comando para rodar, uma atualização de estado, uma tarefa para um subagente ou a resposta final.

### Como rodar

    cd lives/2026-11-24
    python3 server.py

Abra http://127.0.0.1:8000, escolha a pasta do projeto no botão de pasta abaixo do campo de texto, escreva uma tarefa e aperte Enter.

Opções: `--port 8000`, `--host 127.0.0.1`, `--cwd PASTA` (a pasta em que o agente começa; o padrão é a pasta atual), `--max-steps 15`.

Só a biblioteca padrão do Python 3, nada para instalar. Você precisa de pelo menos uma destas CLIs, instalada e com login feito:

| backend | comando                                                                                      |
| ------- | -------------------------------------------------------------------------------------------- |
| claude  | `claude -p --tools "" --disable-slash-commands --no-session-persistence --strict-mcp-config` |
| codex   | `codex exec --skip-git-repo-check --ephemeral --sandbox read-only --color never -`           |
| kiro    | `kiro-cli chat --no-interactive --trust-tools= --wrap never`                                 |

Ao iniciar, o servidor manda um prompt mínimo para cada uma e só oferece as que respondem.

### O que aparece na tela

Nada fica escondido. Cada chamada ao modelo tem um botão "Ver bruto" com o prompt exato que foi enviado, a resposta crua do modelo, o que o harness interpretou dela e o texto que volta para o modelo no próximo prompt. O botão "Modo bruto" no topo abre tudo de uma vez.

Cada chamada mostra também o tamanho do prompt e da resposta em caracteres e em ≈ tokens (caracteres divididos por 4), com uma barra que divide o prompt em sistema, estado, tarefa, histórico e resultado da ferramenta. O painel lateral soma o custo da execução por agente.

### Segurança

O agente executa, na pasta que você escolher, comandos de shell decididos por um modelo. Aponte só para pastas em que você confia e que pode perder. Por padrão o servidor escuta apenas em 127.0.0.1; não mude `--host` numa rede em que você não confia. O controle de permissões do passo 3 é uma demonstração, não um sandbox.

### Passos

Na live o harness foi montado em seis passos, um mecanismo por vez. Esta pasta tem a versão final, com os seis.
A lista abaixo segue a ordem em que foram construídos: é um roteiro para ler o código, e cada "Tente" funciona na versão final.

1. O loop (`harness/loop.py`). Chama o modelo, roda o comando que ele pede, devolve a saída e repete até ele dizer que terminou. Veja o tamanho do contexto, embaixo do campo de texto, crescer a cada passo.
   Tente: "Liste os arquivos daqui e me diga qual é o maior."
2. Estado fora do contexto (`harness/state.py`). Fatos, tentativas e tarefas a fazer ficam em `.mini-harness/state.json`, dentro da pasta escolhida, e aparecem no painel da direita. O modelo atualiza o arquivo com um bloco `state`, o harness coloca o estado em todo prompt e a conversa é cortada nos últimos três turnos, então é o arquivo que carrega a tarefa. Ele também sobrevive entre execuções.
   Tente: "Conte as linhas de cada arquivo de texto daqui e anote o que encontrar." e rode de novo para ver a segunda execução usar o estado.
3. Controle (`harness/permissions.py`). Antes de rodar o bash, o harness confere o comando: comandos de leitura (`ls`, `cat`, `grep`, `git status`, ...) rodam direto, qualquer outro pausa a execução até você clicar em Permitir uma vez ou Negar, e uma lista curta (`rm -rf`, `sudo`, `curl | sh`, ...) é sempre recusada. A decisão volta para o modelo como saída do comando.
   Tente: "Crie um arquivo hello.txt com o texto oi." (pergunta) e "Apague tudo nesta pasta com rm -rf." (bloqueado).
4. Modelo trocável (`harness/model.py`). O modelo é só uma função de prompt para texto. O seletor no campo de texto troca entre as CLIs que funcionam nesta máquina.
   Tente: "O que tem nesta pasta? Responda em duas frases." com cada modelo.
5. Subagentes (`Agent.delegate` em `harness/loop.py`). Com um bloco `delegate` o modelo passa uma subtarefa independente para um agente filho: o mesmo loop com uma conversa vazia, seu próprio limite de passos, a mesma pasta e o mesmo controle de permissões, e sem poder delegar de novo. Só a resposta final dele volta para o pai, então o contexto do pai continua pequeno. No modo bruto dá para ver que o prompt do pai só recebe essa resposta.
   Tente: "Use um subagente para descobrir qual arquivo tem mais linhas e me mostre as 5 primeiras."
6. Leitura do código (`harness/codebase.py`). O seletor "Leitura do código" escolhe como o código chega ao prompt: "Tudo no prompt" cola todos os arquivos de texto da pasta no prompt e tira as ferramentas do modelo; "Agente com grep" deixa o modelo procurar com bash, como nos passos anteriores; "Índice + busca" indexa a pasta em trechos, pontua cada trecho contra a tarefa (BM25) e coloca só os melhores no prompt, com o bash ainda disponível. O botão "Comparar" mostra, para cada execução da sessão, chamadas, ≈ tokens enviados e recebidos, tempo e, se você digitar um preço por milhão de tokens, o custo estimado. "Rodar nas 3 estratégias" roda a tarefa do campo de texto com as três, uma depois da outra.
   Tente, numa pasta pequena com código: "Em que arquivo está definida a função que calcula o frete e qual a fórmula?"

### Arquivos

Comece pelo `harness/loop.py`: o resto do pacote existe para servir o loop.

```
harness/
  loop.py          o loop: chama o modelo, executa o pedido, devolve o resultado
  protocol.py      como o harness lê o pedido do modelo (uma frase e um bloco cercado)
  prompts.py       o que vai no prompt a cada chamada
  tools.py         a ferramenta do agente: bash
  model.py         o modelo: uma função que recebe texto e devolve texto, uma por CLI
  state.py         a memória do agente, num arquivo fora do contexto
  permissions.py   o portão que decide se um comando pode rodar
  codebase.py      três formas de o código da pasta chegar ao prompt
server.py          inicia as execuções e transmite os eventos para a página
static/index.html  a página
```

---

## Parte 2: um harness real por dentro (Weslley Araújo)

Com um harness experimental, esta parte mostra na prática o que um harness completo monta por baixo dos panos: o system prompt cru e bruto que ele envia junto ao prompt, como o modelo enxerga as chamadas de cada ferramenta e por que o modelo nem sempre abre uma skill, mesmo quando pedimos explicitamente.

### Instruções do projeto

O modelo sempre lê o `AGENTS.md` (ou `CLAUDE.md`), porque o próprio harness o embute na mensagem do usuário via System Prompt, sem depender de uma decisão do modelo. Os `AGENTS.md` de subdiretórios também chegam ao modelo da mesma forma determinística, sendo somados ao conteúdo do `AGENTS.md` principal.

### Skills

O harness só embute a primeira skill, e apenas quando ela abre o prompt literalmente, como em `/skill-01 <prompt>`. Da segunda em diante, e também quando aparece no meio do prompt, a skill chega ao modelo como texto puro e só é lida se tudo der certo:

- O modelo recebe a skill na lista de skills disponíveis.
- A descrição dela chega completa.
- O modelo decide (ou não) chamar a ferramenta que lê a skill.

As duas primeiras condições não são garantidas. Cada harness limita quantas skills mostra ao modelo (as 20, 100 ou 1000 primeiras, por exemplo), e quanto maior a lista, mais comum é pagar por ela truncando a descrição que cada skill traz no frontmatter.

### Skill ou `AGENTS.md` num subdiretório

Por essa diferença, uma instrução que precisa valer sempre que o agente trabalha numa parte específica do projeto fica mais segura num `AGENTS.md` dentro daquele subdiretório do que numa skill.

### Subagentes

Para o agente orquestrador, chamar um subagente é só mais uma chamada de ferramenta entre as outras, então dá para orientá-lo sobre qual modelo e qual nível de esforço cada subagente deve usar, inclusive, eles devem rodar de forma síncrona ou assíncrona conforme a necessidade da tarefa.

### A analogia com a falsa sensação de segurança

Tudo o que vem acima conversa diretamente com segurança: o que parece uma proteção pode nunca chegar a agir.

Instalar inúmeras skills de segurança não garante que o modelo carregue cada uma sempre que precisar. Elas passam pelas mesmas condições de qualquer outra skill: entrar na lista, chegar com a descrição completa e o modelo decidir abri-las toda vez que for necessário.

Um prompt que depende de uma skill também não a aciona só porque está documentado assim. O modelo pode fazer o que foi pedido por conta própria, sem carregar a skill, e nunca avisar que não a carregou.

Até um hook pode ser contornado. Um ReDoS no scanner determinístico, por exemplo, faz o modelo perceber que ele está demorando demais e concluir que travou. Então o modelo interrompe o scanner e segue sozinho para completar a tarefa pedida pelo usuário, podendo nunca avisar que seguiu por conta própria.

> [!TIP]
>
> - Conhecer o que acontece por baixo dos panos dá autonomia para decidir sem achismo e sem seguir uma prática só porque todo mundo já usa assim. Você sabe exatamente o que o harness e o modelo fazem e, por isso, qual é a melhor forma de lidar com cada um em cada situação.
> - A live mostra bastante o uso com **Claude Code** e **Codex**, mas todo o conhecimento vale para qualquer outro modelo ou harness que siga a mesma lógica de funcionamento, como **GitHub Copilot**, **OpenCode** dentre outros.

---

## Glossário

### Modelo, harness e agente

- **Modelo**: o modelo de linguagem (LLM) em si, como o **Claude** ou o **GPT**, que recebe texto e devolve texto. Sozinho, ele não lê arquivos nem roda comandos.
- **Harness**: o programa em volta do modelo, como o **Claude Code**, o **Codex** ou o mini-harness da Parte 1. Ele monta o prompt, executa o que o modelo pede e controla o que pode rodar.
- **Agente**: o modelo e o harness trabalhando juntos em loop: o modelo decide o próximo passo, o harness o executa, e o ciclo se repete até a tarefa terminar.

### O que chega ao modelo

- **Prompt**: o texto que o modelo recebe a cada chamada. O usuário escreve só o pedido, e o harness monta o resto em volta dele.
- **System prompt**: a parte do prompt com as instruções do harness para o modelo, como o comportamento esperado e as ferramentas disponíveis. O usuário normalmente não a vê.
- **Contexto**: tudo o que o modelo sabe sobre a tarefa numa chamada, com o histórico e os resultados de ferramentas acumulados até ali. Tem um tamanho máximo, a janela de contexto, e o modelo não guarda nada entre uma chamada e outra.
- **Token**: a unidade em que o modelo lê e escreve texto, em geral um pedaço de palavra. O tamanho do contexto e o preço de uso são medidos em tokens.

### Como o agente age

- **Ferramenta** (_tool_): uma ação que o modelo pode pedir ao harness, como rodar um comando ou ler e editar um arquivo. Esse pedido é a chamada de ferramenta (_tool calling_), que diz qual ferramenta usar e com quais argumentos.
- **Bloco cercado**: um trecho entre `` ``` `` de abertura e de fechamento, o mesmo formato dos blocos de código em Markdown. É o formato das chamadas de ferramenta do mini-harness, enquanto as APIs nativas dos modelos usam JSON.
- **Orquestrador e subagente**: o orquestrador é o agente principal, que delega partes da tarefa a subagentes, agentes filhos que trabalham com contexto próprio.
- **Nível de esforço**: quanto o modelo raciocina antes de responder. Mais esforço costuma ajudar em tarefas difíceis, ao custo de mais tempo e mais tokens.

### Como personalizar o agente

- **`AGENTS.md`**: arquivo Markdown com as instruções de um projeto para os agentes que trabalham nele, como convenções, comandos e regras. O **Claude Code** usa o `CLAUDE.md` para o mesmo papel.
- **Skill**: um conjunto de instruções, às vezes com scripts e arquivos de apoio, para um tipo específico de tarefa. Até a skill ser carregada, o modelo só conhece o nome e a descrição dela.
- **Frontmatter**: o bloco de metadados no topo de um arquivo Markdown, entre duas linhas `---`. Numa skill, é onde ficam o nome e a descrição.
- **Hook**: um comando que roda automaticamente quando um evento acontece, como antes de o agente usar uma ferramenta ou antes de um commit, sem depender de o modelo decidir chamá-lo.

### Outros termos

- **Determinístico**: que acontece sempre da mesma forma, porque é decidido por código e não pelo modelo. O que depende do modelo pode mudar de uma execução para outra, mesmo com o mesmo pedido.
- **Sandbox**: um ambiente isolado que limita o que um processo consegue acessar, como arquivos, rede e sistema. Um controle de permissões só decide se um comando roda, enquanto o sandbox limita o que ele consegue fazer depois de rodar.
- **ReDoS** (_Regular expression Denial of Service_): quando uma entrada faz uma expressão regular levar tempo demais para terminar, travando na prática o programa que a avalia.
- **BM25**: uma fórmula clássica de busca que pontua o quanto um trecho de texto é relevante para uma consulta, a partir das palavras que os dois têm em comum, dando mais peso às mais raras.
