/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 3.2
 *
 * Callback real pros Módulos 1.2 e 1.3: no Módulo 1.2, o framework de 4
 * perguntas concluiu, na mão, que Amplitude Saúde Empresarial reprovava só
 * por dado (p3 vermelha). No Módulo 1.3, rodando o código de verdade,
 * p3 = 0,35 (abaixo do limiarVerde = 0,6), e a Real Options recomendava
 * esperar 9 meses acumulando volume antes de treinar.
 *
 * Este script não inventa uma decisão nova. Ele reabre o MESMO tool do
 * Módulo 1.3 (decision-framework-tool.js, sem duplicar nenhuma lógica),
 * com o caso Saúde Empresarial atualizado pros 9 meses que se passaram --
 * usando exatamente a taxa de crescimento de score que o Módulo 1.3 já
 * tinha usado (taxaCrescimentoScorePorMes = 0,03/mês, do bloco
 * opcaoReal do próprio caso). Se o job real do Módulo 3.2 inclui Saúde
 * Empresarial no treino, é porque esse recálculo, rodado com o mesmo
 * critério, agora aprova o caso -- não porque o critério mudou.
 *
 * Uso: node reavaliacao-saude-empresarial.js
 *
 * Par oficial desta disciplina: reavaliacao-saude-empresarial.js (oficial) /
 * reavaliacao_saude_empresarial.py (referência espelhada).
 */

'use strict';

const assert = require('assert').strict;
const path = require('path');

const {
  avaliarFramework,
  derivarPesosAHP,
  carregarConfiguracao,
  RECOMENDACAO,
  PERGUNTAS,
  CHAVES_PERGUNTAS,
} = require(path.join(__dirname, '..', 'modulo-01-decision-framework', 'decision-framework-tool.js'));

const MESES_DECORRIDOS = 9;

/**
 * Deriva o caso "9 meses depois" a partir do caso original do Módulo 1.2,
 * sem hardcodar nenhum número novo: p3 evolui pela taxa de crescimento de
 * score já projetada em opcaoReal, e o volume evolui pela mesma taxa de
 * crescimento mensal (moda) já usada no cálculo financeiro original.
 */
