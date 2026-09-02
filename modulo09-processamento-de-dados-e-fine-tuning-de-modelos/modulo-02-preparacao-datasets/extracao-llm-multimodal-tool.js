/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo Complementar - Módulo 2.1
 *
 * Ferramenta: Extração via LLM multimodal, em oposição ao pipeline de OCR
 * clássico (Tesseract + regex) de extraction-to-jsonl-tool.js.
 *
 * Roda de verdade: manda cada uma das 4 imagens sintéticas de
 * documentos-brutos/ direto pro Gemini (Vertex AI, mesmo projeto GCP dos
 * jobs reais de fine-tuning do Módulo 3), pedindo o JSON estruturado sem
 * nenhum passo de regex intermediário, e compara contra o mesmo gabarito
 * (`esperado`) usado no teste automatizado do pipeline de OCR.
 *
 * Não substitui o pipeline OCR ensinado no vídeo, é um contraponto real:
 * mesmo dado de entrada, abordagem diferente, métricas comparáveis
 * (acerto por campo, latência, uso de token) lado a lado.
 *
 * Uso: node extracao-llm-multimodal-tool.js
 * Requer: gcloud autenticado (gcloud auth application-default login) com
 * acesso ao projeto amplitude-seguros-demo.
 *
 * Nota de validade (ago/2026): este demo foi validado com gemini-2.5-flash.
 * O processo -- montar o payload multimodal, comparar contra o gabarito -- é
 * o mesmo independente da versão exata do modelo. A Google aposenta versões
 * do Gemini com aviso prévio (a família 2.5 tem retirement anunciado pra
 * 16/out/2026); antes de rodar você mesmo, confira em
 * https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes
 * quais modelos estão disponíveis no momento e troque a constante MODELO.
 */

'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJETO = 'amplitude-seguros-demo';
const REGIAO = 'us-central1';
const MODELO = 'gemini-2.5-flash';

const DIR_DOCUMENTOS = path.join(__dirname, 'documentos-brutos');

const DOCUMENTOS = [
  {
    arquivo: 'doc-auto-1.png',
    caso: 'amplitude-auto',
    campos: ['segurado', 'placa', 'valor'],
    esperado: { segurado: 'Marcos Vinicius Andrade Pereira', placa: 'QJK-4F82', valor: 3210.50 },
  },
  {
    arquivo: 'doc-auto-2.png',
    caso: 'amplitude-auto',
    campos: ['segurado', 'placa', 'valor'],
    esperado: { segurado: 'Beatriz Nogueira Lima', placa: 'RTA-9B15', valor: 7940.00 },
  },
  {
    arquivo: 'doc-saude-1.png',
    caso: 'amplitude-saude-empresarial',
    campos: ['beneficiario', 'procedimento', 'valor'],
    esperado: { beneficiario: 'Carlos Eduardo Martins', procedimento: 'Consulta Cardiologica', valor: 380.00 },
  },
  {
    arquivo: 'doc-saude-2.png',
    caso: 'amplitude-saude-empresarial',
    campos: ['beneficiario', 'procedimento', 'valor'],
    esperado: { beneficiario: 'Fernanda Alves Costa', procedimento: 'Exame de Sangue Completo', valor: 145.90 },
  },
];

const INSTRUCOES = {
  'amplitude-auto': 'Extraia segurado, placa e valor do orçamento de oficina na imagem.',
  'amplitude-saude-empresarial': 'Extraia beneficiário, procedimento e valor do recibo médico na imagem.',
};

/* --------------------------------------------------------------------------
 * 1. Chamada real ao Gemini multimodal via Vertex AI
 * -------------------------------------------------------------------------- */

function obterTokenAcesso() {
  try {
    return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  } catch (erro) {
    throw new Error(
      'Não consegui obter um token de acesso via gcloud. Rode "gcloud auth login" '
      + `nesta máquina antes de rodar a demo ao vivo. (${erro.message})`,
    );
  }
}

function normalizar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

