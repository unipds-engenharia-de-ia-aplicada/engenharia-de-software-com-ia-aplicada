# Abrindo o capô dos harnesses: mini-harness

- **Data:** 24 de novembro de 2026
- **Professor:**
  - [**Aurélio Oliveira**](https://www.linkedin.com/in/aurelioolive/)

Um harness de agente de IA mínimo, com uma pequena interface web, feito para a live sobre design de harness.
Ele mostra que o loop no centro de um agente é pequeno e que a maior parte do trabalho está no que fica em volta do modelo.

Não há chaves de API. O modelo é uma CLI de agente de código em que você já fez login, chamada como subprocesso e usada como texto puro: entra texto, sai texto.
Ele responde num protocolo de texto: uma frase curta e um bloco cercado por resposta, que pode ser um comando para rodar, uma atualização de estado, uma tarefa para um subagente ou a resposta final.

## Como rodar

    cd lives/2026-11-24
    python3 server.py

Abra http://127.0.0.1:8000, escolha a pasta do projeto no botão de pasta abaixo do campo de texto, escreva uma tarefa e aperte Enter.

Opções: `--port 8000`, `--host 127.0.0.1`, `--cwd PASTA` (a pasta em que o agente começa; o padrão é a pasta atual), `--max-steps 15`.

Só a biblioteca padrão do Python 3, nada para instalar. Você precisa de pelo menos uma destas CLIs, instalada e com login feito:

| backend | comando |
| --- | --- |
| claude | `claude -p --tools "" --disable-slash-commands --no-session-persistence --strict-mcp-config` |
| codex | `codex exec --skip-git-repo-check --ephemeral --sandbox read-only --color never -` |
| kiro | `kiro-cli chat --no-interactive --trust-tools= --wrap never` |

Ao iniciar, o servidor manda um prompt mínimo para cada uma e só oferece as que respondem.

## O que aparece na tela

Nada fica escondido. Cada chamada ao modelo tem um botão "Ver bruto" com o prompt exato que foi enviado, a resposta crua do modelo, o que o harness interpretou dela e o texto que volta para o modelo no próximo prompt. O botão "Modo bruto" no topo abre tudo de uma vez.

Cada chamada mostra também o tamanho do prompt e da resposta em caracteres e em ≈ tokens (caracteres divididos por 4), com uma barra que divide o prompt em sistema, estado, tarefa, histórico e resultado da ferramenta. O painel lateral soma o custo da execução por agente.

## Segurança

O agente executa, na pasta que você escolher, comandos de shell decididos por um modelo. Aponte só para pastas em que você confia e que pode perder. Por padrão o servidor escuta apenas em 127.0.0.1; não mude `--host` numa rede em que você não confia. O controle de permissões do passo 3 é uma demonstração, não um sandbox.

## Passos

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

## Arquivos

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
