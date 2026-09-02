/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 3.4
 *
 * Ferramenta: automação em JavaScript do processo completo de fine-tuning
 * via API, upload do dataset, criação do job com hiperparâmetro validado,
 * e acompanhamento sozinho até o job terminar, sem comando manual a cada
 * etapa.
 *
 * A criação de job (criarJobFineTuning) tem uma trava de confirmação
 * explícita, `confirmar: true`, sem a qual ela nunca chama a rede. Essa
 * trava existe por causa do incidente real do Módulo 3.3: a Vertex AI
 * aceitou hiperparâmetro inválido sem erro rápido e começou a treinar de
 * verdade. Automação sem trava de confirmação teria disparado o mesmo
 * problema de novo, agora sem ninguém olhando o terminal.
 *
 * A demo principal NÃO cria job novo: reusa o job real do Módulo 3.2 pra
 * provar o acompanhamento sozinho de ponta a ponta.
 *
 * Uso: node finetuning-automation-tool.js
 *
 * Nota de validade (ago/2026): os exemplos de job usam gemini-2.5-flash como
 * base_model. O processo de automação -- upload, criação de job com trava de
 * confirmação, acompanhamento -- é o mesmo independente da versão exata do
 * modelo. A Google aposenta versões do Gemini com aviso prévio (a família
 * 2.5 tem retirement anunciado pra 16/out/2026); antes de rodar você mesmo,
 * confira em
 * https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes
 * quais modelos estão disponíveis no momento e troque baseModel.
 */

'use strict';

const assert = require('assert').strict;
const { execSync } = require('child_process');

const PROJETO = 'amplitude-seguros-demo';
const REGIAO = 'us-central1';
const JOB_REAL_M32 = 'projects/113512199474/locations/us-central1/tuningJobs/4180970763655839744';

/* --------------------------------------------------------------------------
 * 1. Conversão e validação (reusadas dos Módulos 3.2 e 3.3, mesma lógica)
 * -------------------------------------------------------------------------- */

function converterParaFormatoGemini(exemplo) {
  if (!exemplo.instrucao || !exemplo.entrada || typeof exemplo.saida !== 'object') {
    throw new Error('exemplo incompleto: instrucao, entrada e saida são obrigatórios');
  }
  return {
    contents: [
      { role: 'user', parts: [{ text: `${exemplo.instrucao}\n\n${exemplo.entrada}` }] },
      { role: 'model', parts: [{ text: JSON.stringify(exemplo.saida) }] },
    ],
  };
}

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

/* ============================================================================
 * >>> DAQUI PRA BAIXO (SEÇÕES 2-5): ORQUESTRAÇÃO GOOGLE CLOUD - chamada de
 * rede real. Exige projeto com billing ativo (aiplatform.googleapis.com).
 * A SEÇÃO 1 acima (conversão, validação) roda 100% local, sem tocar rede e
 * sem custo nenhum.
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
  const comando = montarComandoUpload(caminhoLocal, uriGcs);
  execSync(comando, { stdio: 'inherit' });
  return uriGcs;
}

/* --------------------------------------------------------------------------
 * 3. Criação de job, com trava de confirmação
 * -------------------------------------------------------------------------- */

function exigirConfirmacao(opcoes) {
  if (!opcoes || opcoes.confirmar !== true) {
    throw new Error(
      'criarJobFineTuning bloqueado: passe { confirmar: true } explicitamente pra criar job de verdade. ' +
      'Trava adicionada depois do incidente do Módulo 3.3, onde hiperparâmetro inválido criou job real sem aviso.'
    );
  }
}

function obterTokenAcesso() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function criarJobFineTuning(config, opcoes) {
  exigirConfirmacao(opcoes);
  validarHiperparametros(config);

  const token = obterTokenAcesso();
  const url = `https://${REGIAO}-aiplatform.googleapis.com/v1/projects/${PROJETO}/locations/${REGIAO}/tuningJobs`;
  const corpo = {
    baseModel: config.baseModel,
    tunedModelDisplayName: config.displayName,
    supervisedTuningSpec: {
      trainingDatasetUri: config.uriDataset,
      hyperParameters: {
        epochCount: config.epochCount,
        learningRateMultiplier: config.learningRateMultiplier,
      },
    },
  };

  const resposta = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  if (!resposta.ok) throw new Error(`Falha ao criar job: ${resposta.status} ${resposta.statusText}`);
  return resposta.json();
}

/* --------------------------------------------------------------------------
 * 4. Acompanhamento sozinho, com backoff
 * -------------------------------------------------------------------------- */

