# Seletor de Padrão de Orquestração - Completo (6 padrões)
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 3.3**

Versão completa do seletor do Módulo 3.2, com os seis padrões da disciplina.

---

## Árvore de decisão

```
A tarefa B depende do RESULTADO da tarefa A para começar?
│
├── SIM → SEQUENTIAL
│
└── NÃO → Existe uma decisão central de QUAL especialista chamar?
          │
          ├── SIM → O domínio tem múltiplos NÍVEIS de especialização
          │          (ex: divisões diferentes, cada uma com seus próprios especialistas)?
          │          │
          │          ├── SIM → HIERARCHICAL (supervisor de supervisores)
          │          └── NÃO → SUPERVISOR (um nível só)
          │
          └── NÃO → As tarefas são genuinamente independentes?
                    │
                    ├── SIM → PARALLEL
                    │         (todas rodam ao mesmo tempo, agregador no final)
                    │
                    └── NÃO → Os agentes envolvidos têm autoridade IGUAL para discordar,
                              ou existe sempre um dono claro da decisão final?
                              │
                              ├── Discordância é esperada, decisão emerge do debate → GROUP CHAT
                              │
                              └── A tarefa muda de dono no meio do caminho, sem discussão → HANDOFF
```

---

## Os 6 padrões: resumo e origem

| Padrão | O que resolve | Fonte/origem |
|---|---|---|
| **Sequential** | Dependência real de dado entre etapas | Padrão de pipeline, sem origem única |
| **Parallel** | Tarefas independentes que podem rodar simultaneamente | Padrão de pipeline, sem origem única |
| **Supervisor** | Delegação central, um nível | Padrão comum de arquitetura de agentes |
| **Hierarchical** | Delegação central, múltiplos níveis/domínios | Padrão "supervisor de supervisores", documentado por times de engenharia enterprise (ex: Databricks); Gartner registra alta de 1.445% nas consultas sobre sistemas multi-agente (Q1/2024-Q2/2025) |
| **Group Chat** | Debate entre agentes com autoridade igual | AutoGen (Microsoft Research, Wu et al., arXiv 2308.08155, 2023): `GroupChatManager` |
| **Handoff** | Transferência completa de controle no meio da tarefa | OpenAI Swarm (2024) → Agents SDK (2025): primitivo `handoff` |

---

## Exemplo de referência: TrialForge

| Situação | Padrão | Por quê |
|---|---|---|
| Protocolo → (ICF, CSR) | Sequential | ICF e CSR dependem dos critérios que o Protocolo define (dependência real de dado) |
| ICF ∥ CSR | Parallel | Nenhum dos dois usa o resultado do outro |
| Verificação de consistência dos 3 documentos | Supervisor | Decisão central de comparar os três e resolver divergência, um nível só |
| Orquestrador Raiz → Supervisor de cada domínio → especialistas | Hierarchical | Múltiplos níveis de especialização, cada domínio com seus próprios especialistas |
| Agente ICF e Agente CSR discordam se um evento adverso relatado deve constar no CSR ou só no ICF | Group Chat | Discordância esperada entre agentes com autoridade igual; moderador coleta as duas posições até convergirem |
| Agente ICF detecta risco bioético fora do escopo e transfere para Agente Bioética | Handoff | A tarefa muda de dono no meio do caminho, sem necessidade de debate |

---

## Seu caso: identifique um candidato a Hierarchical, Group Chat ou Handoff

Volte ao processo do seu próprio trabalho que você já mapeou nos Módulos 3.1 e 3.2. Responda:

- Existe algum ponto onde duas ou mais perspectivas diferentes deveriam ser confrontadas antes de uma decisão (não um dono único decidindo, mas um debate real entre partes com autoridade igual)? Isso é candidato a **Group Chat**.
- Existe algum ponto onde uma etapa, no meio do caminho, descobre que o problema pertence a outra área e simplesmente precisa repassar o trabalho (sem debate, só transferência)? Isso é candidato a **Handoff**.
- Seu processo tem múltiplos domínios, cada um com seus próprios especialistas, exigindo um "supervisor de supervisores"? Isso é candidato a **Hierarchical**.

| Situação do seu processo | Padrão | Por quê |
|---|---|---|
| | | |
| | | |

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
