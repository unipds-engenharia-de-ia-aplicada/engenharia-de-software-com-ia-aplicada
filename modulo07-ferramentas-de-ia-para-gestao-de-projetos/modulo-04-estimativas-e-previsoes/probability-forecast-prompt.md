# Probability Forecast Prompt - Estimativas Probabilísticas com IA
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 4.2**

> **Artefato de Demo - Módulo 4.2**
> Template para estimativa de três pontos, cálculo PERT e Monte Carlo real via script.

---

## Parte 1 — Prompt para o AI Studio

```
Você é um especialista em gerenciamento quantitativo de projetos com experiência
em estimativas probabilísticas para times de desenvolvimento de software.

Sua tarefa é calcular estimativas PERT e variância para o backlog fornecido,
identificar as histórias de maior risco e traduzir os resultados para quatro
audiências diferentes.

---

## DADOS DE INPUT

Para cada história, forneço três pontos de estimativa em semanas:
- O = Otimista (tudo corre bem, sem surpresas)
- M = Mais Provável (cenário esperado dado o histórico do time)
- P = Pessimista (algo deu errado de forma razoável — não catastrófico)

[PREENCHER — cole as histórias com os três pontos]

Formato:
ID | Título | O | M | P | Observações

Exemplo:
US-01 | Alertas de Velocidade     | 2 | 3 | 5 | Risco: bug de integração GPS em área rural
US-03 | Score de Comportamento    | 3 | 4 | 6 | Hardware novo (acelerômetro) — maior incerteza
US-04 | Sensor de Abertura de Baú | 1 | 2 | 3 | Bloqueado por hardware (lead time 60 dias)
US-09 | Carga Refrigerada         | 2 | 3 | 5 | Bloqueado por hardware (lead time 60 dias)

---

## PARALELISMO DO TIME

[PREENCHER]
Número de desenvolvedores trabalhando em paralelo: [X]
Fator de paralelismo efetivo (considere dependências): [X]

Exemplo:
2 devs em paralelo. Fator efetivo 1.7 (algumas histórias têm dependência sequencial).

---

## CÁLCULOS SOLICITADOS

### 1. PERT por história
Para cada história, calcule:
- Estimativa PERT = (O + 4M + P) / 6
- Variância = ((P - O) / 6)²
- Desvio Padrão = √Variância

### 2. Totais do projeto
- Soma das estimativas PERT (esforço sequencial total em semanas)
- Elapsed time com paralelismo = Total PERT / Fator de paralelismo
- Desvio padrão agregado = √(soma das variâncias)

### 3. Interpretação por audiência

**Para o time técnico:**
Quais histórias têm maior variância? O que fazer para reduzir a incerteza
antes do desenvolvimento? (spike técnico, PoC, pesquisa)

**Para o gestor de produto:**
Qual prazo recomendar ao cliente? Com qual nível de confiança?
Quais são os principais drivers de risco?

**Para o executivo:**
Em linguagem de negócio: qual é o prazo e qual é o risco de não cumprir?

**Para o cliente:**
Sem jargão técnico: qual é a previsão de entrega e o que pode impactar o prazo?

---

## FORMATO DE OUTPUT

### Tabela PERT
| História | O | M | P | PERT (sem) | Variância | Desvio Padrão | Status |
|---|---|---|---|---|---|---|---|

### Top 3 histórias com maior incerteza
Liste as 3 histórias com maior desvio padrão e a ação recomendada para
reduzir a incerteza antes do desenvolvimento.

### Comunicação por audiência
[Quatro parágrafos — um para cada audiência]

---

## RESTRIÇÕES DE COMPORTAMENTO

- Nunca retorne apenas o número — sempre explique o raciocínio do cálculo
- Se o Pessimista for menos de 1.5x o Mais Provável, questione se o
  pessimista está subestimado (viés de otimismo)
- Se alguma história tiver Desvio Padrão maior que 30% da estimativa PERT,
  classifique como "Alta Incerteza" e sinalize
- Não calcule Monte Carlo — use apenas PERT e desvio padrão para a análise
```

---

## Por que o Monte Carlo não vai para o LLM?

LLMs não sorteiam números aleatórios — eles aproximam um resultado plausível
com base em padrões de texto. Pedir ao modelo para "simular 1000 cenários"
produz um número que parece estatístico mas não é: não há distribuição real,
não há aleatoriedade, não há garantia matemática.