const ESTADOS_TERMINAIS = new Set(['JOB_STATE_SUCCEEDED', 'JOB_STATE_FAILED', 'JOB_STATE_CANCELLED']);

function calcularProximoIntervalo(atualMs, fator, maximoMs) {
  return Math.min(Math.round(atualMs * fator), maximoMs);
}

async function consultarStatusJob(nomeJob) {
  const token = obterTokenAcesso();
  const url = `https://${REGIAO}-aiplatform.googleapis.com/v1/${nomeJob}`;
  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resposta.ok) throw new Error(`Falha ao consultar job: ${resposta.status} ${resposta.statusText}`);
  return resposta.json();
}

async function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chama `consultarFn(nomeJob)` com retry limitado: uma falha transiente de
 * rede (timeout, 503, reset de conexão) não pode derrubar uma automação que
 * fica rodando sozinha por até ~1h40min sem ninguém olhando o terminal. Só
 * desiste e propaga o erro depois de `tentativas` falhas seguidas.
 *
 * Isso NÃO é o mesmo princípio da trava de confirmação. A trava valida ANTES
 * de qualquer chamada de rede e nunca é reexecutada: "validar antes, nunca
 * depois". O retry age DEPOIS que a chamada já foi autorizada, só pra
 * absorver instabilidade de rede numa consulta de leitura -- ele nunca
 * repete nem contorna a validação de hiperparâmetro ou a trava de
 * confirmação, que continuam falhando rápido e uma única vez.
 */
async function consultarComRetry(consultarFn, nomeJob, {
  tentativas = 3,
  atrasoMs = 3000,
  esperarFn = esperar,
} = {}) {
  let ultimoErro;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      return await consultarFn(nomeJob);
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa < tentativas) {
        await esperarFn(atrasoMs);
      }
    }
  }
  throw ultimoErro;
}

/**
 * Consulta o job repetidamente até ele chegar num estado terminal, com
 * backoff exponencial entre tentativas (não martela a API a cada segundo).
 * Chama `aoAtualizar(job)` a cada consulta, pra quem quiser logar progresso.
 *
 * `consultarFn` é injetável (default: consultarStatusJob de verdade) pra
 * permitir teste unitário real da lógica de loop e backoff, sem precisar
 * de rede nem de esperar o intervalo de verdade. Cada consulta passa por
 * `consultarComRetry`, então uma falha transiente isolada não interrompe
 * o acompanhamento inteiro.
 */
async function acompanharAteFinalizar(nomeJob, {
  intervaloInicialMs = 5000,
  fatorBackoff = 1.5,
  intervaloMaximoMs = 60000,
  aoAtualizar = () => {},
  consultarFn = consultarStatusJob,
  esperarFn = esperar,
  tentativasConsulta = 3,
  atrasoRetryMs = 3000,
} = {}) {
  let intervalo = intervaloInicialMs;
  let job = await consultarComRetry(consultarFn, nomeJob, {
    tentativas: tentativasConsulta, atrasoMs: atrasoRetryMs, esperarFn,
  });
  aoAtualizar(job);

  while (!ESTADOS_TERMINAIS.has(job.state)) {
    await esperarFn(intervalo);
    intervalo = calcularProximoIntervalo(intervalo, fatorBackoff, intervaloMaximoMs);
    job = await consultarComRetry(consultarFn, nomeJob, {
      tentativas: tentativasConsulta, atrasoMs: atrasoRetryMs, esperarFn,
    });
    aoAtualizar(job);
  }

  return job;
}

/* --------------------------------------------------------------------------
 * 5. Orquestração: encadeia os 5 passos numa única automação
 * -------------------------------------------------------------------------- */

/**
 * Encadeia converter → validar → subir → criar job → acompanhar, na ordem
 * que o vídeo descreve, falhando rápido em qualquer passo em vez de seguir
 * com estado inconsistente. Cada passo reusa a função já testada isolada
 * acima -- esta função só orquestra, não duplica nenhuma lógica.
 *
 * `executarUploadFn`, `criarJobFn` e `acompanharFn` são injetáveis (default:
 * as versões reais) pra permitir teste unitário real do encadeamento, sem
 * precisar de rede.
 */
async function automatizarFineTuning(exemplos, config, opcoes = {}) {
  const {
    executarUploadFn = executarUpload,
    criarJobFn = criarJobFineTuning,
    acompanharFn = acompanharAteFinalizar,
    aoAtualizar = () => {},
  } = opcoes;

  const convertidos = exemplos.map(converterParaFormatoGemini);
  validarHiperparametros(config);
  executarUploadFn(config.caminhoLocal, config.uriDataset);
  const jobCriado = await criarJobFn(config, opcoes);
  const jobFinal = await acompanharFn(jobCriado.name, { aoAtualizar });

  return { convertidos, jobCriado, jobFinal };
}

