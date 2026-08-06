# Canvas de Fronteira Multi-Agente
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 3.1**

Use este canvas para decidir se uma tarefa deve ser resolvida por um agente único ou dividida entre múltiplos agentes especialistas.

**Pré-requisito:** se você ainda não decidiu se essa tarefa precisa de um agente (em vez de regra determinística, Approval Gate ou agente autônomo), use primeiro o framework de três perguntas do Módulo 1.3. Este canvas assume que a resposta já foi "agente" e ajuda a decidir se deve ser um ou vários.

---

## Pergunta central

Um agente único generalista, cobrindo todas as sub-tarefas, seria pior do que agentes especialistas? Avalie três dimensões:

| Dimensão | O agente único cobre bem? | Se NÃO em 2 ou mais dimensões → considere dividir |
|---|---|---|
| **Vocabulário/domínio** | As sub-tarefas usam o mesmo vocabulário técnico e o mesmo público-alvo? | |
| **Ferramentas** | As sub-tarefas precisam do mesmo conjunto de ferramentas? | |
| **Risco regulatório/nível de reflexão** | Todas as sub-tarefas têm o mesmo nível de risco, exigindo o mesmo nível de reflexão? | |

**Ressalva:** a regra de "2 ou mais dimensões" acima é um guia, não uma fórmula rígida. Divergência de risco regulatório sozinha, mesmo com vocabulário e ferramentas parecidos, já pode justificar dividir — o custo de errar o nível de reflexão certo costuma ser mais alto que o custo extra de coordenação.

---

## Custo de dividir (não é gratuito)

Antes de dividir, tenha clareza do trade-off:

- **Agente único:** mais barato de coordenar (não há coordenação), mais caro de auditar (raciocínio misturado, difícil isolar onde um erro nasceu).
- **Múltiplos agentes:** mais caro de coordenar (precisa de protocolo de comunicação, gestão de estado compartilhado), mais barato de auditar (erro isolado por agente).

---

## Exemplo de referência: TrialForge

| Dimensão | ICF | Protocolo | CSR |
|---|---|---|---|
| Vocabulário | Linguagem acessível, leigo | Técnico, metodológico | Estatístico, regulatório |
| Ferramentas | Busca de cláusula de consentimento | Busca de critério de inclusão/exclusão | Síntese de resultados, formatação ICH E3 |
| Nível de reflexão | Superfície + conteúdo (seções condicionais) | Superfície | Superfície + conteúdo (dados regulatórios) |

**Conclusão:** as três dimensões divergem nos três documentos → justifica agentes especialistas, coordenados para compartilhar os mesmos critérios de origem do protocolo.

---

## Seu caso: pense num processo do seu próprio trabalho

Pense num processo do seu trabalho que hoje passa por mais de uma pessoa antes de ficar pronto (revisão em cadeia, aprovação em etapas, handoff entre times). Aplique as três dimensões da Pergunta central a esse processo:

| Dimensão | Esse processo cobre bem com uma pessoa/agente só? | Por quê |
|---|---|---|
| Vocabulário/domínio | | |
| Ferramentas | | |
| Risco regulatório/nível de reflexão | | |

Guarde esta resposta: você vai usá-la na Missão Prática #03, no Módulo 3.5.

---

## Agente vs. Ferramenta: checklist rápido

- [ ] Ele executa sempre a mesma lógica para o mesmo input? → **Ferramenta**
- [ ] Ele pode interpretar a solicitação de forma diferente, pedir mais contexto, ou recusar a tarefa? → **Agente**
- [ ] A comunicação com ele precisa de protocolo de estado compartilhado (não só requisição/resposta única)? → **Agente** (considere A2A, não MCP)

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
