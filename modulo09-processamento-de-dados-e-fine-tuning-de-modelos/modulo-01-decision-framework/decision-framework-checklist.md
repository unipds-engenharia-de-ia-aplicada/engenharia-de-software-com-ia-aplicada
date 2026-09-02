# Checklist: Vale a Pena Fazer Fine-Tuning?
> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Artefato de Demo - Módulo 1.1**

Use este checklist antes de decidir treinar seu próprio modelo. Ele não substitui o framework completo (que ganha uma ferramenta de decisão aplicada a casos reais no Módulo 1.2, e rodada de verdade no terminal no Módulo 1.3), mas evita o erro mais caro: tratar fine-tuning como se ensinasse fato novo, quando na verdade ensina comportamento e formato.

> **Versão visual:** este mesmo gate + as quatro perguntas abaixo estão desenhados como pôster de campo em [`fine-tuning-zoo-poster.png`](../../gravacao-m1.3/demos/fine-tuning-zoo-poster.png), junto com as seis técnicas de fine-tuning (Módulo 1.3) e os modelos abertos recomendados pra treinar em 2026.

> **Decidindo em comitê, não sozinho (depois do Módulo 1.3):** depois que vocês virem AHP rodar de verdade no Módulo 1.3, vale saber que o peso de cada uma das quatro perguntas vem de uma matriz preenchida por uma pessoa só. Se o seu contexto real envolve várias pessoas com julgamento diferente (produto, compliance, engenharia), `decision-framework-tool.js`/`.py`, na pasta de demos do Módulo 1.2, também sabe agregar a matriz de vários avaliadores numa só, pela média geométrica de cada célula, sem trocar o resto do pipeline. Rode o script e veja a seção "AHP de comitê" no final da saída.

## Pergunta 0 (elimina antes de tudo): é problema de conhecimento ou de comportamento?

Se a resposta muda porque um fato mudou (política, preço, regra), é **RAG**, não fine-tuning. Se a resposta precisa ser consistente em tom, estrutura e formato (sempre do mesmo jeito, para o mesmo tipo de entrada), aí sim vale seguir para as quatro perguntas abaixo.

## As quatro perguntas

| # | Pergunta | Sinal verde | Sinal vermelho |
|---|---|---|---|
| 1 | A tarefa é estreita e repetida, ou aberta e variável? | Você descreve a tarefa numa frase que vale pra quase todo caso. | A descrição muda dependendo do caso ("às vezes X, às vezes Y"). |
| 2 | Já esgotou prompt engineering + RAG + roteamento + cache de contexto/prompt? | Testou prompt bem escrito de verdade, com exemplos, roteou pro modelo certo e já usa cache de contexto/prompt onde dá, e ainda falha de forma consistente ou fica caro demais em escala. | Nem tentou melhorar o prompt direito antes de cogitar treinar. |
| 3 | Tem dado de exemplo suficiente, diverso e de qualidade? | Já existe histórico real de entrada/saída correta, cobrindo a variação real da tarefa, mesmo que poucas dezenas de casos. | Teria que inventar os exemplos do zero, sem caso real de base. |
| 4 | A tarefa é estável o bastante pra não virar esteira de retreino? | O schema de saída é um contrato que muda raramente, por decisão deliberada. | Cada área pede um formato diferente, sem contrato único definido. |

**Regra prática:** precisa de sinal verde nas quatro perguntas pra fine-tuning valer a pena. Uma resposta vermelha já é motivo pra continuar com prompt engineering + RAG, não pra treinar mesmo assim. Cache de contexto/prompt não substitui a Pergunta 2, só adia: reduz o custo do status quo, mas se a tarefa continuar falhando em qualidade mesmo mais barata, a resposta ainda é treinar.

**Nota de terminologia:** a escada completa antes de considerar fine-tuning é prompt engineering → context engineering (RAG incluído) → Agent Skills → fine-tuning. A Pergunta 2 acima testa se você já esgotou os três primeiros degraus dessa escada.

## Aplicado à Amplitude Seguros

| Sinal avaliado | Observação |
|---|---|
| Pergunta 1 (estreita e repetida) | Extrair segurado, placa e valor de um orçamento de oficina é sempre a mesma estrutura de saída, documento após documento. |
| Pergunta 2 (esgotou prompt+RAG?) | Já testado nos dois casos, mesmo processo de validação, mesmo resultado: sinal verde. |
| Pergunta 3 (dado suficiente?) | Depende do volume histórico de cada linha de negócio: é exatamente o que os casos do Módulo 1.2 vão diferenciar. |
| Pergunta 4 (schema estável?) | O contrato de saída com o sistema de sinistros é fixo, não muda toda semana. |

Repare que a Pergunta 3 não tem resposta óbvia só de olhar a tarefa: depende do histórico real de cada linha de negócio. É exatamente por isso que os dois casos da Amplitude Seguros (Auto e Saúde Empresarial), no Módulo 1.2, não vão dar a mesma recomendação.

## Seu caso: aplique às suas próprias tarefas

| Pergunta | Sua tarefa | Sinal verde ou vermelho? |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |

## Como usar na atividade prática

1. Escolha uma tarefa do seu próprio contexto de trabalho que hoje é feita com prompt ou manualmente.
2. Rode as quatro perguntas contra essa tarefa, marcando sinal verde ou vermelho pra cada uma.
3. Se todas forem verdes, escreva uma frase justificando por que fine-tuning valeria a pena aqui. Se alguma for vermelha, escreva o que precisaria mudar antes de reconsiderar.
4. Guarde este checklist: no Módulo 1.2 ele vira uma ferramenta de decisão aplicada a casos reais da Amplitude Seguros, e no Módulo 1.3 esse mesmo código roda de verdade no terminal.

---

*Ahirton Lopes · Fine-Tuning Toolkit, UNIPDS: Processamento de Dados e Fine-Tuning de Modelos*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