/* --------------------------------------------------------------------------
 * 6. Testes automatizados
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
  console.log('== Testes: upload ==');

  testar('monta comando gsutil cp correto', () => {
    const comando = montarComandoUpload('dataset.jsonl', 'gs://bucket/dataset.jsonl');
    assert.equal(comando, 'gsutil cp "dataset.jsonl" "gs://bucket/dataset.jsonl"');
  });

  testar('rejeita dataset que não é .jsonl', () => {
    assert.throws(() => montarComandoUpload('dataset.json', 'gs://bucket/x.jsonl'), /jsonl/);
  });

  testar('rejeita destino que não é gs://', () => {
    assert.throws(() => montarComandoUpload('dataset.jsonl', '/local/path'), /gs:\/\//);
  });

  console.log();
  console.log('== Testes: trava de confirmação (proteção pós-incidente M3.3) ==');

  testar('bloqueia criação de job sem confirmar:true', () => {
    assert.throws(() => exigirConfirmacao({}), /confirmar: true/);
  });

  testar('bloqueia criação de job sem nenhuma opção', () => {
    assert.throws(() => exigirConfirmacao(undefined), /confirmar: true/);
  });

  testar('permite passar quando confirmar:true está explícito', () => {
    exigirConfirmacao({ confirmar: true });
  });

  console.log();
  console.log('== Testes: backoff exponencial de acompanhamento ==');

  testar('primeiro backoff aplica o fator', () => {
    assert.equal(calcularProximoIntervalo(5000, 1.5, 60000), 7500);
  });

  testar('backoff nunca ultrapassa o teto configurado', () => {
    assert.equal(calcularProximoIntervalo(50000, 1.5, 60000), 60000);
  });

  testar('backoff sucessivo cresce e satura no teto', () => {
    let intervalo = 5000;
    const historico = [intervalo];
    for (let i = 0; i < 8; i++) {
      intervalo = calcularProximoIntervalo(intervalo, 1.5, 60000);
      historico.push(intervalo);
    }
    assert.equal(historico[historico.length - 1], 60000);
    assert.ok(historico[1] > historico[0]);
  });

  console.log();
  console.log('== Testes: conversão e validação reusadas ==');

  testar('conversão reusada continua gerando dois turnos', () => {
    const convertido = converterParaFormatoGemini({
      instrucao: 'x', entrada: 'y', saida: { z: 1 },
    });
    assert.equal(convertido.contents.length, 2);
  });

  testar('validação reusada continua rejeitando epochCount inválido', () => {
    assert.throws(() => validarHiperparametros({ epochCount: 0, learningRateMultiplier: 5 }), /epochCount/);
  });

  console.log();
  console.log('== Testes: loop de acompanhamento (com consulta e espera falsas, sem rede) ==');

  await testarAssincrono('reconhece estado já terminal na primeira consulta, sem esperar', async () => {
    let chamadasConsulta = 0;
    let chamadasEspera = 0;
    const jobFinal = await acompanharAteFinalizar('job-falso', {
      consultarFn: async () => { chamadasConsulta += 1; return { state: 'JOB_STATE_SUCCEEDED' }; },
      esperarFn: async () => { chamadasEspera += 1; },
    });
    assert.equal(jobFinal.state, 'JOB_STATE_SUCCEEDED');
    assert.equal(chamadasConsulta, 1);
    assert.equal(chamadasEspera, 0);
  });

  await testarAssincrono('espera e consulta de novo enquanto o job está RUNNING', async () => {
    const sequenciaEstados = ['JOB_STATE_PENDING', 'JOB_STATE_RUNNING', 'JOB_STATE_RUNNING', 'JOB_STATE_SUCCEEDED'];
    let indice = 0;
    let chamadasEspera = 0;
    const jobFinal = await acompanharAteFinalizar('job-falso', {
      consultarFn: async () => ({ state: sequenciaEstados[indice++] }),
      esperarFn: async () => { chamadasEspera += 1; },
    });
    assert.equal(jobFinal.state, 'JOB_STATE_SUCCEEDED');
    assert.equal(indice, sequenciaEstados.length);
    assert.equal(chamadasEspera, sequenciaEstados.length - 1);
  });

  await testarAssincrono('chama aoAtualizar em toda consulta, inclusive as intermediárias', async () => {
    const sequenciaEstados = ['JOB_STATE_RUNNING', 'JOB_STATE_FAILED'];
    let indice = 0;
    const estadosVistos = [];
    await acompanharAteFinalizar('job-falso', {
      consultarFn: async () => ({ state: sequenciaEstados[indice++] }),
      esperarFn: async () => {},
      aoAtualizar: (job) => estadosVistos.push(job.state),
    });
    assert.deepEqual(estadosVistos, sequenciaEstados);
  });

  console.log();
  console.log('== Testes: orquestração de ponta a ponta (converter → validar → subir → criar job → acompanhar) ==');

  const exemploValido = { instrucao: 'x', entrada: 'y', saida: { z: 1 } };
  const configValida = {
    baseModel: 'gemini-2.5-flash', displayName: 'teste', caminhoLocal: 'dataset.jsonl',
    uriDataset: 'gs://bucket/dataset.jsonl', epochCount: 3, learningRateMultiplier: 5.0,
  };

  await testarAssincrono('encadeia os 5 passos na ordem certa e devolve o resultado de cada um', async () => {
    const chamadas = [];
    const resultado = await automatizarFineTuning([exemploValido], configValida, {
      confirmar: true,
      executarUploadFn: (caminho, uri) => { chamadas.push('upload'); return uri; },
      criarJobFn: async () => { chamadas.push('criarJob'); return { name: 'tuningJobs/falso' }; },
      acompanharFn: async () => { chamadas.push('acompanhar'); return { state: 'JOB_STATE_SUCCEEDED' }; },
    });
    assert.deepEqual(chamadas, ['upload', 'criarJob', 'acompanhar']);
    assert.equal(resultado.convertidos.length, 1);
    assert.equal(resultado.jobFinal.state, 'JOB_STATE_SUCCEEDED');
  });

  await testarAssincrono('falha rápido se algum exemplo estiver incompleto, antes de validar hiperparâmetro', async () => {
    let chamouUpload = false;
    await assert.rejects(
      () => automatizarFineTuning([{ instrucao: 'x' }], configValida, {
        confirmar: true,
        executarUploadFn: () => { chamouUpload = true; },
      }),
      /obrigatórios/,
    );
    assert.equal(chamouUpload, false);
  });

  await testarAssincrono('falha rápido se hiperparâmetro for inválido, antes de subir o dataset', async () => {
    let chamouUpload = false;
    await assert.rejects(
      () => automatizarFineTuning([exemploValido], { ...configValida, epochCount: 0 }, {
        confirmar: true,
        executarUploadFn: () => { chamouUpload = true; },
      }),
      /epochCount/,
    );
    assert.equal(chamouUpload, false);
  });

  await testarAssincrono('propaga a trava de confirmação: sem injetar criarJobFn, usa o criarJobFineTuning real e bloqueia sem confirmar:true', async () => {
    await assert.rejects(
      () => automatizarFineTuning([exemploValido], configValida, {
        executarUploadFn: () => {},
      }),
      /confirmar: true/,
    );
  });

  console.log();
  console.log(`Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ${testesComFalha} falhou(falharam).`);
}

/* --------------------------------------------------------------------------
 * 6. Execução principal
 * -------------------------------------------------------------------------- */

