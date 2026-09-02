/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Extra - Dataset real alternativo, parte 2/2 (companion dos Módulos 3.2-3.4)
 *
 * Ferramenta: converte o dataset real já preparado (ver
 * dolly-dataset-real-starter.js/.py, parte 1/2, conceitualmente equivalente
 * ao Módulo 2.2) pro formato Vertex AI, sobe pro bucket, cria um job de
 * fine-tuning REAL, acompanha até finalizar, e roda uma inferência real
 * contra o endpoint resultante. Mesmo padrão de conversão do Módulo 3.2
 * (converterParaFormatoGemini), mesma trava de confirmação e mesmo loop de
 * acompanhamento com backoff do Módulo 3.4 (criarJobFineTuning,
 * acompanharAteFinalizar).
 *
 * Diferença real de adaptação: a conversão do Módulo 3.2/3.4 faz
 * `JSON.stringify(exemplo.saida)` porque o case Amplitude sempre extrai
 * campo estruturado (saida é objeto). O Dolly-15k tem resposta em texto
 * solto (saida é string) - a conversão aqui usa o texto direto, sem
 * JSON.stringify, senão a resposta esperada do modelo sairia com aspas
 * duplas extras em volta.
 *
 * Rodado de verdade em 25/08/2026 contra o projeto amplitude-seguros-demo:
 * job criado, monitorado até o fim, resultado real documentado no
 * companion.md e na Missão Prática #03 (Módulo 3.5).
 *
 * Uso: node dolly-vertex-pipeline.js  (cria job real, CUSTA DINHEIRO -
 * exige --confirmar explícito, ver rodarPipeline)
 *
 * Nota de validade (ago/2026): validado com gemini-2.5-flash, passado como
 * config.baseModel pra rodarPipeline (não é uma constante de topo de
 * arquivo -- o modelo é parâmetro, não fixo, veja o exemplo de config na
 * suite de teste, rodarTestes, mais abaixo). A Google aposenta versões do
 * Gemini com aviso prévio (a família 2.5 tem retirement anunciado pra
 * 16/out/2026); antes de rodar você mesmo, confira em
 * https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes
 * quais modelos estão disponíveis no momento e troque o valor de baseModel
 * que você passar.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert').strict;
const { execSync } = require('child_process');

const PROJETO = 'amplitude-seguros-demo';
const REGIAO = 'us-central1';
const BUCKET_URI = 'gs://amplitude-seguros-demo-tuning/dolly-extra-200.jsonl';

/* --------------------------------------------------------------------------
 * 1. Conversão (adaptada do Módulo 3.2/3.4: saida do Dolly é texto, não objeto)
 * -------------------------------------------------------------------------- */

function converterParaFormatoGemini(exemplo) {
  if (!exemplo.instrucao || !exemplo.entrada || typeof exemplo.saida !== 'string' || !exemplo.saida.trim()) {
    throw new Error('exemplo incompleto: instrucao, entrada e saida (texto) são obrigatórios');
  }
  return {
    contents: [
      { role: 'user', parts: [{ text: `${exemplo.instrucao}\n\n${exemplo.entrada}` }] },
      { role: 'model', parts: [{ text: exemplo.saida }] },
    ],
  };
}

/* ============================================================================
 * >>> DAQUI PRA BAIXO (SEÇÕES 2-6): ORQUESTRAÇÃO GOOGLE CLOUD - chamada de
 * rede real. Exige projeto com billing ativo (aiplatform.googleapis.com).
 * A SEÇÃO 1 acima (conversão) roda 100% local, sem tocar rede e sem custo
 * nenhum - assim como a Parte 1/2 inteira (dolly-dataset-real-starter),
 * que fica antes desta.
 * ============================================================================ */

/* --------------------------------------------------------------------------
 * 2. Upload
 * -------------------------------------------------------------------------- */

function montarComandoUpload(caminhoLocal, uriGcs) {
  if (!caminhoLocal.endsWith('.jsonl')) throw new Error('dataset precisa ser .jsonl');
  if (!uriGcs.startsWith('gs://')) throw new Error('destino precisa ser um URI gs://');
  return `gsutil cp "${caminhoLocal}" "${uriGcs}"`;
}

function executarUpload(caminhoLocal, uriGcs) {
  execSync(montarComandoUpload(caminhoLocal, uriGcs), { stdio: 'inherit' });
  return uriGcs;
}

/* --------------------------------------------------------------------------
 * 3. Criação de job, com a mesma trava de confirmação E validação de
 *    hiperparâmetro do Módulo 3.4 (achado de painel: a v1 deste arquivo
 *    criava job real sem validar hiperparâmetro antes - regressão de
 *    segurança em relação ao padrão já estabelecido em
 *    finetuning-automation-tool.js)
 * -------------------------------------------------------------------------- */

