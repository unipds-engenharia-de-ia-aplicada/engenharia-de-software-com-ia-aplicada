/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 3.2
 *
 * Ferramenta: Conversão do schema canônico pro formato de fine-tuning
 * supervisionado da Vertex AI / Gemini Enterprise Agent Platform
 * (contents/role/parts), e acompanhamento real de job via a API REST
 * do aiplatform.googleapis.com.
 *
 * O job consultado aqui já rodou de verdade antes desta gravação:
 * tuningJobs/4180970763655839744, 200 exemplos reais (120 Amplitude Auto +
 * 80 Amplitude Saúde Empresarial), gerados pelo mesmo pipeline formal do
 * Módulo 2.2 (MinHash+LSH, amostragem por temperatura, entropia de Shannon),
 * só que escalado pro volume que um job de treino de verdade pede. Consultar
 * o status de um job já concluído não gera custo de treino novo.
 *
 * Uso: node dataset-upload-and-tracking-tool.js
 */

'use strict';

const assert = require('assert').strict;
const { execSync } = require('child_process');

const PROJETO = 'amplitude-seguros-demo';
const REGIAO = 'us-central1';
const NOME_JOB = 'projects/113512199474/locations/us-central1/tuningJobs/4180970763655839744';

/* --------------------------------------------------------------------------
 * 1. Conversão do schema canônico pro formato Gemini
 * -------------------------------------------------------------------------- */

function validarExemplo(exemplo) {
  if (!exemplo.instrucao || typeof exemplo.instrucao !== 'string') {
    throw new Error('exemplo sem instrucao valida');
  }
  if (!exemplo.entrada || typeof exemplo.entrada !== 'string') {
    throw new Error('exemplo sem entrada valida');
  }
  if (!exemplo.saida || typeof exemplo.saida !== 'object') {
    throw new Error('exemplo sem saida valida');
  }
}

/**
 * Converte um exemplo do schema canônico (instrucao/entrada/saida/metadata,
 * o mesmo dos Módulos 2.1 e 2.2) pro formato que a Vertex AI espera pra
 * fine-tuning supervisionado: uma lista de turnos com role e parts.
 */
function converterParaFormatoGemini(exemplo) {
  validarExemplo(exemplo);
  const textoUsuario = `${exemplo.instrucao}\n\n${exemplo.entrada}`;
  const textoModelo = JSON.stringify(exemplo.saida);
  return {
    contents: [
      { role: 'user', parts: [{ text: textoUsuario }] },
      { role: 'model', parts: [{ text: textoModelo }] },
    ],
  };
}

/* --------------------------------------------------------------------------
 * 1.5. Gate de confiança de OCR (promessa do Módulo 2.1: o campo
 * metadata.confiancaOcr decide se um exemplo precisa de revisão humana
 * antes de entrar no treino). Só se aplica a exemplo que passou por OCR
 * de verdade (tem confiancaOcr no metadata); exemplo gerado por texto
 * sintético, como o dataset de 200 deste job, não tem confiança de OCR
 * porque nunca foi escaneado, e por isso passa direto, sem gate.
 * -------------------------------------------------------------------------- */

const LIMIAR_CONFIANCA_OCR_PADRAO = 0.85;

/**
 * Separa exemplos em três grupos: aprovados (confiança >= limiar, ou sem
 * OCR envolvido), sinalizados para revisão humana (confiança < limiar), e
 * o subconjunto dos aprovados que não passou pelo gate por não ter
 * confiancaOcr no metadata (rastreável separadamente pra transparência).
 */
function filtrarPorConfiancaOcr(exemplos, limiar = LIMIAR_CONFIANCA_OCR_PADRAO) {
  const semConfianca = [];
  const aprovadosPorOcr = [];
  const sinalizadosParaRevisao = [];

  for (const exemplo of exemplos) {
    const confianca = exemplo.metadata && exemplo.metadata.confiancaOcr;
    if (confianca === undefined || confianca === null) {
      semConfianca.push(exemplo);
    } else if (confianca >= limiar) {
      aprovadosPorOcr.push(exemplo);
    } else {
      sinalizadosParaRevisao.push(exemplo);
    }
  }

  return {
    aprovados: [...aprovadosPorOcr, ...semConfianca],
    aprovadosPorOcr,
    semConfianca,
    sinalizadosParaRevisao,
    limiar,
  };
}

