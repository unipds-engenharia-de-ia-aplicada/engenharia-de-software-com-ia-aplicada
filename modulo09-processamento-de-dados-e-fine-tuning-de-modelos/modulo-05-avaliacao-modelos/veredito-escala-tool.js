/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 5.4
 *
 * Fecha o arco do Módulo 5: reabre o MESMO gate de 4 perguntas do Módulo
 * 1.3 (decision-framework-tool.js) e a MESMA reavaliação de Saúde
 * Empresarial do Módulo 3.2 (reavaliacao-saude-empresarial.js), sem
 * duplicar nenhuma lógica -- e soma um checklist de graduação com os
 * números REAIS já medidos nos Módulos 5.1, 5.2 e 5.3. Nenhum número
 * novo é inventado aqui: os cinco critérios abaixo só repetem o que já
 * foi rodado nos Módulos 5.1, 5.2 e 5.3.
 *
 * Nota de robustez -- dois dos cinco critérios (bate-generico e
 * junto-bate-separado) envolvem uma chamada de LLM não 100% determinística.
 * Os valores abaixo não vêm de uma execução única: foram remedidos com N=20
 * chamadas reais repetidas contra os mesmos endpoints do Módulo 5.2, e o
 * critério usa o valor mais conservador da faixa observada (o pior caso pro
 * lado que precisa vencer a comparação), não uma média nem um instantâneo
 * de sorte.
 *
 * Uso: node veredito-escala-tool.js
 *
 * Par oficial desta disciplina: veredito-escala-tool.js (oficial) /
 * veredito_escala_tool.py (referência espelhada).
 */

'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

const {
  carregarConfiguracao,
  derivarPesosAHP,
  avaliarCasoCompleto,
  CHAVES_PERGUNTAS,
} = require(path.join(__dirname, '..', 'modulo-01-decision-framework', 'decision-framework-tool.js'));

const {
  construirCasoNoveMesesDepois,
} = require(path.join(__dirname, '..', 'modulo-03-fine-tuning-via-api', 'reavaliacao-saude-empresarial.js'));

/* --------------------------------------------------------------------------
 * Checklist de graduação -- definido ANTES de checar, pra não virar
 * racionalização a posteriori. Os cinco critérios vêm, sem alteração, dos
 * Módulos 5.1-5.3 -- mas o RESULTADO medido não é mais copiado à mão pra um
 * literal aqui. Cada harness de origem grava seu próprio ledger
 * (resultado-medido.json, ao lado dele) quando roda de verdade;
 * carregarCriteriosGraduacao() lê esses ledgers como fonte única de
 * verdade, e só cai pro valor fixado abaixo (evidência histórica, a mesma
 * publicada no TP/slide) se o ledger ainda não existir -- com aviso.
 *
 * Nesta pasta (achatada), os quatro harnesses de origem e este arquivo
 * moram juntos -- então o ledger é o MESMO resultado-medido.json pros
 * cinco critérios, cada harness só grava a própria chave nele.
 * -------------------------------------------------------------------------- */

const LEDGER = path.join(__dirname, 'resultado-medido.json');

