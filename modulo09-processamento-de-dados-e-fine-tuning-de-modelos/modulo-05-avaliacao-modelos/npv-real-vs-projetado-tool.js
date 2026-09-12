/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 5.4 (companion, fecha o arco financeiro do Módulo 1)
 *
 * O Módulo 1.3 rodou a projeção de NPV que aprovou Amplitude Auto
 * (Saúde Empresarial só foi aprovada depois, no Módulo 3.2) com um custo
 * de treino ESTIMADO (R$2.400, o valor de referência desta disciplina pra "GPU
 * alugada"). O Módulo 5.2 mediu o custo REAL desses treinos no billing
 * do Google Cloud: R$1,53 (Auto) e R$0,86 (Saúde Empresarial) -- centavos,
 * não milhares de reais.
 *
 * Este arquivo NÃO inventa nenhum dado de negócio novo (nenhuma receita
 * de produção, nenhum ROI fictício): reabre o MESMO código de NPV do
 * Módulo 1.3 (decision-framework-tool.js, `calcularNPV` e
 * `simularMonteCarlo`, sem duplicar nenhuma lógica financeira) e troca
 * só o custo de treino, do estimado pro medido, mantendo toda a outra
 * premissa (crescimento de volume, custo por chamada) exatamente como a
 * projeção original -- essas continuam sendo estimativa, não foram
 * medidas em produção.
 *
 * Uso: node npv-real-vs-projetado-tool.js
 *
 * Par oficial desta disciplina: npv-real-vs-projetado-tool.js (oficial) /
 * npv_real_vs_projetado_tool.py (referência espelhada).
 */

'use strict';

const assert = require('assert').strict;
const path = require('path');

const {
  carregarConfiguracao,
  calcularNPV,
  simularMonteCarlo,
} = require(path.join(__dirname, '..', 'modulo-01-decision-framework', 'decision-framework-tool.js'));

/* ============================================================================
 * 1. Custo de treino real, medido no Módulo 5.2 (billing real do Google
 *    Cloud), contra o valor de referência estimado no Módulo 1.3
 * ========================================================================= */

const CUSTO_TREINAMENTO_REAL = Object.freeze({
  'amplitude-auto': 1.53,
  'amplitude-saude-empresarial': 0.86,
});

/* ============================================================================
 * 2. Montar os params determinísticos que calcularNPV espera (mesma forma
 *    que a função interna paramsDeterministicos do Módulo 1.3, não
 *    exportada -- reconstruída aqui só como adaptador de interface, a
 *    lógica financeira em si continua vindo de calcularNPV real)
 * ========================================================================= */

function montarParamsDeterministicos(financeiro, custoTreinamentoOverride = null) {
  return {
    volumeInicialMensal: financeiro.volumeInicialMensal,
    crescimentoMensal: financeiro.crescimentoMensal.moda,
    custoPorChamadaStatusQuo: financeiro.custoPorChamadaStatusQuo.moda,
    custoPorChamadaFineTuned: financeiro.custoPorChamadaFineTuned.moda,
    custoTreinamento: custoTreinamentoOverride !== null ? custoTreinamentoOverride : financeiro.custoTreinamento,
    horizonteMeses: financeiro.horizonteMeses,
    taxaDescontoMensal: financeiro.taxaDescontoMensal,
  };
}

/* ============================================================================
 * 3. Comparar projeção original (custo estimado) contra real (custo medido)
 * ========================================================================= */

function compararProjetadoVsReal(casoId, config) {
  const caso = config.casos.find((c) => c.id === casoId);
  if (!caso) throw new Error(`caso não encontrado: ${casoId}`);
  const custoReal = CUSTO_TREINAMENTO_REAL[casoId];
  if (custoReal === undefined) throw new Error(`sem custo real medido pra: ${casoId}`);

  const projetado = calcularNPV(montarParamsDeterministicos(caso.financeiro));
  const real = calcularNPV(montarParamsDeterministicos(caso.financeiro, custoReal));

  return {
    casoId,
    custoTreinamentoProjetado: caso.financeiro.custoTreinamento,
    custoTreinamentoReal: custoReal,
    npvProjetado: projetado.npv,
    breakevenProjetado: projetado.mesBreakeven,
    npvReal: real.npv,
    breakevenReal: real.mesBreakeven,
  };
}

/* --------------------------------------------------------------------------
 * Testes automatizados -- contra os números reais capturados rodando este
 * mesmo código nesta máquina em 2026-09-04
 * -------------------------------------------------------------------------- */

let totalTestes = 0;
let testesComFalha = 0;

function testar(descricao, fn) {
  totalTestes += 1;
  try {
    fn();
    console.log(`  [OK] ${descricao}`);
  } catch (erro) {
    testesComFalha += 1;
    console.log(`  [FALHOU] ${descricao}`);
    console.log(`           ${erro.message}`);
  }
}

function rodarTestes() {
  console.log('== Testes: recomputação de NPV com custo de treino real ==');
  const config = carregarConfiguracao();

  testar('Auto: NPV projetado bate com o número real do Módulo 1.3 (R$4.780,27, breakeven mês 10)', () => {
    const r = compararProjetadoVsReal('amplitude-auto', config);
    assert.equal(r.custoTreinamentoProjetado, 2400);
    assert.equal(r.npvProjetado, 4780.27);
    assert.equal(r.breakevenProjetado, 10);
  });

  testar('Auto: NPV real (custo R$1,53) sobe pra R$7.178,74, breakeven cai pro mês 1', () => {
    const r = compararProjetadoVsReal('amplitude-auto', config);
    assert.equal(r.npvReal, 7178.74);
    assert.equal(r.breakevenReal, 1);
    assert.ok(r.npvReal > r.npvProjetado, 'NPV real deveria ser maior que o projetado');
  });

  testar('Saúde Empresarial: NPV projetado era negativo (R$-993,23, sem breakeven)', () => {
    const r = compararProjetadoVsReal('amplitude-saude-empresarial', config);
    assert.equal(r.custoTreinamentoProjetado, 2400);
    assert.equal(r.npvProjetado, -993.23);
    assert.equal(r.breakevenProjetado, null);
  });

  testar('Saúde Empresarial: NPV real (custo R$0,86) vira positivo, R$1.405,91, breakeven mês 1', () => {
    const r = compararProjetadoVsReal('amplitude-saude-empresarial', config);
    assert.equal(r.npvReal, 1405.91);
    assert.equal(r.breakevenReal, 1);
  });

  testar('custo por chamada e crescimento de volume NÃO mudam (continuam projeção, não medidos)', () => {
    const caso = config.casos.find((c) => c.id === 'amplitude-auto');
    const paramsProjetado = montarParamsDeterministicos(caso.financeiro);
    const paramsReal = montarParamsDeterministicos(caso.financeiro, CUSTO_TREINAMENTO_REAL['amplitude-auto']);
    assert.equal(paramsProjetado.custoPorChamadaFineTuned, paramsReal.custoPorChamadaFineTuned);
    assert.equal(paramsProjetado.crescimentoMensal, paramsReal.crescimentoMensal);
    assert.notEqual(paramsProjetado.custoTreinamento, paramsReal.custoTreinamento);
  });

  console.log(`\n${totalTestes - testesComFalha}/${totalTestes} testes passaram.`);
  if (testesComFalha > 0) process.exitCode = 1;
}

/* ============================================================================
 * 4. Comparação real, impressa
 * ========================================================================= */

function rodarComparacaoReal() {
  const config = carregarConfiguracao();
  console.log('\n===== NPV: projeção original (Módulo 1.3) vs. custo real medido (Módulo 5.2) =====\n');

  ['amplitude-auto', 'amplitude-saude-empresarial'].forEach((casoId) => {
    const r = compararProjetadoVsReal(casoId, config);
    console.log(`--- ${casoId} ---`);
    console.log(`  Custo de treino projetado: R$${r.custoTreinamentoProjetado.toFixed(2)}  ->  real medido: R$${r.custoTreinamentoReal.toFixed(2)}`);
    console.log(`  NPV projetado: R$${r.npvProjetado.toFixed(2)} (breakeven: ${r.breakevenProjetado === null ? 'nunca' : `mês ${r.breakevenProjetado}`})`);
    console.log(`  NPV real:      R$${r.npvReal.toFixed(2)} (breakeven: ${r.breakevenReal === null ? 'nunca' : `mês ${r.breakevenReal}`})`);
    console.log();
  });

  console.log(
    'O que mudou: só o custo de treino, de estimativa pra medição real. Custo por '
    + 'chamada em produção e crescimento de volume continuam sendo a mesma projeção '
    + 'do Módulo 1.3 -- não foram medidos em produção, então não mudam aqui.'
  );

  return ['amplitude-auto', 'amplitude-saude-empresarial'].map((id) => compararProjetadoVsReal(id, config));
}

if (require.main === module) {
  rodarTestes();
  rodarComparacaoReal();
}

module.exports = {
  CUSTO_TREINAMENTO_REAL,
  montarParamsDeterministicos,
  compararProjetadoVsReal,
  rodarComparacaoReal,
};

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
