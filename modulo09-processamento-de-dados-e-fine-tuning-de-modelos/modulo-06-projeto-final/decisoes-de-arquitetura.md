# Decisões de Arquitetura: Amplitude Seguros, Fine-Tuning de Ponta a Ponta

Ahirton Lopes · Fine-Tuning Toolkit
UNIPDS: Processamento de Dados e Fine-Tuning de Modelos

Este documento cumpre o quarto bullet oficial do Módulo 6: documentar e apresentar os resultados, justificando as escolhas de arquitetura e abordagem. Oito decisões: uma por módulo do Módulo 1 ao Módulo 5, e três do Módulo 6, o módulo de fechamento do case, cada uma com a alternativa rejeitada e o número real que sustentou a escolha. Nenhuma decisão aqui foi tomada por regra de bolso: todas rodaram de verdade antes de virar escolha final.

## Decisão 1 (Módulo 1): Framework de 4 perguntas ponderado por AHP, não um checklist binário

**Escolha**: gate de decisão com peso por pergunta (derivado por Analytic Hierarchy Process, matriz de comparação pareada de Saaty) e limiar verde de 0,6 por pergunta, não uma média simples nem um checklist "sim/não" solto.

**Alternativa rejeitada**: um checklist binário de 4 perguntas, decidido por maioria simples ou por julgamento qualitativo direto.

**Por quê**: um checklist simples deixaria a Amplitude Saúde Empresarial passar por engano, já que seu score composto ponderado (0,60) fica perto do de Atendimento ao Cliente (0,66), mas os dois têm perfis completamente diferentes: Saúde reprova só na pergunta de dado (p3), um problema temporário; Atendimento reprova em duas perguntas estruturais (p1, tarefa aberta; p4, instabilidade), um problema permanente. Um gate ponderado, com regra "uma pergunta vermelha derruba o caso, não importa a média", captura essa diferença; uma média simples, não.

**Resultado real**: Amplitude Auto aprovado desde o início (as 4 perguntas verdes). Saúde Empresarial reprovado em 2026 (M1.2/M1.3), reaprovado 9 meses depois no M3.2 quando p3 cruzou de 0,35 para 0,62 com dado real acumulado. Atendimento ao Cliente reprovado nos dois momentos, sem mudança: a distinção que o gate ponderado deveria capturar se confirmou na prática.

## Decisão 2 (Módulo 2): MinHash + LSH pra deduplicação, não comparação par a par

**Escolha**: MinHash com Locality-Sensitive Hashing pra encontrar candidatos a duplicata, reduzindo o espaço de comparação antes de aplicar similaridade de conteúdo.

**Alternativa rejeitada**: comparação de similaridade de Jaccard ingênua, par a par, com corte fixo arbitrário (a versão original do Módulo 2.2, reconstruída depois de reconhecida como heurística fraca demais pro nível da disciplina).

**Por quê**: comparação par a par escala quadraticamente com o número de exemplos, inviável em qualquer volume real de produção. LSH reduz o espaço de busca sem perder recall em duplicatas genuínas.

**Resultado real**: 549 comparações par a par reduzidas para 20 comparações via candidatos LSH, 96,4% menos trabalho, com recall perfeito nas 3 duplicatas reais plantadas no dataset de prova de conceito. A economia de escala é o próprio argumento: numa base de produção de milhares de exemplos, comparação par a par simplesmente não roda em tempo viável.

## Decisão 3 (Módulo 3): API gerenciada (Vertex AI), não infraestrutura de treino própria

**Escolha**: fine-tuning via job gerenciado na Vertex AI (upload de dataset, configuração de hiperparâmetro, endpoint publicado automaticamente).

**Alternativa rejeitada**: treino próprio, infraestrutura de GPU dedicada, pipeline de deploy de modelo construído do zero.

**Por quê**: pra um piloto validando se fine-tuning vale a pena, o custo fixo de montar infraestrutura de treino própria não se justifica antes de provar o caso de negócio. A API gerenciada move esse custo pra depois, quando o caso já estiver provado, coerente com a lógica de NPV do Módulo 1 (adiar custo fixo até ter validação).

**Resultado real**: job real (`tuningJobs/4180970763655839744`), 200 exemplos (120 Auto + 80 Saúde Empresarial), 3 épocas, taxa de aprendizado 5, posto 4, SUCCEEDED em 45 minutos e 42 segundos, endpoint publicado e usado sem interrupção do Módulo 3.2 até aqui.

