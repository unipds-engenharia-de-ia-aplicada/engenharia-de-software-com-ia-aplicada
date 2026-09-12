/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 5.1
 *
 * Nota técnica: os 200 exemplos do Módulo 3.2 foram 100% usados no
 * treino -- não existe conjunto de teste retido pro modelo da nuvem (o
 * split local 157/30/13 do Módulo 4.2 cobre só o modelo local). Este
 * arquivo constrói um de verdade: reusa gerarExemplo do
 * Módulo 3.2 (mesmo gerador determinístico, sem duplicar lógica), mas com
 * índices bem além da faixa usada no treino (offset de 5000), garantindo
 * que nenhum exemplo aqui foi visto pelo modelo durante o fine-tuning.
 *
 * O harness chama o modelo real, publicado no SEU endpoint do Módulo 3.2,
 * via REST, com o mesmo padrão de autenticação (gcloud auth print-access-token)
 * já usado em dataset-upload-and-tracking-tool.js.
 *
 * Nota técnica: `avaliarAdequacaoSchema` remove cerca de markdown (```json ... ```)
 * antes de fazer parse, e `normalizarTexto` ignora acento e diferença de
 * maiúscula/minúscula -- sem isso, respostas corretas do modelo seriam
 * contadas como erro de extração. Corrigido aqui, na fonte
 * compartilhada, porque afeta qualquer avaliação que reuse este harness.
 *
 * Uso: node model-evaluation-harness-tool.js
 * Requer: ENDPOINT_MODULO32 definida com o endpoint do SEU modelo
 * publicado no Módulo 3.2 (veja README.md, seção "Antes de rodar").
 */

'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { gerarExemplo, FONTES_AUTO, FONTES_SAUDE } = require(
  path.join(__dirname, '..', 'modulo-03-fine-tuning-via-api', 'm3-dataset-scaling-tool.js')
);

const REGIAO = 'us-central1';
// CONFIGURAÇÃO: defina ENDPOINT_MODULO32 com o endpoint do modelo que VOCÊ
// publicou no Módulo 3.2 (projects/.../endpoints/...) -- não há valor
// padrão, cada aluno usa o próprio modelo. A checagem é lazy (dentro de
// obterEndpoint(), não aqui no escopo do módulo) pra não travar quem exige
// este arquivo só pelas funções utilitárias, sem tocar rede.
const ENDPOINT = process.env.ENDPOINT_MODULO32;

function obterEndpoint() {
  if (!ENDPOINT) {
    throw new Error('Defina a variável de ambiente ENDPOINT_MODULO32 com o endpoint do seu modelo publicado no Módulo 3.2 antes de rodar este script.');
  }
  return ENDPOINT;
}

const OFFSET_RETIDO = 5000;

const CAMPOS_ESPERADOS = {
  'amplitude-auto': ['segurado', 'placa', 'valor'],
  'amplitude-saude-empresarial': ['beneficiario', 'procedimento', 'valor'],
};

/* --------------------------------------------------------------------------
 * 1. Conjunto de teste retido (genuinamente novo, nunca treinado)
 * -------------------------------------------------------------------------- */

function gerarConjuntoTesteRetido() {
  const exemplos = [];
  FONTES_AUTO.forEach(([fonte], i) =>
    exemplos.push(gerarExemplo('amplitude-auto', fonte, OFFSET_RETIDO + i))
  );
  FONTES_SAUDE.forEach(([fonte], i) =>
    exemplos.push(gerarExemplo('amplitude-saude-empresarial', fonte, OFFSET_RETIDO + i))
  );
  return exemplos;
}

/* --------------------------------------------------------------------------
 * 2. Chamada real ao modelo fine-tunado (REST, endpoint do Módulo 3.2)
 * -------------------------------------------------------------------------- */

function obterTokenAcesso() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function chamarModeloReal(exemplo) {
  const token = obterTokenAcesso();
  const url = `https://${REGIAO}-aiplatform.googleapis.com/v1/${obterEndpoint()}:generateContent`;
  const textoUsuario = `${exemplo.instrucao}\n\n${exemplo.entrada}`;
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: textoUsuario }] }],
      generationConfig: { temperature: 0 },
    }),
  });
  if (!resposta.ok) {
    throw new Error(`Falha ao chamar o modelo: ${resposta.status} ${resposta.statusText}`);
  }
  const dados = await resposta.json();
  return dados.candidates[0].content.parts[0].text;
}

