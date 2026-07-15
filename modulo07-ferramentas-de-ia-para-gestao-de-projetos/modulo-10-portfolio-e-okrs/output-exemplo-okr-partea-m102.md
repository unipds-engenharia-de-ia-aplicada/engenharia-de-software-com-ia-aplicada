# Output OKR Aligner - Parte A: Validação de OKRs - U10.2 Backup
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 10.2**

Output de referência gerado em pré-gravação. Use como backup caso o modelo produza resultado inesperado na demo ao vivo.

Gerado em: 2026-07-08 (AI Studio — Gemini 3.1 Pro Preview)
Input: 2 OKRs — Conecta Cargas, Q2–Q3 2026
Modelo: Gemini 3.1 Pro Preview | Temperatura: 0.3

---

Como especialista em planejamento estratégico e OKRs, analisei a estrutura proposta para a Diretoria de Operações da Conecta Cargas. Abaixo está a avaliação detalhada de cada Objetivo e Key Result, apontando as fortalezas e os gaps estruturais que precisam ser corrigidos antes do comprometimento público.

---

### Avaliação do Objetivo 1
**Objetivo 1:** Tornar a frota mais segura e reduzir custos com sinistros
*   **Qualidade do Objetivo:** **Bom, mas pode melhorar.** Ele é claramente orientado a resultado (outcome) e não é uma tarefa disfarçada. No entanto, falta um pouco de apelo inspiracional. A junção de "segurança" com "redução de custos" na mesma frase divide o foco entre o fator humano (segurança) e o financeiro (sinistros).
*   *Sugestão de melhoria (opcional):* "Garantir a máxima segurança nas estradas para nossos motoristas, zerando desperdícios com sinistros."

#### Avaliação do KR 1.1
**KR 1.1:** Reduzir o índice de acidentes por excesso de velocidade em 20% até setembro de 2026

| Critério | Status |
| :--- | :---: |
| Mensurável | ✅ |
| Baseline declarada | ❌ |
| Prazo definido | ✅ |
| Responsável implícito | ✅ |
| Independente de output | ✅ |
| Verificável por terceiro | ❌ |

**Problemas identificados e Reformulação:**
*   **Baseline declarada (❌):** O KR fala em reduzir "em 20%", mas não diz a partir de qual número. Sem o ponto de partida (baseline), o time não tem clareza do tamanho do desafio.
*   **Verificável por terceiro (❌):** Um auditor externo não consegue validar o atingimento sem saber qual era o número absoluto inicial e qual a fórmula exata do "índice" (ex: acidentes por 100 mil km rodados? Total absoluto de acidentes?).
*   **Sugestão de Reformulação:** *"Reduzir a taxa de acidentes por excesso de velocidade de [X acidentes/100 mil km] para [Y acidentes/100 mil km] até 30 de setembro de 2026."*

---

### Avaliação do Objetivo 2
**Objetivo 2:** Reduzir custo operacional com manutenção
*   **Qualidade do Objetivo:** **Mediano.** É orientado a resultado de negócio (outcome), o que é excelente. Porém, é puramente utilitário e pouco inspiracional para o time. Parece mais o nome de um indicador do que um Objetivo que engaja a equipe.
*   *Sugestão de melhoria (opcional):* "Alcançar a excelência operacional com uma frota sempre disponível e de baixo custo de manutenção."

#### Avaliação do KR 2.1
**KR 2.1:** Reduzir o custo médio de manutenção corretiva por veículo em 15% até setembro de 2026

| Critério | Status |
| :--- | :---: |
| Mensurável | ✅ |
| Baseline declarada | ❌ |
| Prazo definido | ✅ |
| Responsável implícito | ✅ |
| Independente de output | ✅ |
| Verificável por terceiro | ❌ |

**Problemas identificados e Reformulação:**
*   **Baseline declarada (❌):** Novamente, temos um percentual relativo (15%) sem o valor financeiro atual. É preciso ancorar o KR na realidade financeira da empresa.
*   **Verificável por terceiro (❌):** Sem o valor em Reais (R$) de partida e de chegada, a auditoria do resultado fica impossibilitada apenas lendo o OKR.
*   **Sugestão de Reformulação:** *"Reduzir o custo médio mensal de manutenção corretiva por veículo de [R$ X] para [R$ Y] até 30 de setembro de 2026."*

---

### ⚠️ Análise de Dependências e Sobreposições

1.  **Dependência Crítica de Projetos (Output vs. Outcome):**
    Ambos os KRs dependem fortemente do projeto ativo citado no contexto: o **Sistema de Gestão de Frota RouteWise (MVP)**.
    *   Para medir e reduzir excesso de velocidade (KR 1.1), a operação precisará da telemetria do RouteWise.
    *   Para reduzir manutenção corretiva (KR 2.1), a operação precisará dos alertas de manutenção preventiva do RouteWise.
    *   *Atenção:* O lançamento do MVP do RouteWise é um *Output* (projeto/tarefa) que viabilizará esses *Outcomes* (KRs). Garanta que o time de tecnologia responsável pelo RouteWise tenha KRs de adoção ou de sucesso do MVP alinhados com este ciclo da Diretoria de Operações.

2.  **Correlação entre KRs:**
    Embora os KRs 1.1 e 2.1 não meçam exatamente a mesma coisa, eles possuem uma forte correlação. Acidentes por excesso de velocidade (KR 1.1) geram manutenções corretivas severas (KR 2.1). Ao atingir o KR 1.1, o KR 2.1 será impactado positivamente de forma indireta. Isso é saudável, mas o líder (Carlos) deve ter clareza de que parte da redução de custos do KR 2.1 virá "de graça" se a segurança melhorar.

---

## Curadoria — Pontos de Discussão na Demo

**Ponto 1 — Correlação entre KRs:**
O modelo identificou espontaneamente que KR 1.1 (acidentes) e KR 2.1 (custo de manutenção) se impactam mutuamente. Esse é o insight mais rico do output: sinistros geram manutenção corretiva, então melhorar segurança move os dois KRs simultaneamente. O modelo foi além do que foi pedido — sinal de contexto bem injetado.

**Ponto 2 — Sugestão de melhoria nos Objetivos:**
O modelo sugeriu reformulações nos dois Objetivos mesmo sem ❌ nesse critério. Isso é uma saída além das restrições — na demo, use como exemplo de por que curadoria humana existe: o modelo tem opiniões, mas a decisão de mudar o tom de um OKR é do gestor, não do parser.

**Ponto 3 — Baseline ausente em ambos os KRs:**
Ambos os KRs falharam exatamente nos mesmos dois critérios (Baseline e Verificável por terceiro). Padrão previsível para OKRs escritos "de cabeça" sem consultar dados históricos. O OKR Aligner torna esse gap visível antes do comprometimento público — esse é o valor do exercício de validação.

---

*Artefato de referência para gravação — Parte A: validação de OKRs.*

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
