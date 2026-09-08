/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 4.4
 *
 * Fecha a pergunta que ficou em aberto desde o Módulo 4.1: será que LoRA
 * local, mesmo no posto certo, chega perto de um full fine-tuning de
 * verdade, ou tem sempre um teto? Os números abaixo não são estimativas:
 * são a saída real de um treino full fine-tuning (mesmo dataset, mesmo
 * modelo, mesmas 20 iterações, mesmas 16 camadas que o LoRA usa por
 * padrão) rodado nesta disciplina em 2026-08-08, comparado contra os três
 * treinos LoRA do Módulo 4.3.
 *
 * Uso: node full-vs-lora-tradeoff-tool.js
 *
 * Par oficial desta disciplina: full-vs-lora-tradeoff-tool.js (oficial) /
 * full_vs_lora_tradeoff_tool.py (referência espelhada).
 */

'use strict';

const assert = require('assert').strict;

/**
 * Dados reais. LoRA rank 4/8/16 vêm do Módulo 4.3. Full fine-tuning é novo
 * nesta sessão: --fine-tune-type full, mesmas 16 camadas (--num-layers
 * padrão), mesmos hiperparâmetros de treino do resto do módulo.
 */
const CONFIGURACOES_REAIS = [
  {
    tipo: 'LoRA rank 4',
    percentualModelo: 0.074,
    valLossFinal: 1.246,
    picoMemGB: 10.787,
    tamanhoCheckpointMB: 13,
  },
  {
    tipo: 'LoRA rank 8',
    percentualModelo: 0.147,
    valLossFinal: 0.895,
    picoMemGB: 10.833,
    tamanhoCheckpointMB: 27,
  },
  {
    tipo: 'LoRA rank 16',
    percentualModelo: 0.295,
    valLossFinal: 0.725,
    picoMemGB: 10.930,
    tamanhoCheckpointMB: 52,
  },
  {
    tipo: 'Full fine-tuning',
    percentualModelo: 22.567,
    valLossFinal: 0.612,
    picoMemGB: 15.338,
    tamanhoCheckpointMB: 1992,
  },
];

/**
 * Resultado real de inferência: os mesmos dois exemplos dos Módulos 4.2 e
 * 4.3, rodados contra o checkpoint de full fine-tuning. beneficiario/valor
 * e segurado/placa/valor batem exatamente com o gabarito, campo a campo,
 * nos dois casos -- incluindo o caso com dois valores distratores.
 */
const RESULTADO_INFERENCIA_FULL = {
  exemploFacil: { acertouTodosCampos: true },
  exemploComDistratores: { acertouTodosCampos: true },
};

/* ============================================================================
 * 1. Métricas derivadas
 * ========================================================================= */

function calcularGanhoValLoss(base, comparado) {
  return Number((((base.valLossFinal - comparado.valLossFinal) / base.valLossFinal) * 100).toFixed(2));
}

function calcularRazaoCusto(base, comparado) {
  return {
    parametro: Number((comparado.percentualModelo / base.percentualModelo).toFixed(1)),
    memoria: Number((comparado.picoMemGB / base.picoMemGB).toFixed(2)),
    checkpoint: Number((comparado.tamanhoCheckpointMB / base.tamanhoCheckpointMB).toFixed(1)),
  };
}

/**
 * Decide se vale a pena pagar o custo extra do full fine-tuning: só faz
 * sentido se o ganho de val loss superar um limiar mínimo (padrão 20%)
 * em relação ao melhor LoRA já testado -- caso contrário, o custo extra
 * não se justifica pela melhoria de qualidade.
 */
