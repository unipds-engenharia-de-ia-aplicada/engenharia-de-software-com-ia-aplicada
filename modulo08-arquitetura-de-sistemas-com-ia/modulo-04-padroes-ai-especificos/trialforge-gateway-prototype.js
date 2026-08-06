/**
 * Ahirton Lopes · AI Architecture Toolkit
 * Artefato de Demo - Módulo 4.5
 *
 * Protótipo: Gateway do TrialForge combinando os 4 grupos de padrão do Módulo 4 —
 * RAG completo: Multi-Index + Hybrid Search + Agentic RAG (4.1), Intent-Based Routing
 * + Model Router (4.2), Semantic Cache + Response Streaming (4.3), Confidence Threshold
 * + Approval Gate + Audit Trail (4.4). O RAG usa três índices reais (um por domínio de
 * agente do TrialForge: ICF, Protocolo, CSR), busca híbrida (BM25 léxico + embedding
 * denso, fundidos por posição de rank via Reciprocal Rank Fusion) e um loop agente que
 * amplia a estratégia de busca até 3 vezes antes de desistir e escalar pro Approval Gate.
 * Indexação (embeddings + estatísticas BM25 do corpus) roda uma vez, na inicialização —
 * nunca de novo a cada busca — a mesma separação que a anatomia do Basic RAG (Módulo 4.1)
 * já ensina entre a fase de indexação e a fase de retrieval.
 *
 * Modelos: Ollama local, gratuito, sem chave de API, sem cartão.
 *   - nomic-embed-text: embeddings REAIS para Semantic Cache e para o score de
 *     confiança da busca de cláusula — não é heurística de palavra-chave.
 *   - gemma4:e2b    (~7.2GB): modelo "barato" — consulta de rotina.
 *   - gemma4:latest  (~9.6GB): modelo "caro"   — síntese que vira documento oficial.
 *
 * Requer: 1) ollama pull nomic-embed-text && ollama pull gemma4:e2b && ollama pull gemma4
 *         2) npm install ollama
 * Uso:    node trialforge-gateway-prototype.js
 *
 * Existe uma versão idêntica em Python: trialforge_gateway_prototype.py (a Missão
 * Prática #04 pede o protótipo em JavaScript, conforme a ementa — Python é referência).
 */

const ollama = require('ollama').default;
const fs = require('fs');
const readline = require('readline');

const MODELO_BARATO = 'gemma4:e2b';
const MODELO_CARO = 'gemma4:latest';
const MODELO_EMBEDDING = 'nomic-embed-text';

// Os dois limiares abaixo foram calibrados testando de verdade contra o
// nomic-embed-text em perguntas curtas em português (Módulo 4.3: "não existe
// limiar universal, se calibra por tipo de pergunta"). Nesse par modelo+idioma,
// paráfrases próximas reaproveitando termos do domínio ficaram em ~0.82 de
// similaridade, enquanto perguntas de tema totalmente diferente ficaram em
// ~0.64-0.65 — o corte abaixo fica no meio desse intervalo, não é um valor
// padrão de mercado.
const LIMIAR_CACHE = 0.75; // Semantic Cache (Módulo 4.3): acima disso, é "a mesma pergunta"
const LIMIAR_CONFIANCA = 0.7; // Confidence Threshold (Módulo 4.4): abaixo disso, escala pro Approval Gate
const TRILHA_AUDITORIA = `${__dirname}/audit-trail.jsonl`;

// Multi-Index (Módulo 4.1): um índice por domínio de agente — ICF, Protocolo, CSR —
// em vez de um banco único e achatado. Cada domínio tem vocabulário e fonte regulatória
// próprios (Módulo 3.1: é o mesmo motivo que justifica agentes especialistas), então
// misturar os três num índice só só adicionaria ruído de recuperação sem necessidade.
const INDICES = {
  icf: [
    {
      tema: 'Assentimento de menores de idade em estudos clínicos',
      texto:
        'Para participantes entre 12 e 17 anos, é necessário assentimento por escrito, ' +
        'além do consentimento do responsável legal (RDC ANVISA 466/2012, Art. 4º).',
      fonte: 'RDC ANVISA 466/2012, Art. 4º',
    },
    {
      tema: 'Direito de retirada do participante do estudo a qualquer momento',
      texto:
        'O participante pode retirar seu consentimento a qualquer momento, sem necessidade ' +
        'de justificativa e sem prejuízo ao seu tratamento (RDC ANVISA 466/2012, Art. 5º).',
      fonte: 'RDC ANVISA 466/2012, Art. 5º',
    },
  ],
  // "doze anos" aqui é o mesmo número da emenda ética do Módulo 3.4/3.5 (idade
  // mínima 13 → 12) — o mesmo critério de protocolo revisitado em outra camada.
  protocolo: [
    {
      tema: 'Critério de idade mínima para inclusão no estudo',
      texto:
        'A idade mínima para participação no estudo é de doze anos completos na data ' +
        'da assinatura do assentimento, conforme a versão vigente do protocolo aprovada ' +
        'pelo comitê de ética.',
      fonte: 'Protocolo Clínico TrialForge, critério de inclusão nº 2',
    },
    {
      tema: 'Critério de exclusão por interação medicamentosa',
      texto:
        'Participantes em uso concomitante de medicação com interação farmacológica ' +
        'documentada são excluídos do estudo, conforme a seção 4.2 do protocolo.',
      fonte: 'Protocolo Clínico TrialForge, critério de exclusão nº 4',
    },
  ],
  csr: [
    {
      tema: 'Apresentação de eventos adversos no relatório final',
      texto:
        'Eventos adversos devem ser apresentados por gravidade e causalidade, seguindo ' +
        'a estrutura de seções do guia ICH E3, sem agregação que oculte eventos ' +
        'individuais graves.',
      fonte: 'ICH E3, seção 12',
    },
    {
      tema: 'Significância estatística do desfecho primário',
      texto:
        'O desfecho primário só pode ser reportado como positivo se atingir o nível de ' +
        'significância pré-especificado no plano de análise estatística, sem ajuste ' +
        'post-hoc.',
      fonte: 'ICH E3, seção 11; Plano de Análise Estatística do estudo',
    },
  ],
};

