/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 4.3 (Demo, parte 2 -- companion)
 *
 * Roda o exemplo difícil do TP (Boa Vista Reparos Automotivos, com dois
 * valores distratores antes do valor certo) sem adaptador e com os três
 * postos testados no módulo -- rank 4, 8 (reaproveita o adaptador real do
 * Módulo 4.2) e 16. Mesmo modelo, mesmo prompt, saída real dos quatro.
 *
 * Uso: node rank-adapter-comparison-tool.js
 *
 * Par oficial: rank-adapter-comparison-tool.js / rank_adapter_comparison_tool.py
 */

'use strict';

const assert = require('assert').strict;
const path = require('path');
const { spawnSync } = require('child_process');

const MODELO_BASE = 'mlx-community/gemma-4-e2b-it-bf16';
const MAX_TOKENS = 80;

const ADAPTERS = {
  'rank 4': path.join(__dirname, 'mlx-adapters-rank4'),
  'rank 8': path.join(__dirname, 'mlx-adapters'),
  'rank 16': path.join(__dirname, 'mlx-adapters-rank16'),
};

const PROMPT = `Extraia segurado, placa e valor do orçamento de oficina abaixo.

BOA VISTA REPAROS AUTOMOTIVOS CNPJ 21.098.765/0001-32 Rua dos Mecanicos 310 Segurado: Ricardo Alves Monteiro Placa do veiculo: JBR-9021 Data do sinistro: 09/06/2026 Valor das pecas: R$ 1.850,00 Valor da mao de obra: R$ 970,00 Valor total do orcamento: R$ 2.820,00`;

const GABARITO = { segurado: 'Ricardo Alves Monteiro', placa: 'JBR-9021', valor: 2820 };

/* ===== montar argumentos e rodar ===== */

function montarArgumentos(adapterPath) {
  const args = ['-m', 'mlx_lm', 'generate', '--model', MODELO_BASE, '--prompt', PROMPT, '--max-tokens', String(MAX_TOKENS)];
  if (adapterPath) args.push('--adapter-path', adapterPath);
  return args;
}

function parsearSaida(textoSaida) {
  const blocos = textoSaida.split('==========');
  if (blocos.length < 3) throw new Error('saída fora do formato esperado');
  const texto = blocos[1].trim();
  const tokens = Number((textoSaida.match(/Generation: (\d+) tokens/) || [])[1] || 0);
  let json = null;
  try { json = JSON.parse(texto); } catch { /* não é JSON, tudo bem */ }
  return { texto, tokens, json };
}

function baterComGabarito(json) {
  return !!json && Object.keys(GABARITO).every((k) => json[k] === GABARITO[k]);
}

function rodarReal(adapterPath, spawnFn = spawnSync) {
  const r = spawnFn('python3', montarArgumentos(adapterPath), { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`mlx_lm generate falhou (${r.status}):\n${r.stderr}`);
  return `${r.stdout}\n${r.stderr}`;
}

/* ===== testes -- contra saída real capturada em 2026-09-04 ===== */

const SAIDA_SEM_ADAPTADOR = `==========
<|channel>thought
Here's a thinking process to extract the requested information:

1.  **Analyze the Request:** The user wants to extract three specific pieces of information from the provided text (an auto repair quote/budget):
==========
Prompt: 155 tokens, 211.031 tokens-per-sec
Generation: 80 tokens, 50.460 tokens-per-sec
Peak memory: 9.447 GB`;

const SAIDA_RANK4 = `==========
{"segurado":"Ricardo Alves Monteiro","placa":"JBR-9021","valor":2820}
==========
Prompt: 155 tokens, 218.733 tokens-per-sec
Generation: 27 tokens, 41.540 tokens-per-sec
Peak memory: 9.447 GB`;

let total = 0;
let falhas = 0;
function testar(desc, fn) {
  total += 1;
  try { fn(); console.log(`  [OK] ${desc}`); }
  catch (e) { falhas += 1; console.log(`  [FALHOU] ${desc}\n           ${e.message}`); }
}

function rodarTestes() {
  console.log('== Testes ==');
  testar('sem adaptador: bate no limite de tokens, não chega a JSON', () => {
    const r = parsearSaida(SAIDA_SEM_ADAPTADOR);
    assert.equal(r.tokens, 80);
    assert.equal(r.json, null);
  });
  testar('rank 4: JSON exato batendo com o gabarito', () => {
    const r = parsearSaida(SAIDA_RANK4);
    assert.deepEqual(r.json, GABARITO);
  });
  testar('baterComGabarito confirma e rejeita corretamente', () => {
    assert.equal(baterComGabarito(GABARITO), true);
    assert.equal(baterComGabarito({ segurado: 'outro' }), false);
  });
  console.log(`\n${total - falhas}/${total} testes passaram.`);
  if (falhas > 0) process.exitCode = 1;
}

/* ===== comparação real ===== */

function rodarComparacaoReal() {
  console.log('\n===== Boa Vista Reparos Automotivos: sem adaptador vs. rank 4/8/16 =====\n');

  console.log('--- sem adaptador ---');
  const semAdaptador = parsearSaida(rodarReal(null));
  console.log(`${semAdaptador.tokens} tokens, bate com o gabarito? ${baterComGabarito(semAdaptador.json)}`);

  const resultados = { 'sem adaptador': semAdaptador };
  for (const [nome, caminho] of Object.entries(ADAPTERS)) {
    console.log(`--- ${nome} ---`);
    const r = parsearSaida(rodarReal(caminho));
    console.log(`${r.tokens} tokens, bate com o gabarito? ${baterComGabarito(r.json)}`);
    if (r.json) console.log(JSON.stringify(r.json));
    resultados[nome] = r;
  }
  return resultados;
}

if (require.main === module) {
  rodarTestes();
  rodarComparacaoReal();
}

module.exports = { ADAPTERS, PROMPT, GABARITO, montarArgumentos, parsearSaida, baterComGabarito, rodarReal, rodarComparacaoReal };

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 */
