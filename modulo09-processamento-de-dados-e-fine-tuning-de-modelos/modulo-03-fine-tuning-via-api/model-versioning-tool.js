/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 3.5
 *
 * Ferramenta: versionamento e documentação de modelo fine-tunado. Gera uma
 * ficha de versionamento real, a partir do job de verdade dos Módulos 3.2 a
 * 3.4, com identificador de dataset baseado em conteúdo (hash SHA-256, o
 * mesmo princípio de versionamento por conteúdo que git e Docker usam),
 * não em nome de arquivo ou data, que podem mudar sem o conteúdo mudar.
 *
 * Uso: node model-versioning-tool.js
 *
 * Nota de validade (ago/2026): este script não tem constante de modelo pra
 * trocar - ele consulta o job real (JOB_REAL acima) e usa o que a API
 * devolver (job.baseModel), então sempre reflete a versão de verdade usada
 * naquele job específico, não uma suposição hardcoded. A Google aposenta
 * versões do Gemini com aviso prévio (a família 2.5 tem retirement anunciado
 * pra 16/out/2026); confira em
 * https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes
 * quais modelos têm suporte a fine-tuning supervisionado no momento. Essa
 * mesma nota também sai embutida automaticamente no model card que este
 * script gera (função gerarModelCard, o texto do rodapé "Este model card
 * documenta...").
 */

'use strict';

const assert = require('assert').strict;
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REGIAO = 'us-central1';
const JOB_REAL = 'projects/113512199474/locations/us-central1/tuningJobs/4180970763655839744';
const CAMINHO_DATASET = path.join(__dirname, 'dataset-treinado.jsonl');

// Job real de preference tuning (DPO) do Módulo 3.5, continuação do job SFT
// acima sobre o mesmo modelo base. Histórico e congelado (já concluído em
// 2026-08), por isso é uma constante, não uma consulta nova à API a cada
// rodada -- ao contrário do job SFT acima, que é sempre revalidado de verdade.
const JOB_DPO_REAL = {
  jobId: 'tuningJobs/3733013646142341120',
  estado: 'JOB_STATE_SUCCEEDED',
  duracaoFormatada: '17min 32s',
  exemplos: 40,
};

// Faixa de custo de GPU cloud por hora, do cheatsheet do Modulo 1.3
// (fine-tuning-types-cheatsheet.md, secao LoRA): referencia de mercado, nao
// a fatura real do job (Vertex AI cobra por token de treino, nao por hora de GPU).
const FAIXA_CUSTO_GPU_CLOUD_USD_HORA = {
  consumerMin: 0.40,
  consumerMax: 0.80,
  h100Min: 2.50,
  h100Max: 4.00,
};

/* --------------------------------------------------------------------------
 * 1. Hash de conteúdo do dataset (versionamento por conteúdo)
 * -------------------------------------------------------------------------- */

function calcularHashDataset(caminhoArquivo) {
  const conteudo = fs.readFileSync(caminhoArquivo);
  return crypto.createHash('sha256').update(conteudo).digest('hex');
}

/* --------------------------------------------------------------------------
 * 2. Consulta ao job real
 * -------------------------------------------------------------------------- */

/* ============================================================================
 * >>> DAQUI PRA BAIXO: ORQUESTRAÇÃO GOOGLE CLOUD -- chamada de rede real <<<
 * Exige projeto com billing ativo (aiplatform.googleapis.com). Tudo ACIMA
 * desta marca (hash do dataset) e tudo ABAIXO da Seção 3 (duração, custo,
 * ficha, model card) roda 100% local, sem tocar rede e sem custo nenhum --
 * só esta consulta ao job já criado toca a nuvem de verdade.
 * ============================================================================ */

function obterTokenAcesso() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function consultarJobCompleto(nomeJob) {
  const token = obterTokenAcesso();
  const url = `https://${REGIAO}-aiplatform.googleapis.com/v1/${nomeJob}`;
  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resposta.ok) throw new Error(`Falha ao consultar job: ${resposta.status} ${resposta.statusText}`);
  return resposta.json();
}

function calcularDuracaoSegundos(criadoEm, concluidoEm) {
  const inicio = new Date(criadoEm);
  const fim = new Date(concluidoEm);
  return (fim.getTime() - inicio.getTime()) / 1000;
}

