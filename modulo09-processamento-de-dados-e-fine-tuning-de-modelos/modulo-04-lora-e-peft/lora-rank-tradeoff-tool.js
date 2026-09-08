/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 4.3
 *
 * Analisa o trade-off real entre posto (rank) do LoRA, parâmetros
 * treináveis, memória, velocidade e qualidade (val loss). Os números abaixo
 * não são estimativa nem exemplo de documentação: são a saída real de três
 * treinos rodados nesta disciplina, mesmo dataset, mesmo modelo, mesmos
 * hiperparâmetros (iters=20, batch=1, learning-rate=1e-5), variando só o
 * rank -- 4, 8 (o mesmo treino do Módulo 4.2) e 16 -- via
 * lora_parameters.rank no arquivo de config YAML do mlx_lm.lora.
 *
 * Uso: node lora-rank-tradeoff-tool.js
 *
 * Par oficial desta disciplina: lora-rank-tradeoff-tool.js (oficial) /
 * lora_rank_tradeoff_tool.py (referência espelhada).
 */

'use strict';

const assert = require('assert').strict;

/**
 * Dados reais, capturados rodando mlx_lm.lora três vezes contra o mesmo
 * dataset do Módulo 3 (157 exemplos de treino), no Gemma 4 E2B, em
 * 2026-08-08. Nenhum número aqui é estimado.
 */
const EXECUCOES_REAIS = [
  {
    rank: 4,
    parametrosTreinaveis: 3.408e6,
    percentualModelo: 0.074,
    valLossInicial: 4.752,
    valLossFinal: 1.246,
    picoMemGB: 10.787,
    itPorSegundoFinal: 7.401,
    tamanhoAdapterMB: 13,
  },
  {
    rank: 8,
    parametrosTreinaveis: 6.816e6,
    percentualModelo: 0.147,
    valLossInicial: 4.752,
    valLossFinal: 0.895,
    picoMemGB: 10.833,
    itPorSegundoFinal: 7.295,
    tamanhoAdapterMB: 27,
  },
  {
    rank: 16,
    parametrosTreinaveis: 13.631e6,
    percentualModelo: 0.295,
    valLossInicial: 4.752,
    valLossFinal: 0.725,
    picoMemGB: 10.930,
    itPorSegundoFinal: 7.253,
    tamanhoAdapterMB: 52,
  },
];

/**
 * Segundo par de execuções reais, mesmo rank (8), mesmo dataset, mesmos
 * hiperparâmetros -- só o dtype do modelo base muda: bf16 (a execução de
 * rank 8 acima) contra o mesmo modelo pré-quantizado em 4-bit (QLoRA de
 * verdade, não só citado em slide). Capturado em 2026-08-16.
 */
const COMPARACAO_QUANTIZACAO = {
  bf16: {
    tamanhoModeloDiscoGB: 10.241,
    picoMemTreinoGB: 10.833,
    valLossFinal: 0.895,
    tamanhoAdapterMB: 27,
  },
  '4bit': {
    tamanhoModeloDiscoGB: 3.583,
    picoMemTreinoGB: 4.193,
    valLossFinal: 0.932,
    tamanhoAdapterMB: 27,
    picoMemGeracaoGB: 2.794,
  },
};

/**
 * Terceiro par de execuções reais, mesmo rank (8), mesmo dataset, mesmos
 * hiperparâmetros -- só o tipo de adaptação muda: LoRA puro (a execução de
 * rank 8 acima) contra DoRA (weight-decomposed LoRA), via fine_tune_type:
 * dora no mesmo mlx_lm.lora (suporte nativo desde a versão instalada nesta
 * disciplina, sem código extra). Capturado em 2026-08-31.
 */
const COMPARACAO_TIPO_ADAPTACAO = {
  lora: {
    parametrosTreinaveis: 6.816e6,
    picoMemGB: 10.833,
    valLossFinal: 0.895,
    tamanhoAdapterMB: 27,
  },
  dora: {
    parametrosTreinaveis: 7.328e6,
    picoMemGB: 11.099,
    valLossFinal: 0.895,
    tamanhoAdapterMB: 28,
  },
};

/* ============================================================================
 * 1. Métricas derivadas -- quanto cada dobra de rank custa e entrega
 * ========================================================================= */

function calcularReducaoValLoss(execucao) {
  return Number((((execucao.valLossInicial - execucao.valLossFinal) / execucao.valLossInicial) * 100).toFixed(2));
}