// Roteamento pro índice certo (Módulo 4.1) reaproveita a mesma classificação de
// intenção que já decide o Model Router (Módulo 4.2) — a pergunta já diz o domínio.
const INDICE_POR_INTENCAO = {
  consulta_icf: 'icf',
  consulta_protocolo: 'protocolo',
  sintese_csr: 'csr',
};

// ---------- Retry com limite + timeout real (mesmo padrão do Módulo 3.5) ----------
// Falha transitória de rede ou de modelo não deveria derrubar a requisição inteira — o
// Supervisor do Módulo 3.5 já resolveu isso com timeout real (Promise.race contra um
// temporizador) + retry com limite; aqui é a mesma receita aplicada às duas chamadas ao
// Ollama (embedding e geração), que antes não tinham nenhuma proteção contra travamento
// ou instabilidade momentânea do modelo local.
const MAX_TENTATIVAS_OLLAMA = 3;
const TIMEOUT_OLLAMA_MS = 20000;

class ErroDeTimeoutOllama extends Error {
  constructor(operacao, timeoutMs) {
    super(`${operacao}: timeout de ${timeoutMs}ms excedido — Ollama não respondeu a tempo.`);
  }
}

function comTimeout(promessa, timeoutMs, operacao) {
  return new Promise((resolve, reject) => {
    const temporizador = setTimeout(() => reject(new ErroDeTimeoutOllama(operacao, timeoutMs)), timeoutMs);
    promessa.then(
      (valor) => {
        clearTimeout(temporizador);
        resolve(valor);
      },
      (erro) => {
        clearTimeout(temporizador);
        reject(erro);
      }
    );
  });
}

async function comRetry(criarPromessa, operacao) {
  let ultimoErro = null;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_OLLAMA; tentativa++) {
    try {
      return await comTimeout(criarPromessa(), TIMEOUT_OLLAMA_MS, operacao);
    } catch (erro) {
      ultimoErro = erro;
      console.log(`[Retry] ${operacao} falhou na tentativa ${tentativa}/${MAX_TENTATIVAS_OLLAMA}: ${erro.message}`);
    }
  }
  throw new Error(`${operacao} falhou após ${MAX_TENTATIVAS_OLLAMA} tentativas: ${ultimoErro.message}`);
}

// ---------- Embeddings reais (base de Semantic Cache e de confiança do RAG) ----------

async function embedar(texto) {
  const resposta = await comRetry(
    () => ollama.embeddings({ model: MODELO_EMBEDDING, prompt: texto }),
    'Embedding'
  );
  return resposta.embedding;
}

function similaridadeCosseno(a, b) {
  let produto = 0;
  let normaA = 0;
  let normaB = 0;
  for (let i = 0; i < a.length; i++) {
    produto += a[i] * b[i];
    normaA += a[i] * a[i];
    normaB += b[i] * b[i];
  }
  return produto / (Math.sqrt(normaA) * Math.sqrt(normaB));
}

// ---------- Semantic Cache (Módulo 4.3) ----------

const cacheSemantico = []; // { pergunta, embedding, resposta }

function consultarCache(perguntaEmbedding) {
  let melhor = { similaridade: 0, entrada: null };
  for (const entrada of cacheSemantico) {
    const sim = similaridadeCosseno(perguntaEmbedding, entrada.embedding);
    if (sim > melhor.similaridade) melhor = { similaridade: sim, entrada };
  }
  return melhor;
}

// ---------- Intent-Based Routing (Módulo 4.2) ----------
// Classificador de regra determinística — a ponta mais simples da escada descrita
// no 4.2, suficiente pra separar os únicos 2 fluxos que pedem tratamento diferente aqui.

