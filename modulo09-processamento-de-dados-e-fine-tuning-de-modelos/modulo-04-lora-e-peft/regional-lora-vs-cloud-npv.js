/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 4.1
 *
 * Este script não inventa uma ferramenta financeira nova. Ele reabre
 * calcularNPV, direto do decision-framework-tool.js do Módulo 1.3, sem
 * duplicar nenhuma linha de lógica, pra responder uma pergunta que o
 * Módulo 1.3 nunca precisou responder: quando o CASO já foi aprovado
 * (fine-tuning vale a pena), mas o VOLUME é pequeno demais pro custo fixo
 * de alugar uma GPU na nuvem pra treinar, o que muda na conta se o treino
 * for local, via LoRA, em vez de GPU alugada?
 *
 * Caso: Amplitude Auto está expandindo pra parcerias regionais (Sul,
 * Nordeste), cada uma gerando ~400 orçamentos de oficina por mês, mesma
 * tarefa da Amplitude Auto nacional (8.000/mês), volume bem menor.
 *
 * Uso: node regional-lora-vs-cloud-npv.js
 *
 * Par oficial desta disciplina: regional-lora-vs-cloud-npv.js (oficial) /
 * regional_lora_vs_cloud_npv.py (referência espelhada).
 */

'use strict';

const assert = require('assert').strict;
const path = require('path');

const { calcularNPV } = require(path.join(__dirname, '..', 'modulo-01-decision-framework', 'decision-framework-tool.js'));

const VOLUME_REGIONAL_MENSAL = 400;
const CRESCIMENTO_MENSAL = 0.03;
const CUSTO_STATUS_QUO = 0.045;
const CUSTO_FINE_TUNED = 0.016;
// [Estimativa de mercado, ago/2026] R$2.400 é o número ilustrativo do case Amplitude
// Seguros (herdado do Módulo 1.3), não uma cotação real de mercado -- foi calibrado
// pra sustentar a história financeira do case, usando como referência frouxa a faixa
// de GPU cloud verificada no cheatsheet do Módulo 1.3 (~US$0,40-4,00/hora). Preço de
// aluguel de GPU muda rápido; antes de usar este script pra uma decisão real, confira
// valores atuais em vast.ai/pricing ou runpod.io/pricing.
const CUSTO_JOB_GERENCIADO = 2400; // custo fixo de alugar GPU na nuvem por job de treino (não é o preço da API gerenciada da Vertex AI, que fatura por token)
const CUSTO_LORA_LOCAL = 0; // hardware já existe, custo marginal de treinar mais um adaptador é tempo de máquina
const HORIZONTE_MESES = 24;
const TAXA_DESCONTO_MENSAL = 0.01;
const NUM_PARCERIAS_REGIONAIS = 5;

function paramsBase(custoTreinamento) {
  return {
    volumeInicialMensal: VOLUME_REGIONAL_MENSAL,
    crescimentoMensal: CRESCIMENTO_MENSAL,
    custoPorChamadaStatusQuo: CUSTO_STATUS_QUO,
    custoPorChamadaFineTuned: CUSTO_FINE_TUNED,
    custoTreinamento,
    horizonteMeses: HORIZONTE_MESES,
    taxaDescontoMensal: TAXA_DESCONTO_MENSAL,
  };
}

