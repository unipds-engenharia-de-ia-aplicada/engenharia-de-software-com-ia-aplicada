# Canvas de Calibragem do Protótipo
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 2.5**

Para cada componente, justifique o nível de intensidade escolhido: não copie o nível máximo por padrão.

**Seu caso:** preencha os quatro componentes abaixo (seções 1-4) para o seu próprio contexto de trabalho - o exemplo de referência do TrialForge vem só depois, ao final.

---

## 1. Memória

- [ ] Nenhuma (cada chamada é isolada)
- [ ] Curto prazo (contexto da própria requisição)
- [ ] Longo prazo (histórico entre sessões)

**Justificativa:** por que esse nível é suficiente para a tarefa?

---

## 2. Loop (ReAct)

- [ ] Não precisa de loop: uma chamada resolve
- [ ] Loop com máximo de ___ iterações

**Critério de parada:** o que acontece quando o limite é atingido sem convergência?

---

## 3. Reflexão

- [ ] Não precisa
- [ ] Superfície (formato, completude, consistência interna)
- [ ] Superfície + Conteúdo (comparação com fonte externa)

**Justificativa:** o risco da tarefa exige verificação contra fonte externa, ou a checagem interna já basta?

---

## 4. Ferramentas

Liste cada ferramenta que o agente pode chamar:

| Nome | Schema tipado? (sim/não) | Leitura ou escrita? | Passa pelo Approval Gate antes de executar? |
|---|---|---|---|
| | | | |

---

## Exemplo de referência: TrialForge (seção condicional do ICF)

| Componente | Nível escolhido | Justificativa |
|---|---|---|
| Memória | Mínima, sem estado entre protocolos | Cada estudo é isolado; lembrar do anterior gera risco de contaminação de cláusula desatualizada |
| Loop | Máximo 4 voltas | Decisão condicional + busca de cláusula raramente exige mais de 2-3 voltas reais |
| Reflexão | Não incluída neste protótipo | Decisão condicional + busca de cláusula resolve em 2-3 voltas diretas; erro residual é pego no Approval Gate antes de qualquer aprovação |
| Ferramentas | 1: busca de cláusula regulatória, schema tipado, leitura, sem Gate (não escreve nada) | Ferramenta de leitura não altera estado; só a saída final do documento passa pelo Gate |

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
