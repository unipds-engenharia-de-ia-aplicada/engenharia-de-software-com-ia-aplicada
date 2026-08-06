# Canvas de Formalização do Approval Gate
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 4.4**

Use este canvas pra decidir, em ordem, os três componentes que formalizam o Approval Gate do diagrama do Módulo 1.2. A ordem importa: o limiar de confiança decide SE o portão aciona; o portão decide QUEM aprova; a trilha registra o que os dois primeiros fizeram.

## Passo 1 - Confidence Threshold: essa tarefa segue sozinha?

1. **Qual é o sinal de confiança disponível pra essa tarefa?** (score do modelo, similaridade de retrieval, ou uma regra determinística de complexidade)
   Sem sinal nenhum → não dá pra calibrar limiar ainda; comece registrando o comportamento antes de automatizar a decisão.

2. **Onde fica o corte, nas três faixas do estilo Stripe Radar?**
   Confiança alta → segue sozinho, sem intervenção.
   Confiança média → escala pro Approval Gate (Passo 2).
   Confiança muito baixa, ou tarefa sabidamente caro+irreversível (Módulo 1.3) → Approval Gate obrigatório, independente do score.

3. **Quando foi a última recalibração deste limiar?**
   Modelo mudou de versão, ou o perfil de pergunta mudou → recalibre antes de confiar no limiar antigo.

Formalização acadêmica: Madras, Pitassi e Zemel, "Predict Responsibly: Improving Fairness and Accuracy by Learning to Defer", NeurIPS 2018 - modela explicitamente a opção de "passar" a decisão pra um humano, reconhecendo que esse humano também pode errar ou ter viés.

## Passo 2 - Approval Gate: síncrono ou assíncrono?

1. **O erro desta tarefa é caro E irreversível?** (framework do Módulo 1.3)
   Sim → gate **síncrono**: o fluxo pausa e espera aprovação explícita antes de prosseguir (o padrão do `interrupt()` do LangGraph, ou o mecanismo equivalente CONFIRM/DENY do AWS Bedrock Agents).
   Não, mas é caro → gate **assíncrono**: a ação prossegue, mas marcada pra revisão, com possibilidade de reversão.

2. **Quem tem autoridade pra aprovar essa categoria específica de decisão?**
   Defina isso por tipo de tarefa, não por sistema inteiro. Nem toda aprovação precisa do mesmo especialista.

## Passo 3 - Audit Trail: o que exatamente fica registrado?

Pra cada decisão (seguiu sozinha, foi aprovada, ou foi rejeitada), confirme que a trilha capturou:

- [ ] Quem, ou qual componente, tomou a decisão
- [ ] Data e hora exatas
- [ ] Versão do prompt usado
- [ ] Versão do modelo usado
- [ ] Limiar de confiança aplicado e o score obtido
- [ ] Resultado final: aprovado, rejeitado, ou escalado

Se qualquer um desses campos está ausente, a trilha existe no papel mas não responde as perguntas que uma auditoria de verdade faz.

## Aplicado ao TrialForge

| Componente | Aplicação | Padrão de referência |
|---|---|---|
| Confidence Threshold | Agente ICF: extração de alta confiança segue, abaixo do limiar escala | Stripe Radar (3 faixas); Madras, Pitassi & Zemel, NeurIPS 2018 |
| Approval Gate (síncrono) | Síntese final do CSR: nunca prossegue sem aprovação do especialista regulatório | `interrupt()` (LangGraph); CONFIRM/DENY (AWS Bedrock Agents) |
| Audit Trail | Atravessa os três agentes: toda aprovação, limiar e versão registrados, nunca sobrescritos | 21 CFR Part 11 / EU AI Act Art. 12 |

## Como usar na atividade prática

1. Pegue uma tarefa do seu próprio sistema (ou hipotética) que hoje segue sem nenhuma revisão.
2. Rode os três passos em ordem. Não pule direto pro Approval Gate sem antes definir o limiar de confiança.
3. Preencha o checklist de trilha do Passo 3 pra essa tarefa específica.

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