/* --------------------------------------------------------------------------
 * 2. Acompanhamento real do job via REST API
 * -------------------------------------------------------------------------- */

/* ============================================================================
 * >>> DAQUI PRA BAIXO: ORQUESTRAÇÃO GOOGLE CLOUD - chamada de rede real <<<
 * Exige projeto com billing ativo (aiplatform.googleapis.com). Tudo ACIMA
 * desta marca (conversão, gate de OCR) roda 100% local, sem tocar rede e
 * sem custo nenhum.
 * ============================================================================ */

function obterTokenAcesso() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function consultarStatusJob(nomeJob) {
  const token = obterTokenAcesso();
  const url = `https://${REGIAO}-aiplatform.googleapis.com/v1/${nomeJob}`;
  const resposta = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resposta.ok) {
    throw new Error(`Falha ao consultar job: ${resposta.status} ${resposta.statusText}`);
  }
  return resposta.json();
}

function formatarDuracao(inicioISO, fimISO) {
  const inicio = new Date(inicioISO);
  const fim = new Date(fimISO);
  const totalMs = fim - inicio;
  const minutos = Math.floor(totalMs / 60000);
  const segundos = ((totalMs % 60000) / 1000).toFixed(2);
  return `${minutos}min${segundos}s`;
}

/* --------------------------------------------------------------------------
 * 3. Testes automatizados
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
  console.log('== Testes: conversão pro formato Gemini ==');

  const exemploAuto = {
    instrucao: 'Extraia segurado, placa e valor do orçamento de oficina abaixo.',
    entrada: 'ATIVA ORCAMENTOS AUTOMOTIVOS OFICINA ESTRELA LTDA Segurado: Camila Costa Ribeiro Placa do veiculo: AZS-6617 Valor total do reparo: R$ 1.780,50',
    saida: { segurado: 'Camila Costa Ribeiro', placa: 'AZS-6617', valor: 1780.5 },
    metadata: { caso: 'amplitude-auto', fonte: 'Oficina Estrela', id: 'amplitude-auto-Oficina Estrela-5' },
  };

  testar('conversão gera exatamente dois turnos, user e model', () => {
    const convertido = converterParaFormatoGemini(exemploAuto);
    assert.equal(convertido.contents.length, 2);
    assert.equal(convertido.contents[0].role, 'user');
    assert.equal(convertido.contents[1].role, 'model');
  });

  testar('turno do usuário concatena instrução e entrada', () => {
    const convertido = converterParaFormatoGemini(exemploAuto);
    const texto = convertido.contents[0].parts[0].text;
    assert.ok(texto.includes(exemploAuto.instrucao));
    assert.ok(texto.includes(exemploAuto.entrada));
  });

  testar('turno do modelo é o JSON exato da saída esperada', () => {
    const convertido = converterParaFormatoGemini(exemploAuto);
    const saidaDecodificada = JSON.parse(convertido.contents[1].parts[0].text);
    assert.deepEqual(saidaDecodificada, exemploAuto.saida);
  });

  testar('rejeita exemplo sem instrucao', () => {
    assert.throws(() => converterParaFormatoGemini({ entrada: 'x', saida: {} }), /instrucao/);
  });

  testar('rejeita exemplo sem entrada', () => {
    assert.throws(() => converterParaFormatoGemini({ instrucao: 'x', saida: {} }), /entrada/);
  });

  testar('rejeita exemplo sem saida', () => {
    assert.throws(() => converterParaFormatoGemini({ instrucao: 'x', entrada: 'y' }), /saida/);
  });

  console.log();
  console.log('== Testes: gate de confiança de OCR ==');

  const exemplosReaisM21 = [
    { metadata: { id: 'doc-auto-1', confiancaOcr: 0.943 } },
    { metadata: { id: 'doc-auto-2', confiancaOcr: 0.958 } },
    { metadata: { id: 'doc-saude-1', confiancaOcr: 0.957 } },
    { metadata: { id: 'doc-saude-2', confiancaOcr: 0.959 } },
  ];

  testar('os 4 documentos reais do Módulo 2.1 (94%-96% de confiança) passam todos no limiar padrão', () => {
    const resultado = filtrarPorConfiancaOcr(exemplosReaisM21);
    assert.equal(resultado.aprovadosPorOcr.length, 4);
    assert.equal(resultado.sinalizadosParaRevisao.length, 0);
  });

  testar('exemplo com confiança abaixo do limiar é sinalizado pra revisão, não aprovado', () => {
    const scanDegradado = { metadata: { id: 'doc-degradado', confiancaOcr: 0.62 } };
    const resultado = filtrarPorConfiancaOcr([...exemplosReaisM21, scanDegradado]);
    assert.equal(resultado.sinalizadosParaRevisao.length, 1);
    assert.equal(resultado.sinalizadosParaRevisao[0].metadata.id, 'doc-degradado');
    assert.ok(!resultado.aprovados.some((e) => e.metadata.id === 'doc-degradado'));
  });

  testar('exemplo sem confiancaOcr (texto sintético, nunca passou por OCR) segue aprovado sem gate', () => {
    const sintetico = { metadata: { id: 'amplitude-auto-Oficina Estrela-5' } };
    const resultado = filtrarPorConfiancaOcr([sintetico]);
    assert.equal(resultado.semConfianca.length, 1);
    assert.equal(resultado.aprovadosPorOcr.length, 0);
    assert.ok(resultado.aprovados.includes(sintetico));
  });

  testar('confiança exatamente igual ao limiar é aprovada (>=, não >)', () => {
    const exemplo = { metadata: { id: 'limiar-exato', confiancaOcr: LIMIAR_CONFIANCA_OCR_PADRAO } };
    const resultado = filtrarPorConfiancaOcr([exemplo]);
    assert.equal(resultado.aprovadosPorOcr.length, 1);
  });

  testar('limiar customizado é respeitado em vez do padrão', () => {
    const exemplo = { metadata: { id: 'confianca-70', confiancaOcr: 0.7 } };
    const resultadoPadrao = filtrarPorConfiancaOcr([exemplo]);
    const resultadoFrouxo = filtrarPorConfiancaOcr([exemplo], 0.6);
    assert.equal(resultadoPadrao.sinalizadosParaRevisao.length, 1);
    assert.equal(resultadoFrouxo.aprovadosPorOcr.length, 1);
  });

  console.log();
  console.log('== Testes: formatação de duração ==');

  testar('duração de 45min41,95s é formatada corretamente', () => {
    const formatado = formatarDuracao(
      '2026-08-08T02:38:12.364747Z',
      '2026-08-08T03:23:54.310390Z'
    );
    assert.equal(formatado, '45min41.95s');
  });

  testar('duração de exatamente 1 minuto é formatada corretamente', () => {
    const formatado = formatarDuracao('2026-01-01T00:00:00.000Z', '2026-01-01T00:01:00.000Z');
    assert.equal(formatado, '1min0.00s');
  });

  console.log();
  console.log(`Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ${testesComFalha} falhou(falharam).`);
}

/* --------------------------------------------------------------------------
 * 4. Execução principal
 * -------------------------------------------------------------------------- */