async function main() {
  await rodarTestes();

  console.log();
  console.log('== Reprodução da trava de confirmação ==');
  try {
    await criarJobFineTuning({
      baseModel: 'gemini-2.5-flash',
      displayName: 'teste-sem-confirmar',
      uriDataset: 'gs://amplitude-seguros-demo-tuning/m3-amplitude-auto-saude-200.jsonl',
      epochCount: 3,
      learningRateMultiplier: 5.0,
    }, {});
  } catch (erro) {
    console.log(`Bloqueado como esperado: ${erro.message}`);
  }

  console.log();
  console.log('== Acompanhamento sozinho, ao vivo, contra o job real do Módulo 3.2 ==');
  console.log(`Job: ${JOB_REAL_M32}`);
  try {
    const jobFinal = await acompanharAteFinalizar(JOB_REAL_M32, {
      aoAtualizar: (job) => console.log(`  consulta: estado=${job.state}`),
    });
    console.log(`Acompanhamento terminou sozinho. Estado final: ${jobFinal.state}`);
    if (jobFinal.tunedModel) {
      console.log(`Endpoint: ${jobFinal.tunedModel.endpoint}`);
    }
  } catch (erro) {
    console.log(`Não foi possível acompanhar agora: ${erro.message}`);
  }
}

main();

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