const FAIXAS_VALIDAS = {
  epochCount: { min: 1, max: 20 },
  learningRateMultiplier: { min: 0.1, max: 10 },
};

function validarHiperparametros(config) {
  const erros = [];
  if (!Number.isInteger(config.epochCount) || config.epochCount < FAIXAS_VALIDAS.epochCount.min || config.epochCount > FAIXAS_VALIDAS.epochCount.max) {
    erros.push(`epochCount fora da faixa 1-20: ${config.epochCount}`);
  }
  if (typeof config.learningRateMultiplier !== 'number' || config.learningRateMultiplier < FAIXAS_VALIDAS.learningRateMultiplier.min || config.learningRateMultiplier > FAIXAS_VALIDAS.learningRateMultiplier.max) {
    erros.push(`learningRateMultiplier fora da faixa 0.1-10: ${config.learningRateMultiplier}`);
  }
  if (erros.length > 0) throw new Error(`Hiperparâmetro inválido:\n  ${erros.join('\n  ')}`);
  return true;
}

function exigirConfirmacao(opcoes) {
  if (!opcoes || opcoes.confirmar !== true) {
    throw new Error('criarJobFineTuning bloqueado: passe { confirmar: true } explicitamente pra criar job de verdade (cobra da conta GCP).');
  }
}

/**
 * Cache de token (achado de painel: v1 chamava `gcloud auth print-access-token`
 * via subprocesso síncrono a cada consulta do loop de polling, sem
 * necessidade - o token do gcloud dura ~1h). Renova com 5min de margem.
 */
let _tokenCache = null;
let _tokenCacheExpiraEm = 0;

function obterTokenAcesso(forcarNovo = false) {
  const agora = Date.now();
  if (!forcarNovo && _tokenCache && agora < _tokenCacheExpiraEm) return _tokenCache;
  _tokenCache = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  _tokenCacheExpiraEm = agora + 55 * 60 * 1000;
  return _tokenCache;
}

/**
 * Wrapper que refaz UMA chamada autenticada com token forçadamente novo se
 * a primeira tentativa voltar 401 (achado real: em produção, o cache de
 * token pode ficar inválido antes da janela de 55min por motivo alheio ao
 * script - revogação, rotação de credencial, relógio do host. Cache sem
 * invalidação em 401 repete a mesma falha em todo retry, sem nunca
 * corrigir sozinho).
 */
async function comTokenValido(chamarFn) {
  const token1 = obterTokenAcesso();
  const resposta1 = await chamarFn(token1);
  if (resposta1.status !== 401) return resposta1;
  const token2 = obterTokenAcesso(true);
  return chamarFn(token2);
}

async function criarJobFineTuning(config, opcoes) {
  exigirConfirmacao(opcoes);
  validarHiperparametros(config);
  const url = `https://${REGIAO}-aiplatform.googleapis.com/v1/projects/${PROJETO}/locations/${REGIAO}/tuningJobs`;
  const corpo = {
    baseModel: config.baseModel,
    tunedModelDisplayName: config.displayName,
    supervisedTuningSpec: {
      trainingDatasetUri: config.uriDataset,
      hyperParameters: { epochCount: config.epochCount, learningRateMultiplier: config.learningRateMultiplier },
    },
  };
  const resposta = await comTokenValido((token) => fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  }));
  if (!resposta.ok) throw new Error(`Falha ao criar job: ${resposta.status} ${resposta.statusText}`);
  return resposta.json();
}

/* --------------------------------------------------------------------------
 * 4. Acompanhamento com backoff (mesma lógica do Módulo 3.4)
 * -------------------------------------------------------------------------- */

const ESTADOS_TERMINAIS = new Set(['JOB_STATE_SUCCEEDED', 'JOB_STATE_FAILED', 'JOB_STATE_CANCELLED']);

async function consultarStatusJob(nomeJob) {
  const url = `https://${REGIAO}-aiplatform.googleapis.com/v1/${nomeJob}`;
  const resposta = await comTokenValido((token) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }));
  if (!resposta.ok) throw new Error(`Falha ao consultar job: ${resposta.status} ${resposta.statusText}`);
  return resposta.json();
}

