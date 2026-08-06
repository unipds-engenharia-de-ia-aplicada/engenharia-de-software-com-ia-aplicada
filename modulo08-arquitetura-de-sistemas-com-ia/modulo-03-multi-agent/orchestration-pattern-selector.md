# Seletor de Padrão de Orquestração - Parte 1
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 3.2**

Árvore de decisão para os três primeiros padrões do módulo. Cobre a maioria dos casos simples de coordenação. Para debate entre agentes ou passagem de controle no meio da tarefa, ver o seletor completo do Módulo 3.3.

---

## Árvore de decisão

```
A tarefa B depende do RESULTADO da tarefa A para começar?
│
├── SIM → SEQUENTIAL
│         (A → B → C, cada um espera o anterior)
│
└── NÃO → Existe uma decisão central de QUAL especialista chamar
          para essa solicitação específica?
          │
          ├── SIM → SUPERVISOR
          │         (agente central delega, agrega, resolve conflito)
          │
          └── NÃO → As tarefas são genuinamente independentes?
                    │
                    ├── SIM → PARALLEL
                    │         (todas rodam ao mesmo tempo, agregador no final)
                    │
                    └── NÃO → Nenhum dos três padrões simples serve — provavelmente
                              é debate entre agentes ou passagem de controle no meio
                              da tarefa. Veja Hierarchical, Group Chat e Handoff no
                              seletor completo do Módulo 3.3.
```

---

## Checklist antes de escolher Sequential por padrão

Sequential é o padrão mais fácil de raciocinar, e por isso é escolhido por hábito mesmo quando não há dependência real. Antes de forçar uma ordem:

- [ ] O Agente B usa algum dado que só existe depois que o Agente A termina?
- [ ] Se a resposta for "não, ele só roda depois porque faz sentido cronológico", considere Parallel.

---

## Exemplo de referência: TrialForge

| Transição | Padrão | Por quê |
|---|---|---|
| Protocolo → (ICF, CSR) | Sequential | ICF e CSR usam os critérios que o Protocolo define (dependência real de dado) |
| ICF ∥ CSR | Parallel | Nenhum dos dois usa o resultado do outro |
| (Protocolo, ICF, CSR) → Verificação | Supervisor | Decisão central de comparar os três e resolver divergência |

---

## Seu caso: aplique a árvore ao seu processo

Pense de novo no processo do seu trabalho que você já analisou no Módulo 3.1. Para cada transição entre etapas desse processo, rode a árvore de decisão acima e classifique o padrão, usando as mesmas colunas do exemplo TrialForge:

| Transição | Padrão | Por quê |
|---|---|---|
| | | |
| | | |
| | | |

Onde estaria uma dependência Sequential genuína, e onde estaria uma falsa dependência que na verdade poderia rodar em Parallel?

---

## Nota sobre Supervisor com raciocínio próprio

Um Supervisor pode ser um roteador fixo (regra determinística: "se pedido X, chama especialista Y") ou um agente com raciocínio próprio, capaz de lidar com solicitações ambíguas que não se encaixam claramente em um especialista só. A segunda opção custa mais latência, mas ganha flexibilidade nas fronteiras nebulosas entre domínios.

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
