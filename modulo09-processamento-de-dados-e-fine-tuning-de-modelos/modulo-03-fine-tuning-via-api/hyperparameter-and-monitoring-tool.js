/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 3.3
 *
 * Ferramenta: validação de hiperparâmetro ANTES do envio (a Vertex AI não
 * faz isso de forma confiável, ver nota abaixo), comparação entre
 * hiperparâmetro pedido e hiperparâmetro realmente aplicado por um job já
 * criado, e leitura de estatística real de monitoramento de um job
 * concluído (contagem de token, distribuição de token por exemplo).
 *
 * Descoberta real desta disciplina, feita testando de propósito antes de
 * gravar: pedir epoch_count=0 (hiperparâmetro inválido) pra Vertex AI NÃO
 * gera erro rápido e gratuito. A API aceita a criação do job, ele vai pra
 * RUNNING de verdade, com o hiperparâmetro internamente ignorado e
 * substituído por um default silencioso. Só cancelar na mão parou o gasto.
 * A validação client-side deste arquivo é a mitigação real pra esse gap:
 * pegar o hiperparâmetro inválido ANTES de qualquer chamada de rede.
 *
 * Uso: node hyperparameter-and-monitoring-tool.js
 */

'use strict';

const assert = require('assert').strict;
const { execSync } = require('child_process');

const REGIAO = 'us-central1';
const NOME_JOB = 'projects/113512199474/locations/us-central1/tuningJobs/4180970763655839744';

/* --------------------------------------------------------------------------
 * 1. Validação client-side de hiperparâmetro (a mitigação real)
 * -------------------------------------------------------------------------- */

const FAIXAS_VALIDAS = {
  epochCount: { min: 1, max: 20 },
  learningRateMultiplier: { min: 0.1, max: 10 },
};

function validarHiperparametros(config) {
  const erros = [];

  if (!Number.isInteger(config.epochCount) || config.epochCount < FAIXAS_VALIDAS.epochCount.min || config.epochCount > FAIXAS_VALIDAS.epochCount.max) {
    erros.push(`epochCount deve ser inteiro entre ${FAIXAS_VALIDAS.epochCount.min} e ${FAIXAS_VALIDAS.epochCount.max}, recebido: ${config.epochCount}`);
  }
  if (typeof config.learningRateMultiplier !== 'number' || config.learningRateMultiplier < FAIXAS_VALIDAS.learningRateMultiplier.min || config.learningRateMultiplier > FAIXAS_VALIDAS.learningRateMultiplier.max) {
    erros.push(`learningRateMultiplier deve estar entre ${FAIXAS_VALIDAS.learningRateMultiplier.min} e ${FAIXAS_VALIDAS.learningRateMultiplier.max}, recebido: ${config.learningRateMultiplier}`);
  }

  if (erros.length > 0) {
    throw new Error(`Hiperparâmetro inválido, job não enviado:\n  ${erros.join('\n  ')}`);
  }
  return true;
}

/**
 * Compara dois valores tolerando a diferença de tipo que a Vertex AI
 * introduz de verdade: campos int64 como epochCount voltam como STRING no
 * JSON ("3"), não como number (3), uma convenção comum de serialização de
 * inteiro de 64 bits em API do Google. Comparação estrita (===) falharia
 * aqui mesmo quando os valores são iguais. Se os dois lados forem
 * numericamente comparáveis, compara como número; senão, cai pra
 * comparação direta (cobre adapterSize e outros campos não numéricos).
 */
function valoresEquivalentes(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  return a === b;
}

/**
 * Compara o hiperparâmetro que foi pedido na criação do job com o que a API
 * realmente aplicou (campo supervised_tuning_spec.hyper_parameters do job).
 * É a checagem que teria pegado o epoch_count=0 sendo silenciosamente
 * substituído, sem depender da API validar nada.
 */
function compararHiperparametros(pedido, aplicado) {
  const divergencias = [];
  for (const chave of Object.keys(pedido)) {
    if (aplicado[chave] === undefined || aplicado[chave] === null) {
      divergencias.push(`${chave}: pedido ${pedido[chave]}, aplicado ausente (provavelmente default silencioso do provedor)`);
    } else if (!valoresEquivalentes(aplicado[chave], pedido[chave])) {
      divergencias.push(`${chave}: pedido ${pedido[chave]}, aplicado ${aplicado[chave]}`);
    }
  }
  return divergencias;
}

/* --------------------------------------------------------------------------
 * 2. Monitoramento real: estatística do job concluído
 * -------------------------------------------------------------------------- */

/* ============================================================================
 * >>> DAQUI PRA BAIXO: ORQUESTRAÇÃO GOOGLE CLOUD - chamada de rede real <<<
 * Exige projeto com billing ativo (aiplatform.googleapis.com). Tudo ACIMA
 * desta marca (validação, comparação pedido x aplicado) roda 100% local,
 * sem tocar rede e sem custo nenhum.
 * ============================================================================ */

function obterTokenAcesso() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function consultarJobCompleto(nomeJob) {
  const token = obterTokenAcesso();
  const url = `https://${REGIAO}-aiplatform.googleapis.com/v1/${nomeJob}`;
  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resposta.ok) {
    throw new Error(`Falha ao consultar job: ${resposta.status} ${resposta.statusText}`);
  }
  return resposta.json();
}

