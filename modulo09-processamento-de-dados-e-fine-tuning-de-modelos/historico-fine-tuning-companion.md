# Companion: Uma Breve História do Fine-Tuning

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Leitura complementar, disciplina inteira**

## Por que isso existe

Esta disciplina inteira trata fine-tuning como uma técnica estabelecida, com protocolo de decisão, avaliação e produtização. Mas a técnica não nasceu assim, e não ficou parada -- ela passou por pelo menos quatro guinadas reais em menos de 10 anos, cada uma mudando o que "fine-tuning" queria dizer na prática. Este companion é o mapa dessas guinadas: de onde veio a ideia, por que ela quase saiu de moda no meio do caminho, e por que ela voltou de um jeito diferente do que começou. Não é pré-requisito pra nenhum módulo -- é contexto pra quem quer entender por que o protocolo desta disciplina existe do jeito que existe, não só como aplicá-lo.

---

## 1. Antes de 2018: fine-tuning já existia, mas não era assim

Transferir conhecimento de um modelo treinado numa tarefa pra outra tarefa (transfer learning) é uma ideia mais velha que deep learning -- já aparecia em visão computacional bem antes de chegar em linguagem, reaproveitando redes convolucionais treinadas em ImageNet pra outras tarefas de imagem. Em NLP, a versão mais próxima do que existia antes de 2018 era usar embeddings de palavra pré-treinados (word2vec, GloVe) como ponto de partida, não o modelo inteiro. O salto real pra "pré-treinar um modelo de linguagem inteiro, depois ajustar ele pra tarefa específica" começou a se firmar com ULMFiT (Howard & Ruder, 2018), que mostrou que essa receita funcionava bem pra classificação de texto usando um LSTM -- um ano antes de virar o padrão da área com os Transformers.

## 2. 2018-2019: BERT e o paradigma "pré-treine, depois ajuste"

BERT (Devlin et al., Google, 2018) é o marco que a maioria da área aponta como o início do fine-tuning moderno: pré-treinar um Transformer bidirecional num volume gigante de texto sem rótulo, depois ajustar (fine-tune) esse mesmo modelo, quase sem mudança de arquitetura, pra qualquer tarefa de NLP -- classificação, resposta a pergunta, reconhecimento de entidade. O resultado bateu recorde em praticamente todo benchmark de NLP da época. Esse foi o momento em que "fine-tuning" virou sinônimo de "como se usa um modelo de linguagem grande na prática": pré-treino uma vez, caro; fine-tuning muitas vezes, um por tarefa, relativamente barato.

## 3. 2019: adapters, o primeiro sinal de que ajustar tudo é caro demais

Quase junto com a virada do BERT, Houlsby et al. (Google, 2019) propuseram adapters: em vez de reajustar todos os parâmetros do modelo pré-treinado, inserir módulos pequenos e novos entre as camadas existentes, e treinar só esses módulos, mantendo o resto congelado. A motivação já era a mesma que justifica o Módulo 4 desta disciplina inteira: full fine-tuning de um modelo grande custa memória e tempo proporcionais ao tamanho do modelo inteiro, não da tarefa. Os adapters não pegaram tração imediata (o full fine-tuning de modelos do tamanho do BERT ainda era viável pra maioria), mas plantaram a pergunta que o LoRA respondeu, dois anos depois, de um jeito que pegou.

## 4. 2020: GPT-3 e a ameaça real ao fine-tuning

"Language Models are Few-Shot Learners" (Brown et al., OpenAI, 2020), o paper do GPT-3, mostrou algo que colocou em xeque o parágrafo anterior inteiro: um modelo grande o bastante consegue aprender uma tarefa nova só de ver alguns exemplos dentro do próprio prompt, sem nenhum ajuste de peso -- in-context learning, não fine-tuning. Por um tempo real, essa descoberta puxou o pêndulo da área inteira em direção a "prompt engineering resolve, fine-tuning é caro e desnecessário". Essa tensão nunca desapareceu de verdade -- é literalmente a mesma pergunta que o Módulo 1 desta disciplina abre perguntando "quando fine-tuning vale a pena", e que o Módulo 6.3 fecha com o case real da Intercom mostrando que, pra tarefa estreita e volume alto, a resposta ainda pode ser "vale, e vale muito".

## 5. 2021-2022: instruction tuning e RLHF, fine-tuning muda de alvo