function classificarIntencao(pergunta) {
  const p = pergunta.toLowerCase();
  if (p.includes('csr') || p.includes('relatório final') || p.includes('síntese') || p.includes('evento adverso') || p.includes('desfecho')) {
    return 'sintese_csr';
  }
  if (p.includes('critério') || p.includes('inclusão') || p.includes('exclusão') || p.includes('idade mínima') || p.includes('protocolo')) {
    return 'consulta_protocolo';
  }
  return 'consulta_icf';
}

// ---------- RAG (Módulo 4.1): Multi-Index + Hybrid Search + Agentic RAG ----------
// Três mecanismos empilhados, cada um resolvendo um problema diferente do RAG básico:
//   1. Multi-Index: busca só dentro do índice do domínio certo, não no banco inteiro.
//   2. Hybrid Search: combina léxico (BM25) com denso (embedding), fundidos por RANK,
//      nunca somando os dois scores brutos direto — escalas incompatíveis (Módulo 4.1).
//   3. Agentic RAG: se a confiança fica baixa, tenta de novo com estratégia mais ampla,
//      até um limite de tentativas — mesma lógica do retry com limite do Módulo 3.5.
// As três funções de busca abaixo são síncronas de propósito: toda chamada ao modelo de
// embedding do CORPUS já aconteceu antes, em prepararIndices() — buscar não faz rede
// nenhuma, só compara vetores e tokens já prontos. A única chamada de rede por requisição
// é o embedding da PERGUNTA em si, feito uma vez em processarRequisicao().

function tokenizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (marcas combinantes pós-NFD): idf mais estável com corpus pequeno
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function construirEstatisticasBM25(documentos) {
  const tokensPorDoc = documentos.map(tokenizar);
  const N = documentos.length;
  const avgdl = tokensPorDoc.reduce((soma, t) => soma + t.length, 0) / N;
  const df = new Map(); // em quantos documentos cada termo aparece
  for (const tokens of tokensPorDoc) {
    for (const termo of new Set(tokens)) {
      df.set(termo, (df.get(termo) || 0) + 1);
    }
  }
  return { tokensPorDoc, N, avgdl, df };
}

function scoreBM25(queryTokens, docTokens, estatisticas, k1 = 1.5, b = 0.75) {
  const { N, avgdl, df } = estatisticas;
  let score = 0;
  for (const termo of queryTokens) {
    const freqNoDoc = docTokens.filter((t) => t === termo).length;
    if (freqNoDoc === 0) continue;
    const docFreq = df.get(termo) || 0;
    const idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1); // +1 evita idf negativo com poucos docs
    const numerador = freqNoDoc * (k1 + 1);
    const denominador = freqNoDoc + k1 * (1 - b + (b * docTokens.length) / avgdl);
    score += idf * (numerador / denominador);
  }
  return score;
}

function ordenarPorScore(scores) {
  return scores
    .map((score, idx) => ({ idx, score }))
    .sort((a, b) => b.score - a.score)
    .map((e) => e.idx);
}

// Reciprocal Rank Fusion (Cormack, Clarke & Büttcher, SIGIR 2009): funde dois rankings
// pela POSIÇÃO de cada documento em cada um, não pelo valor do score — é assim que se
// combina BM25 (escala aberta) com cosseno (-1 a 1) sem normalizar nada à mão.
function fusaoReciprocalRank(ranking1, ranking2, k = 60) {
  const scores = new Map();
  for (const ranking of [ranking1, ranking2]) {
    ranking.forEach((idx, posicao) => {
      scores.set(idx, (scores.get(idx) || 0) + 1 / (k + posicao + 1));
    });
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]);
}

// Indexação (Módulo 4.1): embeddings de CADA cláusula (tema e texto) e as estatísticas
// BM25 do corpus, um índice por domínio — tudo calculado uma vez só. `buscarClausulaHibrida`
// nunca chama embedar() pro lado do corpus; só lê o que já está pronto aqui.
let indicesPreparados = null;

async function prepararIndices() {
  const nomesIndices = Object.keys(INDICES);
  const totalClausulas = nomesIndices.reduce((soma, nome) => soma + INDICES[nome].length, 0);
  console.log(
    `[Indexação] Pré-computando embeddings e estatísticas BM25 de ${totalClausulas} cláusulas em ` +
      `${nomesIndices.length} índices — uma vez, não a cada busca...`
  );

  const preparados = {};
  for (const nomeIndice of nomesIndices) {
    const clausulas = INDICES[nomeIndice];
    const estatisticasBM25 = construirEstatisticasBM25(clausulas.map((c) => c.texto));
    const embeddingsTema = [];
    const embeddingsTexto = [];
    for (const clausula of clausulas) {
      embeddingsTema.push(await embedar(clausula.tema));
      embeddingsTexto.push(await embedar(clausula.texto));
    }
    preparados[nomeIndice] = { clausulas, estatisticasBM25, embeddingsTema, embeddingsTexto };
  }

  console.log('[Indexação] Concluída.\n');
  return preparados;
}

