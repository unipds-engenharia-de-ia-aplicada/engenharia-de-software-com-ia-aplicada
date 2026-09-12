# Companion: `npv-real-vs-projetado-tool.js`

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Artefato de Demo - Módulo 5.4, fecha o arco financeiro do Módulo 1**

## O que é

O Módulo 1.3 rodou a projeção de NPV que aprovou Amplitude Auto (Saúde Empresarial só foi aprovada depois, no Módulo 3.2) com um custo de treino **estimado**: R$2.400, o valor de referência desta disciplina pra "GPU alugada" (nenhum treino tinha rodado ainda). O Módulo 5.2 mediu o custo **real** desses treinos, no billing de verdade do Google Cloud: R$1,53 pra Auto, R$0,86 pra Saúde Empresarial.

Este companion reabre o mesmo código de NPV do Módulo 1.3 (`decision-framework-tool.js`, funções `calcularNPV` e `simularMonteCarlo`, sem duplicar nenhuma lógica financeira) e troca só o custo de treino, do estimado pro medido. Nenhum dado de negócio novo é inventado: nenhuma receita de produção, nenhum ROI fictício. Só a premissa que já foi medida de verdade entra atualizada; o resto (custo por chamada em produção, crescimento de volume) continua sendo a mesma projeção original, porque não foi medido em produção.

## Por que isso importa

O Módulo 1 fechou com uma promessa em aberto (dado suficiente, quantificado em 1.3); o Módulo 5.4 pergunta se ela se cumpriu de verdade. O Módulo 5 inteiro fechou o lado de qualidade dessa promessa (o modelo funciona, medido com rigor). Este companion fecha o pedaço do lado financeiro que já dá pra checar sem inventar nada: o custo de treino, que era a maior incerteza da conta original.

## Resultado real

Rodado de verdade nesta máquina em 2026-09-04, reabrindo `modulo-01-decision-framework/decision-framework-tool.js` sem alterar nenhuma linha dele.

| Caso | NPV projetado (R$2.400) | NPV real (custo medido) |
|---|---|---|
| **Amplitude Auto** | R$4.780,27 · breakeven mês 10 | **R$7.178,74 · breakeven mês 1** (custo real R$1,53) |
| **Amplitude Saúde Empresarial** | **-R$993,23 · sem breakeven** | **R$1.405,91 · breakeven mês 1** (custo real R$0,86) |

O achado mais forte: a estimativa original de R$2.400 superestimou tanto o custo real que **Amplitude Saúde Empresarial, cujo caso só se justificava esperando** (Real Options, opção de esperar precificada em ~R$230 no Módulo 1.3, contra decidir agora, que valia zero), **teria sido positiva desde o início** se o custo real de treino fosse conhecido na hora. Isso não muda a decisão de esperar que o Módulo 1.3 tomou (a razão de esperar era falta de **dado**, não custo financeiro), mas mostra que, no eixo puramente financeiro, o piloto saiu ainda mais barato do que o comitê de investimento tinha motivos pra esperar.

## O que continua sendo projeção (não foi medido)

- **Custo por chamada em produção**: continua a estimativa triangular original (R$0,012 a R$0,022, moda R$0,016). Esta disciplina nunca rodou o modelo fine-tunado servindo tráfego de produção de verdade, só treino e avaliação.
- **Crescimento de volume mensal**: continua a estimativa original (1% a 5% ao mês pra Auto, 2% a 8% pra Saúde Empresarial). Também não medido.

Só o custo de treino saiu do território de estimativa pro de medição real: é por isso que só ele muda aqui.

## Como rodar

```bash
node npv-real-vs-projetado-tool.js
# ou, equivalente:
python3 npv_real_vs_projetado_tool.py
```

Sem rede, sem custo, sem dependência externa além do próprio `decision-framework-tool.js` do Módulo 1.3 (já presente no repositório). Roda em menos de um segundo.

## Quando usar

Pra quem quer ver com números reais até onde a promessa financeira do Módulo 1 se confirmou, sem esperar um relatório de produção que esta disciplina nunca vai ter. Referenciado no encerramento do Módulo 5.4.

---

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