async function main() {
  rodarTestes();

  console.log();
  console.log('== Conversão de exemplos reais do dataset (Amplitude Auto + Saúde Empresarial) ==');

  const exemploAuto = {
    instrucao: 'Extraia segurado, placa e valor do orçamento de oficina abaixo.',
    entrada: 'ATIVA ORCAMENTOS AUTOMOTIVOS OFICINA ESTRELA LTDA CNPJ 12.345.678/0001-90 Rua das Turbinas 450 Distrito Industrial Segurado: Camila Costa Ribeiro Placa do veiculo: AZS-6617 Data do sinistro: 21/05/2026 Descricao do servico: reparo de lataria e pintura no para-choque dianteiro Valor total do reparo: R$ 1.780,50',
    saida: { segurado: 'Camila Costa Ribeiro', placa: 'AZS-6617', valor: 1780.5 },
    metadata: { caso: 'amplitude-auto', fonte: 'Oficina Estrela', id: 'amplitude-auto-Oficina Estrela-5' },
  };

  const exemploSaude = {
    instrucao: 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.',
    entrada: 'CLINICA VITALIS SAUDE OCUPACIONAL CNPJ 33.222.111/0001-44 Av. Paulista 900 Paciente/Beneficiario: Thiago Augusto Barbosa Procedimento: consulta ginecologica Data do atendimento: 02/05/2026 Valor cobrado: R$ 4.430,00',
    saida: { beneficiario: 'Thiago Augusto Barbosa', procedimento: 'consulta ginecologica', valor: 4430 },
    metadata: { caso: 'amplitude-saude-empresarial', fonte: 'Clínica Vitalis', id: 'amplitude-saude-empresarial-Clínica Vitalis-8' },
  };

  for (const exemplo of [exemploAuto, exemploSaude]) {
    const convertido = converterParaFormatoGemini(exemplo);
    console.log(`\n${exemplo.metadata.id}:`);
    console.log(JSON.stringify(convertido, null, 2));
  }

  console.log();
  console.log('== Gate de confiança de OCR (promessa do Módulo 2.1, cumprida aqui) ==');

  const documentosReaisM21 = [
    { metadata: { id: 'doc-auto-1.png', confiancaOcr: 0.943 } },
    { metadata: { id: 'doc-auto-2.png', confiancaOcr: 0.958 } },
    { metadata: { id: 'doc-saude-1.png', confiancaOcr: 0.957 } },
    { metadata: { id: 'doc-saude-2.png', confiancaOcr: 0.959 } },
  ];
  const scanDegradadoHipotetico = {
    metadata: { id: 'doc-danificado-por-agua.png', confiancaOcr: 0.62 },
  };
  const exemploDoDatasetDeHoje = { metadata: { caso: 'amplitude-auto', fonte: 'Oficina Estrela', id: 'amplitude-auto-Oficina Estrela-5' } };

  const resultadoGate = filtrarPorConfiancaOcr([
    ...documentosReaisM21,
    scanDegradadoHipotetico,
    exemploDoDatasetDeHoje,
  ]);

  console.log(`Limiar: ${resultadoGate.limiar} (${resultadoGate.limiar * 100}% de confiança)`);
  console.log(`Aprovados por OCR real: ${resultadoGate.aprovadosPorOcr.length} (os 4 documentos reais do Módulo 2.1, 94%-96%)`);
  console.log(`Sinalizados para revisão humana: ${resultadoGate.sinalizadosParaRevisao.length} (${resultadoGate.sinalizadosParaRevisao.map((e) => `${e.metadata.id} confiança ${(e.metadata.confiancaOcr * 100).toFixed(0)}%`).join(', ')}, abaixo do limiar)`);
  console.log(`Sem OCR, seguem sem gate: ${resultadoGate.semConfianca.length} (${resultadoGate.semConfianca.map((e) => e.metadata.id).join(', ')}, texto sintético, nunca foi escaneado)`);
  console.log('Nenhum dos 200 exemplos do job de hoje passou por este gate, porque nenhum deles veio de OCR de verdade.');

  console.log();
  console.log('== Acompanhamento real do job de fine-tuning ==');
  console.log(`Job: ${NOME_JOB}`);

  try {
    const job = await consultarStatusJob(NOME_JOB);
    console.log(`Estado: ${job.state}`);
    console.log(`Modelo base: ${job.baseModel}`);
    console.log(`Nome de exibição: ${job.tunedModelDisplayName}`);
    console.log(`Início: ${job.startTime}`);
    console.log(`Fim: ${job.endTime}`);
    if (job.startTime && job.endTime) {
      console.log(`Duração real: ${formatarDuracao(job.startTime, job.endTime)}`);
    }
    if (job.tunedModel) {
      console.log(`Modelo ajustado: ${job.tunedModel.model}`);
      console.log(`Endpoint publicado: ${job.tunedModel.endpoint}`);
    }
  } catch (erro) {
    console.log(`Não foi possível consultar o job agora: ${erro.message}`);
  }
}

main();

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