// Hybrid Search dentro de UM índice (já roteado pelo Multi-Index). `campoEmbedding` escolhe,
// entre os embeddings JÁ pré-computados, comparar contra o tema (mais preciso) ou o texto
// inteiro da cláusula (mais abrangente) — é o que o Agentic RAG varia entre tentativas.
function buscarClausulaHibrida(pergunta, perguntaEmbedding, nomeIndice, campoEmbedding = 'tema') {
  const { clausulas, estatisticasBM25, embeddingsTema, embeddingsTexto } = indicesPreparados[nomeIndice];
  const embeddingsCorpus = campoEmbedding === 'tema' ? embeddingsTema : embeddingsTexto;
  const queryTokens = tokenizar(pergunta);

  const similaridadesCosseno = embeddingsCorpus.map((embeddingClausula) =>
    similaridadeCosseno(perguntaEmbedding, embeddingClausula)
  );
  const rankingDenso = ordenarPorScore(similaridadesCosseno);

  const scoresBM25 = clausulas.map((_, idx) => scoreBM25(queryTokens, estatisticasBM25.tokensPorDoc[idx], estatisticasBM25));
  const rankingEsparso = ordenarPorScore(scoresBM25);

  const fusao = fusaoReciprocalRank(rankingDenso, rankingEsparso);
  const [melhorIdx, scoreRRF] = fusao[0];

  return {
    indice: nomeIndice,
    clausula: clausulas[melhorIdx],
    similaridadeCosseno: similaridadesCosseno[melhorIdx],
    scoreBM25: scoresBM25[melhorIdx],
    scoreRRF,
  };
}

// Último recurso do Agentic RAG: cruza TODOS os índices, não só o roteado inicialmente.
function buscarEmTodosIndices(pergunta, perguntaEmbedding) {
  let melhor = null;
  for (const nomeIndice of Object.keys(INDICES)) {
    const resultado = buscarClausulaHibrida(pergunta, perguntaEmbedding, nomeIndice, 'texto');
    if (!melhor || resultado.similaridadeCosseno > melhor.similaridadeCosseno) melhor = resultado;
  }
  return melhor;
}

const MAX_ITERACOES_AGENTIC = 3; // mesmo limite do retry do Módulo 3.5: insistir além disso não ajuda mais

// Agentic RAG (Módulo 4.1): busca → avalia confiança → busca de novo com estratégia mais
// ampla, até MAX_ITERACOES_AGENTIC. Se nunca atingir o limiar, devolve o melhor achado e
// deixa o Confidence Threshold (Módulo 4.4) escalar pro Approval Gate — o RAG não decide
// sozinho quando desistir, ele só para de insistir e passa a decisão adiante.
function buscarClausulaAgentica(pergunta, perguntaEmbedding, nomeIndiceInicial) {
  let melhorResultado = null;

  for (let iteracao = 1; iteracao <= MAX_ITERACOES_AGENTIC; iteracao++) {
    let resultado;
    let estrategia;
    if (iteracao === 1) {
      estrategia = `índice "${nomeIndiceInicial}", comparando com o tema da cláusula`;
      resultado = buscarClausulaHibrida(pergunta, perguntaEmbedding, nomeIndiceInicial, 'tema');
    } else if (iteracao === 2) {
      estrategia = `índice "${nomeIndiceInicial}", ampliando pro texto completo da cláusula`;
      resultado = buscarClausulaHibrida(pergunta, perguntaEmbedding, nomeIndiceInicial, 'texto');
    } else {
      estrategia = 'todos os índices, cruzando domínios (último recurso)';
      resultado = buscarEmTodosIndices(pergunta, perguntaEmbedding);
    }

    console.log(
      `  [Agentic RAG] Iteração ${iteracao}/${MAX_ITERACOES_AGENTIC} — ${estrategia} — confiança ${resultado.similaridadeCosseno.toFixed(3)}`
    );
    if (!melhorResultado || resultado.similaridadeCosseno > melhorResultado.similaridadeCosseno) {
      melhorResultado = resultado;
    }

    if (resultado.similaridadeCosseno >= LIMIAR_CONFIANCA) {
      return { ...melhorResultado, iteracoesUsadas: iteracao, esgotouLimite: false };
    }
  }

  console.log(
    `  [Agentic RAG] ${MAX_ITERACOES_AGENTIC} iterações esgotadas sem atingir o limiar — segue com o melhor ` +
      `resultado (confiança ${melhorResultado.similaridadeCosseno.toFixed(3)}) e deixa o Confidence Threshold decidir.`
  );
  return { ...melhorResultado, iteracoesUsadas: MAX_ITERACOES_AGENTIC, esgotouLimite: true };
}

// ---------- Testes automatizados (funções puras, sem rede — rodam antes de tocar o Ollama) ----------
// Mesma disciplina do Módulo 1.3/2.5: o que é determinístico no nosso próprio código (o
// classificador de intenção, a matemática do cosseno) ganha teste automatizado instantâneo;
// a redação exata gerada pelo modelo não entra aqui, só a verificação de trilha mais abaixo,
// que confere as DECISÕES tomadas (roteamento/cache/gate), não o texto.

