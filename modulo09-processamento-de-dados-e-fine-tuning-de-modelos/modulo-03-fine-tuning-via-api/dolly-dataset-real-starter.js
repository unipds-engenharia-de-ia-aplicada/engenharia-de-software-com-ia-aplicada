/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Extra - Dataset real alternativo, parte 1/2 (companion do Módulo 3.2 em
 * diante, mas conceitualmente equivalente ao Módulo 2.2 - preparação de
 * dataset, não upload/job)
 *
 * Ferramenta: carrega o databricks-dolly-15k (real, CC-BY-SA-3.0), mapeia pro
 * schema canônico do Módulo 2.1 (instrucao/entrada/saida/metadata), e roda
 * o mesmo tipo de dedup MinHash+LSH e balanceamento por temperatura do
 * Módulo 2.2 contra dado real, não sintético. Fica fisicamente na pasta do
 * Módulo 3 (junto com a parte 2/2, dolly-vertex-pipeline.js, que sobe e
 * treina de verdade) só por conveniência de não espalhar o extra em duas
 * pastas - o conteúdo em si é 100% Módulo 2.2: dedup e balanceamento, nada
 * de upload ou job.
 *
 * Pré-requisito: baixar o dataset uma vez (13MB, ~15 mil linhas JSONL):
 *   curl -L "https://huggingface.co/datasets/databricks/databricks-dolly-15k/resolve/main/databricks-dolly-15k.jsonl" -o databricks-dolly-15k.jsonl
 *
 * Nota de honestidade: das 8 categorias do Dolly-15k, só 3 têm o campo
 * "context" preenchido (closed_qa, information_extraction, summarization) -
 * são as únicas com o mesmo formato "documento de entrada -> saída
 * específica" que o schema canônico exige. As outras 5 (open_qa,
 * general_qa, classification, brainstorming, creative_writing) não têm
 * documento de entrada real, então não servem pra esse pipeline: usar só
 * as 3 compatíveis não é recorte arbitrário, é o que o próprio formato do
 * dado permite.
 *
 * Segunda nota de honestidade: as funções `encontrarQuaseDuplicatasMinHashLSH`
 * e `limparEBalancear`, importadas de dataset-cleaning-balancing-tool.js, são
 * hardcoded pros dois casos desta disciplina ('amplitude-auto' e
 * 'amplitude-saude-empresarial') - não acionam em cima de um `metadata.caso`
 * novo. Balanceamento por temperatura (balancearPorTemperatura,
 * entropiaShannon, numeroEfetivoFontes) já é genérico e reusado direto daqui;
 * dedup usa as mesmas primitivas exportadas (assinaturaMinHash, bandingLSH,
 * similaridadeJaccardExata), só reimplementando o laço de orquestração de
 * forma genérica, ~15 linhas, em vez de patchear o arquivo original.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const m2 = require('../modulo-02-preparacao-datasets/dataset-cleaning-balancing-tool.js');

const CATEGORIAS_COMPATIVEIS = ['information_extraction', 'closed_qa', 'summarization'];
const CASO = 'dolly-instruction-tuning';
const N_SHINGLE = 5;

/* --------------------------------------------------------------------------
 * 1. Carregar e mapear pro schema canônico
 * -------------------------------------------------------------------------- */

function carregarDolly(caminhoJsonl) {
  const bruto = fs.readFileSync(caminhoJsonl, 'utf-8').trim().split('\n');
  return bruto.map((linha) => JSON.parse(linha));
}

/** Mapeia um registro bruto do Dolly-15k pro schema canônico do Módulo 2.1. */
function paraSchemaCanonico(registroDolly, indice) {
  return {
    instrucao: registroDolly.instruction,
    entrada: registroDolly.context,
    saida: registroDolly.response,
    metadata: {
      caso: CASO,
      fonte: registroDolly.category,
      id: `dolly-${registroDolly.category}-${indice}`,
    },
  };
}

function filtrarCompativeis(registrosDolly) {
  return registrosDolly.filter(
    (r) => CATEGORIAS_COMPATIVEIS.includes(r.category) && r.context && r.context.trim() && r.response && r.response.trim()
  );
}

