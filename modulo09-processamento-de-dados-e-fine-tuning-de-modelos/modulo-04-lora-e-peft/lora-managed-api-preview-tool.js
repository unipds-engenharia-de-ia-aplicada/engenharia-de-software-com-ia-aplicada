/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 4.2
 *
 * Companion de local-lora-training-tool.js. O MLX-LM não tem binding nativo
 * em Node -- o outro arquivo deste módulo monta um comando e dispara um
 * processo Python via child_process, uma API do sistema operacional, não
 * uma API de ML. Este arquivo mostra o outro lado: como a MESMA
 * configuração de LoRA que treinamos localmente (rank 8, scale 20.0,
 * dropout 0.0 -- valores reais de mlx-adapters/adapter_config.json) fica
 * quando enviada de verdade em JavaScript, via fetch(), pra uma API
 * gerenciada que expõe os parâmetros de LoRA no corpo da requisição: a API de
 * fine-tuning da Together AI (endpoint e formato de payload verificados
 * contra a documentação oficial em 2026-08-22, ver docs.together.ai).
 *
 * Não é uma chamada simulada: monta a requisição HTTP real (URL, headers,
 * corpo) e só a envia de verdade se TOGETHER_API_KEY estiver configurada no
 * ambiente -- sem a chave, imprime a requisição que seria enviada e para
 * aí, sem fingir uma resposta que não existe.
 *
 * Ressalva de honestidade: "scale" (MLX-LM) e "lora_alpha" (Together AI)
 * não são garantidamente definidos de forma idêntica entre frameworks --
 * os dois controlam a magnitude do ajuste de baixo posto, mas a fórmula
 * exata pode variar. Este arquivo usa o mesmo valor numérico (20) como
 * ponte ilustrativa, não como equivalência matemática comprovada.
 *
 * Uso: node lora-managed-api-preview-tool.js
 *
 * Par oficial desta disciplina: lora-managed-api-preview-tool.js (oficial) /
 * lora_managed_api_preview_tool.py (referência espelhada).
 */

'use strict';

const assert = require('assert').strict;

const TOGETHER_ENDPOINT = 'https://api.together.ai/v1/fine-tunes';

/* ============================================================================
 * 1. Configuração real reaproveitada do treino local (M4.2)
 * ========================================================================= */

const CONFIG_TREINADA_LOCAL = Object.freeze({
  rank: 8,
  dropout: 0.0,
  scale: 20.0,
});

/* ============================================================================
 * 2. Montagem da requisição real (função pura, testável sem rede)
 * ========================================================================= */

function montarRequisicaoLoraGerenciada({
  apiKey,
  trainingFileId,
  modelo = 'meta-llama/Meta-Llama-3.1-8B-Instruct-Reference',
  loraConfig = CONFIG_TREINADA_LOCAL,
} = {}) {
  if (!trainingFileId) {
    throw new Error('trainingFileId é obrigatório (id do arquivo já enviado à API)');
  }
  return {
    url: TOGETHER_ENDPOINT,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey || '<TOGETHER_API_KEY>'}`,
      'Content-Type': 'application/json',
    },
    body: {
      model: modelo,
      training_file: trainingFileId,
      training_type: {
        type: 'Lora',
        lora_r: loraConfig.rank,
        lora_alpha: loraConfig.scale,
        lora_dropout: loraConfig.dropout,
        lora_trainable_modules: 'all-linear',
      },
    },
  };
}

/* ============================================================================
 * 3. Envio real -- só dispara se TOGETHER_API_KEY existir no ambiente
 * ========================================================================= */

async function enviarOuPrever(trainingFileId) {
  const apiKey = process.env.TOGETHER_API_KEY;
  const requisicao = montarRequisicaoLoraGerenciada({ apiKey, trainingFileId });

  if (!apiKey) {
    console.log('TOGETHER_API_KEY não configurada -- modo preview, nada foi enviado.');
    console.log(JSON.stringify({ ...requisicao, headers: { ...requisicao.headers, Authorization: 'Bearer <TOGETHER_API_KEY>' } }, null, 2));
    return { modo: 'preview', requisicao };
  }

  const resposta = await fetch(requisicao.url, {
    method: requisicao.method,
    headers: requisicao.headers,
    body: JSON.stringify(requisicao.body),
  });
  const corpo = await resposta.json();
  if (!resposta.ok) {
    throw new Error(`Together AI recusou a requisição (${resposta.status}): ${JSON.stringify(corpo)}`);
  }
  console.log('Job de fine-tuning LoRA criado de verdade:', corpo);
  return { modo: 'real', requisicao, resposta: corpo };
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
  console.log('== Testes: montagem da requisição LoRA gerenciada ==');

  testar('usa o endpoint real de fine-tuning da Together AI', () => {
    const req = montarRequisicaoLoraGerenciada({ trainingFileId: 'file-abc123' });
    assert.equal(req.url, 'https://api.together.ai/v1/fine-tunes');
    assert.equal(req.method, 'POST');
  });

  testar('exige trainingFileId', () => {
    assert.throws(() => montarRequisicaoLoraGerenciada({}), /trainingFileId é obrigatório/);
  });

  testar('reaproveita rank 8 / scale 20.0 / dropout 0.0 do treino real de M4.2', () => {
    const req = montarRequisicaoLoraGerenciada({ trainingFileId: 'file-abc123' });
    assert.equal(req.body.training_type.lora_r, 8);
    assert.equal(req.body.training_type.lora_alpha, 20.0);
    assert.equal(req.body.training_type.lora_dropout, 0.0);
  });

  testar('corpo da requisição usa o formato training_type.type = "Lora" documentado', () => {
    const req = montarRequisicaoLoraGerenciada({ trainingFileId: 'file-abc123' });
    assert.equal(req.body.training_type.type, 'Lora');
    assert.ok('training_file' in req.body);
    assert.ok('model' in req.body);
  });

  testar('sem apiKey, o header Authorization usa placeholder (nunca string vazia)', () => {
    const req = montarRequisicaoLoraGerenciada({ trainingFileId: 'file-abc123' });
    assert.equal(req.headers.Authorization, 'Bearer <TOGETHER_API_KEY>');
  });

  testar('com apiKey, o header Authorization carrega a chave de verdade', () => {
    const req = montarRequisicaoLoraGerenciada({ trainingFileId: 'file-abc123', apiKey: 'sk-real-123' });
    assert.equal(req.headers.Authorization, 'Bearer sk-real-123');
  });

  console.log(`\n${totalTestes - testesComFalha}/${totalTestes} testes passaram.`);
  if (testesComFalha > 0) process.exitCode = 1;
}

if (require.main === module) {
  rodarTestes();
  enviarOuPrever('file-exemplo-amplitude-seguros').catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
}

module.exports = {
  TOGETHER_ENDPOINT,
  CONFIG_TREINADA_LOCAL,
  montarRequisicaoLoraGerenciada,
  enviarOuPrever,
};

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