function rodarTestesPuros() {
  console.log('== Testes: classificarIntencao + similaridadeCosseno (puros, sem rede) ==');
  let passou = 0;
  let total = 0;

  const casosIntencao = [
    { pergunta: 'Preciso da síntese do CSR final desse estudo.', esperado: 'sintese_csr' },
    { pergunta: 'Quero o relatório final do estudo.', esperado: 'sintese_csr' },
    { pergunta: 'Como os eventos adversos aparecem no relatório final?', esperado: 'sintese_csr' },
    { pergunta: 'Qual é o critério de idade mínima pra participar desse estudo?', esperado: 'consulta_protocolo' },
    { pergunta: 'Quais são os critérios de exclusão desse protocolo?', esperado: 'consulta_protocolo' },
    { pergunta: 'Quais são as regras de assentimento pra menores?', esperado: 'consulta_icf' },
    { pergunta: 'Qual o prazo de armazenamento das amostras biológicas?', esperado: 'consulta_icf' },
  ];
  for (const caso of casosIntencao) {
    total++;
    const resultado = classificarIntencao(caso.pergunta);
    const ok = resultado === caso.esperado;
    console.log(`  [${ok ? 'OK' : 'FALHOU'}] classificarIntencao("${caso.pergunta}") -> ${resultado} (esperado ${caso.esperado})`);
    if (ok) passou++;
  }

  const vetorA = [1, 0, 0];
  const vetorB = [1, 0, 0];
  const vetorOrtogonal = [0, 1, 0];
  const vetorOposto = [-1, 0, 0];
  const casosCosseno = [
    { nome: 'vetores idênticos', a: vetorA, b: vetorB, esperado: 1 },
    { nome: 'vetores ortogonais', a: vetorA, b: vetorOrtogonal, esperado: 0 },
    { nome: 'vetores opostos', a: vetorA, b: vetorOposto, esperado: -1 },
  ];
  for (const caso of casosCosseno) {
    total++;
    const resultado = similaridadeCosseno(caso.a, caso.b);
    const ok = Math.abs(resultado - caso.esperado) < 1e-9;
    console.log(`  [${ok ? 'OK' : 'FALHOU'}] similaridadeCosseno(${caso.nome}) -> ${resultado.toFixed(3)} (esperado ${caso.esperado})`);
    if (ok) passou++;
  }

  console.log('\n== Testes: scoreBM25 + fusaoReciprocalRank (puros, sem rede) ==');

  const corpusTeste = [
    'idade mínima de doze anos para participar do estudo',
    'consentimento do responsável legal é obrigatório',
    'retirada do participante a qualquer momento sem justificativa',
  ];
  const estatisticasTeste = construirEstatisticasBM25(corpusTeste);
  const queryTeste = tokenizar('qual a idade mínima exigida');
  const scoresTeste = corpusTeste.map((_, idx) => scoreBM25(queryTeste, estatisticasTeste.tokensPorDoc[idx], estatisticasTeste));
  const vencedorBM25 = scoresTeste.indexOf(Math.max(...scoresTeste));
  total++;
  const okBM25 = vencedorBM25 === 0; // único doc que compartilha "idade" e "mínima" com a query
  console.log(`  [${okBM25 ? 'OK' : 'FALHOU'}] scoreBM25: doc sobre idade mínima vence a busca lexical (venceu doc ${vencedorBM25})`);
  if (okBM25) passou++;

  // ranking1 e ranking2 concordam que o doc 0 é o melhor — sem empate, resultado não depende de estabilidade de sort
  const fusaoTeste = fusaoReciprocalRank([0, 1, 2], [0, 2, 1]);
  total++;
  const okFusao = fusaoTeste[0][0] === 0;
  console.log(`  [${okFusao ? 'OK' : 'FALHOU'}] fusaoReciprocalRank: doc no topo dos dois rankings vence a fusão (venceu doc ${fusaoTeste[0][0]})`);
  if (okFusao) passou++;

  console.log(`Total: ${total} teste(s), ${passou} passou(passaram), ${total - passou} falhou(falharam).\n`);
  if (passou !== total) {
    throw new Error(`Testes puros falharam: ${passou}/${total} — corrija antes de chamar o modelo.`);
  }
}

// ---------- Approval Gate + Audit Trail (Módulo 4.4) ----------

// Duas versões anteriores deste arquivo tinham bugs reais aqui, os dois só
// aparecendo quando as respostas chegam de uma vez pelo stdin (ex.: `printf
// "s\ns\n" | node ...`, o jeito mais provável de um aluno automatizar a entrega
// da Missão Prática #04) — nunca num terminal interativo de verdade:
//   1) Recriar um readline.Interface a cada chamada: cada interface nova só
//      enxerga a partir do ponto em que foi criada, e uma resposta pode ser
//      consumida por uma interface que já fechou.
//   2) Uma única interface, mas com question() chamado só quando a aprovação
//      é de fato necessária: como isso acontece depois de chamadas assíncronas
//      ao modelo, o stdin não-interativo pode chegar ao fim (EOF) antes da
//      primeira pergunta, e o readline se fecha sozinho, derrubando as
//      perguntas seguintes com "readline was closed".
// A correção robusta é não depender de timing nenhum: se a entrada não é um
// terminal (isTTY), lê tudo de stdin de uma vez, síncrono, antes de qualquer
// chamada ao modelo, e consome as respostas de uma fila. Só usa o
// readline.Interface interativo quando tem um terminal de verdade do outro lado.
let filaRespostasAprovacao = null;
let interfaceAprovacaoInterativa = null;

