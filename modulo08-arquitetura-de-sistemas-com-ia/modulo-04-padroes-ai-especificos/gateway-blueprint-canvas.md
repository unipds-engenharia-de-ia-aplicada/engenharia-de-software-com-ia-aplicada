# Blueprint de Calibragem do Gateway
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 4.5**

Use este template pra aplicar os 4 padrões do Módulo 4 a um contexto real (o seu, ou um hipotético) antes de escrever qualquer código. É o mesmo blueprint que gerou o `trialforge-gateway-prototype.js/py`.

## 1. Categorias de intenção e roteamento de modelo

Para cada categoria de requisição do seu contexto, preencha:

| Categoria de intenção | Exemplo de pergunta | Modelo (barato/caro) | Por quê |
|---|---|---|---|
| _ex.: consulta_icf_ | "Quais as regras de X?" | barato | erro reversível, baixo risco |
| _ex.: consulta_protocolo_ | "Qual o critério de inclusão Y?" | barato | erro reversível, baixo risco |
| _ex.: sintese_csr_ | "Preciso da síntese final" | caro | erro caro e irreversível (Módulo 1.3) |
| | | | |

Cada categoria de intenção também é a chave de roteamento do Multi-Index (seção 5): a mesma classificação decide o modelo E o índice de busca.

## 2. Calibração de limiar com dado real (não assuma um número)

Teste pares de pergunta contra o modelo de embedding que você for usar, e preencha com os valores medidos. **Não copie os números do TrialForge**, eles são específicos do nomic-embed-text em português:

| Par de pergunta | Similaridade medida | É "a mesma pergunta"? |
|---|---|---|
| _ex.: "Quais são as regras de assentimento pra menores?" vs. "O assentimento dos menores de idade é obrigatório?"_ | _0,825_ | _Sim, bateu no Semantic Cache_ |
| Pergunta original vs. paráfrase distante (termos diferentes) | | |
| Pergunta original vs. tema totalmente diferente | | |

Nota sobre os outros números citados no vídeo (0,668 e 0,633): vêm de uma comparação diferente desta tabela: confiança do RAG (Agentic RAG, seção 5) entre a pergunta e a cláusula regulatória mais próxima, não pergunta-contra-pergunta do Semantic Cache. Servem de referência de ordem de grandeza pro mesmo par modelo+idioma (nomic-embed-text em português), não são um preenchimento direto desta tabela.

Limiar escolhido: **______** (deve ficar entre o valor da paráfrase próxima e o valor do tema diferente, com folga, não no ponto exato de corte, conforme Módulo 4.2).

## 3. Critério de Approval Gate: o que SEMPRE escala, independente de confiança

Liste as categorias de tarefa que, na sua arquitetura, nunca deveriam pular o Approval Gate, mesmo com confiança alta:

- [ ] _ex.: qualquer síntese que vira documento oficial_
- [ ] _ex.: qualquer ação que envolve dado de menor de idade_
- [ ]

## 4. Checklist de campos da trilha de auditoria

Reaproveitado do Módulo 4.4. Confirme que sua trilha registra, pra cada decisão:

- [ ] Quem, ou qual componente, tomou a decisão
- [ ] Data e hora exatas
- [ ] Versão do prompt e do modelo usados
- [ ] Limiar aplicado e o score obtido
- [ ] Resultado final (aprovado, rejeitado, ou escalado)

## 5. RAG avançado: Multi-Index + Hybrid Search + Agentic RAG (Módulo 4.1 completo)

O RAG do protótipo não é mais um banco único comparado por embedding — são três mecanismos empilhados, todos implementados de ponta a ponta em `trialforge-gateway-prototype.js/py`:

**Multi-Index:** três índices reais, um por domínio de agente do TrialForge (ICF, Protocolo, CSR — mesma divisão do Módulo 3.1). A classificação de intenção que já decide o Model Router (Módulo 4.2, seção 1 acima) também roteia pro índice certo — nenhuma cláusula de um domínio compete por atenção com as de outro.

**Hybrid Search:** dentro do índice roteado, busca léxica (BM25, calibrado com o IDF do próprio corpus) e busca densa (cosseno sobre embedding real) rodam sobre as mesmas cláusulas e são fundidas por Reciprocal Rank Fusion (Cormack, Clarke & Büttcher, SIGIR 2009) — pela POSIÇÃO de cada cláusula em cada ranking, nunca somando os dois scores brutos direto: BM25 é de escala aberta, cosseno vai de -1 a 1, somar os dois sem normalizar mistura grandezas incompatíveis.

**Agentic RAG:** se a confiança da 1ª busca fica abaixo do limiar (seção 2), o protótipo tenta de novo com estratégia mais ampla — até 3 iterações (mesmo limite de tentativas do CAP do Módulo 3.5): a 1ª compara com o tema da cláusula, a 2ª amplia pro texto completo, a 3ª cruza os três índices. Se as 3 esgotarem sem atingir o limiar, o RAG não decide sozinho — devolve o melhor resultado achado e deixa o Confidence Threshold (seção 3) escalar pro Approval Gate.

**Exemplo real medido (nomic-embed-text, português):** a pergunta "Qual é o critério de idade mínima pra participar desse estudo?" roteia pro índice `protocolo` e converge já na 1ª iteração (cosseno 0,848, BM25 2,358 — "idade mínima" casa literalmente no texto da cláusula). Já "Qual o prazo de armazenamento das amostras biológicas..." não converge em nenhuma das 3 iterações (melhor confiança 0,633, mesmo depois de cruzar os 3 índices) — nenhuma cláusula do banco cobre esse tema, então escalar pro Approval Gate é o comportamento certo, não uma falha do RAG.

## Como usar na Missão Prática #04

1. Preencha as 5 seções acima para uma tarefa real do seu contexto.
2. Rode o protótipo na sua máquina pra ver os caminhos possíveis: cache miss, cache hit, Approval Gate obrigatório (síntese de CSR), Approval Gate por confiança baixa mesmo depois do Agentic RAG insistir 3 vezes, e roteamento correto de Multi-Index + convergência rápida do Hybrid Search (pergunta de protocolo). A entrega oficial da Missão Prática é `trialforge-gateway-prototype.js`, conforme a ementa; `.py` é só referência.
3. Entregue o blueprint preenchido + o log da execução, num único arquivo.

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D. (GDE AI, Microsoft MVP, Senior Manager)*