async function esperar(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function calcularProximoIntervalo(atualMs, fator, maximoMs) {
  return Math.min(Math.round(atualMs * fator), maximoMs);
}

/**
 * Retry limitado (achado de painel: v1 não tinha isso - uma falha
 * transiente de rede num job de 13min matava o acompanhamento inteiro).
 * Mesmo princípio do Módulo 3.4: retry age DEPOIS da chamada já
 * autorizada, só absorve instabilidade de rede numa consulta de leitura.
 */
async function consultarComRetry(consultarFn, nomeJob, { tentativas = 3, atrasoMs = 3000, esperarFn = esperar } = {}) {
  let ultimoErro;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      return await consultarFn(nomeJob);
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa < tentativas) await esperarFn(atrasoMs);
    }
  }
  throw ultimoErro;
}

async function acompanharAteFinalizar(nomeJob, {
  intervaloInicialMs = 15000,
  fatorBackoff = 1.3,
  intervaloMaximoMs = 60000,
  aoAtualizar = () => {},
  consultarFn = consultarStatusJob,
  esperarFn = esperar,
  tentativasConsulta = 3,
  atrasoRetryMs = 3000,
} = {}) {
  let intervalo = intervaloInicialMs;
  let job = await consultarComRetry(consultarFn, nomeJob, { tentativas: tentativasConsulta, atrasoMs: atrasoRetryMs, esperarFn });
  aoAtualizar(job);
  while (!ESTADOS_TERMINAIS.has(job.state)) {
    await esperarFn(intervalo);
    intervalo = calcularProximoIntervalo(intervalo, fatorBackoff, intervaloMaximoMs);
    job = await consultarComRetry(consultarFn, nomeJob, { tentativas: tentativasConsulta, atrasoMs: atrasoRetryMs, esperarFn });
    aoAtualizar(job);
  }
  return job;
}

/* --------------------------------------------------------------------------
 * 5. Inferência real contra o endpoint resultante
 * -------------------------------------------------------------------------- */

async function rodarInferencia(endpointNome, textoUsuario, generationConfig = { temperature: 0 }) {
  // temperature=0 (achado de painel: v1 não documentava sampling; geração é
  // estocástica, e sem isso o mesmo teste não é reproduzível de novo)
  const url = `https://${REGIAO}-aiplatform.googleapis.com/v1/${endpointNome}:generateContent`;
  const corpo = { contents: [{ role: 'user', parts: [{ text: textoUsuario }] }], generationConfig };
  const resposta = await comTokenValido((token) => fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  }));
  if (!resposta.ok) throw new Error(`Falha na inferência: ${resposta.status} ${resposta.statusText}`);
  return resposta.json();
}

/* --------------------------------------------------------------------------
 * 6. Orquestração completa (mesmo formato do automatizarFineTuning do Módulo 3.4)
 * -------------------------------------------------------------------------- */

async function rodarPipeline(exemplos, config, opcoes = {}) {
  const {
    executarUploadFn = executarUpload,
    criarJobFn = criarJobFineTuning,
    acompanharFn = acompanharAteFinalizar,
    aoAtualizar = () => {},
  } = opcoes;

  const convertidos = exemplos.map(converterParaFormatoGemini);
  fs.writeFileSync(config.caminhoLocal, convertidos.map((c) => JSON.stringify(c)).join('\n') + '\n');
  executarUploadFn(config.caminhoLocal, config.uriDataset);
  const jobCriado = await criarJobFn(config, opcoes);
  const jobFinal = await acompanharFn(jobCriado.name, { aoAtualizar });

  return { convertidos, jobCriado, jobFinal };
}

