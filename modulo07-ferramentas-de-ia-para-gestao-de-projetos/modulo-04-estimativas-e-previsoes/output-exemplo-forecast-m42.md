# Output Probability Forecast - Demo M4.2
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 4.2**
Gerado via Google AI Studio (Gemini 3.1 Pro Preview, temperatura 0.2) + Monte Carlo Python (10.000 simulações)
Input: backlog RouteWise 4 USs do MVP com estimativas O/M/P em semanas + constraint de hardware semana 9

---

### 1. Raciocínio dos Cálculos

Como especialista em gerenciamento quantitativo de projetos, estruturei a análise do backlog do MVP RouteWise utilizando a modelagem PERT (Program Evaluation and Review Technique).

Para garantir que não estamos apenas olhando para números absolutos, apliquei as seguintes fórmulas estatísticas para cada história:

- **Estimativa PERT (Esperança Matemática):** Calculada pela média ponderada `(O + 4M + P) / 6`. Isso puxa a estimativa para mais perto do cenário mais provável, mas considera a cauda de risco do cenário pessimista.
- **Variância:** Calculada por `((P - O) / 6)²`. Mede a dispersão da estimativa; quanto maior a diferença entre o otimista e o pessimista, maior a variância.
- **Desvio Padrão:** A raiz quadrada da variância `(P - O) / 6`. Representa a margem de erro média da estimativa em semanas.
- **Verificação de Incerteza e Viés:** Avaliei se o Desvio Padrão ultrapassa 30% do PERT (critério para "Alta Incerteza") e testei a regra do viés de otimismo (Pessimista < 1.5x o Mais Provável).

Exemplo prático (US-01): PERT = (2 + 4(3) + 5) / 6 = 3.17 semanas. Variância = ((5 - 2) / 6)² = 0.25. Desvio Padrão = 0.50. O desvio padrão (0.50) representa 15.7% do PERT (3.17), logo abaixo do limite de 30% (Status: Normal).

---

### 2. Tabela PERT

| História | O | M | P | PERT (sem) | Variância | Desvio Padrão | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|
| US-01 Alertas de Velocidade | 2 | 3 | 5 | 3,17 | 0,25 | 0,50 | Normal |
| US-03 Score de Comportamento | 3 | 4 | 6 | 4,17 | 0,25 | 0,50 | Normal (Alerta de Viés) |
| US-04 Sensor de Abertura de Baú | 1 | 2 | 3 | 2,00 | 0,11 | 0,33 | Normal (Alerta de Viés) |
| US-09 Sensor de Baú — Controle de Temperatura da Carga | 2 | 3 | 5 | 3,17 | 0,25 | 0,50 | Normal |
| **TOTAL** | | | | **12,51** | **0,86** | **0,93** | |

**Nota sobre Viés de Otimismo:** Nenhuma história ultrapassou o limite de 30% de incerteza relativa. No entanto, na US-03 e US-04, o cenário Pessimista é exatamente 1.5x o Mais Provável. Como a US-03 envolve hardware novo, cravar o pessimista no limite exato sugere subestimação do pior cenário. O P da US-03 deveria ser questionado e possivelmente revisado para 7 ou 8.

---

### 3. Totais do Projeto

- **Soma das estimativas PERT (Esforço Sequencial):** 12,51 semanas de esforço total de desenvolvimento.
- **Elapsed Time com Paralelismo:** 12,51 / 1,7 = **7,36 semanas** de tempo líquido de engenharia.
- **Desvio Padrão Agregado:** √(0,25 + 0,25 + 0,11 + 0,25) = √0,86 = **0,93 semanas**.

**Impacto do Lead Time (Restrição Física):**

Embora o tempo de engenharia seja de ~7,4 semanas, as US-04 e US-09 estão bloqueadas até a semana 9.

- Fase 1 (Semanas 1 a 4,3): Execução da US-01 e US-03 (7,34 sem / 1,7).
- Fase 2 (Semanas 9 a 12): Chegada do hardware e execução da US-04 e US-09 (5,17 sem / 1,7 = 3,04 semanas).
- **Prazo Real Calculado:** Semana 9 + 3,04 semanas = **12,04 semanas**.

**Monte Carlo — 10.000 simulações (script Python, distribuição triangular, duas trilhas com constraint de hardware):**