async function extrairViaLlm(doc) {
  const caminho = path.join(DIR_DOCUMENTOS, doc.arquivo);
  const imagemBase64 = fs.readFileSync(caminho).toString('base64');
  const listaCampos = doc.campos.join(', ');

  const prompt = `${INSTRUCOES[doc.caso]} Devolva SOMENTE um JSON válido, sem markdown ` +
    `e sem texto extra, com exatamente estas chaves: ${listaCampos}. O campo "valor" deve ` +
    'ser um número (não string, sem símbolo de moeda).';

  const token = obterTokenAcesso();
  const url = `https://${REGIAO}-aiplatform.googleapis.com/v1/projects/${PROJETO}/locations/${REGIAO}` +
    `/publishers/google/models/${MODELO}:generateContent`;

  const corpo = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/png', data: imagemBase64 } },
      ],
    }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  };

  const inicio = Date.now();
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const latenciaMs = Date.now() - inicio;

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Vertex AI retornou ${resposta.status}: ${erro}`);
  }

  const json = await resposta.json();
  const textoResposta = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textoResposta) {
    throw new Error(`resposta sem texto utilizável: ${JSON.stringify(json)}`);
  }

  let extraido;
  try {
    extraido = JSON.parse(textoResposta);
  } catch (e) {
    throw new Error(`resposta não é JSON válido: ${textoResposta}`);
  }

  const tokensEntrada = json.usageMetadata?.promptTokenCount ?? null;
  const tokensSaida = json.usageMetadata?.candidatesTokenCount ?? null;

  return { extraido, latenciaMs, tokensEntrada, tokensSaida };
}

/* --------------------------------------------------------------------------
 * 2. Comparação campo a campo contra o gabarito
 * -------------------------------------------------------------------------- */

function compararComEsperado(extraido, esperado) {
  const porCampo = {};
  let acertos = 0;
  for (const campo of Object.keys(esperado)) {
    const valorEsperado = esperado[campo];
    const valorExtraido = extraido[campo];
    let bate;
    if (typeof valorEsperado === 'number') {
      bate = Number(valorExtraido) === valorEsperado;
    } else {
      bate = normalizar(valorExtraido || '') === normalizar(valorEsperado);
    }
    porCampo[campo] = { esperado: valorEsperado, extraido: valorExtraido, bate };
    if (bate) acertos += 1;
  }
  return { porCampo, acertos, total: Object.keys(esperado).length };
}

/* --------------------------------------------------------------------------
 * 3. Testes
 * -------------------------------------------------------------------------- */

function testar(descricao, fn) {
  try {
    fn();
    console.log(`  [OK] ${descricao}`);
    return true;
  } catch (e) {
    console.log(`  [FALHOU] ${descricao}: ${e.message}`);
    return false;
  }
}

/* --------------------------------------------------------------------------
 * 4. Execução real contra os 4 documentos + comparação lado a lado com OCR
 * -------------------------------------------------------------------------- */

async function main() {
  console.log('== Extração via LLM multimodal (Gemini/Vertex AI) vs. OCR clássico ==\n');

  const resultados = [];
  for (const doc of DOCUMENTOS) {
    console.log(`--- ${doc.arquivo} (${doc.caso}) ---`);
    const { extraido, latenciaMs, tokensEntrada, tokensSaida } = await extrairViaLlm(doc);
    const comparacao = compararComEsperado(extraido, doc.esperado);
    resultados.push({ doc, extraido, latenciaMs, tokensEntrada, tokensSaida, comparacao });

    console.log(`  extraído: ${JSON.stringify(extraido)}`);
    console.log(`  acerto: ${comparacao.acertos}/${comparacao.total} campos`);
    console.log(`  latência: ${latenciaMs}ms · tokens entrada/saída: ${tokensEntrada}/${tokensSaida}`);
    console.log('');
  }

  console.log('== Testes: LLM multimodal acerta o gabarito campo a campo ==');
  let passaram = 0;
  let totalTestes = 0;
  for (const r of resultados) {
    for (const campo of Object.keys(r.comparacao.porCampo)) {
      totalTestes += 1;
      const info = r.comparacao.porCampo[campo];
      const ok = testar(
        `${r.doc.arquivo}: campo "${campo}" extraído bate com o esperado`,
        () => assert.ok(info.bate, `extraído=${JSON.stringify(info.extraido)}, esperado=${JSON.stringify(info.esperado)}`)
      );
      if (ok) passaram += 1;
    }
  }
  console.log(`\n${passaram}/${totalTestes} testes passaram.\n`);

  const totalAcertos = resultados.reduce((s, r) => s + r.comparacao.acertos, 0);
  const totalCampos = resultados.reduce((s, r) => s + r.comparacao.total, 0);
  const latenciaMedia = resultados.reduce((s, r) => s + r.latenciaMs, 0) / resultados.length;
  const tokensEntradaTotal = resultados.reduce((s, r) => s + (r.tokensEntrada || 0), 0);
  const tokensSaidaTotal = resultados.reduce((s, r) => s + (r.tokensSaida || 0), 0);

  console.log('== Resumo ==');
  console.log(`Acerto total (LLM multimodal): ${totalAcertos}/${totalCampos} campos (${((totalAcertos / totalCampos) * 100).toFixed(1)}%)`);
  console.log(`Latência média por documento: ${latenciaMedia.toFixed(0)}ms`);
  console.log(`Tokens totais: ${tokensEntradaTotal} entrada + ${tokensSaidaTotal} saída, ${DOCUMENTOS.length} chamadas`);
  console.log('\nCompare com extraction-to-jsonl-tool.js (OCR clássico): mesmo gabarito, mesmas 4 imagens.');

  return {
    resultados: resultados.map((r) => ({
      arquivo: r.doc.arquivo,
      extraido: r.extraido,
      acertos: r.comparacao.acertos,
      total: r.comparacao.total,
      latenciaMs: r.latenciaMs,
      tokensEntrada: r.tokensEntrada,
      tokensSaida: r.tokensSaida,
    })),
    resumo: { totalAcertos, totalCampos, latenciaMedia, tokensEntradaTotal, tokensSaidaTotal },
  };
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Erro:', e.message);
    process.exitCode = 1;
  });
}

module.exports = { extrairViaLlm, compararComEsperado, normalizar, main };

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