const METADATA_CRITERIOS = [
  {
    id: 'baseline',
    descricao: 'Precisão em dado nunca visto, mesmo formato do treino',
    limiar: '>= 95%',
    limiarPct: 95,
    ledger: LEDGER,
    fonte: path.join(__dirname, 'model-evaluation-harness-tool.js'),
    fallback: {
      medido: '100% (11/11 schema válido, precisão média por campo)',
      medidoPct: 100,
      origem: 'Módulo 5.1',
    },
  },
  {
    id: 'bate-generico',
    descricao: 'Bate o modelo genérico no mesmo teste retido (schema + precisão)',
    limiar: 'schema e precisão maiores que o genérico, mesmo no melhor caso observado do genérico',
    ledger: LEDGER,
    fonte: path.join(__dirname, 'ab-and-domain-tradeoff-tool.js'),
    fallback: {
      comparacao: { finetunado: 100, generico: 72.7 },
      medido: '11/11 vs. 0/11 schema sem hint; 100% vs. 72,7% precisão com hint no melhor caso observado '
        + '(N=20 execuções reais: média 61,8%, mínimo 54,5%, máximo 72,7%)',
      origem: 'Módulo 5.2 (reconfirmado com N=20 repetições reais)',
    },
  },
  {
    id: 'junto-bate-separado',
    descricao: 'Treinar os domínios juntos generaliza tão bem ou melhor que separado',
    limiar: 'conjunto >= separado, nos dois domínios',
    ledger: LEDGER,
    fonte: path.join(__dirname, 'ab-and-domain-tradeoff-tool.js'),
    fallback: {
      comparacao: {
        conjuntoAuto: 100, separadoAuto: 100, conjuntoSaude: 100, separadoSaude: 0,
      },
      medido: 'Auto 100% vs. 100% (empate, estável em N=20 chamadas reais repetidas); '
        + 'Saúde Empresarial 100% vs. 0%',
      origem: 'Módulo 5.2 (Auto reconfirmado com N=20 repetições reais)',
    },
  },
  {
    id: 'robusto-formato',
    descricao: 'Robusto a variação de formato realista, fora do gerador determinístico',
    limiar: '>= 95%',
    limiarPct: 95,
    ledger: LEDGER,
    fonte: path.join(__dirname, 'overfitting-stress-test-tool.js'),
    fallback: {
      medido: '100% (depois do fix do harness, zero queda contra o baseline)',
      medidoPct: 100,
      origem: 'Módulo 5.3 (round 1)',
    },
  },
  {
    id: 'robusto-estrutura',
    descricao: 'Robusto a variação estrutural, genuinamente fora da distribuição de treino',
    limiar: '>= 90% (limiar mais baixo que os outros -- variação estrutural é teste mais difícil por desenho)',
    limiarPct: 90,
    ledger: LEDGER,
    fonte: path.join(__dirname, 'overfitting-stress-test-tool.js'),
    fallback: {
      medido: '100% (N=58 execuções, zero erros; uma checagem inicial com N=3 sugeriu um erro de '
        + 'fraseado que não se confirmou em amostra maior)',
      medidoPct: 100,
      origem: 'Módulo 5.3 (round 2, N=58)',
    },
  },
];

/**
 * Lê o ledger de cada critério (gravado pelo harness de origem quando roda
 * de verdade); cai pro valor histórico fixado (fallback) se o ledger ainda
 * não existir. Nos dois casos, avisa -- ledger ausente é esperado antes da
 * primeira remedição, harness mais novo que o ledger é sinal de possível
 * desatualização.
 */
function carregarCriteriosGraduacao() {
  return METADATA_CRITERIOS.map((meta) => {
    let dados = null;
    try {
      const conteudo = JSON.parse(fs.readFileSync(meta.ledger, 'utf8'));
      if (conteudo[meta.id]) dados = conteudo[meta.id];
    } catch (erro) {
      if (erro.code !== 'ENOENT') throw erro;
    }

    if (!dados) {
      console.log(`[AVISO] "${meta.id}": ledger não encontrado (${path.relative(__dirname, meta.ledger)}), usando evidência histórica fixada. Rode ${path.basename(meta.fonte)} pra medir de verdade e gerar o ledger.`);
      dados = meta.fallback;
    } else if (dados.medidoEm) {
      try {
        const mtimeFonte = fs.statSync(meta.fonte).mtime;
        if (mtimeFonte > new Date(`${dados.medidoEm}T23:59:59`)) {
          console.log(`[AVISO] "${meta.id}": ${path.basename(meta.fonte)} foi modificado depois da última medição registrada (${dados.medidoEm}) -- considere remedir antes de confiar neste número.`);
        }
      } catch (erro) {
        if (erro.code !== 'ENOENT') throw erro;
      }
    }

    return {
      id: meta.id,
      descricao: meta.descricao,
      limiar: meta.limiar,
      limiarPct: meta.limiarPct,
      medido: dados.medido,
      medidoPct: dados.medidoPct,
      comparacao: dados.comparacao,
      origem: dados.origem,
    };
  });
}

/**
 * Computa passou/falhou a partir dos números medidos abaixo. Critérios com
 * limiarPct comparam número contra número; os dois critérios comparativos
 * (bate-generico, junto-bate-separado) comparam par a par os valores em
 * `comparacao` -- valores que, nesses dois casos, vêm de N=20 remedições
 * reais, não de uma execução única (ver nota de robustez no cabeçalho).
 */