Nota de transparência, mesmo espírito da Decisão 4: o posto 4 nunca foi pedido explicitamente na chamada de criação de nenhum job real desta disciplina (a requisição só envia época e taxa de aprendizado): é o default silencioso da própria Vertex AI, não uma escolha deliberada, achado numa auditoria posterior aos resultados do Módulo 3.3. O Módulo 4.3, medindo em outro stack (MLX-LM local), concluiu que posto 4 seria insuficiente numa margem de qualidade generosa; nesta tarefa específica de extração, porém, os resultados reais medidos a partir do Módulo 5.1 não mostraram prejuízo de precisão.

## Decisão 4 (Módulo 4): LoRA rank 8, não full fine-tuning

**Escolha**: adaptação de baixo posto (LoRA) como caminho testado, usando posto 8, o valor default do MLX-LM mantido sem comparação de custo-benefício prévia, entre as 4 configurações avaliadas (rank 4, 8, 16, e full fine-tuning das últimas 16 camadas).

**Alternativa rejeitada**: full fine-tuning das últimas 16 camadas.

**Por quê**: full fine-tuning treina 153,5 vezes mais parâmetro que LoRA rank 8, usa 42% mais memória de pico, e gera um checkpoint 73,8 vezes maior. Mas, medido contra dois exemplos de teste, incluindo um desenhado de propósito pra ser difícil, os dois produzem exatamente o mesmo resultado observável nesta tarefa de extração estruturada.

**Resultado real**: rank 8, o valor default do MLX-LM usado sem escolha deliberada de custo-benefício, empatou com full fine-tuning nesta tarefa específica. O ganho de qualidade de full fine-tuning existe (mensurável em val loss), mas nunca apareceu como erro corrigido na prática dos testes reais. Isso não significa que rank 8 seja universalmente o melhor custo-benefício: o Módulo 4.3 mediu e concluiu que não existe posto certo universal, existe posto certo pra margem de qualidade que se aceita, e dependendo da margem, recomenda rank 16 (margem apertada) ou rank 8 (margem generosa); rank 4 fica de fora até na margem mais larga testada.

## Decisão 5 (Módulo 5): Protocolo de avaliação em 3 frentes, não uma métrica isolada

**Escolha**: nenhuma medição isolada é aceita como prova de generalização. O protocolo exige teste retido (dado nunca visto), comparação A/B contra baseline genérica, e teste de estresse de invariância (fora do gerador determinístico de treino), nessa ordem, antes de declarar um piloto pronto pra escalar.

**Alternativa rejeitada**: aceitar a primeira métrica forte como prova suficiente (por exemplo, cem por cento de precisão contra o mesmo gerador que criou os dados de treino).

**Por quê**: uma métrica isolada, mesmo perfeita, não distingue "generaliza de verdade" de "decorou o formato do gerador". O Módulo 5.3 provou isso na prática: o teste retido inicial usava o mesmo gerador determinístico do treino, e só o teste de estresse com texto escrito à mão revelou se a robustez era real.

**Resultado real**: 100% de precisão no teste retido (Módulo 5.1); 100% contra 0% do modelo genérico sem hint, 100% contra 54,5%-72,7% (média 61,8%), N=20, com hint (Módulo 5.2); 100% depois de corrigido um bug real de comparação de maiúscula no harness, e 100% também no round de estresse estrutural mais severo, depois de descartar um alarme falso de amostra pequena (retestado com N=58, zero erros reais, Módulo 5.3). Checklist de graduação final: 5 de 5 critérios, definidos antes de medir.

## Decisão 6 (Módulo 6): Classificador de palavra-chave, não um segundo modelo de linguagem

**Escolha**: `classificarDominio` conta ocorrências de vocabulário deliberadamente específico de cada domínio (não vocabulário genérico de seguros) pra decidir o roteamento, em vez de uma chamada de LLM adicional pra classificação.

**Alternativa rejeitada**: usar um modelo de linguagem (o mesmo modelo fine-tunado, ou um genérico) pra classificar o domínio antes de extrair os campos.

**Por quê**: classificar entre dois domínios já conhecidos, com vocabulário genuinamente distinto, é um problema fácil o bastante pra não justificar o custo, a latência, e o ponto de falha adicional de mais uma chamada de API. A complexidade da solução deve ser proporcional à dificuldade real do problema, a mesma lógica que já apareceu no Módulo 1 (não usar Real Options quando não há componente temporal genuíno na decisão).

**Resultado real**: 14 testes automatizados, todos passando, incluindo casos reais escritos à mão (não gerados pelo template determinístico) pros dois domínios aprovados, pro caso fora do escopo (Atendimento ao Cliente), e pro caso ambíguo. Os dois casos de recusa nunca chamam o modelo fine-tunado: verificado por teste, não só assumido.

