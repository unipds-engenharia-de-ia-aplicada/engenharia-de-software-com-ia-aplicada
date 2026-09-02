/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 2.1
 *
 * Ferramenta: Da Extração ao Dataset -- pipeline real de OCR + parsing +
 * validação de schema, transformando documento de apoio bruto (orçamento de
 * oficina, recibo médico) num exemplo estruturado de treino em JSONL.
 *
 * Este NÃO é um pipeline simulado: chama o binário `tesseract` de verdade
 * (Tesseract 5.5.3, pacote de idioma português instalado nesta máquina --
 * ver nota no cabeçalho do case) contra 4 imagens sintéticas em
 * documentos-brutos/, cada uma com layout de campo diferente, exatamente
 * pra provar o ponto do Módulo 1: cada oficina/clínica tem o próprio
 * formato, então o parser tem que aceitar variação de rótulo, não só
 * posição fixa de texto.
 *
 * Uso: node extraction-to-jsonl-tool.js
 * Requer o binário `tesseract` instalado com o pacote de idioma `por`
 * (`brew install tesseract tesseract-lang` no macOS).
 *
 * Material complementar: extracao-llm-multimodal-tool.js roda o mesmo
 * gabarito contra Gemini multimodal (Vertex AI), sem OCR nem regex, como
 * contraponto real ao pipeline abaixo. Ver ocr-vs-llm-extracao-comparativo.md
 * pro resultado lado a lado.
 */

'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR_DOCUMENTOS = path.join(__dirname, 'documentos-brutos');
const ARQUIVO_JSONL_SAIDA = path.join(__dirname, 'dataset-amplitude-seguros.jsonl');

const DOCUMENTOS = [
  {
    arquivo: 'doc-auto-1.png',
    caso: 'amplitude-auto',
    esperado: { segurado: 'Marcos Vinicius Andrade Pereira', placa: 'QJK-4F82', valor: 3210.50 },
  },
  {
    arquivo: 'doc-auto-2.png',
    caso: 'amplitude-auto',
    esperado: { segurado: 'Beatriz Nogueira Lima', placa: 'RTA-9B15', valor: 7940.00 },
  },
  {
    arquivo: 'doc-saude-1.png',
    caso: 'amplitude-saude-empresarial',
    esperado: { beneficiario: 'Carlos Eduardo Martins', procedimento: 'Consulta Cardiologica', valor: 380.00 },
  },
  {
    arquivo: 'doc-saude-2.png',
    caso: 'amplitude-saude-empresarial',
    esperado: { beneficiario: 'Fernanda Alves Costa', procedimento: 'Exame de Sangue Completo', valor: 145.90 },
  },
];

const INSTRUCOES = {
  'amplitude-auto': 'Extraia segurado, placa e valor do orçamento de oficina abaixo.',
  'amplitude-saude-empresarial': 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.',
};

/* ============================================================================
 * 1. OCR -- chama o binário tesseract de verdade (texto + confiança por TSV)
 * ========================================================================= */

/**
 * Roda o Tesseract em modo texto puro contra a imagem, em português.
 */