/* --------------------------------------------------------------------------
 * Testes automatizados
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
  console.log('== Testes: NPV de parceria regional, GPU alugada vs. LoRA local ==');

  const npvGerenciado = calcularNPV(paramsBase(CUSTO_JOB_GERENCIADO));
  const npvLora = calcularNPV(paramsBase(CUSTO_LORA_LOCAL));

  testar('volume regional (400/mês) com custo fixo de GPU alugada dá NPV negativo em 24 meses', () => {
    assert.ok(npvGerenciado.npv < 0, `npv=${npvGerenciado.npv}, esperado < 0`);
  });

  testar('volume regional com custo fixo de GPU alugada nunca atinge breakeven no horizonte', () => {
    assert.equal(npvGerenciado.mesBreakeven, null);
  });

  testar('mesmo volume regional, mesmo custo por chamada, com LoRA local (custo fixo ~0) dá NPV positivo', () => {
    assert.ok(npvLora.npv > 0, `npv=${npvLora.npv}, esperado > 0`);
  });

  testar('LoRA local atinge breakeven rápido (poucos meses), diferença é só o custo fixo', () => {
    assert.ok(npvLora.mesBreakeven !== null && npvLora.mesBreakeven <= 3, `mesBreakeven=${npvLora.mesBreakeven}`);
  });

  testar('a diferença de NPV entre os dois caminhos é exatamente a diferença de custo fixo, descontada', () => {
    const diferenca = npvLora.npv - npvGerenciado.npv;
    assert.ok(Math.abs(diferenca - CUSTO_JOB_GERENCIADO) < 50, `diferença=${diferenca}, esperado próximo de ${CUSTO_JOB_GERENCIADO}`);
  });

  console.log();
  console.log(
    `Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), `
    + `${testesComFalha} falhou(falharam).`
  );

  if (testesComFalha > 0) {
    throw new Error(`${testesComFalha} teste(s) falharam. A implementação não bate com a especificação.`);
  }

  return { npvGerenciado, npvLora };
}

/* --------------------------------------------------------------------------
 * Demo
 * -------------------------------------------------------------------------- */

function rodarDemo({ npvGerenciado, npvLora }) {
  console.log();
  console.log('===== Demo: uma parceria regional, dois caminhos de fine-tuning =====\n');
  console.log(`Volume: ${VOLUME_REGIONAL_MENSAL}/mês (vs. 8.000/mês da Amplitude Auto nacional)`);
  console.log(`Mesmo custo por chamada do Módulo 1.3: status quo R$ ${CUSTO_STATUS_QUO}, fine-tunado R$ ${CUSTO_FINE_TUNED}\n`);

  console.log('--- Caminho 1: GPU alugada na nuvem ---');
  console.log(`  Custo fixo de treino: R$ ${CUSTO_JOB_GERENCIADO.toFixed(2)}`);
  console.log(`  NPV em ${HORIZONTE_MESES} meses: R$ ${npvGerenciado.npv.toFixed(2)}`);
  console.log(`  Breakeven: ${npvGerenciado.mesBreakeven ? `mês ${npvGerenciado.mesBreakeven}` : 'não atinge no horizonte'}`);

  console.log('\n--- Caminho 2: LoRA local (Módulo 4, este vídeo) ---');
  console.log(`  Custo fixo de treino: R$ ${CUSTO_LORA_LOCAL.toFixed(2)} (hardware já existe, custo marginal é tempo de máquina)`);
  console.log(`  NPV em ${HORIZONTE_MESES} meses: R$ ${npvLora.npv.toFixed(2)}`);
  console.log(`  Breakeven: mês ${npvLora.mesBreakeven}`);

  console.log(`\n--- Escalando pra ${NUM_PARCERIAS_REGIONAIS} parcerias regionais ---`);
  console.log(`  ${NUM_PARCERIAS_REGIONAIS} GPUs alugadas: custo fixo total R$ ${(CUSTO_JOB_GERENCIADO * NUM_PARCERIAS_REGIONAIS).toFixed(2)}, nenhuma atinge breakeven sozinha`);
  console.log(`  ${NUM_PARCERIAS_REGIONAIS} adaptadores LoRA locais: custo fixo total ~R$ 0, cada um com NPV positivo desde o mês 1`);

  console.log('\n-----------------------------------------------------------------------------');
  console.log('Mesma fórmula de NPV do Módulo 1.3, mesmo caso aprovado no gate. O que muda é');
  console.log('o custo fixo por unidade de treino: perto de zero pra LoRA local, fixo e alto');
  console.log('pra GPU alugada. Em volume pequeno, essa diferença decide o resultado.');
  console.log('-----------------------------------------------------------------------------');
}

if (require.main === module) {
  const resultado = rodarTestes();
  rodarDemo(resultado);
}

module.exports = {
  paramsBase,
  VOLUME_REGIONAL_MENSAL,
  CUSTO_JOB_GERENCIADO,
  CUSTO_LORA_LOCAL,
};

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
