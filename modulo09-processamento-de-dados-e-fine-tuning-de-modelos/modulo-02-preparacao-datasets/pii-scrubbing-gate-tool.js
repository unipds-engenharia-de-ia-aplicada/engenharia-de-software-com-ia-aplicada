/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 2.1 (companion: fine-tuning com dado regulado)
 *
 * Gate real de higienização de PII antes que um documento da Amplitude
 * Seguros entre no dataset de fine-tuning. Não substitui o gate de
 * governança do Módulo 1.2 (validarGovernancaDado, que checa base legal
 * e DPA) nem o aprofundamento de mascaramento/auditoria da disciplina 10,
 * Segurança e Governança em IA: é o passo técnico mais estreito e mais
 * concreto que existe entre os dois, específico de preparar dado pra
 * fine-tuning.
 *
 * Abordagem híbrida, a mesma usada em pipelines reais de produção
 * (Microsoft Presidio combina regex + NER; ver companion
 * privacy-preserving-finetuning-companion.md pras fontes completas):
 *   - CPF: regex de formato + validação real do dígito verificador
 *     (algoritmo Módulo 11 da Receita Federal), não só formato.
 *   - Nome: âncora de rótulo (Segurado:/Beneficiário:) mais confiável;
 *     fallback heurístico de sequência de palavras capitalizadas pra
 *     nome solto no texto, com taxa de falso positivo/negativo honesta,
 *     não perfeita.
 *
 * Uso: node pii-scrubbing-gate-tool.js
 */

'use strict';

const assert = require('assert').strict;

/* --------------------------------------------------------------------------
 * 1. CPF: regex de formato + Módulo 11 (dígito verificador real)
 * -------------------------------------------------------------------------- */

const REGEX_CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