function avaliarCriterio(criterio) {
  if (criterio.limiarPct !== undefined) {
    return criterio.medidoPct >= criterio.limiarPct;
  }
  if (criterio.id === 'bate-generico') {
    return criterio.comparacao.finetunado > criterio.comparacao.generico;
  }
  if (criterio.id === 'junto-bate-separado') {
    const c = criterio.comparacao;
    return c.conjuntoAuto >= c.separadoAuto && c.conjuntoSaude >= c.separadoSaude;
  }
  throw new Error(`critério "${criterio.id}" não tem regra de avaliação definida`);
}

function avaliarGraduacao() {
  const criteriosComputados = carregarCriteriosGraduacao().map((c) => ({ ...c, passou: avaliarCriterio(c) }));
  const passaram = criteriosComputados.filter((c) => c.passou);
  return {
    graduado: passaram.length === criteriosComputados.length,
    criterios: criteriosComputados,
    passou: passaram.length,
    total: criteriosComputados.length,
  };
}

/* --------------------------------------------------------------------------
 * Veredito por caso: AHP + governança (Módulo 1.3/3.2) combinado com o
 * checklist de graduação (Módulo 5.1-5.3) -- só os dois juntos aprovam
 * escalar. Casos fora do escopo medido pelo Módulo 5 (tarefa
 * estruturalmente diferente da extração testada) não herdam a evidência.
 * -------------------------------------------------------------------------- */

function avaliarVereditoCaso(nome, gate, graduacao, cobertoPelaEvidencia) {
  if (!gate.aprovado) {
    return {
      nome,
      gateAprovado: false,
      escalar: false,
      motivo: gate.bloqueadoPorGovernanca
        ? `bloqueado por governança: ${gate.motivosGovernanca.join('; ')}`
        : `gate reprovado, pergunta(s) ${gate.perguntasFalhas.join(', ')} vermelha(s)`,
    };
  }
  if (!cobertoPelaEvidencia) {
    return {
      nome,
      gateAprovado: true,
      escalar: null,
      motivo: 'gate aprovado, mas fora do escopo medido: os Módulos 5.1-5.3 testaram extração estruturada, não esta tarefa',
    };
  }
  return {
    nome,
    gateAprovado: true,
    escalar: graduacao.graduado,
    motivo: graduacao.graduado
      ? `graduado: ${graduacao.passou}/${graduacao.total} critérios medidos passaram`
      : `gate aprovado, mas só ${graduacao.passou}/${graduacao.total} critérios de graduação passaram`,
  };
}