/* --------------------------------------------------------------------------
 * Testes automatizados (sem rede real, funções injetadas)
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

async function testarAssincrono(descricao, fn) {
  totalTestes += 1;
  try {
    await fn();
    console.log(`  [OK] ${descricao}`);
  } catch (erro) {
    testesComFalha += 1;
    console.log(`  [FALHOU] ${descricao}`);
    console.log(`           ${erro.message}`);
  }
}

async function rodarTestes() {
  console.log('== Testes: conversão (saída texto, não objeto) ==');

  testar('converte instrucao+entrada+saida (texto) em dois turnos user/model', () => {
    const r = converterParaFormatoGemini({ instrucao: 'Pergunta', entrada: 'Contexto', saida: 'Resposta em texto puro' });
    assert.equal(r.contents[0].role, 'user');
    assert.equal(r.contents[1].role, 'model');
    assert.equal(r.contents[1].parts[0].text, 'Resposta em texto puro');
  });

  testar('NÃO faz JSON.stringify na saida (diferente do Módulo 3.2/3.4, que espera objeto)', () => {
    const r = converterParaFormatoGemini({ instrucao: 'x', entrada: 'y', saida: 'texto simples' });
    assert.ok(!r.contents[1].parts[0].text.startsWith('"'), 'saida não deveria vir entre aspas de JSON.stringify');
  });

  testar('rejeita exemplo com saida como objeto (esse pipeline é só pra saida-texto)', () => {
    assert.throws(() => converterParaFormatoGemini({ instrucao: 'x', entrada: 'y', saida: { a: 1 } }));
  });

  testar('rejeita exemplo sem instrucao/entrada/saida', () => {
    assert.throws(() => converterParaFormatoGemini({ entrada: 'y', saida: 'z' }));
    assert.throws(() => converterParaFormatoGemini({ instrucao: 'x', saida: 'z' }));
    assert.throws(() => converterParaFormatoGemini({ instrucao: 'x', entrada: 'y' }));
  });

  console.log('\n== Testes: trava de confirmação e validação de hiperparâmetro (mesma do Módulo 3.4) ==');

  await testarAssincrono('bloqueia criação de job sem confirmar:true', async () => {
    await assert.rejects(() => criarJobFineTuning({}, {}), /bloqueado/);
  });

  await testarAssincrono('bloqueia job com hiperparâmetro inválido, mesmo com confirmar:true (achado de painel: v1 não tinha essa checagem)', async () => {
    await assert.rejects(
      () => criarJobFineTuning({ epochCount: 0, learningRateMultiplier: 5 }, { confirmar: true }),
      /Hiperparâmetro inválido/
    );
  });

  testar('validarHiperparametros aceita a config real usada no job (epochCount=3, learningRateMultiplier=5)', () => {
    assert.ok(validarHiperparametros({ epochCount: 3, learningRateMultiplier: 5 }));
  });

  console.log('\n== Testes: acompanhamento com backoff, sem rede real ==');

  await testarAssincrono('para no primeiro estado terminal, sem esperar', async () => {
    const consultarFn = async () => ({ state: 'JOB_STATE_SUCCEEDED' });
    const job = await acompanharAteFinalizar('job-fake', { consultarFn, esperarFn: async () => {} });
    assert.equal(job.state, 'JOB_STATE_SUCCEEDED');
  });

  await testarAssincrono('consulta repetidamente até estado terminal, respeitando backoff', async () => {
    const estados = ['JOB_STATE_PENDING', 'JOB_STATE_RUNNING', 'JOB_STATE_RUNNING', 'JOB_STATE_SUCCEEDED'];
    let i = 0;
    const consultarFn = async () => ({ state: estados[i++] });
    const esperas = [];
    const esperarFn = async (ms) => { esperas.push(ms); };
    const job = await acompanharAteFinalizar('job-fake', { consultarFn, esperarFn, intervaloInicialMs: 1000, fatorBackoff: 2 });
    assert.equal(job.state, 'JOB_STATE_SUCCEEDED');
    assert.equal(esperas.length, 3);
    assert.deepEqual(esperas, [1000, 2000, 4000]);
  });

  console.log('\n== Testes: pipeline completo, orquestração encadeada, sem rede real ==');

  await testarAssincrono('encadeia converter -> upload -> criar job -> acompanhar, na ordem certa', async () => {
    const chamadas = [];
    const exemplos = [{ instrucao: 'x', entrada: 'y', saida: 'resposta' }];
    const config = { caminhoLocal: '/tmp/teste-dolly-pipeline.jsonl', uriDataset: 'gs://fake/teste.jsonl', baseModel: 'gemini-2.5-flash', displayName: 'teste', epochCount: 3, learningRateMultiplier: 1 };
    const r = await rodarPipeline(exemplos, config, {
      confirmar: true,
      executarUploadFn: (local, uri) => { chamadas.push(`upload:${uri}`); },
      criarJobFn: async () => { chamadas.push('criarJob'); return { name: 'jobs/fake-123' }; },
      acompanharFn: async (nome) => { chamadas.push(`acompanhar:${nome}`); return { state: 'JOB_STATE_SUCCEEDED', tunedModel: { endpoint: 'endpoints/fake' } }; },
    });
    assert.deepEqual(chamadas, ['upload:gs://fake/teste.jsonl', 'criarJob', 'acompanhar:jobs/fake-123']);
    assert.equal(r.jobFinal.state, 'JOB_STATE_SUCCEEDED');
    fs.unlinkSync(config.caminhoLocal);
  });

  console.log(`\n${totalTestes - testesComFalha}/${totalTestes} testes passaram.`);
}

module.exports = {
  converterParaFormatoGemini,
  validarHiperparametros,
  executarUpload,
  criarJobFineTuning,
  consultarStatusJob,
  acompanharAteFinalizar,
  rodarInferencia,
  rodarPipeline,
  rodarTestes,
};

if (require.main === module) {
  rodarTestes();
}

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