function ocrTexto(caminhoImagem) {
  return execFileSync('tesseract', [caminhoImagem, 'stdout', '-l', 'por'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

/**
 * Roda o Tesseract em modo TSV pra extrair a confiança palavra a palavra, e
 * devolve a confiança média (0.0-1.0) das palavras reconhecidas -- métrica
 * real do motor de OCR, não estimada.
 */
function ocrConfiancaMedia(caminhoImagem) {
  const tsv = execFileSync('tesseract', [caminhoImagem, 'stdout', '-l', 'por', 'tsv'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const linhas = tsv.trim().split('\n').slice(1); // pula cabeçalho
  const confiancas = linhas
    .map((linha) => linha.split('\t'))
    .filter((campos) => campos.length >= 12 && Number(campos[10]) >= 0) // conf >= 0 = palavra real reconhecida
    .map((campos) => Number(campos[10]) / 100);
  if (confiancas.length === 0) return 0;
  return confiancas.reduce((s, v) => s + v, 0) / confiancas.length;
}

/* ============================================================================
 * 2. Parsing -- regex tolerante a variação de rótulo (layout heterogêneo)
 * ========================================================================= */

/**
 * Converte valor no formato brasileiro ("3.210,50") pra número (3210.50).
 */
function parsearValorBRL(texto) {
  const limpo = texto.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  return Number(limpo);
}

function extrairCampo(texto, padroes) {
  for (const padrao of padroes) {
    const m = texto.match(padrao);
    if (m) return m[1].trim();
  }
  return null;
}

function parsearOrcamentoAuto(textoOcr) {
  const segurado = extrairCampo(textoOcr, [/(?:nome do )?segurado:?\s*(.+)/i]);
  const placa = extrairCampo(textoOcr, [/placa(?:\s+do\s+ve[ií]culo)?:?\s*([A-Z0-9\-]+)/i]);
  const valorTexto = extrairCampo(textoOcr, [/(?:valor total do reparo|total):?\s*r\$?\s*([\d.,]+)/i]);
  return {
    segurado,
    placa,
    valor: valorTexto ? parsearValorBRL(valorTexto) : null,
  };
}

function parsearReciboSaude(textoOcr) {
  const beneficiario = extrairCampo(textoOcr, [/(?:paciente\/)?benefici[aá]rio:?\s*(.+)/i]);
  const procedimento = extrairCampo(textoOcr, [/procedimento(?:\s+realizado)?:?\s*(.+)/i]);
  const valorTexto = extrairCampo(textoOcr, [/valor(?:\s+cobrado)?:?\s*r\$?\s*([\d.,]+)/i]);
  return {
    beneficiario,
    procedimento,
    valor: valorTexto ? parsearValorBRL(valorTexto) : null,
  };
}

/* ============================================================================
 * 3. Schema -- validação do exemplo antes de aceitar no dataset
 * ========================================================================= */

const CAMPOS_OBRIGATORIOS = {
  'amplitude-auto': ['segurado', 'placa', 'valor'],
  'amplitude-saude-empresarial': ['beneficiario', 'procedimento', 'valor'],
};

/**
 * Valida se um exemplo estruturado tem todos os campos obrigatórios do seu
 * caso, sem nenhum null (extração falhou) nem valor inválido.
 */
function validarExemplo(caso, saida) {
  const erros = [];
  const camposObrigatorios = CAMPOS_OBRIGATORIOS[caso];
  for (const campo of camposObrigatorios) {
    if (saida[campo] === null || saida[campo] === undefined || saida[campo] === '') {
      erros.push(`campo obrigatório ausente: ${campo}`);
    }
  }
  if (typeof saida.valor === 'number' && (Number.isNaN(saida.valor) || saida.valor <= 0)) {
    erros.push(`valor inválido: ${saida.valor}`);
  }
  return { valido: erros.length === 0, erros };
}

/* ============================================================================
 * 4. Pipeline completo: imagem -> OCR -> parse -> exemplo validado
 * ========================================================================= */

function processarDocumento(doc) {
  const caminho = path.join(DIR_DOCUMENTOS, doc.arquivo);
  const textoOcr = ocrTexto(caminho);
  const confianca = ocrConfiancaMedia(caminho);
  const saida = doc.caso === 'amplitude-auto' ? parsearOrcamentoAuto(textoOcr) : parsearReciboSaude(textoOcr);
  const validacao = validarExemplo(doc.caso, saida);

  const exemplo = {
    instrucao: INSTRUCOES[doc.caso],
    entrada: textoOcr,
    saida,
    metadata: {
      caso: doc.caso,
      arquivoFonte: doc.arquivo,
      confiancaOcr: Number(confianca.toFixed(4)),
      valido: validacao.valido,
    },
  };

  return { exemplo, validacao, textoOcr };
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
  console.log('== Testes: parsing de valor em formato brasileiro ==');

  testar('"3.210,50" -> 3210.5', () => {
    assert.equal(parsearValorBRL('3.210,50'), 3210.5);
  });

  testar('"R$ 145,90" -> 145.9', () => {
    assert.equal(parsearValorBRL('R$ 145,90'), 145.9);
  });

  console.log();
  console.log('== Testes: OCR + parsing contra os 4 documentos reais (Tesseract de verdade) ==');

  const resultados = DOCUMENTOS.map((doc) => ({ doc, resultado: processarDocumento(doc) }));

  resultados.forEach(({ doc, resultado }) => {
    testar(`${doc.arquivo}: OCR extrai texto não vazio`, () => {
      assert.ok(resultado.textoOcr.length > 20, `texto OCR muito curto: "${resultado.textoOcr}"`);
    });

    testar(`${doc.arquivo}: exemplo passa na validação de schema`, () => {
      assert.equal(resultado.validacao.valido, true, `erros: ${resultado.validacao.erros.join(', ')}`);
    });

    Object.keys(doc.esperado).forEach((campo) => {
      testar(`${doc.arquivo}: campo "${campo}" extraído bate com o esperado`, () => {
        const extraido = resultado.exemplo.saida[campo];
        const esperado = doc.esperado[campo];
        if (typeof esperado === 'number') {
          assert.equal(extraido, esperado, `extraído=${extraido}, esperado=${esperado}`);
        } else {
          // comparação tolerante a acento (Tesseract às vezes derruba acento)
          const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
          assert.equal(normalizar(extraido || ''), normalizar(esperado), `extraído="${extraido}", esperado="${esperado}"`);
        }
      });
    });

    testar(`${doc.arquivo}: confiança de OCR está entre 0 e 1`, () => {
      const c = resultado.exemplo.metadata.confiancaOcr;
      assert.ok(c >= 0 && c <= 1, `confiança fora da faixa: ${c}`);
    });
  });

  console.log();
  console.log('== Testes: validação de schema rejeita exemplo incompleto ==');

  testar('exemplo sem campo obrigatório é marcado inválido', () => {
    const v = validarExemplo('amplitude-auto', { segurado: 'Fulano', placa: null, valor: 100 });
    assert.equal(v.valido, false);
    assert.ok(v.erros.some((e) => e.includes('placa')));
  });

  testar('exemplo com valor zero ou negativo é marcado inválido', () => {
    const v = validarExemplo('amplitude-auto', { segurado: 'Fulano', placa: 'ABC-1234', valor: 0 });
    assert.equal(v.valido, false);
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
  console.log('===== Demo: pipeline completo de extração, 4 documentos reais via Tesseract =====');

  resultados.forEach(({ doc, resultado }) => {
    console.log(`\n--- ${doc.arquivo} (${doc.caso}) ---`);
    console.log('Texto OCR bruto:');
    console.log(resultado.textoOcr.split('\n').map((l) => `  ${l}`).join('\n'));
    console.log(`Confiança média de OCR: ${(resultado.exemplo.metadata.confiancaOcr * 100).toFixed(1)}%`);
    console.log('Exemplo estruturado:', JSON.stringify(resultado.exemplo.saida));
    console.log(`Validação de schema: ${resultado.validacao.valido ? 'OK' : 'FALHOU: ' + resultado.validacao.erros.join(', ')}`);
  });

  const linhasJsonl = resultados.map(({ resultado }) => JSON.stringify(resultado.exemplo));
  fs.writeFileSync(ARQUIVO_JSONL_SAIDA, linhasJsonl.join('\n') + '\n', 'utf8');

  console.log(`\n-----------------------------------------------------------------------------`);
  console.log(`${linhasJsonl.length} exemplos escritos em: ${path.basename(ARQUIVO_JSONL_SAIDA)}`);
  console.log('Dois formatos de orçamento de oficina, dois formatos de recibo médico, rótulo');
  console.log('de campo diferente em cada um, mas o parser tolerante e a validação de schema');
  console.log('garantem que os 4 viram exemplo estruturado, sem exigir OCR ou layout perfeito.');
  console.log('-----------------------------------------------------------------------------');
}

if (require.main === module) {
  const resultados = rodarTestes();
  rodarDemo(resultados);
}

module.exports = {
  ocrTexto,
  ocrConfiancaMedia,
  parsearValorBRL,
  parsearOrcamentoAuto,
  parsearReciboSaude,
  validarExemplo,
  processarDocumento,
};

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