/* --------------------------------------------------------------------------
 * 2. Dedup genérico via MinHash+LSH (reusa as primitivas do Módulo 2.2,
 *    não o orquestrador hardcoded pros casos Amplitude)
 * -------------------------------------------------------------------------- */

function shinglesLocal(texto, n) {
  const palavras = texto.toLowerCase().replace(/\s+/g, ' ').trim().split(' ');
  const conjunto = new Set();
  for (let i = 0; i <= palavras.length - n; i++) conjunto.add(palavras.slice(i, i + n).join(' '));
  return conjunto;
}

/** contarPorFonte não é exportado por dataset-cleaning-balancing-tool.js; reimplementado aqui, mesma lógica. */
function contarPorFonteLocal(exemplos, caso) {
  const doCaso = exemplos.filter((e) => e.metadata.caso === caso);
  const contagem = {};
  for (const e of doCaso) contagem[e.metadata.fonte] = (contagem[e.metadata.fonte] || 0) + 1;
  return contagem;
}

/**
 * Correção 25/08 (achado de painel de avaliação): comparar só `entrada`
 * confunde pares de PERGUNTA DIFERENTE sobre o mesmo trecho de contexto
 * (Jaccard=1,0 na entrada) com duplicata real - problema que o próprio
 * companion.md já identificava, mas que a v1 deste arquivo não corrigia de
 * verdade no código, só discutia como hipótese. `textoParaDedup` concatena
 * instrução+entrada antes de shinglar, então duas perguntas diferentes
 * sobre o mesmo texto-fonte já não colidem mais.
 */
function textoParaDedup(exemplo) {
  return `${exemplo.instrucao}\n${exemplo.entrada}`;
}

function dedupGenerico(exemplos, n = N_SHINGLE) {
  const coeficientes = m2.gerarCoeficientesHash(m2.MINHASH_K, 42);
  const assinaturas = exemplos.map((e) => m2.assinaturaMinHash(shinglesLocal(textoParaDedup(e), n), coeficientes));
  const candidatos = m2.bandingLSH(assinaturas, m2.LSH_BANDAS, m2.LSH_LINHAS);
  const pares = [];
  for (const chave of candidatos) {
    const [i, j] = chave.split('-').map(Number);
    const sim = m2.similaridadeJaccardExata(textoParaDedup(exemplos[i]), textoParaDedup(exemplos[j]), n);
    if (sim >= m2.LIMIAR_DUPLICATA) pares.push({ i, j, sim });
  }
  const totalForcaBruta = (exemplos.length * (exemplos.length - 1)) / 2;
  return { totalForcaBruta, candidatosLSH: candidatos.size, pares };
}

/**
 * Pipeline completo de preparo (achado de painel: v1 não exportava isso,
 * então os números do model card não eram reproduzíveis a partir do
 * arquivo entregue - só uma amostra de 1500 era testada). Roda dedup no
 * dataset INTEIRO (não amostra) e balanceia pro alvo pedido. É exatamente
 * o que gerou o dataset do job real.
 */
