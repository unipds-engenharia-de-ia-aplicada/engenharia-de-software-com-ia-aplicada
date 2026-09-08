/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 4.2 (Demo, parte 3 -- companion)
 *
 * A gravação do Módulo 4.2 ficou sem tempo pra parte 3 da demo ao vivo
 * (comparar a saída do modelo com e sem o adaptador). Este arquivo é o
 * companion pra rodar exatamente essa comparação por conta própria: chama
 * `python3 -m mlx_lm generate` duas vezes contra o MESMO exemplo real do
 * conjunto de teste (índice 8 de mlx-data/test.jsonl, o recibo médico de
 * Felipe Alves Monteiro) -- uma vez sem --adapter-path, uma vez com --, e
 * compara as duas saídas. Mesmo par modelo+adaptador que
 * local-lora-training-tool.js treina (mlx-community/gemma-4-e2b-it-bf16 +
 * ./mlx-adapters, rank 8).
 *
 * Resultado real capturado nesta máquina em 2026-09-04, com o adaptador do
 * próprio treino gravado no vídeo do Módulo 4.2 (mlx-adapters/, treinado
 * 09:51-10:35 no dia da gravação):
 *   - SEM adaptador: 80 tokens gerados (bateu no limite), o modelo entra
 *     num modo de raciocínio em texto livre e nunca chega a um JSON.
 *   - COM adaptador: 28 tokens gerados, JSON exato batendo com o gabarito
 *     campo a campo: {"beneficiario":"Felipe Alves Monteiro",
 *     "procedimento":"consulta de clinica geral","valor":3450}
 * Esses são os mesmos números citados no teleprompter do Módulo 4.2.
 *
 * Uso: node adapter-comparison-tool.js
 * Roda de verdade -- carrega o modelo duas vezes, gera duas vezes, leva
 * uns 30-40s no total. Não é uma simulação nem um resultado pré-gravado.
 *
 * Par oficial desta disciplina: adapter-comparison-tool.js (oficial) /
 * adapter_comparison_tool.py (referência espelhada).
 */

'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MODELO_BASE = 'mlx-community/gemma-4-e2b-it-bf16';
const ADAPTER_PATH = path.join(__dirname, 'mlx-adapters');
const TEST_JSONL = path.join(__dirname, 'mlx-data', 'test.jsonl');
const INDICE_EXEMPLO = 8; // Felipe Alves Monteiro, recibo médico -- o exemplo citado no TP
const MAX_TOKENS = 80;

/* ============================================================================
 * 1. Carregar o exemplo real do conjunto de teste (o mesmo que o TP cita)
 * ========================================================================= */

function carregarExemploTeste(indice = INDICE_EXEMPLO, caminho = TEST_JSONL) {
  const linhas = fs.readFileSync(caminho, 'utf-8').trim().split('\n');
  if (indice < 0 || indice >= linhas.length) {
    throw new Error(`índice ${indice} fora do intervalo (0-${linhas.length - 1})`);
  }
  const exemplo = JSON.parse(linhas[indice]);
  const prompt = exemplo.messages[0].content;
  const gabarito = JSON.parse(exemplo.messages[1].content);
  return { prompt, gabarito };
}

/* ============================================================================
 * 2. Montar os argumentos do mlx_lm.generate (função pura, testável sem
 *    rodar nada)
 * ========================================================================= */

function montarArgumentosGenerate({
  prompt, adapterPath = null, maxTokens = MAX_TOKENS, modelo = MODELO_BASE,
}) {
  const args = [
    '-m', 'mlx_lm', 'generate',
    '--model', modelo,
    '--prompt', prompt,
    '--max-tokens', String(maxTokens),
  ];
  if (adapterPath) {
    args.push('--adapter-path', adapterPath);
  }
  return args;
}

/* ============================================================================
 * 3. Parsear a saída real do mlx_lm.generate (texto entre os dois
 *    separadores "==========" + a linha "Generation: N tokens")
 * ========================================================================= */

