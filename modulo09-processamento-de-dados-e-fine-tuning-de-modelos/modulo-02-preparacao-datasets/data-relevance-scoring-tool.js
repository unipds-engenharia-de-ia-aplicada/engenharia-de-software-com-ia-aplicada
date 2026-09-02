/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 2.1
 *
 * Ferramenta: Identificando Dado Relevante -- antes de coletar e extrair
 * qualquer documento, aplica um gate de 4 perguntas pra decidir se aquele
 * candidato a fonte de dado vale a pena entrar no pipeline de extração.
 *
 * Fundamento de mercado (não é método inventado): o princípio de Data-Centric
 * AI de Andrew Ng -- definir critério sistemático de qualidade, relevância e
 * representatividade dos dados, em vez de coletar tudo que existir -- e o
 * paper LIMA (Zhou et al. 2023, Meta/CMU/USC/Tel Aviv, arXiv 2305.11206):
 * 1.000 exemplos cuidadosamente curados superaram uma reprodução do Alpaca
 * com 52.000 exemplos, e bateram o DaVinci003 da OpenAI treinado com RLHF em
 * preferência humana. A lição prática: curadoria de fonte bate volume bruto.
 *
 * Uso: node data-relevance-scoring-tool.js
 * Aplica o gate contra 7 candidatos reais de documento pra Amplitude
 * Seguros (4 pro caso Auto, 3 pro caso Saúde Empresarial), incluindo
 * candidatos plausíveis que são REJEITADOS, não só os que já escolhemos.
 */

'use strict';

const assert = require('assert').strict;

const CRITERIOS = {
  contemGroundTruth: 'Contém o ground truth da tarefa (entrada real + resposta correta observável)?',
  producaoReal: 'Vem do fluxo real de produção, não é exemplo sintético ou hipotético?',
  cobreVariacao: 'Cobre a variação real de formato e situação que a tarefa tem, não só o caso fácil?',
  passaCompliance: 'Passa no crivo de sensibilidade e compliance pra ser usado em treino?',
};

const CHAVES_CRITERIOS = Object.keys(CRITERIOS);

/**
 * Avalia um candidato a fonte de dado contra os 4 critérios. Gate estrito:
 * os 4 precisam ser verdadeiros pro candidato ser aceito -- mesma lógica do
 * framework de decisão do Módulo 1, aplicada agora à seleção de fonte, não
 * à decisão de treinar.
 */
function avaliarCandidato(candidato) {
  const falhas = CHAVES_CRITERIOS.filter((chave) => !candidato.criterios[chave]);
  return {
    aceito: falhas.length === 0,
    criteriosFalhos: falhas,
  };
}