/* --------------------------------------------------------------------------
 * 3. Adequação de schema: a resposta é JSON válido, com exatamente os
 * campos esperados, nem a mais nem a menos?
 * -------------------------------------------------------------------------- */

function removerCercaMarkdown(texto) {
  const semCerca = texto.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return semCerca ? semCerca[1] : texto;
}

function avaliarAdequacaoSchema(caso, textoResposta) {
  let obj;
  try {
    obj = JSON.parse(removerCercaMarkdown(textoResposta));
  } catch (erro) {
    return { valido: false, motivo: 'resposta não é JSON válido', campos: null };
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return { valido: false, motivo: 'resposta não é um objeto JSON', campos: null };
  }
  const esperados = CAMPOS_ESPERADOS[caso];
  const chaves = Object.keys(obj);
  const faltando = esperados.filter((c) => !chaves.includes(c));
  const extras = chaves.filter((c) => !esperados.includes(c));
  return {
    valido: faltando.length === 0 && extras.length === 0,
    faltando,
    extras,
    campos: obj,
  };
}

/* --------------------------------------------------------------------------
 * 4. Precisão por campo: cada campo esperado bate com o que o modelo
 * devolveu? Numérico com tolerância, texto comparado ignorando caixa,
 * acento e espaço extra.
 * -------------------------------------------------------------------------- */