## Decisão 7 (Módulo 6): Vertex AI por padrão, com flag `--local` pra trocar o caminho de inferência

**Escolha**: o protótipo (`amplitude-seguros-assistente.js`) chama o endpoint Vertex AI (Módulo 3.2) por padrão, com uma flag `--local` opcional pra trocar pro checkpoint LoRA local (Módulo 4.2).

**Alternativa rejeitada**: fixar o protótipo num único caminho de inferência, só nuvem ou só local, sem opção de troca.

**Por quê**: o Módulo 5.4 já mostrou, medindo, que os dois modelos, endpoint Vertex AI e checkpoint local LoRA rank 8, dão o mesmo resultado nesta tarefa. Deixar o caminho fixo esconderia essa equivalência real; expor a escolha como flag prova, no próprio código, que a arquitetura de orquestração não fica presa a um provedor só.

**Resultado real**: `node amplitude-seguros-assistente.js` roda contra o endpoint Vertex AI por padrão; `node amplitude-seguros-assistente.js --local` roda contra o checkpoint local via `chamar_modelo_local.py`, com a mesma lógica de roteamento e classificação nos dois caminhos.

## Decisão 8 (Módulo 6): Recusar em vez de adivinhar quando o texto é ambíguo ou fora do escopo

**Escolha**: o classificador de domínio devolve explicitamente `motivo: 'ambiguo'` quando o texto empata ou não tem pista clara entre Auto e Saúde Empresarial, e roteia pra um especialista humano quando o texto é de um domínio fora do escopo aprovado (ex.: Atendimento ao Cliente), em vez de forçar uma extração com o modelo fine-tunado.

**Alternativa rejeitada**: sempre escolher o domínio com a pontuação mais alta, mesmo quando as pontuações empatam ou nenhuma delas tem sinal claro.

**Por quê**: é a mesma regra do gate de governança do Módulo 1 aplicada de novo, agora no protótipo: sem confiança clara, o sistema não decide no chute. Errar rejeitando um caso válido é um incômodo pequeno; errar extraindo campo do domínio errado é dado corrompido saindo como se fosse confiável.

**Resultado real**: testes automatizados confirmam que um caso de Atendimento ao Cliente (fora do escopo) nunca chama o modelo fine-tunado e é roteado a um especialista humano com motivo `fora_do_escopo`; e que um caso com pistas empatadas de Auto e Saúde é sinalizado com motivo `ambiguo`, devolvido pro usuário confirmar. Nos dois casos, sem custo de chamada de API.

## Adendo: a escala do Módulo 5.4 (veredito "ESCALAR"), executada de verdade

O veredito do Módulo 5.4 (Slide 8) foi "Auto e Saúde Empresarial: SIM, escalar", sem especificar um número de exemplos, o módulo só definiu a direção da decisão, não a magnitude. A faixa de 3.000 exemplos usada nesta revisão é critério aplicado agora, nesta documentação, não uma recomendação numérica que o Módulo 5.4 tenha feito. Fechado com um dataset de **3.000 exemplos reais (1.800 Auto + 1.200 Saúde)**, não só mais volume do mesmo template: 10 oficinas e 8 clínicas (contra 6 e 5 do piloto), 3 personas de redação distintas por fonte, campos distratores reais (apólice, franquia, convênio, guia, CRM) que não fazem parte do schema extraído, e ruído real de OCR em cerca de 9% dos exemplos.

**Escolha**: 3.000 exemplos, dentro da faixa de "poucos milhares" que a literatura já citada nesta disciplina (LIMA, Zhou et al. 2023) associa a retorno decrescente pra tarefas estreitas de extração, já que o custo de treino é pequeno nessa faixa (R$41,40, ver abaixo) e o limite real não é dinheiro, é diversidade genuína de conteúdo.

**Alternativa rejeitada**: escalar pra dezenas de milhares de exemplos, já que o custo permitiria. Rejeitada porque, pra uma tarefa estreita de extração de 2 schemas fixos, a literatura já citada nesta disciplina (LIMA, Zhou et al. 2023) mostra retorno decrescente além de poucos milhares de exemplos bem curados: mais volume sem mais diversidade real vira enchimento, não rigor.