function parsearSaidaGenerate(textoSaida) {
  const blocos = textoSaida.split('==========');
  if (blocos.length < 3) {
    throw new Error('saída não tem o formato esperado (dois separadores "==========")');
  }
  const textoGerado = blocos[1].trim();
  const matchTokens = textoSaida.match(/Generation: (\d+) tokens/);
  const tokensGerados = matchTokens ? Number(matchTokens[1]) : null;
  let json = null;
  try {
    json = JSON.parse(textoGerado);
  } catch {
    json = null;
  }
  return {
    textoGerado,
    tokensGerados,
    json,
    bateuNoLimiteDeTokens: tokensGerados !== null && tokensGerados >= MAX_TOKENS,
  };
}

function compararComGabarito(json, gabarito) {
  if (!json) return false;
  return Object.keys(gabarito).every((chave) => json[chave] === gabarito[chave]);
}

/* ============================================================================
 * 4. Rodar de verdade -- spawnSync porque a comparação é sequencial por
 *    natureza (roda um, mostra, roda o outro, mostra)
 * ========================================================================= */

function rodarGenerateReal(args, spawnFn = spawnSync) {
  const resultado = spawnFn('python3', args, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  if (resultado.error) {
    throw resultado.error;
  }
  if (resultado.status !== 0) {
    throw new Error(`mlx_lm generate saiu com código ${resultado.status}:\n${resultado.stderr}`);
  }
  // mlx_lm manda parte da saída (barra de progresso do download) pro stderr
  return `${resultado.stdout}\n${resultado.stderr}`;
}

/* --------------------------------------------------------------------------
 * Testes automatizados -- contra saída real capturada nesta máquina em
 * 2026-09-04, sem precisar rodar o modelo de novo pra validar o parser
 * -------------------------------------------------------------------------- */

const SAIDA_REAL_SEM_ADAPTADOR = `==========
<|channel>thought
Here's a thinking process to extract the requested information:

1.  **Analyze the Request:** The user wants to extract three specific pieces of information from the provided text (a medical receipt/summary):
    *   Beneficiário (Beneficiary)
    *   Procedimento (Procedure)
    *   Valor (Value/Amount)

2.  **
==========
Prompt: 119 tokens, 119.302 tokens-per-sec
Generation: 80 tokens, 52.503 tokens-per-sec
Peak memory: 9.406 GB`;

const SAIDA_REAL_COM_ADAPTADOR = `==========
{"beneficiario":"Felipe Alves Monteiro","procedimento":"consulta de clinica geral","valor":3450}
==========
Prompt: 119 tokens, 161.590 tokens-per-sec
Generation: 28 tokens, 43.129 tokens-per-sec
Peak memory: 9.406 GB`;

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
  console.log('== Testes: montagem de argumentos e parsing da saída real ==');

  testar('carrega o exemplo real (índice 8) e é o recibo do Felipe Alves Monteiro', () => {
    const { gabarito } = carregarExemploTeste();
    assert.equal(gabarito.beneficiario, 'Felipe Alves Monteiro');
    assert.equal(gabarito.procedimento, 'consulta de clinica geral');
    assert.equal(gabarito.valor, 3450);
  });

  testar('monta argumentos sem --adapter-path quando adapterPath não é passado', () => {
    const args = montarArgumentosGenerate({ prompt: 'x' });
    assert.ok(!args.includes('--adapter-path'));
  });

  testar('monta argumentos com --adapter-path quando adapterPath é passado', () => {
    const args = montarArgumentosGenerate({ prompt: 'x', adapterPath: '/caminho/adapters' });
    const idx = args.indexOf('--adapter-path');
    assert.ok(idx !== -1);
    assert.equal(args[idx + 1], '/caminho/adapters');
  });

  testar('parseia a saída real SEM adaptador: 80 tokens, bateu no limite, não é JSON', () => {
    const r = parsearSaidaGenerate(SAIDA_REAL_SEM_ADAPTADOR);
    assert.equal(r.tokensGerados, 80);
    assert.equal(r.bateuNoLimiteDeTokens, true);
    assert.equal(r.json, null);
  });

  testar('parseia a saída real COM adaptador: 28 tokens, não bateu no limite, JSON válido', () => {
    const r = parsearSaidaGenerate(SAIDA_REAL_COM_ADAPTADOR);
    assert.equal(r.tokensGerados, 28);
    assert.equal(r.bateuNoLimiteDeTokens, false);
    assert.deepEqual(r.json, {
      beneficiario: 'Felipe Alves Monteiro',
      procedimento: 'consulta de clinica geral',
      valor: 3450,
    });
  });

  testar('compararComGabarito bate campo a campo quando o JSON é igual ao gabarito', () => {
    const { json } = parsearSaidaGenerate(SAIDA_REAL_COM_ADAPTADOR);
    const gabarito = { beneficiario: 'Felipe Alves Monteiro', procedimento: 'consulta de clinica geral', valor: 3450 };
    assert.equal(compararComGabarito(json, gabarito), true);
  });

  testar('compararComGabarito falha se faltar JSON (caso sem adaptador)', () => {
    const { json } = parsearSaidaGenerate(SAIDA_REAL_SEM_ADAPTADOR);
    const gabarito = { beneficiario: 'Felipe Alves Monteiro' };
    assert.equal(compararComGabarito(json, gabarito), false);
  });

  console.log(`\n${totalTestes - testesComFalha}/${totalTestes} testes passaram.`);
  if (testesComFalha > 0) process.exitCode = 1;
}