/**
 * Compara cada execução contra a anterior na lista (assumida ordenada por
 * rank crescente): quanto os parâmetros treináveis cresceram, quanto o val
 * loss final melhorou, e o custo de memória extra.
 */
function compararExecucoesSucessivas(execucoes) {
  const comparacoes = [];
  for (let i = 1; i < execucoes.length; i += 1) {
    const anterior = execucoes[i - 1];
    const atual = execucoes[i];
    const razaoParametros = Number((atual.parametrosTreinaveis / anterior.parametrosTreinaveis).toFixed(2));
    const melhoriaValLoss = Number((anterior.valLossFinal - atual.valLossFinal).toFixed(3));
    const melhoriaPercentual = Number(((melhoriaValLoss / anterior.valLossFinal) * 100).toFixed(2));
    const custoMemoriaExtraGB = Number((atual.picoMemGB - anterior.picoMemGB).toFixed(3));
    comparacoes.push({
      deRank: anterior.rank,
      paraRank: atual.rank,
      razaoParametros,
      melhoriaValLoss,
      melhoriaPercentual,
      custoMemoriaExtraGB,
    });
  }
  return comparacoes;
}

/**
 * Compara a mesma configuração de LoRA (rank 8) contra o modelo base em
 * bf16 e em 4-bit (QLoRA de verdade): quanto de memória a quantização
 * economiza, e quanto de val loss ela custa.
 */
function compararQuantizacao(comparacao = COMPARACAO_QUANTIZACAO) {
  const bf16 = comparacao.bf16;
  const quatroBit = comparacao['4bit'];
  const reducaoDiscoPct = Number(((1 - quatroBit.tamanhoModeloDiscoGB / bf16.tamanhoModeloDiscoGB) * 100).toFixed(1));
  const reducaoMemTreinoPct = Number(((1 - quatroBit.picoMemTreinoGB / bf16.picoMemTreinoGB) * 100).toFixed(1));
  const custoValLoss = Number((quatroBit.valLossFinal - bf16.valLossFinal).toFixed(3));
  const custoValLossPct = Number(((custoValLoss / bf16.valLossFinal) * 100).toFixed(1));
  return {
    reducaoDiscoPct, reducaoMemTreinoPct, custoValLoss, custoValLossPct,
  };
}

/**
 * Compara a mesma configuração de LoRA (rank 8) contra DoRA (weight-
 * decomposed LoRA): quanto DoRA custa a mais de parâmetros treináveis e
 * memória, e se esse custo se traduz em val loss melhor neste treino
 * pequeno e nesta tarefa de extração estruturada.
 */
function compararTipoAdaptacao(comparacao = COMPARACAO_TIPO_ADAPTACAO) {
  const lora = comparacao.lora;
  const dora = comparacao.dora;
  const razaoParametros = Number((dora.parametrosTreinaveis / lora.parametrosTreinaveis).toFixed(3));
  const custoMemoriaExtraGB = Number((dora.picoMemGB - lora.picoMemGB).toFixed(3));
  const diferencaValLoss = Number((dora.valLossFinal - lora.valLossFinal).toFixed(3));
  return {
    razaoParametros, custoMemoriaExtraGB, diferencaValLoss,
  };
}

/**
 * Recomenda o menor rank cujo val loss final fica dentro de uma margem
 * (padrão 10%) do melhor val loss observado -- formaliza "retorno
 * decrescente" em vez de deixar a decisão no olho.
 */
