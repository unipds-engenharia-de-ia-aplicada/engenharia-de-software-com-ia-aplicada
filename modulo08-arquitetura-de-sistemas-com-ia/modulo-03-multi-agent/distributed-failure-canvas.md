# Canvas de Falha Distribuída e Compensação
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 3.4**

Para cada etapa do seu fluxo multi-agente, mapeie o comportamento diante de falha e a ação compensatória, caso a etapa precise ser desfeita depois.

---

## Parte 1: Falha de nó (Teorema CAP)

Para cada agente do seu fluxo:

| Agente | Timeout (segundos) | Retries máximos | Se esgotar: Consistência (espera) ou Disponibilidade (segue sem)? |
|---|---|---|---|
| | | | |

**Checklist de idempotência:** se este agente receber a mesma solicitação duas vezes (por causa de um retry), isso gera efeito duplicado?
- [ ] Não: a operação é naturalmente idempotente (ex: leitura, cálculo puro)
- [ ] Sim: precisa de um identificador único de solicitação para detectar e ignorar duplicatas

### Exemplo de referência: TrialForge

| Agente | Timeout (segundos) | Retries máximos | Se esgotar: Consistência (espera) ou Disponibilidade (segue sem)? |
|---|---|---|---|
| Protocolo | 30 | 3 | Consistência: é o primeiro da cadeia (Sequential), ICF e CSR dependem do resultado dele |
| ICF | 45 | 2 | Disponibilidade: roda em Parallel, não bloqueia o CSR; o Supervisor sinaliza a seção pendente e segue |
| CSR | 60 | 2 | Disponibilidade: segue em frente sinalizando que a síntese ficou incompleta, em vez de travar o sistema inteiro |

---

## Parte 2: Controle de estado (Padrão Saga)

Para cada etapa da sequência, declare a ação compensatória:

| Etapa | O que ela produz | Ação compensatória se precisar desfazer |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |

**Pergunta-chave:** se a Etapa 3 falhar depois que as Etapas 1 e 2 já terminaram com sucesso, você tem uma ação específica para desfazer o efeito de cada uma, ou a única opção hoje é recomeçar tudo do zero?

**Não esqueça de declarar quem aciona a compensação:** ela não dispara sozinha — alguém precisa detectar a falha da Etapa 3 e disparar a ação compensatória nas etapas anteriores, na ordem inversa. Normalmente esse alguém é o próprio Supervisor do seu fluxo (Módulo 3.2); declarar a compensação sem declarar quem a aciona é meio caminho andado.

---

## Exemplo de referência: TrialForge

| Etapa | O que produz | Compensação |
|---|---|---|
| 1. Agente Protocolo | Protocolo v1, critérios de inclusão | Versionar (não apagar) → Protocolo v2 com o critério corrigido |
| 2. Agente ICF | Termo de Consentimento baseado no Protocolo v1 | Handoff para regenerar apenas a seção afetada pela mudança de critério |
| 3. Agente CSR | Síntese de resultados, aqui que o problema é descoberto | N/A (é quem detecta, não quem precisa ser desfeito) |

---

## Origem dos conceitos

- **Teorema CAP**: Brewer (2000); formalizado por Gilbert & Lynch (2002); retrospectiva do próprio Brewer em 2012 esclarecendo que a escolha é situacional, não permanente.
- **Padrão Saga**: Garcia-Molina & Salem, "Sagas", ACM SIGMOD 1987. Aplicação recente a sistemas multi-agente de LLM: SagaLLM (2025).

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