/* ============================================================================
 * 5. Comparação real -- roda os dois `mlx_lm generate` de verdade
 * ========================================================================= */

function rodarComparacaoReal() {
  const { prompt, gabarito } = carregarExemploTeste();

  console.log('\n===== Demo parte 3: mesmo exemplo real, com e sem o adaptador =====\n');
  console.log('Exemplo (índice 8, mlx-data/test.jsonl):');
  console.log(`${prompt.split('\n').slice(0, 2).join(' ')} ...\n`);

  console.log('Rodando SEM adaptador (carrega o modelo, ~15-20s)...');
  const saidaSem = parsearSaidaGenerate(rodarGenerateReal(montarArgumentosGenerate({ prompt })));

  console.log('Rodando COM adaptador (~15-20s)...');
  const saidaCom = parsearSaidaGenerate(
    rodarGenerateReal(montarArgumentosGenerate({ prompt, adapterPath: ADAPTER_PATH })),
  );

  console.log('\n--- SEM adaptador ---');
  console.log(`${saidaSem.tokensGerados} tokens gerados${saidaSem.bateuNoLimiteDeTokens ? ' -- bateu no limite, não terminou' : ''}`);
  console.log(saidaSem.textoGerado.length > 220 ? `${saidaSem.textoGerado.slice(0, 220)}...` : saidaSem.textoGerado);
  console.log(`Bate com o gabarito? ${compararComGabarito(saidaSem.json, gabarito)}`);

  console.log('\n--- COM adaptador ---');
  console.log(`${saidaCom.tokensGerados} tokens gerados`);
  console.log(saidaCom.textoGerado);
  console.log(`Bate com o gabarito? ${compararComGabarito(saidaCom.json, gabarito)}`);

  console.log(
    `\nConclusão: ${saidaCom.tokensGerados} tokens de diferença de configuração (o adaptador de 27MB) `
    + `são a diferença entre um modelo que ${compararComGabarito(saidaSem.json, gabarito) ? 'também acerta' : 'não chega a um JSON'} `
    + `e um modelo que acerta o formato inteiro, campo a campo, num exemplo que nunca esteve no treino.`,
  );

  return { saidaSem, saidaCom, gabarito };
}

if (require.main === module) {
  rodarTestes();
  rodarComparacaoReal();
}

module.exports = {
  MODELO_BASE,
  ADAPTER_PATH,
  INDICE_EXEMPLO,
  carregarExemploTeste,
  montarArgumentosGenerate,
  parsearSaidaGenerate,
  compararComGabarito,
  rodarGenerateReal,
  rodarComparacaoReal,
};

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
