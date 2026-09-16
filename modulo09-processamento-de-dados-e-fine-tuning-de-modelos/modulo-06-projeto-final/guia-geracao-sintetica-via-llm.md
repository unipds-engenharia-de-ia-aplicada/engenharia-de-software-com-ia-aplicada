# Guia: Gerando Exemplos de Treino via LLM, Amplitude Seguros ou Seu Próprio Caso

Ahirton Lopes · Fine-Tuning Toolkit
UNIPDS: Processamento de Dados e Fine-Tuning de Modelos

## Quando usar este guia

O gerador determinístico desta disciplina (`m6-dataset-scaling-tool.js`/`.py`) resolve bem o caso Amplitude Seguros: schema fixo, valores conhecidos de antemão, sem custo de API, 100% reproduzível. Editar esse código pro seu próprio caso funciona se você sabe programar e seu domínio se encaixa no mesmo molde (extração estruturada com poucos campos).

Esse guia serve pra dois cenários onde o gerador determinístico não é o caminho certo:

1. Você quer mais exemplos pro caso Amplitude do que os pools de entidade do gerador cobrem, ou variedade de redação que o gerador não produz.
2. Você está aplicando o framework da disciplina (Missão Prática #06) ao seu próprio domínio, e não tem dado real suficiente pra curar um piloto, o bloqueio mais comum em fine-tuning de verdade.

**Dado real sempre vence dado sintético.** Se você tem exemplos reais do seu domínio, mesmo poucos, use-os antes de gerar qualquer coisa via LLM. Este guia é pra fechar a lacuna quando dado real não é suficiente, não pra substituí-lo.

## O princípio central: escreva o texto em torno do valor, não o contrário

O gerador determinístico desta disciplina funciona porque a ordem é sempre: primeiro decide o valor certo (nome, placa, valor do orçamento), depois pede pra alguém, ou algo, escrever o texto que carrega esse valor. O rótulo nunca é incerto porque ele nasceu antes do texto.

Peça a mesma coisa pro LLM: nunca peça "gere um exemplo de entrada e saída" solto. Peça "aqui estão os valores corretos, escreva um texto realista que os contenha". Isso garante que o rótulo, a extração correta, é conhecido de antemão, não uma segunda alucinação do próprio LLM tentando adivinhar o que ele mesmo acabou de escrever.

Se sua tarefa não for extração (não tem um valor "certo" objetivo, pense classificação de sentimento aberta, ou geração de resposta), essa garantia não existe. Nesse caso, todo exemplo gerado por LLM precisa de revisão humana antes de entrar no dataset de treino, não é opcional.

## Passo a passo

### 1. Defina o schema e os valores, não peça pro LLM inventar

Gere os valores de verdade primeiro, com código simples (nem precisa ser sofisticado como o gerador desta disciplina): um nome aleatório de uma lista, um valor numérico dentro de uma faixa plausível, uma data. Isso já é 90% do trabalho de garantir rótulo correto.

### 2. Peça diversidade de redação explicitamente, nunca "gere N exemplos" de uma vez

Um único prompt gerando N exemplos de uma vez tende a colapsar em padrões repetidos (o próprio LLM se ancora no primeiro exemplo que escreveu). Peça um exemplo por vez, ou poucos por vez, variando explicitamente:

- **A persona de quem escreveu**: mais formal, mais corrido, mais abreviado. O gerador desta disciplina usa 3 personas fixas por fonte, um bom número de partida.
- **O formato**: bloco de texto corrido, lista de campos, tabela improvisada em texto.
- **Ruído deliberado**: erro de digitação plausível, abreviação regional, campo faltando de propósito.

### 3. Inclua campos distratores

Peça pro LLM incluir, no texto gerado, pelo menos um dado que não faz parte do schema que você vai extrair (um número de apólice, um código interno, uma observação irrelevante). Sem isso, o modelo aprende a copiar tudo que vê, não a selecionar o campo certo, exatamente o motivo desse recurso existir no gerador desta disciplina.

### 4. Gere mais do que você precisa, e rode pelo pipeline real de curadoria

LLMs geram quase-duplicata (mesma estrutura, troca só o nome) com mais frequência do que parece à primeira vista. Não confie no julgamento visual. Gere um volume maior do que o alvo final e rode os exemplos crus pelo pipeline formal desta disciplina, a função `limparEBalancear` de `dataset-cleaning-balancing-tool.js` (Módulo 2.2), a mesma que o próprio gerador do Módulo 6 já reusa via `require` direto, sem lógica duplicada. Esse pipeline aplica MinHash+LSH pra achar quase-duplicata, e amostragem por temperatura pra balancear fonte dominante. Não escreva essa lógica de novo.

### 5. Valide uma amostra, não confie cegamente

Mesmo com valor conhecido de antemão, revise manualmente uma amostra dos textos gerados (10 a 20 exemplos é um começo razoável). Procure por: texto que soa artificial demais, personas que na prática saem parecidas, ou o LLM ignorando a instrução do campo distrator. Ajuste o prompt e regenere antes de seguir pro treino.

## Modelo de prompt (adapte pro seu domínio)

```
Você vai escrever um [tipo de documento, ex.: "recibo de manutenção
automotiva"] realista, no estilo de [persona, ex.: "um formulário
preenchido à mão, com abreviações comuns do setor"].

O documento precisa conter, de forma natural dentro do texto, estes
valores exatos (não troque, não arredonde):
- [campo 1]: [valor]
- [campo 2]: [valor]
- [campo 3]: [valor]

Inclua também, em algum lugar do texto, um dado que NÃO está na lista
acima (um campo distrator plausível pro seu domínio, ex.: número de
protocolo interno, observação do atendente). Ele não deve ser
confundido com os campos reais.

Não gere o rótulo ou a extração, só o texto de entrada. O rótulo já é
conhecido: os valores exatos acima.
```

## Aplicando ao caso Amplitude

Se você quiser gerar exemplos adicionais de Amplitude Auto ou Saúde Empresarial via LLM (cenário 1 acima), os valores certos e os campos distratores já estão documentados no próprio gerador determinístico: schema canônico em `dataset-cleaning-balancing-tool.js` (Módulo 2.2), campos distratores e personas descritos no cabeçalho de `m6-dataset-scaling-tool.js`. Use esse código como fonte de verdade dos valores e da estrutura de campo, e o prompt acima só pra variar a redação além do que os templates fixos do gerador já cobrem.

## Onde isso vem da literatura, não é intuição solta

A técnica deste guia não é original: é uma aplicação direta de resultados publicados em pesquisa de geração sintética de dado de treino.

**Self-Instruct** (Wang et al., 2022, "Self-Instruct: Aligning Language Models with Self-Generated Instructions", arXiv:2212.10560) é o trabalho que formalizou a ideia central: usar um LLM pra gerar seus próprios exemplos de treino, com um pipeline de geração seguido de filtro de similaridade antes de aceitar cada exemplo novo. Aplicado ao GPT-3, o método produziu ganho de 33 pontos percentuais absolutos sobre o GPT-3 original no benchmark Super-NaturalInstructions.

**Alpaca** (Taori et al., 2023, Stanford) é a aplicação mais conhecida dessa técnica, e já apareceu antes nesta disciplina: os 52 mil exemplos citados no Módulo 2 como comparação contra o LIMA foram gerados exatamente assim, via `text-davinci-003`, com custo abaixo de US$ 500 só na geração dos dados (o total pra reproduzir o Alpaca inteiro, incluindo o fine-tuning do LLaMA-7B, ficou abaixo de US$ 600, segundo o post original de Taori et al.). É também um alerta real: o próprio LIMA (Zhou et al., 2023, já citado no Módulo 2) mostrou que 1.000 exemplos bem curados batem os 52 mil do Alpaca em preferência humana. Volume gerado por LLM sem curadoria não é garantia de qualidade, o Passo 5 deste guia (validar amostra) existe por causa desse resultado publicado, não por excesso de cautela.

**Textbooks Are All You Need** (Gunasekar et al., 2023, Microsoft Research, arXiv:2306.11644) reforça o mesmo ponto do outro lado: o phi-1, modelo de 1,3 bilhão de parâmetros treinado com só 1 bilhão de tokens sintéticos de qualidade didática mais 6 bilhões de tokens web curados, chegou a 50,6% de acerto no HumanEval e 55,5% no MBPP, competindo com modelos ordens de grandeza maiores. Dado sintético bem desenhado pode superar dado bruto em volume, a mesma lógica do balanceamento por temperatura do Módulo 2.2.

**GuideX** (De La Fuente, Sainz, García-Ferrero e Agirre, ACL Findings 2025, arXiv:2506.00649) é o mais próximo tecnicamente deste guia: gera texto sintético rotulado pra extração de informação definindo o schema e as regras primeiro, e só depois sintetizando o texto alinhado a elas, o mesmo princípio do Passo 1 deste guia (decida o valor, depois escreva o texto em torno dele). Resultado publicado: até 7 pontos de F1 de ganho sobre métodos anteriores sem dado rotulado por humano, em sete benchmarks de reconhecimento de entidade nomeada, zero-shot.

## A técnica de 2022 ainda é atual, ou já foi ultrapassada

Self-Instruct é de dezembro de 2022, quase quatro anos antes deste guia. A pesquisa mais recente confirma que ele continua sendo a base, não foi substituído por um paradigma diferente, foi refinado em cima:

**Magpie** (Xu, Jiang, Niu, Deng, Poovendran, Choi e Lin, 2024, arXiv:2406.08464) mostra que nem precisa de exemplo semente: um LLM já ajustado por instrução gera sozinho a própria pergunta de usuário, só a partir do início do template de conversa, por causa da natureza autorregressiva do modelo. Modelos ajustados com dado gerado assim chegaram perto do Llama-3-8B-Instruct oficial, que usa dez milhões de exemplos curados com feedback humano.

**CoT-Self-Instruct** (Yu et al., Meta FAIR, julho de 2025, arXiv:2507.23751) é a atualização mais direta do método original, o próprio nome é uma continuação explícita: pede pro LLM raciocinar via Chain-of-Thought antes de gerar cada exemplo novo com base nas sementes, depois filtra por qualidade automaticamente. Superou datasets de referência existentes (s1k, OpenMathReasoning) em benchmarks de raciocínio verificável (MATH500, AMC23, AIME24, GPQA-Diamond).

O que mudou de 2022 pra cá não foi o esqueleto (gerar exemplo, filtrar por qualidade, repetir), foi o refinamento do filtro (de similaridade simples pra raciocínio explícito e juízes automáticos) e o modelo usado pra gerar (GPT-3 original em 2022, modelos de fronteira hoje). Pro objetivo específico deste guia, escrever texto realista em torno de um valor já conhecido, o princípio de 2022 continua sendo exatamente o que se aplica em 2026.

## O que este guia não resolve

Ele não substitui dado real quando dado real existe. Ele não valida se sua tarefa é sequer um bom caso pra fine-tuning, isso é o framework do Módulo 1, não deste guia. E ele não elimina a necessidade da Frente 3 do Módulo 5 (teste de estresse escrito à mão, não gerado por template nenhum, sintético ou não): gerar dado de treino sintético e testar contra dado sintético é o mesmo erro que o Módulo 5.3 já mostrou, decorar o formato do próprio gerador, não generalizar de verdade.

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
