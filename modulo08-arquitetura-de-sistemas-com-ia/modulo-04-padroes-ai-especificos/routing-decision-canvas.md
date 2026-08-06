# Canvas de Decisão de Roteamento
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 4.2**

Use este canvas antes de mandar uma requisição direto pro seu modelo padrão. Ele separa as duas decisões de roteamento em ordem (primeiro pra onde, depois com qual modelo), porque resolver as duas juntas de uma vez costuma esconder qual delas está realmente causando o desperdício.

## Passo 1 (Intent-Based Routing): pra onde essa requisição vai?

1. **Você consegue nomear a intenção desta requisição em uma frase curta?**
   Não → antes de rotear qualquer coisa, defina as categorias de intenção do seu domínio. Não existe um número universal aqui: trate "entre 10 e 15 categorias de primeiro nível" como uma heurística de ponto de partida, não como um dado de mercado citável como os que aparecem na tabela abaixo — ajuste pra cima ou pra baixo conforme os fluxos reais do seu domínio pedirem tratamento diferente.
   Sim → siga para a pergunta 2.

2. **Essa intenção aponta claramente pra um agente ou índice específico?**
   Sim → roteie direto pra esse agente/índice.
   Não, ou confiança baixa → registre a decisão com a confiança marcada e escale pra revisão humana antes de prosseguir (formalizado no Módulo 4.4).

3. **A conversa já rodou mais de um turno?**
   Sim → reclassifique a intenção a cada novo turno relevante. Ela pode ter mudado desde a primeira mensagem.
   Não → prossiga para o Passo 2 com a classificação inicial.

## Passo 2 (Model Router): qual modelo processa?

1. **Um erro nesta tarefa específica é caro ou irreversível?** (framework do Módulo 1.3)
   Sim → modelo mais capaz disponível, sem economia aqui.
   Não → siga para a pergunta 2.

2. **A tarefa é extração simples, formatação, ou confirmação de um dado já validado?** (framework de trade-off do Módulo 1.4: latência, custo, precisão, performance)
   Sim → modelo mais barato resolve, com folga de qualidade.
   Não tenho certeza → calibre o limiar do classificador com folga, não no ponto exato de corte. Errar pra cima custa dinheiro, errar pra baixo custa qualidade.

3. **O classificador que decide isso é mais rápido e mais barato do que a tarefa que ele está evitando?** (mesmo framework do Módulo 1.4: o classificador também paga latência e custo)
   Não → o roteamento parou de economizar; simplifique o classificador antes de confiar nele.

## Aplicado ao TrialForge

| Decisão | Padrão aplicado | Onde acontece | Padrão de referência |
|---|---|---|---|
| Qual agente atende a requisição: ICF, Protocolo ou CSR | Intent-Based Routing | Gateway, antes de qualquer busca (Módulo 4.1) | Zendesk Intelligent Triage |
| Confiança baixa na classificação de intenção | Escalar, não adivinhar | Formalizado no Módulo 4.4 | Zendesk Intelligent Triage |
| Síntese estatística final do CSR | Model Router → modelo mais capaz | Erro caro e irreversível (Módulo 1.3) | RouteLLM (Berkeley/Anyscale/Canva, ICLR 2025) |
| Extração de dado simples de uma tabela, dentro do CSR | Model Router → modelo mais barato | Mesmo agente, tarefa de menor risco | RouteLLM |

## Como usar na atividade prática

1. Pegue três ou quatro tipos de requisição do seu próprio sistema (ou hipotético).
2. Rode o Passo 1 pra cada uma: anote pra onde ela vai e com que confiança.
3. Rode o Passo 2 só depois: anote qual modelo resolve, e por quê.
4. Confira a pergunta final do Passo 2 pra cada classificador que você desenhou: ele é mesmo mais barato que o problema que resolve?

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