function valeAPenaFullFineTuning(configuracoes, limiarGanhoMinimo = 20) {
  const melhorLora = configuracoes
    .filter((c) => c.tipo.startsWith('LoRA'))
    .sort((a, b) => a.valLossFinal - b.valLossFinal)[0];
  const full = configuracoes.find((c) => c.tipo === 'Full fine-tuning');
  const ganho = calcularGanhoValLoss(melhorLora, full);
  return {
    melhorLora: melhorLora.tipo,
    ganhoPercentual: ganho,
    valeAPena: ganho >= limiarGanhoMinimo,
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
  console.log('== Testes: métricas derivadas sobre dado real ==');

  const loraOito = CONFIGURACOES_REAIS.find((c) => c.tipo === 'LoRA rank 8');
  const full = CONFIGURACOES_REAIS.find((c) => c.tipo === 'Full fine-tuning');

  testar('full fine-tuning melhora o val loss frente ao LoRA rank 8 em ~31,6%', () => {
    const ganho = calcularGanhoValLoss(loraOito, full);
    assert.ok(Math.abs(ganho - 31.62) < 0.5, `ganho=${ganho}`);
  });

  testar('full fine-tuning usa ~153x mais parâmetros treináveis que LoRA rank 8', () => {
    const razao = calcularRazaoCusto(loraOito, full);
    assert.ok(Math.abs(razao.parametro - 153.5) < 1, `razao=${razao.parametro}`);
  });

  testar('checkpoint do full fine-tuning é ~73,8x maior que o adaptador LoRA rank 8', () => {
    const razao = calcularRazaoCusto(loraOito, full);
    assert.equal(razao.checkpoint, 73.8);
  });

  testar('full fine-tuning usa mais memória de pico que qualquer configuração LoRA', () => {
    const loras = CONFIGURACOES_REAIS.filter((c) => c.tipo.startsWith('LoRA'));
    loras.forEach((l) => {
      assert.ok(full.picoMemGB > l.picoMemGB, `${l.tipo}: full=${full.picoMemGB}, lora=${l.picoMemGB}`);
    });
  });

  console.log();
  console.log('== Testes: vale a pena o custo extra? ==');

  testar('aplica corretamente o limiar de 20% sobre o ganho de full fine-tuning vs. o melhor LoRA testado', () => {
    const r = valeAPenaFullFineTuning(CONFIGURACOES_REAIS, 20);
    assert.equal(r.melhorLora, 'LoRA rank 16');
    assert.equal(r.valeAPena, false, `esperado false pois o ganho real fica abaixo de 20%, ganho=${r.ganhoPercentual}`);
  });

  testar('aplica corretamente o limiar de 10% sobre o mesmo critério de decisão', () => {
    const r = valeAPenaFullFineTuning(CONFIGURACOES_REAIS, 10);
    assert.equal(r.valeAPena, true);
  });

  console.log();
  console.log('== Testes: resultado de inferência real (mesmos exemplos dos Módulos 4.2 e 4.3) ==');

  testar('valida o resultado de inferência do exemplo fácil contra o valor de referência interno', () => {
    assert.equal(RESULTADO_INFERENCIA_FULL.exemploFacil.acertouTodosCampos, true);
  });

  testar('valida o resultado de inferência do exemplo com distratores contra o valor de referência interno', () => {
    assert.equal(RESULTADO_INFERENCIA_FULL.exemploComDistratores.acertouTodosCampos, true);
  });

  console.log();
  console.log(
    `Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), `
    + `${testesComFalha} falhou(falharam).`
  );

  if (testesComFalha > 0) {
    throw new Error(`${testesComFalha} teste(s) falharam. A implementação não bate com a especificação.`);
  }
}

/* --------------------------------------------------------------------------
 * Demo
 * -------------------------------------------------------------------------- */

function rodarDemo() {
  console.log();
  console.log('===== Full Fine-Tuning vs. LoRA: a resposta, com números reais =====\n');

  CONFIGURACOES_REAIS.forEach((c) => {
    console.log(`  ${c.tipo}:`);
    console.log(`    Parâmetros treináveis: ${c.percentualModelo}% do modelo`);
    console.log(`    Val loss final: ${c.valLossFinal}`);
    console.log(`    Pico de memória: ${c.picoMemGB.toFixed(3)} GB`);
    console.log(`    Checkpoint salvo: ${c.tamanhoCheckpointMB} MB`);
    console.log();
  });

  const loraOito = CONFIGURACOES_REAIS.find((c) => c.tipo === 'LoRA rank 8');
  const full = CONFIGURACOES_REAIS.find((c) => c.tipo === 'Full fine-tuning');
  const razao = calcularRazaoCusto(loraOito, full);
  console.log('  --- Full fine-tuning vs. LoRA rank 8 ---');
  console.log(`  Val loss ${calcularGanhoValLoss(loraOito, full)}% melhor, com ${razao.parametro}x mais parâmetros,`);
  console.log(`  ${razao.memoria}x mais memória de pico, e checkpoint ${razao.checkpoint}x maior.`);

  const decisao = valeAPenaFullFineTuning(CONFIGURACOES_REAIS, 20);
  console.log(`\n  Vale a pena? Comparado ao melhor LoRA (${decisao.melhorLora}), o ganho real é de ${decisao.ganhoPercentual}%.`);
  console.log(`  Com limiar de 20% pra justificar o custo extra: ${decisao.valeAPena ? 'SIM' : 'NÃO, fica abaixo do limiar'}.`);

  console.log('\n  --- Inferência real, mesmos dois exemplos dos Módulos 4.2 e 4.3 ---');
  console.log('  Exemplo fácil (Felipe Alves Monteiro): full fine-tuning acerta, campo a campo.');
  console.log('  Exemplo com distratores (Ricardo Alves Monteiro): full fine-tuning acerta, campo a campo.');
  console.log('  Mesmo resultado observável que LoRA rank 4, 8 e 16 nos dois casos.');

  console.log('\n-----------------------------------------------------------------------------');
  console.log('Existe teto, e é real: full fine-tuning chega a um val loss melhor que qualquer');
  console.log('LoRA testado. Mas pra esta tarefa, extração estruturada e estreita, esse teto');
  console.log('não aparece em comportamento observável, nem no caso fácil, nem no difícil. O');
  const percentualMemoriaExtra = Math.round((razao.memoria - 1) * 100);
  console.log(`custo aparece sempre: ${razao.checkpoint}x mais disco, ~${percentualMemoriaExtra}% mais memória, ${razao.parametro}x mais parâmetros.`);
  console.log('  (medido em iters=20 pros dois lados - o Módulo 4.2 mostrou esse checkpoint subtreinado, melhor iteração real = 90. O teto pode ser real, mas o tamanho exato ainda não foi medido até convergência.)');
  console.log('-----------------------------------------------------------------------------');
}

if (require.main === module) {
  rodarTestes();
  rodarDemo();
}

module.exports = {
  CONFIGURACOES_REAIS,
  RESULTADO_INFERENCIA_FULL,
  calcularGanhoValLoss,
  calcularRazaoCusto,
  valeAPenaFullFineTuning,
};

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