- P50 (cenário provável): **12,5 semanas**
- P85 (compromisso com cliente): **13,1 semanas**
- P95 (conservador): **13,4 semanas**
- Média: **12,6 semanas**

---

### 4. Top 3 Histórias com Maior Incerteza

**1. US-03 Score de Comportamento (Desvio Padrão: 0,50)**

Além de ter a maior estimativa absoluta (4,17 sem), possui forte indício de viés de otimismo no cenário pessimista frente ao risco de lidar com hardware novo (acelerômetro) e depende parcialmente da US-01.

Ação Recomendada: Executar um spike (prova de conceito técnica) na Sprint 0 utilizando a documentação do acelerômetro ou um dev-kit genérico para validar a extração de dados antes do desenvolvimento oficial.

**2. US-01 Alertas de Velocidade (Desvio Padrão: 0,50)**

O risco de integração de GPS em áreas rurais (perda de sinal/latência) pode gerar retrabalho complexo no pipeline de dados, impactando também a US-03.

Ação Recomendada: Criar testes de simulação de perda de pacotes e dead-zones de GPS em ambiente local/mockado para garantir que a arquitetura suporta a intermitência antes de ir a campo.

**3. US-09 Sensor de Baú — Controle de Temperatura da Carga (Desvio Padrão: 0,50)**

Alta dependência externa (lead time de 60 dias). Qualquer atraso na entrega do hardware empurra o caminho crítico do projeto diretamente para frente.

Ação Recomendada: Solicitar ao fornecedor do hardware IoT o envio imediato de emuladores de software ou a especificação exata da API/Payload. O time deve construir a interface usando Mocks durante as semanas ociosas (semanas 5 a 8) para que, na semana 9, reste apenas a integração física.

---

### 5. Comunicação por Audiência

**Para o Time Técnico:**

"Temos um esforço líquido de engenharia de cerca de 7,4 semanas, mas nosso caminho crítico está quebrado pelo lead time do hardware. As histórias US-01, US-03 e US-09 apresentam a maior variância (0,25). Estou particularmente preocupado com a US-03: estimar o cenário pessimista em apenas 6 semanas para um hardware novo cheira a viés de otimismo. Para mitigar isso, precisamos fazer um spike do acelerômetro o quanto antes. Além disso, como ficaremos ociosos entre as semanas 5 e 9 esperando os sensores da US-04 e US-09, usaremos esse tempo para mockar os payloads e simular a intermitência de GPS da US-01, reduzindo a incerteza da integração final."

**Para o Gestor de Produto:**

"O esforço de desenvolvimento do MVP é de aproximadamente 7 semanas e meia, mas devido ao lead time de 60 dias dos sensores IoT, o projeto não terminará antes da semana 12. Matematicamente, nosso prazo base é de 12 semanas. Considerando nosso desvio padrão agregado de ~1 semana, recomendo comunicar um prazo de 13 semanas (adicionando 1 desvio padrão), o que nos dá cerca de 84% de nível de confiança estatística. Nossos principais drivers de risco são a cadeia de suprimentos (atraso no hardware) e a dependência em cascata entre a US-01 e a US-03."

**Para o Executivo:**

"O lançamento do MVP RouteWise está projetado para ocorrer em aproximadamente 3 meses (13 semanas). O principal risco de negócio hoje não é a capacidade da nossa equipe de engenharia, mas sim um gargalo na cadeia de suprimentos: dependemos da entrega de um hardware IoT que leva 60 dias para chegar. O risco de não cumprirmos esse prazo é o atraso na entrega de valor ao mercado e o custo de ociosidade parcial da equipe no segundo mês. Para mitigar o impacto financeiro, estamos antecipando a construção do software via simuladores, mas recomendo avaliarmos a viabilidade de frete expresso para antecipar a chegada desses sensores."

**Para o Cliente:**

"A previsão para a entrega da primeira versão completa do seu sistema é de aproximadamente 3 meses. Nossa equipe de tecnologia está pronta e já iniciou a construção das funcionalidades de velocidade e comportamento do motorista. O fator principal que dita esse prazo é o tempo de fabricação e entrega dos sensores físicos que serão instalados nos caminhões (cerca de 60 dias). Para garantir que não percamos tempo, nossa equipe já estará construindo e testando o sistema nos bastidores, de forma que, assim que as peças chegarem, a instalação e a liberação final ocorram da forma mais rápida e segura possível."

---

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