function resumirEstatisticaTreino(job) {
  const stats = job?.tuningDataStats?.supervisedTuningDataStats;
  if (!stats) return null;
  return {
    exemplos: stats.tuningDatasetExampleCount,
    tokensCobraveis: stats.totalBillableTokenCount,
    entradaMedia: stats.userInputTokenDistribution?.mean,
    entradaMediana: stats.userInputTokenDistribution?.median,
    entradaMin: stats.userInputTokenDistribution?.min,
    entradaMax: stats.userInputTokenDistribution?.max,
    saidaMedia: stats.userOutputTokenDistribution?.mean,
    saidaMediana: stats.userOutputTokenDistribution?.median,
    saidaMin: stats.userOutputTokenDistribution?.min,
    saidaMax: stats.userOutputTokenDistribution?.max,
  };
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
  console.log('== Testes: validação de hiperparâmetro ==');

  testar('aceita a config real usada no job de produção', () => {
    assert.equal(validarHiperparametros({ epochCount: 3, learningRateMultiplier: 5.0 }), true);
  });

  testar('rejeita o epochCount=0 que escapou da API de verdade', () => {
    assert.throws(
      () => validarHiperparametros({ epochCount: 0, learningRateMultiplier: 5.0 }),
      /epochCount deve ser inteiro entre 1 e 20/
    );
  });

  testar('rejeita épocas negativas', () => {
    assert.throws(() => validarHiperparametros({ epochCount: -3, learningRateMultiplier: 1 }), /epochCount/);
  });

  testar('rejeita épocas não inteiras', () => {
    assert.throws(() => validarHiperparametros({ epochCount: 2.5, learningRateMultiplier: 1 }), /epochCount/);
  });

  testar('rejeita learningRateMultiplier fora da faixa', () => {
    assert.throws(() => validarHiperparametros({ epochCount: 3, learningRateMultiplier: 50 }), /learningRateMultiplier/);
  });

  console.log();
  console.log('== Testes: comparação pedido vs aplicado ==');

  testar('nenhuma divergência quando tudo bate', () => {
    const divergencias = compararHiperparametros({ epochCount: 3 }, { epochCount: 3 });
    assert.equal(divergencias.length, 0);
  });

  testar('detecta o caso real: epochCount pedido, aplicado ausente', () => {
    const divergencias = compararHiperparametros({ epochCount: 0 }, { epochCount: null });
    assert.equal(divergencias.length, 1);
    assert.ok(divergencias[0].includes('default silencioso'));
  });

  testar('detecta divergência de valor numérico', () => {
    const divergencias = compararHiperparametros({ epochCount: 3 }, { epochCount: 5 });
    assert.equal(divergencias.length, 1);
  });

  testar('não aponta divergência quando o valor é igual mas em tipo diferente (bug real: API devolve string)', () => {
    const divergencias = compararHiperparametros({ epochCount: 3, learningRateMultiplier: 5 }, { epochCount: '3', learningRateMultiplier: '5' });
    assert.equal(divergencias.length, 0);
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
  console.log('== Reprodução do problema real encontrado antes de gravar ==');
  console.log('Pedido: epochCount=0, learningRateMultiplier=5.0');
  try {
    validarHiperparametros({ epochCount: 0, learningRateMultiplier: 5.0 });
  } catch (erro) {
    console.log(`Bloqueado ANTES de qualquer chamada de rede: ${erro.message}`);
  }
  console.log('Sem esta validação, a chamada real a client.tunings.tune() com epochCount=0 foi aceita');
  console.log('pela Vertex AI, criou o job tuningJobs/2893240337390632960, foi pra RUNNING de verdade,');
  console.log('com epochCount internamente ausente (default silencioso), e precisou ser cancelado na mão.');

  console.log();
  console.log('== Monitoramento real: estatística do job de produção ==');
  console.log(`Job: ${NOME_JOB}`);

  try {
    const job = await consultarJobCompleto(NOME_JOB);
    const aplicado = job.supervisedTuningSpec?.hyperParameters;
    console.log(`\nHiperparâmetro aplicado de verdade: epochCount=${aplicado?.epochCount}, learningRateMultiplier=${aplicado?.learningRateMultiplier}, adapterSize=${aplicado?.adapterSize}`);

    const divergencias = compararHiperparametros({ epochCount: 3, learningRateMultiplier: 5.0 }, {
      epochCount: aplicado?.epochCount,
      learningRateMultiplier: aplicado?.learningRateMultiplier,
    });
    console.log(divergencias.length === 0 ? 'Confirmado: pedido e aplicado batem exatamente.' : `Divergências: ${divergencias.join('; ')}`);

    const resumo = resumirEstatisticaTreino(job);
    if (resumo) {
      console.log('\nEstatística real do dataset de treino:');
      console.log(`  Exemplos: ${resumo.exemplos}`);
      console.log(`  Tokens cobráveis no total: ${resumo.tokensCobraveis}`);
      console.log(`  Token de entrada por exemplo: média ${resumo.entradaMedia}, mediana ${resumo.entradaMediana}, min ${resumo.entradaMin}, max ${resumo.entradaMax}`);
      console.log(`  Token de saída por exemplo: média ${resumo.saidaMedia}, mediana ${resumo.saidaMediana}, min ${resumo.saidaMin}, max ${resumo.saidaMax}`);
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