Duas linhas de trabalho, quase paralelas, mudaram o que "ajustar" um modelo queria dizer: não mais só uma tarefa específica (classificar, extrair), mas o comportamento geral do modelo ao seguir instrução. FLAN (Wei et al., Google, 2021) mostrou que fine-tuning num conjunto grande e diverso de tarefas descritas como instrução em linguagem natural generaliza pra instrução nova, nunca vista. Em paralelo, RLHF -- Reinforcement Learning from Human Feedback, com base teórica em Christiano et al. (2017) -- virou o mecanismo central por trás do InstructGPT (Ouyang et al., OpenAI, 2022): fine-tuning supervisionado primeiro, depois um segundo estágio ajustando o modelo pra maximizar preferência humana julgada por um modelo de recompensa treinado pra isso. É literalmente o ancestral direto do ChatGPT, e a primeira vez que "fine-tuning" passou a incluir uma etapa de julgamento de preferência, não só rótulo certo/errado -- o mesmo tipo de julgamento que o Módulo 5.2 desta disciplina explora com LLM-as-judge.

## 6. 2021-2023: LoRA, QLoRA e a fine-tuning eficiente virando padrão de mercado

LoRA -- Low-Rank Adaptation (Hu et al., Microsoft, 2021) -- resolveu o mesmo problema dos adapters de 2019, mas de um jeito que pegou de verdade: em vez de inserir módulos novos, decompor a atualização de peso de cada camada em duas matrizes de posto baixo, treinando só essas duas matrizes pequenas e mantendo o peso original congelado. O resultado: uma fração do custo de memória do full fine-tuning, sem adicionar latência de inferência (as matrizes podem ser fundidas de volta no peso original depois do treino). LoRA é literalmente o mecanismo por trás do Módulo 4 inteiro desta disciplina. QLoRA (Dettmers et al., 2023) empurrou mais: quantizar o modelo base pra 4 bits antes de aplicar LoRA, permitindo treinar modelos de dezenas de bilhões de parâmetros numa única GPU de consumidor -- o movimento que democratizou fine-tuning de modelo grande pra fora de laboratório de big tech.

## 7. 2023: DPO, RLHF sem o reward model separado

Direct Preference Optimization (Rafailov et al., Stanford, 2023) mostrou que dá pra conseguir o mesmo efeito prático do RLHF -- ajustar o modelo pra preferência humana -- com uma única etapa de fine-tuning supervisionado sobre pares de resposta preferida/rejeitada, sem precisar treinar um modelo de recompensa separado nem rodar reinforcement learning de verdade. Mais simples de implementar e mais estável de treinar, DPO virou a alternativa padrão ao RLHF clássico pra quem quer alinhar um modelo com preferência sem montar o pipeline de RL inteiro -- o mesmo tipo de ajuste por preferência que o Módulo 3.5 desta disciplina demonstra (`preference-tuning-*.py`, não publicado na versão dos alunos).

## 8. 2024-2026: o pêndulo balança nos dois sentidos, ao mesmo tempo

O momento atual não é uma conclusão, é uma tensão viva, a mesma que esta disciplina inteira tenta resolver com protocolo em vez de opinião. De um lado, modelos de fronteira ficaram bons o bastante em contexto longo e in-context learning que muitas tarefas que antes precisavam de fine-tuning hoje se resolvem só com prompt bem escrito e RAG -- parte do motivo de OpenAI ter anunciado o fim faseado do self-service de fine-tuning via API em 2026 (ver `disponibilidade-fine-tuning-provedores-companion.md`, na mesma pasta deste arquivo). Do outro lado, o case real da Intercom, fechando o Módulo 6.3 desta disciplina, mostra um modelo pós-treinado sobre dado proprietário batendo os melhores modelos de fronteira do mercado numa tarefa estreita de alto volume -- exatamente o argumento que abriu a disciplina no Módulo 1. As duas coisas são verdadeiras ao mesmo tempo: fine-tuning deixou de ser a resposta padrão pra "como uso um modelo de linguagem", e continua sendo a resposta certa pra um conjunto real e específico de problemas -- o mesmo framework de decisão do Módulo 1 é o jeito de saber em qual dos dois lados o seu caso cai.

---

> **Veja também**: `disponibilidade-fine-tuning-provedores-companion.md` (o estado atual, provedor por provedor, de quem ainda oferece fine-tuning self-service) e `casos-de-mercado-fine-tuning-companion.md` (21 casos reais de empresas usando fine-tuning em produção hoje), ambos na raiz da disciplina.

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