function construirCasoNoveMesesDepois(casoOriginal) {
  const { taxaCrescimentoScorePorMes } = casoOriginal.financeiro.opcaoReal;
  const p3Atualizado = Number(
    (casoOriginal.scores.p3 + taxaCrescimentoScorePorMes * MESES_DECORRIDOS).toFixed(2)
  );
  const fatorCrescimentoVolume = (1 + casoOriginal.financeiro.crescimentoMensal.moda) ** MESES_DECORRIDOS;
  const volumeAtualizado = Math.round(casoOriginal.financeiro.volumeInicialMensal * fatorCrescimentoVolume);

  return {
    ...casoOriginal,
    scores: { ...casoOriginal.scores, p3: p3Atualizado },
    financeiro: { ...casoOriginal.financeiro, volumeInicialMensal: volumeAtualizado },
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

function rodarTestes(config) {
  const pesosAHP = derivarPesosAHP(config.ahp.matriz);
  const { limiarVerde, casos } = config;
  const casoOriginal = casos.find((c) => c.id === 'amplitude-saude-empresarial');
  const casoAtualizado = construirCasoNoveMesesDepois(casoOriginal);

  console.log('== Testes: reavaliação de Amplitude Saúde Empresarial, 9 meses depois ==');

  const resultadoOriginal = avaliarFramework(casoOriginal.scores, pesosAHP, limiarVerde);
  const resultadoAtualizado = avaliarFramework(casoAtualizado.scores, pesosAHP, limiarVerde);

  testar('caso original (Módulo 1.3): reprova só por dado', () => {
    assert.equal(resultadoOriginal.aprovado, false);
    assert.equal(resultadoOriginal.falhaSoDado, true);
  });

  testar('caso atualizado (9 meses depois): p3 cruza o limiarVerde', () => {
    assert.ok(casoAtualizado.scores.p3 >= limiarVerde, `p3=${casoAtualizado.scores.p3}, limiar=${limiarVerde}`);
  });

  testar('caso atualizado: aprovado no gate, nenhuma pergunta falha', () => {
    assert.equal(resultadoAtualizado.aprovado, true);
    assert.deepEqual(resultadoAtualizado.perguntasFalhas, []);
  });

  testar('só p3 mudou -- p1, p2 e p4 continuam com o mesmo score do Módulo 1.3', () => {
    assert.equal(casoAtualizado.scores.p1, casoOriginal.scores.p1);
    assert.equal(casoAtualizado.scores.p2, casoOriginal.scores.p2);
    assert.equal(casoAtualizado.scores.p4, casoOriginal.scores.p4);
  });

  testar('o volume atualizado é maior que o original, coerente com 9 meses de crescimento real', () => {
    assert.ok(casoAtualizado.financeiro.volumeInicialMensal > casoOriginal.financeiro.volumeInicialMensal);
  });

  console.log();
  console.log(
    `Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), `
    + `${testesComFalha} falhou(falharam).`
  );

  if (testesComFalha > 0) {
    throw new Error(`${testesComFalha} teste(s) falharam. A implementação não bate com a especificação.`);
  }

  return {
    pesosAHP, limiarVerde, casoOriginal, casoAtualizado, resultadoOriginal, resultadoAtualizado,
  };
}

/* --------------------------------------------------------------------------
 * Demo
 * -------------------------------------------------------------------------- */

function imprimirComparacao({
  limiarVerde, casoOriginal, casoAtualizado, resultadoOriginal, resultadoAtualizado,
}) {
  console.log();
  console.log('===== Reavaliação: Amplitude Saúde Empresarial, 9 meses depois do Módulo 1.3 =====\n');

  console.log(`  Limiar verde: ${limiarVerde}\n`);
  console.log('  --- Módulo 1.3 (o que vimos) ---');
  CHAVES_PERGUNTAS.forEach((chave, i) => {
    const s = resultadoOriginal.sinaisPorPergunta[chave];
    console.log(`  Pergunta ${i + 1} [${s.sinal}, score ${s.score.toFixed(2)}]: ${PERGUNTAS[chave]}`);
  });
  console.log(`  Volume mensal: ${casoOriginal.financeiro.volumeInicialMensal}`);
  console.log(`  Recomendação: ${resultadoOriginal.recomendacao}\n`);

  console.log(`  --- Módulo 3.2 (${MESES_DECORRIDOS} meses depois) ---`);
  CHAVES_PERGUNTAS.forEach((chave, i) => {
    const s = resultadoAtualizado.sinaisPorPergunta[chave];
    console.log(`  Pergunta ${i + 1} [${s.sinal}, score ${s.score.toFixed(2)}]: ${PERGUNTAS[chave]}`);
  });
  console.log(`  Volume mensal: ${casoAtualizado.financeiro.volumeInicialMensal}`);
  console.log(`  Recomendação: ${resultadoAtualizado.recomendacao}`);

  console.log('\n-----------------------------------------------------------------------------');
  console.log('Mesmo tool, mesmo caso, mesmo limiar. O que mudou foi o dado: 9 meses de volume');
  console.log('real acumulado. A pergunta 3 cruzou o limiarVerde, e nenhuma outra pergunta');
  console.log('regrediu. O gate aprova agora pelo mesmo critério que reprovava antes -- essa é');
  console.log('a diferença entre "esperar" (Módulo 1.3) e "decidir de novo com dado novo" (aqui).');
  console.log('-----------------------------------------------------------------------------');
}

if (require.main === module) {
  const config = carregarConfiguracao();
  const resultado = rodarTestes(config);
  imprimirComparacao(resultado);
}

module.exports = {
  construirCasoNoveMesesDepois,
  MESES_DECORRIDOS,
};

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