function prepararEntradaDeAprovacao() {
  if (process.stdin.isTTY) {
    interfaceAprovacaoInterativa = readline.createInterface({ input: process.stdin, output: process.stdout });
  } else {
    const bruto = fs.readFileSync(0, 'utf-8'); // fd 0 = stdin inteiro, síncrono, antes de qualquer await
    filaRespostasAprovacao = bruto.split('\n').filter((linha) => linha.length > 0);
  }
}

async function pedirAprovacaoHumana(rascunho) {
  console.log('\n[Approval Gate] Rascunho aguardando aprovação antes de virar oficial:');
  console.log('   ', rascunho);
  let resposta;
  if (interfaceAprovacaoInterativa) {
    resposta = await new Promise((resolve) => interfaceAprovacaoInterativa.question('\nAprovar? (s/n) ', resolve));
  } else {
    resposta = filaRespostasAprovacao.shift() || '';
    console.log(`\nAprovar? (s/n) ${resposta}`); // eco: não há terminal interativo mostrando o que foi digitado
  }
  return resposta.trim().toLowerCase() === 's';
}

function registrarAuditoria(registro) {
  const linha = `${JSON.stringify({ timestamp: new Date().toISOString(), ...registro })}\n`;
  fs.appendFileSync(TRILHA_AUDITORIA, linha); // append-only — nunca sobrescreve (21 CFR Part 11, Módulo 4.4)
}

// ---------- Gateway: os 4 grupos de padrão encadeados numa requisição só ----------

let proximoIdRequisicao = 1;

async function processarRequisicao(pergunta) {
  const idRequisicao = `req-${proximoIdRequisicao++}`;
  console.log(`\n[Gateway] Requisição recebida: "${pergunta}"`);

  const intencao = classificarIntencao(pergunta);
  console.log(`[Intent-Based Routing] Intenção classificada: ${intencao}`);

  const perguntaEmbedding = await embedar(pergunta);

  // Semantic Cache: só entra em perguntas de rotina — síntese de CSR nunca usa cache (Módulo 4.3)
  if (intencao !== 'sintese_csr') {
    const { similaridade, entrada } = consultarCache(perguntaEmbedding);
    if (entrada && similaridade >= LIMIAR_CACHE) {
      console.log(
        `[Semantic Cache] HIT (similaridade ${similaridade.toFixed(3)}) — resposta reaproveitada, sem chamar o modelo.`
      );
      registrarAuditoria({
        id_requisicao: idRequisicao,
        pergunta,
        intencao,
        cache_hit: true,
        similaridade_cache: similaridade,
        status_final: 'respondido_via_cache',
      });
      return entrada.resposta;
    }
    console.log(`[Semantic Cache] MISS (melhor similaridade ${similaridade.toFixed(3)}) — segue pro modelo.`);
  }

  // Model Router (Módulo 4.2): a intenção decide qual modelo processa
  const modelo = intencao === 'sintese_csr' ? MODELO_CARO : MODELO_BARATO;
  console.log(`[Model Router] Modelo escolhido: ${modelo} (${modelo === MODELO_CARO ? 'caro/capaz' : 'barato/rápido'})`);

  // RAG (Módulo 4.1): Multi-Index roteia pro domínio certo, Hybrid Search busca dentro
  // dele (BM25 + embedding, fundidos por RRF), Agentic RAG insiste com estratégia mais
  // ampla se a confiança vier baixa — a similaridade final também vira sinal de confiança.
  const indiceInicial = INDICE_POR_INTENCAO[intencao];
  console.log(`[Multi-Index] Roteando pro índice "${indiceInicial}" (Módulo 4.1)`);
  const resultadoRag = buscarClausulaAgentica(pergunta, perguntaEmbedding, indiceInicial);
  const confianca = resultadoRag.similaridadeCosseno;
  const clausula = resultadoRag.clausula;
  console.log(
    `[RAG] Cláusula final: "${clausula.tema}" — índice "${resultadoRag.indice}", ` +
      `cosseno ${confianca.toFixed(3)}, BM25 ${resultadoRag.scoreBM25.toFixed(3)}, ` +
      `RRF ${resultadoRag.scoreRRF.toFixed(4)}, ${resultadoRag.iteracoesUsadas} iteração(ões).`
  );

  // Geração com streaming (Módulo 4.3) — token a token, não espera tudo pronto
  console.log('[Response Streaming] Gerando resposta:');
  process.stdout.write('    ');
  let rascunho = '';
  const stream = await comRetry(
    () =>
      ollama.chat({
        model: modelo,
        messages: [
          {
            role: 'system',
            content:
              'Você redige respostas curtas e precisas sobre regras de estudos clínicos, ' +
              'citando a fonte regulatória fornecida.',
          },
          {
            role: 'user',
            content:
              `Pergunta: ${pergunta}\n\n` +
              `Cláusula regulatória relevante: ${clausula.texto}\nFonte: ${clausula.fonte}\n\n` +
              'Responda usando essa cláusula.',
          },
        ],
        stream: true,
      }),
    'Geração de resposta'
  );
  for await (const parte of stream) {
    // Modelo de raciocínio: chunks de "thinking" vêm num campo separado, nunca em
    // .content — por isso só acumulamos/imprimimos .content, igual à versão Python.
    process.stdout.write(parte.message.content);
    rascunho += parte.message.content;
  }
  console.log();

  // Confidence Threshold + Approval Gate (Módulo 4.4)
  const precisaAprovacao = intencao === 'sintese_csr' || confianca < LIMIAR_CONFIANCA;
  let aprovado = true;
  if (precisaAprovacao) {
    const motivo =
      intencao === 'sintese_csr'
        ? 'síntese de CSR — erro caro e irreversível, gate sempre obrigatório (Módulo 1.3)'
        : `confiança abaixo do limiar (${confianca.toFixed(3)} < ${LIMIAR_CONFIANCA})`;
    console.log(`[Confidence Threshold] Escalando pro Approval Gate — motivo: ${motivo}`);
    // Registro gravado ANTES do prompt, não depois: o pedido pendente precisa sobreviver
    // independente de quando (ou se) alguém responde — se o processo caísse aqui, o
    // rascunho não desapareceria sem rastro, ficaria "aguardando_aprovacao" na trilha.
    registrarAuditoria({
      id_requisicao: idRequisicao,
      pergunta,
      intencao,
      status_final: 'aguardando_aprovacao',
      motivo_gate: motivo,
    });
    aprovado = await pedirAprovacaoHumana(rascunho);
  } else {
    console.log(`[Confidence Threshold] Confiança ${confianca.toFixed(3)} acima do limiar — segue sem Approval Gate.`);
  }

  registrarAuditoria({
    id_requisicao: idRequisicao,
    pergunta,
    intencao,
    cache_hit: false,
    modelo_usado: modelo,
    indice_usado: resultadoRag.indice,
    iteracoes_agentic: resultadoRag.iteracoesUsadas,
    esgotou_agentic: resultadoRag.esgotouLimite,
    confianca_rag: confianca,
    gate_acionado: precisaAprovacao,
    aprovado,
    status_final: aprovado ? 'aprovado' : 'rejeitado',
  });

  if (!aprovado) {
    console.log('[Approval Gate] Rascunho rejeitado — não vira oficial.');
    return null;
  }

  // Alimenta o Semantic Cache com essa pergunta+resposta pra próxima vez (só rotina)
  if (intencao !== 'sintese_csr') {
    cacheSemantico.push({ pergunta, embedding: perguntaEmbedding, resposta: rascunho });
  }

  console.log('[Gateway] Requisição concluída — trilha de auditoria registrada.');
  return rascunho;
}