Para o P85 que você vai apresentar ao cliente, use o script abaixo, que modela duas trilhas: software desde a semana 1 e hardware somente a partir da semana 9. É a diferença entre um número defensável e um número inventado.

---

## Parte 2 — Monte Carlo Real

### Opção A: JavaScript — rode direto no browser

**Como usar:** abra qualquer aba no Chrome ou Firefox → pressione `F12`
→ clique em "Console" → cole o script abaixo → pressione Enter.

```javascript
// Monte Carlo — RouteWise MVP com restrição de hardware
// Cole no console do browser (F12 → Console) e pressione Enter.

const historias = {
  us01: { nome: "US-01 Alertas de Velocidade", o: 2, m: 3, p: 5 },
  us03: { nome: "US-03 Score de Comportamento", o: 3, m: 4, p: 6 },
  us04: { nome: "US-04 Sensor de Abertura de Bau", o: 1, m: 2, p: 3 },
  us09: { nome: "US-09 Carga Refrigerada", o: 2, m: 3, p: 5 },
};

const HARDWARE_SEMANA = 9; // US-04 e US-09 só começam quando o hardware chega
const N = 10_000;

function triangular(o, m, p) {
  const u = Math.random();
  const fc = (m - o) / (p - o);
  return u < fc
    ? o + Math.sqrt(u * (p - o) * (m - o))
    : p - Math.sqrt((1 - u) * (p - o) * (p - m));
}

const totais = Array.from({ length: N }, () => {
  const us01 = triangular(historias.us01.o, historias.us01.m, historias.us01.p);
  const us03 = triangular(historias.us03.o, historias.us03.m, historias.us03.p);
  const trilhaSoftware = (us01 + us03) / 1.3;

  const us04 = triangular(historias.us04.o, historias.us04.m, historias.us04.p);
  const us09 = triangular(historias.us09.o, historias.us09.m, historias.us09.p);
  const trilhaHardware = HARDWARE_SEMANA + (us04 + us09) / 1.5;

  return Math.max(trilhaSoftware, trilhaHardware);
}).sort((a, b) => a - b);

const pct = p => totais[Math.floor(p * N / 100)].toFixed(1);
const media = (totais.reduce((a, b) => a + b, 0) / N).toFixed(1);

console.log("=== Monte Carlo RouteWise — " + N.toLocaleString("pt-BR") + " simulações ===");
console.log("P50 (cenário provável):        " + pct(50) + " semanas");
console.log("P85 (compromisso com cliente): " + pct(85) + " semanas");
console.log("P95 (conservador):             " + pct(95) + " semanas");
console.log("Média:                         " + media + " semanas");
```

---

### Opção B: Python — para quem prefere rodar localmente

```python
import random
import math

historias = {
    "US-01 Alertas de Velocidade":      (2, 3, 5),
    "US-03 Score de Comportamento":     (3, 4, 6),
    "US-04 Sensor de Abertura de Bau":  (1, 2, 3),
    "US-09 Carga Refrigerada":          (2, 3, 5),
}

HARDWARE_SEMANA = 9
N = 10_000

def triangular(o, m, p):
    u = random.random()
    fc = (m - o) / (p - o)
    if u < fc:
        return o + math.sqrt(u * (p - o) * (m - o))
    return p - math.sqrt((1 - u) * (p - o) * (p - m))

totais = []
for _ in range(N):
    us01 = triangular(*historias["US-01 Alertas de Velocidade"])
    us03 = triangular(*historias["US-03 Score de Comportamento"])
    trilha_sw = (us01 + us03) / 1.3

    us04 = triangular(*historias["US-04 Sensor de Abertura de Bau"])
    us09 = triangular(*historias["US-09 Carga Refrigerada"])
    trilha_hw = HARDWARE_SEMANA + (us04 + us09) / 1.5

    totais.append(max(trilha_sw, trilha_hw))

totais.sort()
percentil = lambda pct: totais[int(pct * N / 100)]
media = sum(totais) / N

print(f"P50:   {percentil(50):.1f} semanas")
print(f"P85:   {percentil(85):.1f} semanas")
print(f"P95:   {percentil(95):.1f} semanas")
print(f"Média: {media:.1f} semanas")
```

---

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