function normalizarTexto(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acento (ex.: "guimarães" == "guimaraes")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function avaliarPrecisaoPorCampo(esperado, obtido) {
  const campos = Object.keys(esperado);
  const porCampo = {};
  let acertos = 0;
  for (const campo of campos) {
    const valorEsperado = esperado[campo];
    const valorObtido = obtido ? obtido[campo] : undefined;
    let acertou;
    if (typeof valorEsperado === 'number') {
      acertou = valorObtido !== undefined && Math.abs(valorEsperado - Number(valorObtido)) < 0.01;
    } else {
      // Mesma ideia do normalizarTexto do Módulo 2.2: diferença só de
      // maiúscula/minúscula ou espaço não é erro de extração de dados.
      acertou = normalizarTexto(valorEsperado) === normalizarTexto(valorObtido ?? '');
    }
    porCampo[campo] = acertou;
    if (acertou) acertos += 1;
  }
  return { porCampo, acertos, total: campos.length, precisao: acertos / campos.length };
}

/* --------------------------------------------------------------------------
 * 5. Consistência: mesma entrada, múltiplas chamadas, resposta estável?
 * -------------------------------------------------------------------------- */

async function avaliarConsistencia(exemplo, repeticoes = 3) {
  const respostas = [];
  for (let i = 0; i < repeticoes; i++) {
    respostas.push(await chamarModeloReal(exemplo));
  }
  const unicas = new Set(respostas);
  return { respostas, numeroRespostasUnicas: unicas.size, estavel: unicas.size === 1 };
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

async function testarAsync(descricao, fn) {
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
  console.log('== Testes: conjunto de teste retido ==');

  testar('gera 11 exemplos (6 Auto + 5 Saúde, uma por fonte real do Módulo 3.2), todos com índice >= 5000 (fora da faixa de treino)', () => {
    const conjunto = gerarConjuntoTesteRetido();
    assert.equal(conjunto.length, 11);
    assert.equal(conjunto.filter((e) => e.metadata.caso === 'amplitude-auto').length, 6);
    assert.equal(conjunto.filter((e) => e.metadata.caso === 'amplitude-saude-empresarial').length, 5);
    for (const e of conjunto) {
      const indice = Number(e.metadata.id.split('-').pop());
      assert.ok(indice >= OFFSET_RETIDO, `id ${e.metadata.id} não usa offset retido`);
    }
  });

  console.log();
  console.log('== Testes: adequação de schema ==');

  testar('JSON com exatamente os campos esperados é válido', () => {
    const r = avaliarAdequacaoSchema('amplitude-auto', '{"segurado":"X","placa":"Y","valor":10}');
    assert.equal(r.valido, true);
  });

  testar('JSON com campo faltando é inválido', () => {
    const r = avaliarAdequacaoSchema('amplitude-auto', '{"segurado":"X","placa":"Y"}');
    assert.equal(r.valido, false);
    assert.deepEqual(r.faltando, ['valor']);
  });

  testar('JSON com campo extra é inválido', () => {
    const r = avaliarAdequacaoSchema('amplitude-auto', '{"segurado":"X","placa":"Y","valor":10,"extra":1}');
    assert.equal(r.valido, false);
    assert.deepEqual(r.extras, ['extra']);
  });

  testar('resposta que não é JSON é sinalizada, não derruba o harness', () => {
    const r = avaliarAdequacaoSchema('amplitude-auto', 'não é json');
    assert.equal(r.valido, false);
    assert.equal(r.motivo, 'resposta não é JSON válido');
  });

  testar('JSON envolvido em cerca de markdown (```json ... ```) ainda é reconhecido como válido', () => {
    const r = avaliarAdequacaoSchema('amplitude-auto', '```json\n{"segurado":"X","placa":"Y","valor":10}\n```');
    assert.equal(r.valido, true);
  });

  console.log();
  console.log('== Testes: precisão por campo ==');

  testar('todos os campos corretos dá precisão 1.0', () => {
    const r = avaliarPrecisaoPorCampo(
      { segurado: 'Ana', placa: 'ABC-1234', valor: 100.5 },
      { segurado: 'Ana', placa: 'ABC-1234', valor: 100.5 }
    );
    assert.equal(r.precisao, 1);
  });

  testar('um campo errado reduz a precisão proporcionalmente', () => {
    const r = avaliarPrecisaoPorCampo(
      { segurado: 'Ana', placa: 'ABC-1234', valor: 100.5 },
      { segurado: 'Ana', placa: 'ZZZ-0000', valor: 100.5 }
    );
    assert.equal(r.acertos, 2);
    assert.equal(r.total, 3);
    assert.ok(Math.abs(r.precisao - 2 / 3) < 1e-9);
  });

  testar('valor numérico com diferença de arredondamento sob a tolerância ainda acerta', () => {
    const r = avaliarPrecisaoPorCampo({ valor: 100.5 }, { valor: 100.5000001 });
    assert.equal(r.porCampo.valor, true);
  });

  testar('diferença só de acento não é erro de extração', () => {
    const r = avaliarPrecisaoPorCampo({ beneficiario: 'Marcos Lopes Guimarães' }, { beneficiario: 'Marcos Lopes Guimaraes' });
    assert.equal(r.porCampo.beneficiario, true);
  });

  await testarAsync('chamada real ao modelo do Módulo 3.2 devolve schema válido e alta precisão num exemplo novo', async () => {
    const exemplo = gerarExemplo('amplitude-auto', 'Oficina Estrela', OFFSET_RETIDO + 999);
    const textoResposta = await chamarModeloReal(exemplo);
    const schema = avaliarAdequacaoSchema('amplitude-auto', textoResposta);
    assert.equal(schema.valido, true, `schema inválido: ${JSON.stringify(schema)}`);
    const precisao = avaliarPrecisaoPorCampo(exemplo.saida, schema.campos);
    assert.ok(precisao.precisao >= 2 / 3, `precisão baixa: ${JSON.stringify(precisao)}`);
  });

  console.log();
  console.log(`Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ${testesComFalha} falhou(falharam).`);
}

/* --------------------------------------------------------------------------
 * Ledger de resultado medido -- consumido pelo veredito-escala-tool.js do
 * Módulo 5.4, pra não repetir número por cópia manual. Gravado só quando
 * este arquivo roda de verdade (chamada real ao modelo), nunca a partir dos
 * testes automatizados. Ver Módulo 5.4 pra como isso é lido/usado.
 * -------------------------------------------------------------------------- */

function gravarResultadoMedido(caminhoJson, chave, dados) {
  // Lock exclusivo (arquivo .lock criado com 'wx', falha se já existe) protege o
  // read-modify-write: sem isso, duas execuções sobrepostas (ex.: dois harnesses
  // rodando em paralelo contra o mesmo ledger, cenário real quando múltiplas
  // ferramentas deste diretório compartilham um resultado-medido.json só) podem perder uma
  // atualização silenciosamente. Escrita em arquivo temporário + rename (atômico
  // em POSIX) evita também um arquivo corrompido/truncado se o processo morrer no
  // meio da escrita.
  const caminhoLock = `${caminhoJson}.lock`;
  const inicioEspera = Date.now();
  while (true) {
    try {
      fs.closeSync(fs.openSync(caminhoLock, 'wx'));
      break;
    } catch (erro) {
      if (erro.code !== 'EEXIST') throw erro;
      if (Date.now() - inicioEspera > 30000) {
        throw new Error(`Não consegui obter o lock de ${caminhoLock} em 30s -- outro processo pode ter travado com o lock aberto (remova o arquivo .lock manualmente se tiver certeza que não há outra execução deste script rodando).`);
      }
      const proximaTentativa = Date.now() + 100;
      while (Date.now() < proximaTentativa) { /* busy-wait curto, script CLI síncrono */ }
    }
  }
  try {
    let atual = {};
    try {
      atual = JSON.parse(fs.readFileSync(caminhoJson, 'utf8'));
    } catch (erro) {
      if (erro.code !== 'ENOENT') throw erro;
    }
    atual[chave] = dados;
    const caminhoTmp = `${caminhoJson}.${process.pid}.tmp`;
    fs.writeFileSync(caminhoTmp, `${JSON.stringify(atual, null, 2)}\n`);
    fs.renameSync(caminhoTmp, caminhoJson);
  } finally {
    fs.unlinkSync(caminhoLock);
  }
}

/* --------------------------------------------------------------------------
 * Execução principal
 * -------------------------------------------------------------------------- */

async function main() {
  await rodarTestes();

  console.log();
  console.log('== Avaliação real contra o conjunto de teste retido ==');

  const conjuntoTeste = gerarConjuntoTesteRetido();
  console.log(`Endpoint: ${obterEndpoint()}`);
  console.log(`${conjuntoTeste.length} exemplos, nunca vistos no treino do Módulo 3.2.\n`);

  let somaPrecisao = 0;
  let schemasValidos = 0;
  let sucessos = 0;
  const falhas = [];

  for (const exemplo of conjuntoTeste) {
    let textoResposta;
    try {
      textoResposta = await chamarModeloReal(exemplo);
    } catch (erro) {
      console.log(`${exemplo.metadata.id}: [FALHOU] ${erro.message}`);
      falhas.push({ id: exemplo.metadata.id, erro: erro.message });
      continue;
    }
    const schema = avaliarAdequacaoSchema(exemplo.metadata.caso, textoResposta);
    const precisao = schema.valido
      ? avaliarPrecisaoPorCampo(exemplo.saida, schema.campos)
      : { precisao: 0, acertos: 0, total: Object.keys(exemplo.saida).length };

    if (schema.valido) schemasValidos += 1;
    somaPrecisao += precisao.precisao;
    sucessos += 1;

    console.log(`${exemplo.metadata.id}: schema ${schema.valido ? 'válido' : 'INVÁLIDO'}, precisão ${(precisao.precisao * 100).toFixed(0)}% (${precisao.acertos}/${precisao.total})`);
  }

  if (falhas.length > 0) {
    console.log(`\n${falhas.length}/${conjuntoTeste.length} exemplo(s) falharam na chamada real -- verifique projeto/endpoint/billing.`);
  }
  if (sucessos === 0) {
    throw new Error('Nenhum exemplo processado com sucesso -- verifique GCP_PROJECT_ID, ENDPOINT_MODULO32, e a autenticação (gcloud auth login).');
  }

  console.log(`\nAdequação de schema: ${schemasValidos}/${sucessos}`);
  console.log(`Precisão média por campo: ${((somaPrecisao / sucessos) * 100).toFixed(1)}%`);

  const precisaoMedia = somaPrecisao / sucessos;
  const medidoPct = Math.round(Math.min(schemasValidos / sucessos, precisaoMedia) * 100);
  gravarResultadoMedido(path.join(__dirname, 'resultado-medido.json'), 'baseline', {
    medido: `${medidoPct}% (${schemasValidos}/${sucessos} schema válido, precisão média por campo)`,
    medidoPct,
    n: sucessos,
    medidoEm: new Date().toLocaleDateString('sv-SE'),
    origem: 'Módulo 5.1',
    script: 'model-evaluation-harness-tool.js',
  });

  console.log();
  console.log('== Consistência: mesmo exemplo, três chamadas separadas ==');
  const exemploConsistencia = conjuntoTeste[0];
  try {
    const consistencia = await avaliarConsistencia(exemploConsistencia, 3);
    console.log(`Exemplo: ${exemploConsistencia.metadata.id}`);
    consistencia.respostas.forEach((r, i) => console.log(`  Chamada ${i + 1}: ${r}`));
    console.log(`Respostas únicas: ${consistencia.numeroRespostasUnicas} de ${consistencia.respostas.length} (${consistencia.estavel ? 'estável' : 'instável'})`);
  } catch (erro) {
    console.log(`[FALHOU] ${erro.message}`);
  }
}

if (require.main === module) {
  main().catch((erro) => {
    console.error('Erro:', erro.message);
    process.exitCode = 1;
  });
}

module.exports = {
  gerarConjuntoTesteRetido,
  chamarModeloReal,
  avaliarAdequacaoSchema,
  avaliarPrecisaoPorCampo,
  avaliarConsistencia,
};

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