function recomendarRankMinimo(execucoes, margemAceitavel = 0.10) {
  const melhorValLoss = Math.min(...execucoes.map((c) => c.valLossFinal));
  const limiar = melhorValLoss * (1 + margemAceitavel);
  const candidatos = execucoes
    .filter((c) => c.valLossFinal <= limiar)
    .sort((a, b) => a.rank - b.rank);
  return candidatos[0];
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
  console.log('== Testes: redução de val loss por execução ==');

  testar('rank 8 reduz val loss em aproximadamente 81% (4,752 -> 0,895)', () => {
    const r = calcularReducaoValLoss(EXECUCOES_REAIS[1]);
    assert.ok(Math.abs(r - 81.17) < 0.5, `reducao=${r}`);
  });

  console.log();
  console.log('== Testes: comparação entre execuções sucessivas ==');

  const comparacoes = compararExecucoesSucessivas(EXECUCOES_REAIS);

  testar('rank 4 -> 8 dobra os parâmetros treináveis (razão = 2,0)', () => {
    assert.equal(comparacoes[0].razaoParametros, 2.0);
  });

  testar('rank 8 -> 16 também dobra os parâmetros treináveis', () => {
    assert.equal(comparacoes[1].razaoParametros, 2.0);
  });

  testar('mais rank sempre melhora o val loss final, nas três execuções reais', () => {
    comparacoes.forEach((c) => {
      assert.ok(c.melhoriaValLoss > 0, `de rank ${c.deRank} pra ${c.paraRank}, melhoria=${c.melhoriaValLoss}`);
    });
  });

  testar('o custo de memória extra por dobra de rank é pequeno (< 0,2GB), não proporcional aos parâmetros', () => {
    comparacoes.forEach((c) => {
      assert.ok(c.custoMemoriaExtraGB < 0.2, `custo=${c.custoMemoriaExtraGB}GB`);
    });
  });

  console.log();
  console.log('== Testes: recomendação de rank mínimo ==');

  testar('com margem de 10%, recomenda rank 16 (só ele fica dentro da margem do melhor val loss)', () => {
    const r = recomendarRankMinimo(EXECUCOES_REAIS, 0.10);
    assert.equal(r.rank, 16);
  });

  testar('com margem de 60%, recomenda rank 8 (o menor que já entra na margem larga)', () => {
    const r = recomendarRankMinimo(EXECUCOES_REAIS, 0.60);
    assert.equal(r.rank, 8);
  });

  console.log();
  console.log('== Testes: comparação de quantização (bf16 vs. 4-bit / QLoRA de verdade) ==');

  testar('4-bit ocupa cerca de 65% menos espaço em disco que bf16, mesmo modelo', () => {
    const r = compararQuantizacao();
    assert.ok(Math.abs(r.reducaoDiscoPct - 65.0) < 1.0, `reducaoDiscoPct=${r.reducaoDiscoPct}`);
  });

  testar('4-bit reduz o pico de memória de treino em cerca de 61%', () => {
    const r = compararQuantizacao();
    assert.ok(Math.abs(r.reducaoMemTreinoPct - 61.3) < 1.0, `reducaoMemTreinoPct=${r.reducaoMemTreinoPct}`);
  });

  testar('o custo de val loss da quantização é pequeno (< 10%), não proporcional à economia de memória', () => {
    const r = compararQuantizacao();
    assert.ok(r.custoValLossPct < 10, `custoValLossPct=${r.custoValLossPct} deveria ser pequeno`);
  });

  console.log();
  console.log('== Testes: comparação de tipo de adaptação (LoRA vs. DoRA, mesmo rank 8) ==');

  testar('DoRA usa cerca de 7,5% mais parâmetros treináveis que LoRA no mesmo rank', () => {
    const r = compararTipoAdaptacao();
    assert.ok(Math.abs(r.razaoParametros - 1.075) < 0.02, `razaoParametros=${r.razaoParametros}`);
  });

  testar('DoRA custa memória extra de treino (entre 0,2 e 0,35GB a mais que LoRA no mesmo rank)', () => {
    const r = compararTipoAdaptacao();
    assert.ok(r.custoMemoriaExtraGB > 0.2 && r.custoMemoriaExtraGB < 0.35, `custoMemoriaExtraGB=${r.custoMemoriaExtraGB}`);
  });

  testar('nesta tarefa pequena e neste treino curto, DoRA empata com LoRA em val loss final, sem ganho', () => {
    const r = compararTipoAdaptacao();
    assert.equal(r.diferencaValLoss, 0, `diferencaValLoss=${r.diferencaValLoss} deveria ser 0 (empate)`);
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
  console.log('===== Trade-off real: rank do LoRA vs. parâmetros, memória, velocidade e qualidade =====\n');
  console.log('Mesmo dataset (157 exemplos), mesmo modelo (Gemma 4 E2B), mesmos hiperparâmetros,');
  console.log('só o rank muda. Três treinos reais, rodados nesta disciplina.\n');

  EXECUCOES_REAIS.forEach((c) => {
    console.log(`  Rank ${c.rank}:`);
    console.log(`    Parâmetros treináveis: ${(c.parametrosTreinaveis / 1e6).toFixed(3)}M (${c.percentualModelo}% do modelo)`);
    console.log(`    Val loss: ${c.valLossInicial} -> ${c.valLossFinal} (${calcularReducaoValLoss(c)}% de redução)`);
    console.log(`    Pico de memória: ${c.picoMemGB} GB`);
    console.log(`    Velocidade: ${c.itPorSegundoFinal} it/s`);
    console.log(`    Adaptador salvo: ${c.tamanhoAdapterMB} MB`);
    console.log();
  });

  const comparacoes = compararExecucoesSucessivas(EXECUCOES_REAIS);
  console.log('  --- O que cada dobra de rank custa e entrega ---');
  comparacoes.forEach((c) => {
    console.log(`  Rank ${c.deRank} -> ${c.paraRank}: parâmetros x${c.razaoParametros.toFixed(1)}, val loss melhora ${c.melhoriaValLoss} (${c.melhoriaPercentual}%), memória +${c.custoMemoriaExtraGB}GB`);
  });

  const recomendacao = recomendarRankMinimo(EXECUCOES_REAIS, 0.10);
  console.log(`\n  Recomendação (margem de 10% do melhor val loss): rank ${recomendacao.rank}`);
  console.log('  Aviso: recomendação medida em iters=20, o mesmo checkpoint que o Módulo 4.2 mostrou subtreinado (melhor iteração real = 90). Serve pra comparar a ordem entre os postos, não como valor final de produção.');

  console.log('\n===== QLoRA de verdade: o mesmo rank 8, contra o modelo pré-quantizado em 4-bit =====\n');
  const q = compararQuantizacao();
  const bf16 = COMPARACAO_QUANTIZACAO.bf16;
  const quatroBit = COMPARACAO_QUANTIZACAO['4bit'];
  console.log(`  bf16:  modelo em disco ${bf16.tamanhoModeloDiscoGB}GB, pico de memória no treino ${bf16.picoMemTreinoGB}GB, val loss final ${bf16.valLossFinal}`);
  console.log(`  4-bit: modelo em disco ${quatroBit.tamanhoModeloDiscoGB}GB, pico de memória no treino ${quatroBit.picoMemTreinoGB}GB, val loss final ${quatroBit.valLossFinal}`);
  console.log(`\n  Quantização economiza ${q.reducaoDiscoPct.toFixed(1)}% de disco e ${q.reducaoMemTreinoPct}% de pico de memória no treino,`);
  console.log(`  ao custo de ${q.custoValLoss} de val loss (${q.custoValLossPct}% pior - maior que a faixa de ruído entre execuções medida no Módulo 4.2 (~2,3%), então é custo real da quantização, não ruído).`);
  console.log('  Geração com o adaptador QLoRA contra o mesmo exemplo de teste: JSON correto, campo a campo,');
  console.log(`  com pico de memória de só ${quatroBit.picoMemGeracaoGB}GB.`);

  console.log('\n===== DoRA de verdade: o mesmo rank 8, weight-decomposed LoRA em vez de LoRA puro =====\n');
  const t = compararTipoAdaptacao();
  const lora = COMPARACAO_TIPO_ADAPTACAO.lora;
  const dora = COMPARACAO_TIPO_ADAPTACAO.dora;
  console.log(`  LoRA: ${(lora.parametrosTreinaveis / 1e6).toFixed(3)}M parâmetros, pico de memória ${lora.picoMemGB}GB, val loss final ${lora.valLossFinal}, adaptador ${lora.tamanhoAdapterMB}MB`);
  console.log(`  DoRA: ${(dora.parametrosTreinaveis / 1e6).toFixed(3)}M parâmetros, pico de memória ${dora.picoMemGB}GB, val loss final ${dora.valLossFinal}, adaptador ${dora.tamanhoAdapterMB}MB`);
  console.log(`\n  DoRA usa ${t.razaoParametros.toFixed(2)}x mais parâmetros treináveis e +${t.custoMemoriaExtraGB}GB de pico de memória,`);
  console.log(`  mas o val loss final empata exatamente, dentro da faixa de ruído entre execuções medida no`);
  console.log('  Módulo 4.2 (~2,3%). Neste treino pequeno (20 iterações) e nesta tarefa já simples pro modelo,');
  console.log('  o ganho que a literatura relata pra DoRA não aparece - ela descreve ganho em tarefa complexa');
  console.log('  e treino mais longo, não garantia universal.');
}

if (require.main === module) {
  rodarTestes();
  rodarDemo();
}

module.exports = {
  EXECUCOES_REAIS,
  COMPARACAO_QUANTIZACAO,
  COMPARACAO_TIPO_ADAPTACAO,
  calcularReducaoValLoss,
  compararExecucoesSucessivas,
  compararQuantizacao,
  compararTipoAdaptacao,
  recomendarRankMinimo,
};

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
