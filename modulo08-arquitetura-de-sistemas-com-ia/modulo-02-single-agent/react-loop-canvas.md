# Canvas de Rastreamento do Loop ReAct
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 2.2**

Use este template para rastrear, iteração por iteração, o comportamento de um agente com loop ReAct. É a primeira ferramenta de depuração antes de mexer no prompt: a maioria dos comportamentos inesperados aparece na trilha de iterações, não no texto do system prompt.

---

## Seu caso: template de rastreamento em branco

| Volta | Pensamento | Ação | Observação | Continua? | Resposta Final |
|---|---|---|---|---|---|
| 1 | | | | Sim / Não | |
| 2 | | | | Sim / Não | |
| 3 | | | | Sim / Não | |
| 4 | | | | Sim / Não (limite atingido → Approval Gate) | |

**Como preencher:**
- **Pensamento:** o que o agente concluiu que ainda falta saber, em uma frase.
- **Ação:** qual ferramenta foi chamada (busca, RAG, API, cálculo) e com quais parâmetros.
- **Observação:** o que voltou da ação; inclua se o resultado veio vazio, com erro, ou ambíguo.
- **Continua?:** se o agente decidiu que precisa de mais uma volta ou se já tem informação suficiente para a Resposta Final. Se for "Não", anote também o motivo: parou porque decidiu que tinha informação suficiente, ou parou porque o limite de voltas foi atingido? As duas contam como "Não", mas são sinais bem diferentes — a primeira é convergência de verdade, a segunda é o sistema forçando a parada.
- **Resposta Final:** preencha só na volta em que Continua? for "Não": o conteúdo de fato gerado pelo agente, não só a decisão de parar. É o registro que fecha o loop e o que vai para o Approval Gate revisar.

---

## Exemplo preenchido: TrialForge, placeholder de seção condicional (assentimento de menores)

| Volta | Pensamento | Ação | Observação | Continua? | Resposta Final |
|---|---|---|---|---|---|
| 1 | "Este protocolo envolve menores de idade? Preciso checar antes de decidir se a seção de assentimento entra." | Consulta RAG no protocolo do estudo + base de cláusulas regulatórias | Protocolo confirma: público-alvo inclui participantes de 12 a 17 anos | Sim, preciso buscar o texto-padrão da shelf | |
| 2 | "A seção de assentimento é obrigatória. Preciso do texto-padrão dessa shelf específica." | Busca na shelf "Assentimento de Menores" da biblioteca de prompts | Texto-padrão encontrado, com 3 variações por faixa etária | Não, informação suficiente para gerar a seção | Rascunho da seção condicional de assentimento, para participantes de 12 a 17 anos, redigido a partir do texto-padrão da shelf encontrada. Segue para o Approval Gate: nenhuma seção vira versão oficial sem revisão de um especialista regulatório. |

---

## Sinais de alerta na trilha (quando parar e investigar)

- **Observação repetida sem mudança:** a Ação da volta 2 é igual à da volta 1 e devolve o mesmo resultado: sinal de ciclo sem convergência, não de progresso real.
- **Ação sem Pensamento correspondente:** o agente chamou uma ferramenta sem que o Pensamento explicasse por quê: geralmente indica prompt mal calibrado, não falha do modelo.
- **Limite de voltas atingido:** trate como informação, não como erro a esconder. Acione o Approval Gate e registre qual foi a última Observação: é o ponto exato onde a automação parou de bastar.
- **Parâmetro de Ação plausível, mas errado:** o Pensamento parece justificar a Ação, e a Ação parece razoável, mas o parâmetro usado não corresponde exatamente ao que a tarefa pedia. Esse é o sinal mais perigoso da lista, porque não aparece como erro óbvio na trilha — só como uma Resposta Final sutilmente errada. É exatamente o tipo de falha que schema tipado (Módulo 2.4) reduz, mas não elimina sozinho.

---

## Por que registrar isso importa para auditoria

Cada linha desta tabela é o que a banda de Observabilidade do diagrama de referência (Módulo 1.2) deveria estar gravando automaticamente em produção. Se meses depois alguém perguntar por que um documento saiu com determinada seção, a resposta não deveria depender da memória de ninguém; deveria estar nesta trilha.

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
