# Canvas: Anatomia de um Agente Único
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 2.1**

Use este canvas para dimensionar, componente por componente, um agente do seu próprio contexto, antes de escrever qualquer código. O objetivo é decidir quanto de cada componente a tarefa realmente exige, nem mais, nem menos.

## Os quatro componentes

| Componente | O que é | Perguntas-guia |
|---|---|---|
| **Memória** | Curto prazo (contexto da requisição atual) e longo prazo (histórico entre sessões) | A tarefa se repete com o mesmo usuário/contexto ao longo do tempo? Se não, memória de longo prazo é custo sem benefício. |
| **Planejamento** | Reflexão, autocrítica, chain-of-thought, decomposição de subobjetivos — repare que o custo é bem diferente entre eles: chain-of-thought é quase de graça (mesma chamada), reflexão é uma chamada inteira a mais, decomposição em subobjetivos é decisão de fluxo, não de prompt | Quantas etapas de raciocínio a tarefa realmente exige? Mais planejamento = mais latência. |
| **Ferramentas** | Funções externas que o agente pode chamar (busca, cálculo, código, banco de dados) | Que informação ou ação o agente precisa buscar fora do próprio raciocínio? Cada ferramenta nova é uma nova decisão que o agente precisa aprender a fazer. |
| **Ação** | Execução do passo decidido no mundo real | A ação final é irreversível? Se sim, existe um Approval Gate antes dela (ver Módulo 1.3)? |

## Referência: TrialForge (Agente de Geração de ICF)

| Componente | Dimensionamento | Por quê |
|---|---|---|
| Memória | Mínima: só curto prazo, dentro da própria requisição | Cada emenda de protocolo é um caso novo: a tarefa não se repete com o mesmo contexto entre sessões, então memória de longo prazo seria custo sem benefício. |
| Planejamento | Simples: duas etapas (buscar cláusulas via RAG, gerar texto), sem loop de reflexão | O raciocínio necessário é curto e direto; não há checagem intermediária que justifique mais etapas, e mais planejamento aqui só aumentaria latência sem ganho perceptível. |
| Ferramentas | Uma: busca na base de cláusulas regulatórias (RAG) | A única informação que o agente precisa buscar fora do próprio raciocínio é o texto regulatório aplicável; não há outra ação externa que a tarefa exija. |
| Ação | Limitada a rascunho: nunca publica sozinho, sempre atrás do Approval Gate | A ação final é irreversível e o erro é caro (um ICF assinado por um participante real): pela Pergunta 2 do framework do Módulo 1.3, isso exige Approval Gate obrigatório antes de virar versão oficial. |

## Seu caso: dimensione os quatro componentes

| Componente | Dimensionamento no seu caso | Por quê |
|---|---|---|
| Memória | | |
| Planejamento | | |
| Ferramentas | | |
| Ação | | |

## Como usar na atividade prática

1. Escolha uma tarefa do seu próprio contexto (ou do domínio que você escolher para a disciplina) que você imagina resolver com um agente de IA.
2. Para cada um dos quatro componentes, preencha a coluna "Dimensionamento no seu caso" na tabela "Seu caso" acima, usando as perguntas-guia da primeira tabela deste canvas.
3. Escreva na coluna "Por quê" a justificativa de cada dimensionamento: essa frase é o que você vai defender numa revisão de arquitetura.
4. Rode o "Teste de realidade" abaixo antes de considerar o dimensionamento fechado.

## Teste de realidade

Antes de considerar o dimensionamento fechado, responda:

1. Se você removesse a memória de longo prazo, a tarefa ainda funcionaria bem? Se sim, ela provavelmente não precisa dela.
2. Se você reduzisse o planejamento pela metade (menos etapas de reflexão), o resultado pioraria de forma perceptível? Se não, o planejamento atual está superdimensionado.
3. Cada ferramenta listada tem um caso de uso claro e frequente? Ferramentas "por via das dúvidas" são complexidade sem retorno.
4. A ação final é reversível? Se não for, existe approval gate antes dela?
5. Esse dimensionamento cabe no orçamento de latência e custo que você definiu pra esse componente no Módulo 1.4? Se você não tem esse número, essa é a hora de estimar, não depois que o sistema já estiver rodando.

Guarde este canvas: ele volta a aparecer no Módulo 2.5, quando calibramos o protótipo completo do zero usando este mesmo teste de realidade.

## Material extra: cada componente rodando isoladamente

Os quatro componentes desta tabela, mais o Approval Gate, aparecem isolados e rodáveis em `agent-components-demo.js` (versão em Python: `agent_components_demo.py`), nesta mesma pasta. Não é o loop ReAct inteiro (isso é o Módulo 2.2) nem o schema formal de ferramenta (isso é o Módulo 2.4) — é só cada peça, sozinha, com números reais:

- **Memória**: curto prazo (array efêmero) vs. longo prazo (estado que persiste entre chamadas), com o mesmo contraste ICF-vs-assistente-de-longo-prazo desta tabela.
- **Planejamento**: chain-of-thought vs. chain-of-thought + reflexão, rodando de verdade contra o Gemma local e medindo o tempo de cada um — o número concreto por trás da linha "reflexão é uma chamada inteira a mais" desta tabela.
- **Ferramentas**: a mesma lógica de busca de cláusula de assentimento, como função determinística isolada.
- **Ação + Approval Gate**: a mesma ação (`executar`) tratada de dois jeitos — executada direto quando não precisa de aprovação, bloqueada quando precisa — mostrando que a diferença é a Pergunta 2 do Módulo 1.3, não a capacidade técnica.

Rode com `node agent-components-demo.js` (requer `npm install ollama` e o Ollama com `gemma4:e2b` puxado) ou `python agent_components_demo.py` (requer `pip install ollama` no ambiente).

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