function prepararDatasetCompleto(caminhoJsonl, alvoTotal) {
  const bruto = carregarDolly(caminhoJsonl);
  const compativeis = filtrarCompativeis(bruto);
  const mapeados = compativeis.map(paraSchemaCanonico);

  const dedup = dedupGenerico(mapeados, N_SHINGLE);
  const remover = new Set(dedup.pares.map((p) => p.j));
  const semDuplicatas = mapeados.filter((_, i) => !remover.has(i));

  const contagem = contarPorFonteLocal(semDuplicatas, CASO);
  const alocacao = m2.alocarComCapacidade(contagem, m2.ALPHA_TEMPERATURA, alvoTotal);
  const usados = {};
  const balanceado = [];
  for (const e of semDuplicatas) {
    const f = e.metadata.fonte;
    usados[f] = usados[f] || 0;
    if (usados[f] < alocacao[f]) { balanceado.push(e); usados[f] += 1; }
  }

  return {
    bruto, compativeis, mapeados, dedup,
    itensRemovidos: remover.size, semDuplicatas,
    contagem, alocacao, balanceado,
  };
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

function rodarTestes(caminhoJsonl) {
  console.log('== Testes: carga e mapeamento pro schema canônico ==');
  const bruto = carregarDolly(caminhoJsonl);

  testar('dataset bruto tem 15011 registros (tamanho real confirmado do Dolly-15k)', () => {
    assert.equal(bruto.length, 15011);
  });

  testar('só 3 das 8 categorias têm campo context preenchido', () => {
    const porCategoria = {};
    for (const r of bruto) {
      porCategoria[r.category] = porCategoria[r.category] || { total: 0, comContexto: 0 };
      porCategoria[r.category].total += 1;
      if (r.context && r.context.trim()) porCategoria[r.category].comContexto += 1;
    }
    for (const cat of CATEGORIAS_COMPATIVEIS) {
      assert.ok(porCategoria[cat].comContexto === porCategoria[cat].total, `${cat} deveria ter 100% com contexto`);
    }
    const incompativeis = Object.keys(porCategoria).filter((c) => !CATEGORIAS_COMPATIVEIS.includes(c));
    for (const cat of incompativeis) {
      assert.equal(porCategoria[cat].comContexto, 0, `${cat} deveria ter 0% com contexto`);
    }
  });

  const compativeis = filtrarCompativeis(bruto);
  testar('filtro produz 4467 exemplos reais compatíveis com o schema canônico', () => {
    assert.equal(compativeis.length, 4467);
  });

  const mapeados = compativeis.map(paraSchemaCanonico);
  testar('todo exemplo mapeado tem os quatro campos do schema canônico preenchidos', () => {
    for (const e of mapeados) {
      assert.ok(e.instrucao && e.entrada && e.saida, 'campo vazio encontrado');
      assert.ok(e.metadata.caso && e.metadata.fonte, 'metadata incompleto');
    }
  });

  testar('distribuição por fonte bate com a contagem real do dataset', () => {
    const porFonte = {};
    for (const e of mapeados) porFonte[e.metadata.fonte] = (porFonte[e.metadata.fonte] || 0) + 1;
    assert.equal(porFonte.closed_qa, 1773);
    assert.equal(porFonte.information_extraction, 1506);
    assert.equal(porFonte.summarization, 1188);
  });

  console.log('\n== Testes: dedup genérico, comparando instrução+entrada (correção pós-painel de avaliação) ==');

  testar('entrada sozinha teria Jaccard 1,0 (é POR ISSO que comparar só entrada é errado aqui)', () => {
    const a = mapeados.find((e) => e.instrucao === 'What caused the Global Financial Crises?');
    const b = mapeados.find((e) => e.instrucao === 'What caused the 2007-2008 financial crisis?');
    assert.ok(a && b, 'par de teste não encontrado no dataset baixado');
    assert.equal(m2.similaridadeJaccardExata(a.entrada, b.entrada, N_SHINGLE), 1);
  });

  testar('com instrução+entrada, esse mesmo par NÃO é mais Jaccard 1,0 (fix funcionando)', () => {
    const a = mapeados.find((e) => e.instrucao === 'What caused the Global Financial Crises?');
    const b = mapeados.find((e) => e.instrucao === 'What caused the 2007-2008 financial crisis?');
    assert.ok(m2.similaridadeJaccardExata(textoParaDedup(a), textoParaDedup(b), N_SHINGLE) < 1);
  });

  console.log('\n== Testes: pipeline completo (dataset inteiro, não amostra - correção pós-painel) ==');

  const completo = prepararDatasetCompleto(caminhoJsonl, 200);
  testar('roda contra os 4.467 exemplos inteiros, não uma amostra', () => {
    assert.equal(completo.mapeados.length, 4467);
  });

  testar('LSH reduz a busca de força-bruta drasticamente também em dado real', () => {
    assert.ok(completo.dedup.candidatosLSH < completo.dedup.totalForcaBruta * 0.01, 'LSH não reduziu o suficiente');
  });

  testar('dedup real encontra pelo menos 1 par genuíno (mesma instrução E mesmo contexto)', () => {
    assert.ok(completo.dedup.pares.length > 0, 'nenhuma quase-duplicata real encontrada');
  });

  testar('itens removidos é a contagem de índices ÚNICOS, não o total de pares (podem se sobrepor)', () => {
    assert.ok(completo.itensRemovidos <= completo.dedup.pares.length, 'itens removidos não pode exceder pares confirmados');
    assert.equal(completo.semDuplicatas.length, completo.mapeados.length - completo.itensRemovidos);
  });

  console.log('\n== Testes: balanceamento por temperatura (reusado sem modificação) ==');

  testar('alocação final soma exatamente o alvo pedido (200)', () => {
    assert.equal(completo.balanceado.length, 200);
  });

  testar('alocação capacitada nunca excede a contagem real disponível por fonte', () => {
    for (const fonte of Object.keys(completo.alocacao)) {
      assert.ok(completo.alocacao[fonte] <= completo.contagem[fonte], `${fonte} excedeu a contagem real`);
    }
  });

  const distAntes = m2.distribuicaoDe(completo.contagem);
  const distDepois = m2.distribuicaoDe(completo.alocacao);
  testar('entropia sobe depois do balanceamento, igual no dado sintético do Módulo 2.2', () => {
    assert.ok(m2.entropiaShannon(distDepois) >= m2.entropiaShannon(distAntes));
  });

  console.log(`\n${totalTestes - testesComFalha}/${totalTestes} testes passaram.`);
  return { bruto, compativeis, mapeados, completo, distAntes, distDepois };
}

/* --------------------------------------------------------------------------
 * Demo
 * -------------------------------------------------------------------------- */

function rodarDemo(caminhoJsonl) {
  console.log('===== Extra: dataset real alternativo (Dolly-15k) rodando contra o pipeline do Módulo 2.2 =====\n');
  const r = rodarTestes(caminhoJsonl);
  const c = r.completo;

  console.log('\n--- Resumo ---');
  console.log(`Dataset bruto: ${r.bruto.length} exemplos reais (databricks-dolly-15k, CC-BY-SA-3.0)`);
  console.log(`Compatíveis com o schema canônico (têm contexto real): ${r.compativeis.length}`);
  console.log(`Distribuição por fonte antes do dedup: ${JSON.stringify(contarPorFonteLocal(r.mapeados, CASO))}`);
  console.log(`Dedup no dataset INTEIRO (comparando instrução+entrada): ${c.dedup.candidatosLSH} candidatos LSH de ${c.dedup.totalForcaBruta} pares força-bruta, ${c.dedup.pares.length} pares confirmados, ${c.itensRemovidos} itens únicos removidos -> ${c.semDuplicatas.length} restantes`);
  console.log(`Balanceado pro alvo: ${JSON.stringify(c.alocacao)}, total ${c.balanceado.length}`);
  console.log(`Entropia antes/depois do balanceamento: ${m2.entropiaShannon(r.distAntes).toFixed(4)} -> ${m2.entropiaShannon(r.distDepois).toFixed(4)} nats`);
  console.log('\nCorreção pós-painel de avaliação (25/08): a v1 deste arquivo comparava só `entrada` no dedup, o que confundia pares de PERGUNTA DIFERENTE sobre o MESMO trecho de contexto (Jaccard=1,0 na entrada) com duplicata real - ex.: duas perguntas diferentes sobre a crise financeira de 2008, mesmo texto-fonte. Comparar instrução+entrada corrige isso: esse par específico não é mais candidato a duplicata.');
}

module.exports = {
  carregarDolly,
  paraSchemaCanonico,
  filtrarCompativeis,
  dedupGenerico,
  textoParaDedup,
  prepararDatasetCompleto,
  contarPorFonteLocal,
  rodarTestes,
  CATEGORIAS_COMPATIVEIS,
  CASO,
};

if (require.main === module) {
  const caminho = process.argv[2] || path.join(__dirname, 'databricks-dolly-15k.jsonl');
  if (!fs.existsSync(caminho)) {
    console.error(`Arquivo não encontrado: ${caminho}`);
    console.error('Baixe primeiro: curl -L "https://huggingface.co/datasets/databricks/databricks-dolly-15k/resolve/main/databricks-dolly-15k.jsonl" -o databricks-dolly-15k.jsonl');
    process.exit(1);
  }
  rodarDemo(caminho);
}

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