function formatarDuracao(duracaoSegundos) {
  const minutos = Math.floor(duracaoSegundos / 60);
  const segundos = Math.round(duracaoSegundos - minutos * 60);
  return `${minutos}min ${segundos}s`;
}

function formatarUsd(valor) {
  return valor.toFixed(2).replace('.', ',');
}

function formatarBrl(valor) {
  return valor.toFixed(2).replace('.', ',');
}

function formatarMilhar(numero) {
  return numero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Taxa real apurada no relatório de billing por SKU de agosto/2026 (conferida
// de novo em 28/08/2026 contra o CSV diário: R$2,39 em 07/08 = exatamente
// 27.353 tokens x 3 épocas do job do Módulo 3.2, linha literal de fatura).
const TAXA_REAL_POR_UNIDADE = 0.00002909;

function calcularCustoReal(tokensCobraveis, epochCount) {
  if (tokensCobraveis == null || epochCount == null) return null;
  const unidades = tokensCobraveis * epochCount;
  return {
    unidades,
    custoReais: Math.round(unidades * TAXA_REAL_POR_UNIDADE * 100) / 100,
  };
}

function calcularCustoEstimado(duracaoSegundos) {
  const duracaoHoras = duracaoSegundos / 3600;
  const faixa = FAIXA_CUSTO_GPU_CLOUD_USD_HORA;
  return {
    duracaoSegundos: Math.round(duracaoSegundos * 1000) / 1000,
    duracaoFormatada: formatarDuracao(duracaoSegundos),
    consumerMinUsd: Math.round(duracaoHoras * faixa.consumerMin * 100) / 100,
    consumerMaxUsd: Math.round(duracaoHoras * faixa.consumerMax * 100) / 100,
    h100MinUsd: Math.round(duracaoHoras * faixa.h100Min * 100) / 100,
    h100MaxUsd: Math.round(duracaoHoras * faixa.h100Max * 100) / 100,
  };
}

/* --------------------------------------------------------------------------
 * 3. Ficha de versionamento
 * -------------------------------------------------------------------------- */

function gerarFichaVersionamento(job, hashDataset) {
  if (!job || !job.name) throw new Error('job inválido: precisa ter ao menos "name"');
  const hiper = job.supervisedTuningSpec?.hyperParameters || {};
  const stats = job.tuningDataStats?.supervisedTuningDataStats || {};
  const tunedModel = job.tunedModel || {};

  let custoEstimado = null;
  if (job.createTime && job.endTime) {
    const duracaoSegundos = calcularDuracaoSegundos(job.createTime, job.endTime);
    custoEstimado = calcularCustoEstimado(duracaoSegundos);
  }
  const custoReal = calcularCustoReal(stats.totalBillableTokenCount ?? null, hiper.epochCount ?? null);

  return {
    jobId: job.name,
    modeloBase: job.baseModel || null,
    nomeExibicao: job.tunedModelDisplayName || null,
    datasetUri: job.supervisedTuningSpec?.trainingDatasetUri || null,
    datasetHashSha256: hashDataset,
    hiperparametros: {
      epochCount: hiper.epochCount ?? null,
      learningRateMultiplier: hiper.learningRateMultiplier ?? null,
      adapterSize: hiper.adapterSize ?? null,
    },
    estatisticaDataset: {
      exemplos: stats.tuningDatasetExampleCount ?? null,
      tokensCobraveis: stats.totalBillableTokenCount ?? null,
    },
    modeloAjustado: tunedModel.model || null,
    endpoint: tunedModel.endpoint || null,
    criadoEm: job.createTime || null,
    concluidoEm: job.endTime || null,
    estado: job.state || null,
    custoEstimado,
    custoReal,
  };
}

function validarFichaCompleta(ficha) {
  const camposObrigatorios = ['jobId', 'modeloBase', 'datasetUri', 'datasetHashSha256', 'modeloAjustado', 'endpoint'];
  const faltando = camposObrigatorios.filter((campo) => !ficha[campo]);
  if (faltando.length > 0) {
    throw new Error(`Ficha de versionamento incompleta, faltam: ${faltando.join(', ')}`);
  }
  return true;
}

function gerarModelCardMarkdown(ficha) {
  const linhas = [
    `# Model Card, modelo fine-tunado`,
    ``,
    `## Identificação`,
    `- Job: ${ficha.jobId}`,
    `- Modelo ajustado: ${ficha.modeloAjustado}`,
    `- Endpoint: ${ficha.endpoint}`,
    `- Estado: ${ficha.estado}`,
    ``,
    `## Linhagem`,
    `- Modelo base: ${ficha.modeloBase}`,
    `- Dataset de treino: ${ficha.datasetUri}`,
    `- Hash SHA-256 do dataset: ${ficha.datasetHashSha256}`,
    ``,
    `## Hiperparâmetros`,
    `- Épocas: ${ficha.hiperparametros.epochCount}`,
    `- Taxa de aprendizado (multiplicador): ${ficha.hiperparametros.learningRateMultiplier}`,
    `- Rank do adaptador (LoRA): ${ficha.hiperparametros.adapterSize}`,
    ``,
    `## Estatística do dataset`,
    `- Exemplos de treino: ${ficha.estatisticaDataset.exemplos}`,
    `- Tokens cobráveis no total: ${ficha.estatisticaDataset.tokensCobraveis}`,
    ``,
    `## Linha do tempo`,
    `- Criado em: ${ficha.criadoEm}`,
    `- Concluído em: ${ficha.concluidoEm}`,
    ``,
  ];

  if (ficha.custoEstimado) {
    const custo = ficha.custoEstimado;
    linhas.push(`## Custo real`, `- Duração real do job: ${custo.duracaoFormatada}`);
    let notaFinal = `Nota: a Vertex AI cobra por token de treino, não por hora de GPU alugada; a faixa de GPU acima é referência de mercado pra comparar com o custo de rodar o mesmo tipo de treino (LoRA) em infraestrutura própria, não a fatura real deste job.`;
    if (ficha.custoReal) {
      const tokens = ficha.estatisticaDataset.tokensCobraveis;
      const epocas = ficha.hiperparametros.epochCount;
      linhas.push(
        `- **Custo real, conferido no billing do Google Cloud (28/08/2026)**: R$${formatarBrl(ficha.custoReal.custoReais)} (${formatarMilhar(tokens)} tokens faturáveis × ${epocas} épocas = ${formatarMilhar(ficha.custoReal.unidades)} unidades cobradas, à taxa real de R$0,00002909/unidade apurada no relatório de billing por SKU de agosto/2026)`
      );
      notaFinal = `Nota: a Vertex AI cobra por token de treino, não por hora de GPU alugada; a faixa de GPU acima é referência de mercado pra comparar com o custo de rodar o mesmo tipo de treino (LoRA) em infraestrutura própria - o valor real deste job específico é o R$${formatarBrl(ficha.custoReal.custoReais)} conferido no billing, acima.`;
    }
    linhas.push(
      `- Faixa GPU cloud consumer (US$ 0,40-0,80/hora, cheatsheet do Módulo 1.3): US$ ${formatarUsd(custo.consumerMinUsd)}-${formatarUsd(custo.consumerMaxUsd)}`,
      `- Faixa GPU cloud H100 (US$ 2,50-4,00/hora, cheatsheet do Módulo 1.3): US$ ${formatarUsd(custo.h100MinUsd)}-${formatarUsd(custo.h100MaxUsd)}`,
      notaFinal,
      ``,
    );
  }

  linhas.push(
    `## Nota de validade (ago/2026)`,
    `Este model card documenta um job real, rodado com ${ficha.modeloBase}. O processo -- upload, hiperparâmetro, versionamento -- é o mesmo independente da versão exata do modelo-base. A Google aposenta versões do Gemini com aviso prévio (a família 2.5 tem retirement anunciado pra 16/out/2026); antes de treinar você mesmo, confira em [Vertex AI release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes) quais modelos têm suporte a fine-tuning supervisionado no momento.`,
  );

  return linhas.join('\n');
}

/**
 * Seção fixa sobre o job real de preference tuning (DPO) do Módulo 3.5,
 * continuação do job SFT documentado acima sobre o mesmo modelo base.
 * Separada de gerarModelCardMarkdown de propósito: aquela função é sempre
 * gerada a partir de um `job` consultado ao vivo na API (pode mudar de
 * conteúdo a cada rodada real), esta é um fato histórico já congelado
 * (job concluído em 2026-08) que não depende de nenhuma consulta nova.
 */
function gerarSecaoDPO() {
  const j = JOB_DPO_REAL;
  return [
    ``,
    `## Continuação: preference tuning (DPO)`,
    ``,
    `O Módulo 3.5 vai além do fine-tuning supervisionado acima e testa preference tuning (DPO) sobre o mesmo modelo base: 40 dos 200 exemplos deste job foram convertidos em pares de preferência (\`chosen\`/\`rejected\`) - a extração correta de sempre (\`chosen\`) contra uma resposta real gerada por um prompt deliberadamente mais fraco (\`rejected\`, sem exigir JSON estrito). O dataset de preferência resultante está em \`preference-dataset-amplitude.jsonl\`, nesta mesma pasta.`,
    ``,
    `- Job: \`${j.jobId}\``,
    `- Estado: ${j.estado}`,
    `- Duração real: ${j.duracaoFormatada} (mais rápido que o SFT acima, dataset 5x menor: ${j.exemplos} exemplos contra 200)`,
    `- Exemplos: ${j.exemplos} pares de preferência`,
  ].join('\n');
}

/* --------------------------------------------------------------------------
 * 4. Testes automatizados
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
  console.log('== Testes: hash de conteúdo do dataset ==');

  testar('hash do mesmo arquivo, calculado duas vezes, é idêntico', () => {
    const hash1 = calcularHashDataset(CAMINHO_DATASET);
    const hash2 = calcularHashDataset(CAMINHO_DATASET);
    assert.equal(hash1, hash2);
  });

  testar('hash tem 64 caracteres hexadecimais (SHA-256)', () => {
    const hash = calcularHashDataset(CAMINHO_DATASET);
    assert.equal(hash.length, 64);
    assert.ok(/^[0-9a-f]+$/.test(hash));
  });

  testar('conteúdo diferente gera hash diferente', () => {
    const arquivoTemporario = path.join(__dirname, '_teste_hash_temp.jsonl');
    fs.writeFileSync(arquivoTemporario, '{"diferente": true}\n');
    const hashOriginal = calcularHashDataset(CAMINHO_DATASET);
    const hashDiferente = calcularHashDataset(arquivoTemporario);
    fs.unlinkSync(arquivoTemporario);
    assert.notEqual(hashOriginal, hashDiferente);
  });

  console.log();
  console.log('== Testes: ficha de versionamento ==');

  const jobFalso = {
    name: 'projects/x/locations/y/tuningJobs/123',
    baseModel: 'gemini-2.5-flash',
    tunedModelDisplayName: 'teste',
    state: 'JOB_STATE_SUCCEEDED',
    createTime: '2026-08-08T00:00:00Z',
    endTime: '2026-08-08T01:00:00Z',
    supervisedTuningSpec: {
      trainingDatasetUri: 'gs://bucket/dataset.jsonl',
      hyperParameters: { epochCount: 3, learningRateMultiplier: 5, adapterSize: 'ADAPTER_SIZE_FOUR' },
    },
    tuningDataStats: {
      supervisedTuningDataStats: { tuningDatasetExampleCount: 200, totalBillableTokenCount: 27353 },
    },
    tunedModel: { model: 'projects/x/locations/y/models/999', endpoint: 'projects/x/locations/y/endpoints/888' },
  };

  testar('gera ficha completa a partir de um job bem formado', () => {
    const ficha = gerarFichaVersionamento(jobFalso, 'hash-de-teste');
    assert.equal(ficha.jobId, jobFalso.name);
    assert.equal(ficha.hiperparametros.epochCount, 3);
    assert.equal(ficha.datasetHashSha256, 'hash-de-teste');
  });

  testar('rejeita job sem name', () => {
    assert.throws(() => gerarFichaVersionamento({}, 'hash'), /job inválido/);
  });

  testar('validação aceita ficha completa', () => {
    const ficha = gerarFichaVersionamento(jobFalso, 'hash-de-teste');
    assert.equal(validarFichaCompleta(ficha), true);
  });

  testar('validação rejeita ficha com endpoint ausente', () => {
    const ficha = gerarFichaVersionamento(jobFalso, 'hash-de-teste');
    delete ficha.endpoint;
    assert.throws(() => validarFichaCompleta(ficha), /endpoint/);
  });

  testar('custo estimado usa a duração real do job (createTime/endTime)', () => {
    const ficha = gerarFichaVersionamento(jobFalso, 'hash-de-teste');
    // jobFalso dura exatamente 1h (00:00:00Z -> 01:00:00Z): custo = taxa/hora direto
    assert.equal(ficha.custoEstimado.duracaoFormatada, '60min 0s');
    assert.equal(ficha.custoEstimado.consumerMinUsd, 0.40);
    assert.equal(ficha.custoEstimado.consumerMaxUsd, 0.80);
    assert.equal(ficha.custoEstimado.h100MinUsd, 2.50);
    assert.equal(ficha.custoEstimado.h100MaxUsd, 4.00);
  });

  testar('formata a duração real de 45min42s do job de produção', () => {
    // duração real do job de produção desta ficha: 45min42s (02:38:12.307201Z -> 03:23:54.310390Z)
    const segundos = calcularDuracaoSegundos('2026-08-08T02:38:12.307201Z', '2026-08-08T03:23:54.310390Z');
    assert.equal(formatarDuracao(segundos), '45min 42s');
  });

  console.log();
  console.log('== Testes: geração do model card ==');

  testar('model card inclui o hash do dataset', () => {
    const ficha = gerarFichaVersionamento(jobFalso, 'hash-de-teste-abc123');
    const markdown = gerarModelCardMarkdown(ficha);
    assert.ok(markdown.includes('hash-de-teste-abc123'));
  });

  testar('model card inclui endpoint e modelo ajustado', () => {
    const ficha = gerarFichaVersionamento(jobFalso, 'hash-de-teste');
    const markdown = gerarModelCardMarkdown(ficha);
    assert.ok(markdown.includes(jobFalso.tunedModel.endpoint));
    assert.ok(markdown.includes(jobFalso.tunedModel.model));
  });

  testar('model card inclui o custo real, calculado da ficha, e a faixa de GPU de referência', () => {
    const ficha = gerarFichaVersionamento(jobFalso, 'hash-de-teste');
    const markdown = gerarModelCardMarkdown(ficha);
    assert.ok(markdown.includes('## Custo real'));
    assert.ok(markdown.includes('R$2,39'));
    assert.ok(markdown.includes('82.059 unidades cobradas'));
    assert.ok(markdown.includes('US$ 0,40-0,80'));
    assert.ok(markdown.includes('US$ 2,50-4,00'));
  });

  testar('custo real usa tokens faturáveis x épocas x taxa real do billing', () => {
    const ficha = gerarFichaVersionamento(jobFalso, 'hash-de-teste');
    // jobFalso: 27.353 tokens x 3 épocas = 82.059 unidades x R$0,00002909 = R$2,39
    assert.equal(ficha.custoReal.unidades, 82059);
    assert.equal(ficha.custoReal.custoReais, 2.39);
  });

  testar('seção de DPO cita o job real de preference tuning do Módulo 3.5', () => {
    const secao = gerarSecaoDPO();
    assert.ok(secao.includes('## Continuação: preference tuning (DPO)'));
    assert.ok(secao.includes('tuningJobs/3733013646142341120'));
    assert.ok(secao.includes('17min 32s'));
    assert.ok(secao.includes('40 pares de preferência'));
    assert.ok(secao.includes('preference-dataset-amplitude.jsonl'));
  });

  console.log();
  console.log(`Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ${testesComFalha} falhou(falharam).`);
}

/* --------------------------------------------------------------------------
 * 5. Execução principal
 * -------------------------------------------------------------------------- */

async function main() {
  rodarTestes();

  console.log();
  console.log('== Ficha de versionamento real, gerada a partir do job de produção ==');

  const hashDataset = calcularHashDataset(CAMINHO_DATASET);
  console.log(`Hash SHA-256 do dataset de treino (200 exemplos): ${hashDataset}`);

  try {
    const job = await consultarJobCompleto(JOB_REAL);
    const ficha = gerarFichaVersionamento(job, hashDataset);
    validarFichaCompleta(ficha);

    console.log('\nFicha completa e validada:');
    console.log(JSON.stringify(ficha, null, 2));

    const markdown = gerarModelCardMarkdown(ficha) + '\n' + gerarSecaoDPO();
    const caminhoSaida = path.join(__dirname, 'model-card-amplitude-auto-saude-m3-200.md');
    fs.writeFileSync(caminhoSaida, markdown);
    console.log(`\nModel card gerado em: ${caminhoSaida}`);
  } catch (erro) {
    console.log(`Não foi possível gerar a ficha agora: ${erro.message}`);
  }
}

main();

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