function avaliarVeredito(config) {
  const pesosAHP = derivarPesosAHP(config.ahp.matriz);
  const { limiarVerde, casos } = config;

  const auto = casos.find((c) => c.id === 'amplitude-auto');
  const saudeOriginal = casos.find((c) => c.id === 'amplitude-saude-empresarial');
  const saudeAtualizada = construirCasoNoveMesesDepois(saudeOriginal);
  const atendimento = casos.find((c) => c.id === 'amplitude-atendimento-cliente');

  const gateAuto = avaliarCasoCompleto(auto, pesosAHP, limiarVerde);
  const gateSaude = avaliarCasoCompleto(saudeAtualizada, pesosAHP, limiarVerde);
  const gateAtendimento = avaliarCasoCompleto(atendimento, pesosAHP, limiarVerde);

  const graduacao = avaliarGraduacao();

  return {
    graduacao,
    casos: {
      auto: { gate: gateAuto, veredito: avaliarVereditoCaso('Amplitude Auto', gateAuto, graduacao, true) },
      saude: { gate: gateSaude, veredito: avaliarVereditoCaso('Amplitude Saúde Empresarial', gateSaude, graduacao, true) },
      atendimento: { gate: gateAtendimento, veredito: avaliarVereditoCaso('Amplitude Atendimento ao Cliente', gateAtendimento, graduacao, false) },
    },
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
  console.log('== Testes: veredito de escala, Módulo 5.4 ==');
  const resultado = avaliarVeredito(config);

  testar('checklist de graduação: 5 de 5 critérios medidos passam', () => {
    assert.equal(resultado.graduacao.passou, 5);
    assert.equal(resultado.graduacao.total, 5);
    assert.equal(resultado.graduacao.graduado, true);
  });

  testar('Amplitude Auto: gate aprovado e graduado, escalar = true', () => {
    assert.equal(resultado.casos.auto.veredito.gateAprovado, true);
    assert.equal(resultado.casos.auto.veredito.escalar, true);
  });

  testar('Amplitude Saúde Empresarial (caso atualizado): gate aprovado e graduado, escalar = true', () => {
    assert.equal(resultado.casos.saude.veredito.gateAprovado, true);
    assert.equal(resultado.casos.saude.veredito.escalar, true);
  });

  testar('Amplitude Atendimento ao Cliente: gate ainda reprovado (p1 e p4 vermelhas)', () => {
    assert.equal(resultado.casos.atendimento.veredito.gateAprovado, false);
    assert.equal(resultado.casos.atendimento.veredito.escalar, false);
    assert.deepEqual(resultado.casos.atendimento.gate.perguntasFalhas, [1, 4]);
  });

  console.log();
  console.log(
    `Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), `
    + `${testesComFalha} falhou(falharam).`
  );

  if (testesComFalha > 0) {
    throw new Error(`${testesComFalha} teste(s) falharam. A implementação não bate com a especificação.`);
  }

  return resultado;
}

/* --------------------------------------------------------------------------
 * Demo
 * -------------------------------------------------------------------------- */

function imprimirVeredito(resultado) {
  console.log();
  console.log('===== Veredito de Escala: Módulo 5.4 =====\n');

  console.log('--- Checklist de graduação (Módulos 5.1-5.3) ---');
  resultado.graduacao.criterios.forEach((c, i) => {
    console.log(`  ${i + 1}. [${c.passou ? 'PASSOU' : 'FALHOU'}] ${c.descricao} (${c.origem})`);
    console.log(`     limiar: ${c.limiar} · medido: ${c.medido}`);
  });
  console.log(`\n  Graduação: ${resultado.graduacao.passou}/${resultado.graduacao.total}, ${resultado.graduacao.graduado ? 'GRADUADO' : 'NÃO GRADUADO'}\n`);

  Object.values(resultado.casos).forEach(({ gate, veredito }) => {
    console.log(`--- ${veredito.nome} ---`);
    if (gate.bloqueadoPorGovernanca) {
      console.log('  Bloqueado por governança.');
    } else {
      CHAVES_PERGUNTAS.forEach((chave, i) => {
        const s = gate.sinaisPorPergunta[chave];
        console.log(`  Pergunta ${i + 1} [${s.sinal}, score ${s.score.toFixed(2).replace('.', ',')}]`);
      });
    }
    console.log(`  Escalar: ${veredito.escalar === null ? 'FORA DE ESCOPO' : veredito.escalar ? 'SIM' : 'NÃO'}`);
    console.log(`  Motivo: ${veredito.motivo}\n`);
  });

  console.log('-----------------------------------------------------------------------------');
  console.log('Amplitude Auto e Saúde Empresarial: gate aprovado desde o Módulo 1.3/3.2, e agora');
  console.log('também graduados pela evidência medida do Módulo 5. Escalar pro Módulo 6 significa');
  console.log('transformar ESTE piloto já aprovado, com esta evidência medida, num fluxo de uso');
  console.log('prático de verdade, não supor que o resultado se transfere de graça. Atendimento ao Cliente continua bloqueado pelo');
  console.log('mesmo motivo estrutural do Módulo 1.3: a evidência do Módulo 5 nunca testou essa');
  console.log('tarefa, e não pode ser usada pra reverter esse veredito.');
  console.log('-----------------------------------------------------------------------------');
}

if (require.main === module) {
  try {
    const config = carregarConfiguracao();
    const resultado = rodarTestes(config);
    imprimirVeredito(resultado);
  } catch (erro) {
    console.error(`\nErro: ${erro.message}`);
    if (!/teste\(s\) falharam/.test(erro.message)) {
      console.error('Verifique se amplitude-seguros-casos.json existe e está bem formado, e se resultado-medido.json (quando presente) não está corrompido, e tente de novo.');
    }
    if (process.env.DEBUG) {
      console.error(erro.stack);
    }
    process.exitCode = 1;
  }
}

module.exports = {
  carregarCriteriosGraduacao,
  avaliarGraduacao,
  avaliarVeredito,
};

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