**Resultado real**: novo job (`tuningJobs/8278721957516541952`), mesmos hiperparâmetros do job original (3 épocas, `learning_rate_multiplier=5`, adapter rank 4), `SUCCEEDED` em 24min53s (mais rápido que o job de 200 exemplos, 45min42s, resultado real, provavelmente variação de fila da infra, não uma relação causal "mais dado treina mais rápido"). Endpoint publicado: registrado na variável de ambiente `ENDPOINT_MODULO63` (mesmo valor usado em `m6-scaled-model-verification-tool.js`/`.py`), pra que a reavaliação abaixo seja reproduzível com o endpoint de cada um, não só narrada. 474.448 tokens faturáveis, custo estimado de **R$41,40** (número real, conferido no relatório de billing real do Google Cloud por SKU: R$62,01 cobrados na SKU "Gemini 2.5 flash tuning" em agosto/2026 para 2.132.014 unidades faturadas = R$0,00002909/unidade; a quantidade faturada é tokens do dataset × número de épocas, não só tokens do dataset - confirmado batendo 93,5% contra a soma de todos os jobs reais de SFT desta disciplina na mesma SKU: Módulo 3.2 (27.353 tokens), as duas versões do dataset Dolly extra do Módulo 3.4 (67.668 tokens cada, `tuningJobs/7139833932131860480` e `tuningJobs/7943269068780339200`), as duas ablações Auto/Saúde do Módulo 5.2 (17.485 + 9.868 tokens) e este job de 3.000 exemplos (474.448 tokens) - total 664.490 tokens × 3 épocas = 1.993.470 unidades faturadas, 93,5% das 2.132.014 unidades da SKU. Não entra nessa soma o job de Preference Tuning do Módulo 3.5 (13.528 tokens), que corre numa SKU de DPO diferente.

**Custo real, verificado contra o billing**: estimar esse custo só pela página pública de preços é traiçoeiro nos dois sentidos -- confundir o preço por token de SAÍDA de inferência com o de treino superestima o custo em dezenas de vezes; já esquecer que a quantidade faturada é tokens do dataset × número de épocas (não só tokens do dataset) subestima em ~1000x. O número real, checado direto contra o billing de verdade, é R$41,40 pra este job - mais caro que uma estimativa ingênua pela página de preços, mas ainda barato pra rodar um job real.

**Custo total agregado do case**: somando os dois jobs principais de treino que sustentaram esta disciplina, o piloto de 200 exemplos do Módulo 3 (`tuningJobs/4180970763655839744`, 27.353 tokens faturáveis, ver `model-card-amplitude-auto-saude-m3-200.md`, em modulo-03-fine-tuning-via-api/) e este job escalado de 3.000 exemplos do Módulo 6 (474.448 tokens faturáveis, acima), o total é 501.801 tokens de treino faturados, custo real de **R$43,78** (arredondando o total bruto uma única vez: R$2,39 + R$41,40 somados antes de arredondar cada parcela dá R$43,79, um centavo a mais), conferido contra o billing real - não os US$1-2 publicados antes, nem a subestimativa de centavos de uma correção anterior. Além desses dois, o Módulo 5.2 rodou mais dois jobs reais de ablação por domínio único: Auto (17.485 tokens, R$1,53) e Saúde Empresarial (9.868 tokens, R$0,86), ambos confirmados na mesma linha do billing real, mas não entram na soma acima porque a Missão Prática #06 não referencia esses dois jobs especificamente. Os experimentos de rank do Módulo 4 rodaram localmente (MLX, sem faturamento de API), e o dataset de 3.000 exemplos do Módulo 6 foi gerado por script determinístico (`m6-dataset-scaling-tool.js`/`.py`), não por chamada de LLM. Referenciado na Atividade 6 (Missão Prática #06).

**Comparação justa, mesmo harness reusado sem modificação nos dois modelos**: o Módulo 5.3, na investigação final, descartou como alarme falso de amostra pequena o aparente erro do piloto no Round 2 ("exame de ressonância magnética" virando só "ressonância magnética"), retestado com N=58, zero erros reais. O modelo de 200 exemplos, portanto, já estava limpo nesse round: teste retido 11/11 (100%), Round 1 6/6 (100%), Round 2 6/6 (100%). O modelo de 3.000 exemplos, ao contrário, introduz um erro novo nesse mesmo Round 2, sem nenhum ganho compensando: teste retido 11/11 (100%), Round 1 6/6 (100%), Round 2 4/6 (66,7%), uma regressão real, não uma troca. Os 2 casos que falham são os únicos dois exemplos do Round 2 com dois registros no mesmo texto, um completo e um incompleto (ex.: "dois veículos em reparo hoje... o primeiro... ainda aguardando peça, orçamento não fechado... o segundo... teve o orçamento aprovado"). Nos dois casos o modelo identifica a pessoa certa e os valores certos, mas devolve a resposta como array JSON (`[{...}]`, às vezes incluindo o registro incompleto com `valor: null`) em vez do objeto solto que o harness exige e que o modelo de 200 exemplos sempre devolve nos mesmos dois casos. Não é erro de conteúdo, é mudança de formato de saída diante de entrada ambígua, plausivelmente um efeito real de mais fontes e personas de redação no dataset de 3.000 ensinando o modelo a enumerar quando o texto menciona mais de uma pessoa. Diferente do alarme falso do Módulo 5.3, esse erro não é ruído: reproduzido de forma consistente em dezenas de chamadas ao vivo, entre rodadas completas do harness e repetições focadas nos 2 casos que falham, sempre com o mesmo resultado -- comportamento estável do modelo, não coincidência de amostra pequena.

**Honestidade**: 6 exemplos por rodada é uma amostra pequena, mas o erro do modelo escalado foi confirmado de forma consistente em dezenas de chamadas ao vivo, entre rodadas completas do harness e repetições focadas nos 2 casos que falham, sempre com o mesmo resultado. Não é ruído de amostra pequena, ao contrário do alarme falso que o Módulo 5.3 já tinha descartado pro piloto: o piloto de 200 exemplos estava limpo nesse round, o de 3.000 não está. Mais dado não é garantia de manter o que já funcionava.

## Decisão transversal: reuso de código em vez de duplicação em todos os módulos

Cada módulo, a partir do Módulo 3, reusou funções já publicadas de módulos anteriores via `require`/`import` direto do arquivo original, nunca copiando e colando lógica. `avaliarAdequacaoSchema` (Módulo 5.1) é chamado sem modificação pelo protótipo do Módulo 6.2. `limparEBalancear` (Módulo 2.2) é chamado sem modificação pelo gerador de escala do Módulo 3.2. `avaliarFramework` (Módulo 1.2) é chamado sem modificação pela reavaliação do Módulo 3.2. Essa disciplina evita o risco mais comum de sistemas que crescem por cópia: duas cópias da mesma regra divergindo silenciosamente quando só uma é corrigida.

## O que este case prova, e o que não prova

**Prova, medido**: que um piloto de fine-tuning bem curado, com 200 exemplos e um protocolo de avaliação rigoroso, generaliza pra dado nunca visto, bate um modelo genérico por margem clara, resiste a variação de formato e de estrutura, e pode virar um protótipo funcional de baixo custo de manutenção. E, escalado pra 3.000 exemplos reais com mais diversidade de fonte e redação, generaliza tão bem quanto o piloto no teste retido e no Round 1, medido com o mesmo protocolo, não assumido.

**Não prova, e não finge provar**: que 3.000 exemplos bastam em qualquer escala de produção real; que o piloto generaliza pra outro idioma, outra moeda, ou volume real de tráfego; que o sistema resiste a entrada adversarial ou maliciosa (só foi testado contra texto plausível de negócio); que escalar dataset sempre preserva o desempenho do piloto (neste caso específico, o modelo escalado regride no Round 2, de 100% pra 66,7%, um erro de formato novo e reproduzido, ver Adendo acima; mais dado não é garantia de manter o que já funcionava); ou que o mesmo resultado se repete automaticamente num domínio genuinamente novo, sem repetir o protocolo completo do Módulo 5.

> **Versão visual, contexto adicional**: as 8 decisões acima são sobre este case. O estado do campo além dele, o que motivou o gate de governança do Módulo 1 a ficar ainda mais relevante agora (Slide 8 do Módulo 6.3: mundo navegável do Genie 3, crescimento do MCP, o incidente de sandbox da OpenAI em produção real, e por que segurança e governança em IA é o próximo módulo do programa) está reunido como pôster de campo em [`estado-da-fronteira-poster.png`](estado-da-fronteira-poster.png), na mesma pasta deste arquivo.

> **Antes de começar sua própria aplicação, confira isso primeiro**: fine-tuning vale a pena (Módulo 1), a técnica certa depende do caso (Módulos 3-4), e o protocolo de avaliação sustenta a decisão (Módulo 5) -- mas nada disso importa se o provedor que você escolher não oferecer mais fine-tuning self-service no dia em que você for construir. [`disponibilidade-fine-tuning-provedores-companion.md`](../disponibilidade-fine-tuning-provedores-companion.md) traz o status verificado de Google, OpenAI e Anthropic, e onde checar de novo antes de decidir.

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