// ---------- Verificação pós-execução: a trilha de auditoria confirma os 4 caminhos ----------
// Não confia só no humano assistindo notar os 4 comportamentos — relê o artefato persistido
// (o mesmo audit-trail.jsonl que o Módulo 4.4 formaliza) e confere que cada requisição tomou
// a decisão certa. Compara DECISÕES determinísticas (cache hit/miss, modelo escolhido, gate
// acionado ou não), nunca o texto exato gerado pelo modelo, que varia entre execuções.
// Olha só as ÚLTIMAS 4 entradas, nunca apaga nem trunca o arquivo: a trilha é append-only
// de propósito (21 CFR Part 11, Módulo 4.4), inclusive entre execuções repetidas do demo.
function verificarTrilhaAuditoria() {
  const todasLinhas = fs
    .readFileSync(TRILHA_AUDITORIA, 'utf-8')
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
  // "aguardando_aprovacao" é um registro de pendência, não uma decisão concluída — filtra
  // antes do slice(-5), senão as 2 pendências (perguntas #3 e #4) empurram entradas
  // concluídas de verdade pra fora da janela das "últimas 5".
  const linhasConcluidas = todasLinhas.filter((l) => l.status_final !== 'aguardando_aprovacao');
  const linhas = linhasConcluidas.slice(-5);

  console.log(
    `\n== Verificação: últimas 5 requisições concluídas (${linhasConcluidas.length} concluídas, ` +
      `${todasLinhas.length} entradas no total incluindo pendências) ==`
  );

  const checagens = [
    ['pelo menos 5 requisições concluídas na trilha', linhasConcluidas.length >= 5],
    ['ao menos 1 registro "aguardando_aprovacao" gravado antes de qualquer decisão', todasLinhas.some((l) => l.status_final === 'aguardando_aprovacao')],
    ['#1 rotina: sem cache hit', linhas[0]?.cache_hit === false],
    ['#1 rotina: confiança alta, sem Approval Gate', linhas[0]?.gate_acionado === false],
    ['#2 paráfrase: cache HIT', linhas[1]?.cache_hit === true && linhas[1]?.status_final === 'respondido_via_cache'],
    ['#3 síntese de CSR: modelo caro', linhas[2]?.modelo_usado === MODELO_CARO],
    ['#3 síntese de CSR: Approval Gate sempre acionado', linhas[2]?.gate_acionado === true],
    ['#3 síntese de CSR: Multi-Index roteou pro índice csr', linhas[2]?.indice_usado === 'csr'],
    ['#4 tema diferente: cache miss', linhas[3]?.cache_hit === false],
    ['#4 tema diferente: Agentic RAG esgotou as 3 iterações', linhas[3]?.iteracoes_agentic === MAX_ITERACOES_AGENTIC && linhas[3]?.esgotou_agentic === true],
    ['#4 tema diferente: Approval Gate por confiança baixa', linhas[3]?.gate_acionado === true && linhas[3]?.confianca_rag < LIMIAR_CONFIANCA],
    ['#5 critério de protocolo: Multi-Index roteou pro índice protocolo', linhas[4]?.indice_usado === 'protocolo'],
    ['#5 critério de protocolo: Agentic RAG confiante já na 1ª iteração', linhas[4]?.iteracoes_agentic === 1],
    ['#5 critério de protocolo: sem Approval Gate', linhas[4]?.gate_acionado === false],
  ];

  let passou = 0;
  for (const [descricao, ok] of checagens) {
    console.log(`  [${ok ? 'OK' : 'FALHOU'}] ${descricao}`);
    if (ok) passou++;
  }
  console.log(`Total: ${checagens.length} verificação(ões), ${passou} passou(passaram), ${checagens.length - passou} falhou(falharam).`);

  if (passou !== checagens.length) {
    throw new Error(
      `A trilha de auditoria não confirma os 4 caminhos esperados (${passou}/${checagens.length}) — ` +
        'reveja audit-trail.jsonl.'
    );
  }
}