const CANDIDATOS = [
  {
    id: 'orcamento-oficina',
    caso: 'amplitude-auto',
    nome: 'Orçamento de oficina',
    criterios: { contemGroundTruth: true, producaoReal: true, cobreVariacao: true, passaCompliance: true },
    justificativa: 'Contém segurado, placa e valor em texto real, vem de sinistros já processados, varia de formato entre oficinas, sem dado sensível.',
  },
  {
    id: 'boletim-ocorrencia',
    caso: 'amplitude-auto',
    nome: 'Boletim de ocorrência policial',
    criterios: { contemGroundTruth: false, producaoReal: true, cobreVariacao: true, passaCompliance: true },
    justificativa: 'É narrativa de ocorrência, não traz segurado/placa/valor em formato consistente o bastante pra servir de resposta correta da tarefa.',
  },
  {
    id: 'foto-veiculo-danificado',
    caso: 'amplitude-auto',
    nome: 'Foto do veículo danificado',
    criterios: { contemGroundTruth: false, producaoReal: true, cobreVariacao: false, passaCompliance: true },
    justificativa: 'É imagem do dano, não do documento com os campos-alvo; não serve de par texto-entrada/texto-saída pra esta tarefa de extração.',
  },
  {
    id: 'transcricao-ligacao',
    caso: 'amplitude-auto',
    nome: 'Transcrição da ligação de abertura de sinistro',
    criterios: { contemGroundTruth: true, producaoReal: true, cobreVariacao: false, passaCompliance: true },
    justificativa: 'Tem os dados, mas a estrutura da ligação varia demais de atendente pra atendente pra servir de exemplo confiável de formato.',
  },
  {
    id: 'recibo-medico',
    caso: 'amplitude-saude-empresarial',
    nome: 'Recibo médico',
    criterios: { contemGroundTruth: true, producaoReal: true, cobreVariacao: true, passaCompliance: true },
    justificativa: 'Contém beneficiário, procedimento e valor, vem de reembolsos já processados, varia entre clínicas, e o dado sensível é tratável com o rastro de auditoria já desenhado no schema.',
  },
  {
    id: 'prontuario-medico-completo',
    caso: 'amplitude-saude-empresarial',
    nome: 'Prontuário médico completo',
    criterios: { contemGroundTruth: true, producaoReal: true, cobreVariacao: true, passaCompliance: false },
    justificativa: 'Traz dado clínico muito além do necessário pra extrair beneficiário/procedimento/valor; viola minimização de dado exigida pela LGPD pra essa tarefa específica.',
  },
  {
    id: 'cadastro-beneficiarios',
    caso: 'amplitude-saude-empresarial',
    nome: 'Cadastro de beneficiários',
    criterios: { contemGroundTruth: false, producaoReal: true, cobreVariacao: true, passaCompliance: true },
    justificativa: 'É tabela de referência (titular/dependente), não um par entrada-saída de extração; útil pra cruzamento, não pra treinar o extrator em si.',
  },
];

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
  console.log('== Testes: gate de 4 critérios ==');

  testar('candidato com os 4 critérios verdadeiros é aceito', () => {
    const r = avaliarCandidato({ criterios: { contemGroundTruth: true, producaoReal: true, cobreVariacao: true, passaCompliance: true } });
    assert.equal(r.aceito, true);
    assert.deepEqual(r.criteriosFalhos, []);
  });

  testar('candidato sem ground truth é rejeitado', () => {
    const r = avaliarCandidato({ criterios: { contemGroundTruth: false, producaoReal: true, cobreVariacao: true, passaCompliance: true } });
    assert.equal(r.aceito, false);
    assert.deepEqual(r.criteriosFalhos, ['contemGroundTruth']);
  });

  testar('candidato que falha compliance é rejeitado mesmo com os outros 3 verdadeiros', () => {
    const r = avaliarCandidato({ criterios: { contemGroundTruth: true, producaoReal: true, cobreVariacao: true, passaCompliance: false } });
    assert.equal(r.aceito, false);
    assert.deepEqual(r.criteriosFalhos, ['passaCompliance']);
  });

  console.log();
  console.log('== Testes: aplicação aos 7 candidatos reais da Amplitude Seguros ==');

  const resultados = CANDIDATOS.map((c) => ({ candidato: c, resultado: avaliarCandidato(c) }));

  const esperadoAceito = {
    'orcamento-oficina': true,
    'boletim-ocorrencia': false,
    'foto-veiculo-danificado': false,
    'transcricao-ligacao': false,
    'recibo-medico': true,
    'prontuario-medico-completo': false,
    'cadastro-beneficiarios': false,
  };

  resultados.forEach(({ candidato, resultado }) => {
    testar(`${candidato.id}: aceito=${esperadoAceito[candidato.id]}`, () => {
      assert.equal(resultado.aceito, esperadoAceito[candidato.id]);
    });
  });

  testar('exatamente 2 dos 7 candidatos são aceitos (os que já usamos no pipeline)', () => {
    const aceitos = resultados.filter((r) => r.resultado.aceito);
    assert.equal(aceitos.length, 2);
    assert.deepEqual(aceitos.map((r) => r.candidato.id).sort(), ['orcamento-oficina', 'recibo-medico']);
  });

  console.log();
  console.log(
    `Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ` +
      `${testesComFalha} falhou(falharam).`
  );

  if (testesComFalha > 0) {
    throw new Error(`${testesComFalha} teste(s) falharam. A implementação não bate com a especificação.`);
  }

  return resultados;
}

/* --------------------------------------------------------------------------
 * Demo
 * -------------------------------------------------------------------------- */

function rodarDemo(resultados) {
  console.log();
  console.log('===== Demo: gate de relevância aplicado a 7 candidatos reais de documento =====');

  ['amplitude-auto', 'amplitude-saude-empresarial'].forEach((caso) => {
    console.log(`\n--- ${caso} ---`);
    resultados
      .filter((r) => r.candidato.caso === caso)
      .forEach(({ candidato, resultado }) => {
        const status = resultado.aceito ? 'ACEITO' : 'REJEITADO';
        console.log(`\n  [${status}] ${candidato.nome}`);
        CHAVES_CRITERIOS.forEach((chave) => {
          const passou = candidato.criterios[chave];
          console.log(`    ${passou ? 'v' : 'x'} ${CRITERIOS[chave]}`);
        });
        console.log(`    -> ${candidato.justificativa}`);
      });
  });

  console.log('\n-----------------------------------------------------------------------------');
  console.log('De 7 candidatos plausíveis, só 2 passam: orçamento de oficina e recibo médico --');
  console.log('exatamente os que o pipeline de extração deste vídeo usa. Identificar dado');
  console.log('relevante é filtrar antes de coletar, não aceitar tudo que existir no arquivo.');
  console.log('-----------------------------------------------------------------------------');
}

if (require.main === module) {
  const resultados = rodarTestes();
  rodarDemo(resultados);
}

module.exports = { avaliarCandidato, CRITERIOS, CANDIDATOS };

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
