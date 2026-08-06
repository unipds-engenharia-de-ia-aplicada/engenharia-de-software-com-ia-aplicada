# Checklist: Framework de Decisão de Três Perguntas
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 1.3**

Use este framework para decidir, tarefa por tarefa, se o componente certo é um agente de IA ou uma regra determinística. Substitui o critério rápido do Módulo 1.1 por um processo auditável: qualquer pessoa do time, respondendo as mesmas três perguntas, chega na mesma conclusão.

## As três perguntas

**Pergunta 1: Existe uma regra finita que cobre mais de 90% dos casos REAIS (já observados, não hipotéticos)?**
- **SIM** → Regra determinística. Fim da decisão.
- **NÃO** → Vá para a Pergunta 2.
- _Ex.: validar se um formulário de submissão tem todos os campos obrigatórios preenchidos, a lista é finita, documentada pela ANVISA, e não muda de um estudo pro outro dentro da mesma categoria regulatória._

**Pergunta 2: O erro é caro E a ação é irreversível (não dá pra desfazer depois)?**
- **SIM** → Agente pode propor, mas nunca age sozinho. Approval Gate obrigatório (aprovação síncrona, antes da ação).
- **NÃO** → Vá para a Pergunta 3.
- _Ex.: gerar a versão final de um Termo de Consentimento, o texto não segue um template fixo, mas o custo de errar, um participante assinando um termo com informação incorreta, é alto e não tem como desfazer depois._

**Pergunta 3: O comportamento da tarefa muda de acordo com o contexto de entrada?**
- **SIM** → Agente autônomo, com observabilidade completa.
- **NÃO** → Regra determinística: mesmo que pareça complexa, se é enumerável, é regra.
- _Ex.: uma árvore de decisão com quarenta ramos ainda é uma regra, ela só parece assustadora de escrever, não de executar._

## Os três casos-limite (revisar antes de aplicar numa tarefa nova)

1. **A tarefa híbrida**: separe a parte de extração/interpretação (geralmente agente) da parte de decisão de negócio (geralmente regra). Aplique o framework em cada subtarefa, não na tarefa inteira.
2. **Reversibilidade muda o tipo de gate**: erro caro e reversível pede revisão assíncrona; erro caro e irreversível pede aprovação síncrona antes da ação.
3. **A classificação não é permanente**: revisite periodicamente usando os logs de observabilidade (uma tarefa de agente pode virar regra quando um padrão estável aparece; uma regra pode virar agente quando as exceções crescem demais).

## Template: decompondo uma tarefa híbrida

Use esta tabela para decompor qualquer tarefa que "parece uma coisa só" em subtarefas, antes de aplicar as três perguntas.

| Subtarefa | Tipo (Extração/Interpretação ou Decisão de Negócio) | P1 | P2 | P3 | Componente |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |
| | | | | | |

## Referência: TrialForge - Emenda de Protocolo

| Subtarefa | Tipo | P1 | P2 | P3 | Componente |
|---|---|---|---|---|---|
| Extrair o que mudou entre versões do protocolo | Extração/Interpretação | Não | Não | Sim | Agente (Modelo + RAG) |
| Classificar o tipo de emenda (administrativa/substancial) | Decisão de Negócio | Sim | N/A | N/A | Regra (Orquestrador) |
| Rotear pela criticidade | Decisão de Negócio + risco | (não mapeia numa única resposta) | (não mapeia numa única resposta) | (não mapeia numa única resposta) | Regra + Gate condicional (Orquestrador) |
| Regenerar documentos afetados | Extração/Interpretação | (não mapeia numa única resposta) | (não mapeia numa única resposta) | (não mapeia numa única resposta) | Agente, atrás do Gate quando aplicável |

As duas primeiras linhas mapeiam limpo pra uma resposta única de P1/P2/P3 (o mesmo resultado que `decision-framework-tool.js`/`.py` confirmam via teste automatizado). As duas últimas misturam regra e gate condicional de um jeito mais sutil que a árvore pura de três perguntas não representa numa única tripla, é uma limitação real do framework, não um erro de preenchimento.

## Como usar na atividade prática

1. Escolha uma tarefa do seu próprio contexto que hoje parece "óbvia demais pra ser regra" ou "complexa demais pra não ser agente".
2. Decomponha em subtarefas usando o template acima.
3. Aplique as três perguntas em cada subtarefa separadamente.
4. Confira contra os três casos-limite antes de fechar a decisão.

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D. (GDE AI, Microsoft MVP, Senior Manager)*