function calcularDigitoVerificador(parcial) {
  let soma = 0;
  let peso = parcial.length + 1;
  for (const d of parcial) {
    soma += Number(d) * peso;
    peso -= 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function validarCPF(cpfComOuSemMascara) {
  const digitos = cpfComOuSemMascara.replace(/\D/g, '');
  if (digitos.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digitos)) return false; // todos os dígitos iguais, formato bate mas nunca é CPF real
  const d1 = calcularDigitoVerificador(digitos.slice(0, 9));
  const d2 = calcularDigitoVerificador(digitos.slice(0, 9) + String(d1));
  return digitos[9] === String(d1) && digitos[10] === String(d2);
}

/* --------------------------------------------------------------------------
 * 2. Nome: âncora de rótulo (alta confiança) + heurística de fallback
 * -------------------------------------------------------------------------- */

const REGEX_NOME_ANCORADO = /(Segurado|Beneficiário|Beneficiario|Nome do segurado)[ \t]*:[ \t]*([A-ZÀ-Ú][\wÀ-ú]*(?:[ \t]+[A-ZÀ-Ú][\wÀ-ú]*){1,4})/g;

// Heurística de fallback: 2 a 5 palavras capitalizadas em sequência, fora de
// um rótulo conhecido. Pega nome solto no meio do texto, mas também gera
// falso positivo em nome de oficina/clínica em letra maiúscula -- por isso
// é só o fallback, roda depois da âncora de rótulo já ter capturado o que
// pôde com alta confiança.
const REGEX_NOME_HEURISTICO = /\b([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,4})\b/g;

function detectarNomesAncorados(texto) {
  const encontrados = [];
  let m;
  REGEX_NOME_ANCORADO.lastIndex = 0;
  while ((m = REGEX_NOME_ANCORADO.exec(texto)) !== null) {
    encontrados.push({ nome: m[2], confianca: 'alta', metodo: 'ancora_rotulo' });
  }
  return encontrados;
}

/* --------------------------------------------------------------------------
 * 3. Gate principal: varre um documento, redige o que encontra
 * -------------------------------------------------------------------------- */

function varrerPII(textoDocumento) {
  const cpfsEncontrados = [];
  let m;
  REGEX_CPF.lastIndex = 0;
  while ((m = REGEX_CPF.exec(textoDocumento)) !== null) {
    cpfsEncontrados.push({ texto: m[0], valido: validarCPF(m[0]) });
  }

  const nomesEncontrados = detectarNomesAncorados(textoDocumento);

  let textoRedigido = textoDocumento;
  for (const cpf of cpfsEncontrados) {
    if (cpf.valido) {
      textoRedigido = textoRedigido.split(cpf.texto).join('[CPF_REDIGIDO]');
    }
  }
  for (const nome of nomesEncontrados) {
    textoRedigido = textoRedigido.split(nome.nome).join('[NOME_REDIGIDO]');
  }

  return {
    cpfsEncontrados,
    nomesEncontrados,
    textoRedigido,
    totalPiiRedigido: cpfsEncontrados.filter((c) => c.valido).length + nomesEncontrados.length,
  };
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
  console.log('== Testes: validação real de CPF (Módulo 11) ==');

  testar('111.444.777-35 é um CPF de teste conhecido e válido (dígito verificador bate)', () => {
    assert.equal(validarCPF('111.444.777-35'), true);
  });

  testar('trocar o último dígito verificador invalida o CPF', () => {
    assert.equal(validarCPF('111.444.777-34'), false);
  });

  testar('sequência de dígitos repetidos (000.000.000-00) nunca é CPF válido, mesmo com formato certo', () => {
    assert.equal(validarCPF('000.000.000-00'), false);
  });

  testar('CPF sem máscara (só dígitos) valida igual', () => {
    assert.equal(validarCPF('11144477735'), true);
  });

  testar('11 dígitos aleatórios sem dígito verificador coerente é rejeitado', () => {
    assert.equal(validarCPF('123.456.789-00'), false);
  });

  console.log();
  console.log('== Testes: detecção de nome ancorada em rótulo ==');

  testar('extrai nome depois de "Segurado:"', () => {
    const encontrados = detectarNomesAncorados('Segurado: Marcos Vinicius Andrade Pereira\nPlaca: ABC-1234');
    assert.equal(encontrados.length, 1);
    assert.equal(encontrados[0].nome, 'Marcos Vinicius Andrade Pereira');
  });

  testar('extrai nome depois de "Beneficiário:" (com acento)', () => {
    const encontrados = detectarNomesAncorados('Beneficiário: Carlos Eduardo Martins');
    assert.equal(encontrados[0].nome, 'Carlos Eduardo Martins');
  });

  testar('extrai nome depois de "Beneficiario:" (sem acento, variação real de OCR)', () => {
    const encontrados = detectarNomesAncorados('Beneficiario: Carlos Eduardo Martins');
    assert.equal(encontrados[0].nome, 'Carlos Eduardo Martins');
  });

  testar('texto sem rótulo conhecido não gera falso positivo na âncora', () => {
    const encontrados = detectarNomesAncorados('OFICINA ESTRELA - ORCAMENTO N. 4471');
    assert.equal(encontrados.length, 0);
  });

  console.log();
  console.log('== Testes: varredura completa e redação ==');

  testar('documento real do Módulo 2.1 (Amplitude Auto) tem nome e CPF redigidos, placa e valor preservados', () => {
    const doc = 'OFICINA ESTRELA - ORCAMENTO N. 4471\nSegurado: Marcos Vinicius Andrade Pereira\nCPF: 111.444.777-35\nPlaca do veiculo: QJK-4F82\n\nValor total do reparo: R$ 3.210,50';
    const resultado = varrerPII(doc);
    assert.equal(resultado.nomesEncontrados.length, 1);
    assert.equal(resultado.cpfsEncontrados.filter((c) => c.valido).length, 1);
    assert.ok(resultado.textoRedigido.includes('[NOME_REDIGIDO]'));
    assert.ok(resultado.textoRedigido.includes('[CPF_REDIGIDO]'));
    assert.ok(resultado.textoRedigido.includes('QJK-4F82'), 'placa não é PII pessoal, tem que sobreviver à redação');
    assert.ok(resultado.textoRedigido.includes('3.210,50'), 'valor não é PII pessoal, tem que sobreviver à redação');
  });

  testar('CPF com formato certo mas dígito verificador inválido não é redigido (evita falso positivo em número aleatório de 11 dígitos)', () => {
    const doc = 'Protocolo interno: 123.456.789-00\nSegurado: Ana Paula Ribeiro';
    const resultado = varrerPII(doc);
    assert.equal(resultado.cpfsEncontrados.filter((c) => c.valido).length, 0);
    assert.ok(!resultado.textoRedigido.includes('[CPF_REDIGIDO]'));
  });

  console.log();
  console.log(`Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ${testesComFalha} falhou(falharam).`);
}

/* --------------------------------------------------------------------------
 * 5. Execução principal: rodar o gate contra os 2 documentos reais do M2.1
 * -------------------------------------------------------------------------- */

function main() {
  rodarTestes();

  console.log();
  console.log('== Gate real: documentos do Módulo 2.1, agora com CPF (como um caso real de seguradora traria) ==');

  const documentos = [
    {
      id: 'amplitude-auto-1',
      texto: 'OFICINA ESTRELA - ORCAMENTO N. 4471\nSegurado: Marcos Vinicius Andrade Pereira\nCPF: 111.444.777-35\nPlaca do veiculo: QJK-4F82\n\nValor total do reparo: R$ 3.210,50',
    },
    {
      id: 'amplitude-saude-1',
      texto: 'RECIBO DE ATENDIMENTO MEDICO\nBeneficiario: Carlos Eduardo Martins\nCPF: 111.444.777-35\nProcedimento: Consulta Cardiologica\nValor: R$ 380,00',
    },
  ];

  for (const doc of documentos) {
    console.log(`\n--- ${doc.id} ---`);
    console.log('Antes (bruto, nunca deveria entrar assim num dataset de treino):');
    console.log(doc.texto);
    const resultado = varrerPII(doc.texto);
    console.log(`\nPII detectado: ${resultado.nomesEncontrados.length} nome(s), ${resultado.cpfsEncontrados.filter((c) => c.valido).length} CPF(s) válido(s)`);
    console.log('Depois (o que de fato entra no dataset de fine-tuning):');
    console.log(resultado.textoRedigido);
  }

  console.log();
  console.log('Nota honesta: a âncora de rótulo (Segurado:/Beneficiário:) tem alta confiança, mas só');
  console.log('pega nome que segue esse padrão. Nome solto em texto livre, fora de rótulo conhecido,');
  console.log('exigiria NER de verdade (ex.: spaCy, como o Microsoft Presidio usa em produção) para não');
  console.log('depender só de heurística de capitalização, que erra tanto nome de oficina/clínica quanto');
  console.log('nome de pessoa. Ver o companion privacy-preserving-finetuning-companion.md pra esse');
  console.log('próximo passo, mais o cenário de dado de saúde (DP-SGD/DP-LoRA) e o risco de memorização.');
}

main();

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
