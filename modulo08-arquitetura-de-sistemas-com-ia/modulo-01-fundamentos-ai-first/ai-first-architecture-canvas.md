# Canvas de Decisão: Agente de IA vs. Script Determinístico
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 1.1**

Use este checklist antes de desenhar qualquer componente de um sistema AI-first. Ele não substitui a análise de arquitetura, mas evita a maior parte das decisões ruins: colocar um agente onde bastava uma função, ou tentar resolver com regras fixas um problema que é ambíguo por natureza.

## Sinais de que a tarefa pede um agente

- A decisão é complexa e tem várias etapas dependentes entre si
- O contexto muda e o sistema precisa se adaptar sem reprogramação manual
- O volume de variações de entrada é alto demais para mapear em regras de negócio
- Em algum ponto do fluxo, o sistema precisa julgar, de forma sensível ao contexto, que a situação foge do esperado e escalar para um humano — não apenas comparar um score contra um limiar fixo (isso ainda é regra)

## Sinais de que a tarefa pede um script determinístico

- O fluxo é fixo e repetitivo
- O custo do erro é alto e não existe tempo de revisão antes da ação acontecer
- A decisão envolve julgamento ético ou humano que não é seguro delegar a um modelo
- Falta dado estruturado de contexto para o modelo raciocinar em cima

**Erro comum:** classificar pela complexidade *aparente* da tarefa, não pela variabilidade real do comportamento. Uma árvore de decisão grande ainda pode ser regra — você vai ver isso formalizado no Módulo 1.3.

## Aplicado ao case Vitalis Pharma / TrialForge

| Tarefa | Classificação | Por quê |
|---|---|---|
| Gerar rascunho de Termo de Consentimento a partir do protocolo aprovado | **Agente** | Exige julgamento de linguagem e enquadramento regulatório; não é uma transformação 1-para-1 |
| Validar se um formulário tem todos os campos obrigatórios antes de submeter ao comitê de ética | **Script determinístico** | É validação de schema, o conjunto de campos obrigatórios é fixo e conhecido |
| Propor a próxima versão de um protocolo de estudo clínico para revisão regulatória | **Agente com Approval Gate (HITL)** | Julgamento complexo + custo de erro alto → decisão autônoma vira sugestão revisável, nunca ação direta |
| Comparar a versão em português de um documento com a versão em inglês enviada à FDA e sinalizar divergência | **Agente** | Requer raciocínio semântico sobre duas línguas, não é apenas diff de texto |

A linha 3 mistura as duas colunas: quando a tarefa tem sinais de agente e o custo do erro é alto, a decisão do modelo não vira ação direta, vira uma sugestão que passa por aprovação humana antes de acontecer. Isso é o Approval Gate (HITL, human-in-the-loop). Esse critério ganha um framework completo no Módulo 1.3 e é aprofundado no Módulo 4.

## Seu caso: classifique suas próprias tarefas

| Tarefa | Classificação | Por quê |
|---|---|---|
| | | |
| | | |
| | | |
| | | |
| | | |

## Como usar na atividade prática

1. Liste de 3 a 5 tarefas do seu próprio contexto de trabalho (ou do domínio que você escolher para a disciplina) na tabela "Seu caso" acima.
2. Para cada uma, marque os sinais da coluna "Agente" e da coluna "Script" que se aplicam.
3. Classifique cada tarefa e escreva uma frase justificando. Essa frase é o que você vai defender numa revisão de arquitetura.
4. Guarde este canvas: no Módulo 1.3 esse critério rápido vira um framework completo de três perguntas, que é o que volta a ser citado no Módulo 4, quando o Approval Gate (HITL) entra em detalhe.

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