// ---------- Simulação: 4 requisições em sequência, mostrando os 4 caminhos possíveis ----------

async function main() {
  rodarTestesPuros();

  indicesPreparados = await prepararIndices();

  prepararEntradaDeAprovacao();

  // 1) Pergunta de rotina — gera de verdade, depois popula o Semantic Cache
  await processarRequisicao('Quais são as regras de assentimento pra menores nesse estudo?');

  // 2) Paráfrase da pergunta 1, reaproveitando os termos do domínio — deve bater no Semantic Cache
  await processarRequisicao('O assentimento dos menores de idade é obrigatório nesse estudo?');

  // 3) Síntese de CSR — sempre modelo caro + sempre Approval Gate, nunca cache
  await processarRequisicao('Preciso da síntese do CSR final desse estudo.');

  // 4) Pergunta de tema bem diferente de qualquer índice — nenhuma das 3 iterações do
  // Agentic RAG encontra confiança suficiente (nem ampliando o índice, nem cruzando os
  // 3 domínios), então esgota o limite e o Confidence Threshold escala pro Approval Gate
  await processarRequisicao('Qual o prazo de armazenamento das amostras biológicas coletadas nesse estudo?');

  // 5) Pergunta sobre critério de protocolo — Multi-Index roteia pro índice "protocolo"
  // (não "icf"), e Hybrid Search acha a cláusula com confiança já na 1ª iteração: BM25
  // casa "idade mínima" literalmente, cosseno concorda — RRF fecha os dois sem empate
  await processarRequisicao('Qual é o critério de idade mínima pra participar desse estudo?');

  verificarTrilhaAuditoria();
}

if (require.main === module) {
  main()
    .catch((erro) => {
      console.error('[Erro não tratado]', erro.message);
      registrarAuditoria({ erro: erro.message, status_final: 'falha_tecnica' });
      process.exitCode = 1;
    })
    .finally(() => {
      if (interfaceAprovacaoInterativa) interfaceAprovacaoInterativa.close();
    });
}

module.exports = { classificarIntencao, similaridadeCosseno, processarRequisicao, verificarTrilhaAuditoria };

/*
 * Nota sobre Prompt Cache (Módulo 4.3) e provedores pagos:
 * Prompt Cache (Anthropic/OpenAI) é um recurso do lado do PROVEDOR — você marca o
 * prefixo repetido (system prompt, documento longo) e a própria API cacheia isso
 * entre chamadas. Rodando local via Ollama não existe cobrança por token pra
 * caching, então esse padrão específico não se demonstra aqui — ele é real e
 * documentado (Módulo 4.3), só não se aplica da mesma forma a inferência local.
 * Model Router, Semantic Cache, Confidence Threshold e Audit Trail continuam
 * idênticos trocando ollama.chat()/ollama.embeddings() pela chamada equivalente
 * da Claude API, Gemini API ou OpenAI API — é a mesma lição do Módulo 1.2: o
 * modelo é a única peça que se troca.
 *
 * Ahirton Lopes · AI Architecture Toolkit — UNIPDS: Arquitetura de Sistemas com IA
 * Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager
 */
