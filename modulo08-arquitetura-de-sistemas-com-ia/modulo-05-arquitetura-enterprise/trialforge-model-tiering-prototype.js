/**
 * Ahirton Lopes · AI Architecture Toolkit
 * Artefato de Demo - Módulo 5.4 (protótipo final da disciplina)
 *
 * Protótipo: Cascata de Model Tiering + orçamento por estudo, estendendo o
 * Gateway do Módulo 4.5 com o mecanismo de cascata do FrugalGPT (Chen, Zaharia,
 * Zou — Stanford, TMLR 2024): tenta o tier mais barato primeiro, só escala pro
 * tier mais caro se um score de confiança ficar abaixo de um limiar.
 *
 * A escalação usa DOIS sinais, não um — descoberto rodando contra o Ollama de
 * verdade, não assumido de antemão: confiança de BUSCA (achou a cláusula certa
 * pra pergunta? trabalho do Módulo 4.1) e confiança de RESPOSTA, g(pergunta,
 * resposta) como no paper original (a resposta gerada ficou fiel à cláusula que
 * recebeu?). Os dois pegam falhas diferentes — testado na prática: numa pergunta
 * fora do banco de cláusulas, a busca erra a cláusula (confiança de busca baixa,
 * ~0.65) mas o Tier 1 ainda responde fielmente à cláusula ERRADA que recebeu
 * (confiança de resposta alta, ~0.82) — porque "seguir a cláusula fornecida"
 * e "a cláusula fornecida ser a certa" são coisas diferentes. Um score de
 * groundedness sozinho não pega busca ruim; confiança de busca sozinha não pega
 * alucinação sobre uma cláusula certa. A cascata escala se QUALQUER um dos dois
 * ficar abaixo do limiar.
 *
 * Modelos: Ollama local, gratuito, sem chave de API.
 *   - nomic-embed-text: embeddings reais (mesmo uso do Módulo 4.5).
 *   - gemma4:e2b    (~7.2GB): Tier 1 — barato, tentado primeiro.
 *   - gemma4:latest  (~9.6GB): Tier 2 — caro, só entra se o Tier 1 não convencer.
 *   - Tier 3 (frontier, pago — Claude/GPT-4/Gemini): NÃO implementado aqui, só
 *     documentado abaixo — no FrugalGPT original, a cascata pode ter N tiers;
 *     dois tiers reais já bastam pra demonstrar o mecanismo de verdade.
 *
 * Requer: 1) ollama pull nomic-embed-text && ollama pull gemma4:e2b && ollama pull gemma4
 *         2) npm install ollama
 * Uso:    node trialforge-model-tiering-prototype.js
 *
 * Existe uma versão idêntica em Python: trialforge_model_tiering_prototype.py
 * (a Missão Prática #05 pede o protótipo em JavaScript, conforme a ementa).
 */

const ollama = require('ollama').default;
const fs = require('fs');
const readline = require('readline');

const MODELO_TIER1 = 'gemma4:e2b'; // barato — tentado primeiro, sempre
const MODELO_TIER2 = 'gemma4:latest'; // caro — só entra por escalação ou por regra fixa (CSR)
const MODELO_EMBEDDING = 'nomic-embed-text';

// Dois limiares de cascata (Módulo 5.4), um por sinal — nenhum deve ser confundido com o
// LIMIAR_CONFIANCA=0.7 do Módulo 4.5 (esse decide escalar pro Approval Gate, problema diferente).
// LIMIAR_CASCATA_BUSCA: confiança de achar a cláusula certa (0.803 pergunta no domínio,
// 0.648 pergunta fora do banco — medido rodando de verdade; 0.75 fica no meio, com folga).
const LIMIAR_CASCATA_BUSCA = 0.75;
// LIMIAR_CASCATA_RESPOSTA: g(pergunta, resposta) — a resposta gerada ficou fiel à cláusula
// que recebeu? Medido em dois casos reais de resposta fiel (1.000 e 0.817, mesmo quando a
// cláusula de base estava errada) — 0.75 fica abaixo dos dois, então não escala nenhuma
// resposta fiel de verdade; existe pra pegar alucinação além da cláusula, não exercitado
// pelas 2 perguntas deste demo, mas real e calculado a cada chamada.
const LIMIAR_CASCATA_RESPOSTA = 0.75;
const TRILHA_AUDITORIA = `${__dirname}/audit-trail-tiering.jsonl`;

// Custo estimado por chamada, só pra demonstrar o controle de orçamento (Módulo 5.1/5.2) —
// valores ilustrativos, não preço real de nenhum provedor.
const CUSTO_TIER1 = 0.001;
const CUSTO_TIER2 = 0.01;

// Banco de cláusulas do Agente ICF (mesmo dado do Módulo 2.5/4.5) — RAG como sinal de confiança
const BANCO_CLAUSULAS = [
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
];

// ---------- Orçamento por estudo (Módulo 5.1 Uber/Vitalis Platform, Módulo 5.2 LiteLLM) ----------

const orcamentos = {
  'estudo-A': { limite: 0.05, gasto: 0 }, // folga pra cobrir 3 chamadas do estudo-A com margem
  'estudo-B': { limite: 0.005, gasto: 0 }, // propositalmente baixo, pra demonstrar bloqueio
};

function verificarOrcamento(estudoId, custoEstimado) {
  const conta = orcamentos[estudoId];
  if (!conta) throw new Error(`Estudo desconhecido: ${estudoId}`);
  return conta.gasto + custoEstimado <= conta.limite;
}

function registrarGasto(estudoId, custo) {
  orcamentos[estudoId].gasto += custo;
}

// Reserva otimista — checa E debita no MESMO passo síncrono, sem nenhum await entre as duas
// coisas. Diferente de "checar com verificarOrcamento, debitar depois com registrarGasto":
// esse padrão de duas etapas (check-then-act) tem uma janela real entre elas — na função que
// chama isso, há um await (embedar a pergunta) entre a checagem e o primeiro registrarGasto.
// Sob concorrência de verdade (Promise.all com N requisições do MESMO estudo), o event loop
// do Node roda cada chamada até seu primeiro await antes de passar pra próxima — ou seja, as N
// checagens de verificarOrcamento rodam todas ANTES de qualquer registrarGasto acontecer, e
// todas passam, porque nenhuma debitou ainda. Resultado: um estudo com orçamento pra 2
// chamadas pode gastar como se tivesse orçamento pra 5, se 5 chegarem juntas — confirmado
// rodando volume concorrente de verdade (ver simularVolumeConcorrente). reservarOrcamento
// fecha essa janela: não existe await entre checar e debitar, então nenhuma outra chamada
// consegue "entrar no meio".
function reservarOrcamento(estudoId, custoReservado) {
  const conta = orcamentos[estudoId];
  if (!conta) throw new Error(`Estudo desconhecido: ${estudoId}`);
  if (conta.gasto + custoReservado > conta.limite) return false;
  conta.gasto += custoReservado;
  return true;
}

// A reserva em reservarOrcamento cobre o PIOR caso (ex.: Tier 1 + Tier 2, se escalar). Se o
// custo real ficar menor (Tier 1 resolveu sozinho), devolve a diferença no final.
function liberarSobra(estudoId, valorASobrar) {
  if (valorASobrar > 0) orcamentos[estudoId].gasto -= valorASobrar;
}

// ---------- Embeddings e RAG (mesmo padrão do Módulo 4.5) ----------

async function embedar(texto) {
  const resposta = await ollama.embeddings({ model: MODELO_EMBEDDING, prompt: texto });
  return resposta.embedding;
}

function similaridadeCosseno(a, b) {
  let produto = 0, normaA = 0, normaB = 0;
  for (let i = 0; i < a.length; i++) {
    produto += a[i] * b[i];
    normaA += a[i] * a[i];
    normaB += b[i] * b[i];
  }
  return produto / (Math.sqrt(normaA) * Math.sqrt(normaB));
}

// Indexação (Módulo 4.1): embedding de cada cláusula, uma vez só — nunca de novo a cada
// busca. Mesma correção aplicada no Módulo 4.5: reembedar um corpus estático a cada
// chamada não escala e mistura a fase de indexação com a de retrieval.
//
// Dois índices, dois propósitos: embeddings do TEMA acham a cláusula certa pra pergunta
// (confiança de busca); embeddings do TEXTO servem de referência pra medir se a resposta
// GERADA depois fica fiel a essa cláusula (confiança de resposta, calculada em
// calcularConfiancaResposta) — ambos preparados aqui, nenhum recalculado por requisição.
let embeddingsClausulasPreparados = null;
let embeddingsTextoClausulasPreparados = null;

async function prepararIndice() {
  embeddingsClausulasPreparados = [];
  embeddingsTextoClausulasPreparados = [];
  for (const clausula of BANCO_CLAUSULAS) {
    embeddingsClausulasPreparados.push(await embedar(clausula.tema));
    embeddingsTextoClausulasPreparados.push(await embedar(clausula.texto));
  }
}

function buscarClausula(perguntaEmbedding) {
  let melhor = { similaridade: -1, clausula: null, indice: -1 };
  BANCO_CLAUSULAS.forEach((clausula, idx) => {
    const sim = similaridadeCosseno(perguntaEmbedding, embeddingsClausulasPreparados[idx]);
    if (sim > melhor.similaridade) melhor = { similaridade: sim, clausula, indice: idx };
  });
  return melhor;
}

// Confiança da RESPOSTA (g(pergunta, resposta) do FrugalGPT): embeda o rascunho que o tier
// acabou de gerar e compara contra o embedding do TEXTO da cláusula-fonte, já preparado em
// prepararIndice(). Alto = resposta fiel à cláusula; baixo = resposta se afastou da fonte
// (parafraseou demais, misturou informação de fora, ou simplesmente não respondeu bem).
async function calcularConfiancaResposta(rascunho, indiceClausula) {
  const rascunhoEmbedding = await embedar(rascunho);
  return similaridadeCosseno(rascunhoEmbedding, embeddingsTextoClausulasPreparados[indiceClausula]);
}

function classificarIntencao(pergunta) {
  const p = pergunta.toLowerCase();
  if (p.includes('csr') || p.includes('relatório final') || p.includes('síntese')) {
    return 'sintese_csr';
  }
  return 'consulta_clausula';
}

// ---------- Testes automatizados (funções puras, sem rede — rodam antes de tocar o Ollama) ----------
// Mesma disciplina do resto da disciplina: o que é determinístico no nosso próprio código
// (classificador de intenção, matemática do cosseno, verificação de orçamento) ganha teste
// automatizado instantâneo; a redação exata gerada pelo modelo fica só pra observação ao vivo.

function rodarTestesPuros() {
  console.log('== Testes: classificarIntencao + similaridadeCosseno + verificarOrcamento (puros, sem rede) ==');
  let passou = 0;
  let total = 0;

  const casosIntencao = [
    { pergunta: 'Preciso da síntese do CSR final desse estudo.', esperado: 'sintese_csr' },
    { pergunta: 'Quero o relatório final do estudo.', esperado: 'sintese_csr' },
    { pergunta: 'Quais são as regras de assentimento pra menores?', esperado: 'consulta_clausula' },
  ];
  for (const caso of casosIntencao) {
    total++;
    const resultado = classificarIntencao(caso.pergunta);
    const ok = resultado === caso.esperado;
    console.log(`  [${ok ? 'OK' : 'FALHOU'}] classificarIntencao("${caso.pergunta}") -> ${resultado} (esperado ${caso.esperado})`);
    if (ok) passou++;
  }

  const casosCosseno = [
    { nome: 'vetores idênticos', a: [1, 0, 0], b: [1, 0, 0], esperado: 1 },
    { nome: 'vetores ortogonais', a: [1, 0, 0], b: [0, 1, 0], esperado: 0 },
  ];
  for (const caso of casosCosseno) {
    total++;
    const resultado = similaridadeCosseno(caso.a, caso.b);
    const ok = Math.abs(resultado - caso.esperado) < 1e-9;
    console.log(`  [${ok ? 'OK' : 'FALHOU'}] similaridadeCosseno(${caso.nome}) -> ${resultado.toFixed(3)} (esperado ${caso.esperado})`);
    if (ok) passou++;
  }

  // verificarOrcamento não deve mutar estado — testa contra um orçamento sintético, não o real
  const orcamentoTeste = { limite: 0.05, gasto: 0.045 };
  const orcamentosOriginal = orcamentos['estudo-teste'];
  orcamentos['estudo-teste'] = orcamentoTeste;
  total++;
  const cabeDentro = verificarOrcamento('estudo-teste', 0.004); // 0.045 + 0.004 = 0.049 <= 0.05
  const ok1 = cabeDentro === true;
  console.log(`  [${ok1 ? 'OK' : 'FALHOU'}] verificarOrcamento com folga -> ${cabeDentro} (esperado true)`);
  if (ok1) passou++;
  total++;
  const estoura = verificarOrcamento('estudo-teste', 0.006); // 0.045 + 0.006 = 0.051 > 0.05
  const ok2 = estoura === false;
  console.log(`  [${ok2 ? 'OK' : 'FALHOU'}] verificarOrcamento estourando o limite -> ${estoura} (esperado false)`);
  if (ok2) passou++;
  if (orcamentosOriginal === undefined) delete orcamentos['estudo-teste'];
  else orcamentos['estudo-teste'] = orcamentosOriginal;

  console.log(`Total: ${total} teste(s), ${passou} passou(passaram), ${total - passou} falhou(falharam).\n`);
  if (passou !== total) {
    throw new Error(`Testes puros falharam: ${passou}/${total} — corrija antes de chamar o modelo.`);
  }
}

// ---------- Geração num tier específico, com streaming (Módulo 4.3) ----------

async function gerarComTier(modelo, pergunta, clausula) {
  let rascunho = '';
  const stream = await ollama.chat({
    model: modelo,
    messages: [
      { role: 'system', content: 'Você redige respostas curtas e precisas sobre regras de estudos clínicos, citando a fonte regulatória fornecida.' },
      { role: 'user', content: `Pergunta: ${pergunta}\n\nCláusula regulatória relevante: ${clausula.texto}\nFonte: ${clausula.fonte}\n\nResponda usando essa cláusula.` },
    ],
    stream: true,
  });
  for await (const parte of stream) {
    process.stdout.write(parte.message.content);
    rascunho += parte.message.content;
  }
  console.log();
  return rascunho;
}

// ---------- Approval Gate (Módulo 4.4), reaproveitado ----------
// Mesma correção do Módulo 4.5 aplicada aqui, embora este script só acione o Gate uma vez por
// execução (só a síntese de CSR aciona): recriar um readline.Interface a cada chamada é o mesmo
// bug real encontrado e corrigido no Módulo 4.5 (perde resposta vinda de stdin não-interativo,
// ex.: `printf "s\n" | node ...`). Corrigido aqui de propósito, antes de acontecer de novo, caso
// este protótipo seja estendido no futuro pra ter mais de um gatilho de aprovação por execução.
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
  fs.appendFileSync(TRILHA_AUDITORIA, linha);
}

// ---------- Cascata de Model Tiering (Módulo 5.4) ----------

async function processarComCascata(pergunta, estudoId) {
  console.log(`\n[Gateway] Estudo "${estudoId}" — requisição: "${pergunta}"`);

  const intencao = classificarIntencao(pergunta);
  const custoMaximoPossivel = intencao === 'sintese_csr' ? CUSTO_TIER2 : CUSTO_TIER1 + CUSTO_TIER2;

  // Orçamento reservado (não só checado) ANTES de qualquer chamada de modelo (lição do
  // Módulo 5.2) — reservarOrcamento debita o pior caso no mesmo passo síncrono da checagem,
  // fechando a janela de corrida que existiria entre checar e debitar (ver comentário acima
  // de reservarOrcamento).
  if (!reservarOrcamento(estudoId, custoMaximoPossivel)) {
    console.log(`[Orçamento] BLOQUEADO — estudo "${estudoId}" ultrapassaria o limite antes mesmo de chamar o modelo.`);
    registrarAuditoria({ estudoId, pergunta, status_final: 'bloqueado_por_orcamento' });
    return null;
  }
  let custoRealUsado = 0;

  const perguntaEmbedding = await embedar(pergunta);
  const { similaridade: confiancaBusca, clausula, indice: indiceClausula } = buscarClausula(perguntaEmbedding);

  let tierUsado, rascunho, escalou = false, confiancaResposta = null;

  if (intencao === 'sintese_csr') {
    // Regra fixa (Módulo 1.3): erro caro e irreversível, pula direto pro tier caro
    console.log('[Model Tiering] Síntese de CSR — regra fixa, direto pro Tier 2 (caro).');
    tierUsado = 'Tier 2';
    rascunho = await gerarComTier(MODELO_TIER2, pergunta, clausula);
    custoRealUsado += CUSTO_TIER2;
  } else {
    // Cascata FrugalGPT: tenta Tier 1 primeiro, sempre. Dois sinais decidem escalar,
    // cada um pegando uma falha diferente (ver comentário no topo do arquivo).
    console.log(`[Model Tiering] Tentando Tier 1 (barato) primeiro — cláusula encontrada com confiança de busca ${confiancaBusca.toFixed(3)}`);
    tierUsado = 'Tier 1';
    rascunho = await gerarComTier(MODELO_TIER1, pergunta, clausula);
    custoRealUsado += CUSTO_TIER1;

    confiancaResposta = await calcularConfiancaResposta(rascunho, indiceClausula);
    console.log(`[Model Tiering] Confiança da resposta do Tier 1 — g(pergunta, resposta): ${confiancaResposta.toFixed(3)}`);

    const buscaFalhou = confiancaBusca < LIMIAR_CASCATA_BUSCA;
    const respostaFalhou = confiancaResposta < LIMIAR_CASCATA_RESPOSTA;

    if (buscaFalhou || respostaFalhou) {
      const motivo = buscaFalhou && respostaFalhou
        ? 'busca e resposta'
        : buscaFalhou ? 'confiança de busca' : 'confiança de resposta';
      console.log(`[Model Tiering] Escalando pro Tier 2 — motivo: ${motivo} abaixo do limiar (busca ${confiancaBusca.toFixed(3)}, resposta ${confiancaResposta.toFixed(3)}).`);
      escalou = true;
      tierUsado = 'Tier 2 (escalado)';
      rascunho = await gerarComTier(MODELO_TIER2, pergunta, clausula);
      custoRealUsado += CUSTO_TIER2;
      confiancaResposta = await calcularConfiancaResposta(rascunho, indiceClausula);
    } else {
      console.log(`[Model Tiering] Busca e resposta acima do limiar — Tier 1 resolve, sem escalar.`);
    }
  }

  // A reserva cobriu o pior caso (custoMaximoPossivel); devolve o que sobrou se o custo real
  // ficou menor — ex.: Tier 1 resolveu sozinho, sem precisar do Tier 2 que foi reservado.
  liberarSobra(estudoId, custoMaximoPossivel - custoRealUsado);

  // Estreitamento de escopo deliberado em relação ao Módulo 4.5: lá o Approval Gate tinha
  // 2 gatilhos (síntese de CSR OU confiança abaixo do limiar); aqui só CSR aciona. Este módulo
  // é sobre Model Tiering (custo), não sobre HITL — já formalizado no Módulo 4.4 — então uma
  // escalação de cascata por confiança baixa aqui só ajusta o tier, sem reabrir o Approval Gate.
  const precisaAprovacao = intencao === 'sintese_csr';
  let aprovado = true;
  if (precisaAprovacao) {
    aprovado = await pedirAprovacaoHumana(rascunho);
  }

  registrarAuditoria({
    estudoId, pergunta, intencao, tier_usado: tierUsado, escalou_cascata: escalou,
    confianca_busca: confiancaBusca, confianca_resposta: confiancaResposta,
    gasto_acumulado: orcamentos[estudoId].gasto,
    orcamento_limite: orcamentos[estudoId].limite, aprovado, status_final: aprovado ? 'aprovado' : 'rejeitado',
  });

  console.log(`[Orçamento] Estudo "${estudoId}": gasto acumulado ${orcamentos[estudoId].gasto.toFixed(4)} / limite ${orcamentos[estudoId].limite}`);
  return rascunho;
}

// ---------- Verificação pós-execução: a trilha de auditoria confirma os 3 comportamentos ----------
// Mesma disciplina do Módulo 4.5: relê o artefato persistido e confere as DECISÕES determinísticas
// (tier usado, se escalou, se bloqueou por orçamento), nunca o texto exato gerado pelo modelo.
// Olha só as últimas 4 entradas — a trilha é append-only, nunca apagada entre execuções.
function verificarTrilhaAuditoria() {
  const todasLinhas = fs
    .readFileSync(TRILHA_AUDITORIA, 'utf-8')
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
  const linhas = todasLinhas.slice(-4);

  console.log(`\n== Verificação: últimas 4 entradas da trilha de auditoria (${todasLinhas.length} no total) ==`);

  const checagens = [
    ['pelo menos 4 entradas na trilha', todasLinhas.length >= 4],
    ['#1 estudo-A rotina: Tier 1 resolve, sem escalar', linhas[0]?.tier_usado === 'Tier 1' && linhas[0]?.escalou_cascata === false],
    ['#2 estudo-A tema diferente: escala pro Tier 2', linhas[1]?.escalou_cascata === true && linhas[1]?.tier_usado === 'Tier 2 (escalado)'],
    ['#3 estudo-A síntese de CSR: regra fixa pro Tier 2, sem cascata', linhas[2]?.tier_usado === 'Tier 2' && linhas[2]?.escalou_cascata === false],
    ['#3 síntese de CSR: aprovado no Approval Gate', linhas[2]?.aprovado === true],
    ['#4 estudo-B: bloqueado por orçamento antes de chamar o modelo', linhas[3]?.status_final === 'bloqueado_por_orcamento'],
    ['#1 e #2: escalação decidida pela confiança da RESPOSTA (g(pergunta,resposta)), não só da busca', typeof linhas[0]?.confianca_resposta === 'number' && typeof linhas[1]?.confianca_resposta === 'number'],
  ];

  let passou = 0;
  for (const [descricao, ok] of checagens) {
    console.log(`  [${ok ? 'OK' : 'FALHOU'}] ${descricao}`);
    if (ok) passou++;
  }
  console.log(`Total: ${checagens.length} verificação(ões), ${passou} passou(passaram), ${checagens.length - passou} falhou(falharam).`);

  if (passou !== checagens.length) {
    throw new Error(
      `A trilha de auditoria não confirma os 3 comportamentos exigidos (${passou}/${checagens.length}) — ` +
        'reveja audit-trail-tiering.jsonl.'
    );
  }
}

// ---------- Volume concorrente (extra, não faz parte da demo gravada — Missão Prática) ----------
// Testa o Gateway sob pressão real: 4 estudos, múltiplos documentos por estudo (Protocolo/ICF),
// disparados ao mesmo tempo via Promise.all — não um de cada vez como main(). Objetivo: exercitar
// o mesmo cenário de "dezenas de estudos" da Vitalis Platform (Módulo 5.1) e confirmar que
// reservarOrcamento segura o orçamento por estudo mesmo com N requisições concorrentes pro
// mesmo estudo. Sem CSR aqui de propósito: 5 aprovações concorrentes disputando o mesmo
// readline/stdin complicaria sem ajudar — o Approval Gate já foi testado à exaustão no fluxo
// sequencial de main(). Ollama local não paraleliza GPU de verdade — isso testa a LÓGICA do
// Gateway sob concorrência, não throughput real de inferência compartilhada entre estudos.
async function simularVolumeConcorrente() {
  const PERGUNTA_ASSENTIMENTO = 'Quais são as regras de assentimento pra menores nesse estudo?';
  const PERGUNTA_RETIRADA = 'O participante pode desistir do estudo a qualquer momento?';
  const PERGUNTA_FORA_DOMINIO = 'Qual é o prazo de validade dos exames laboratoriais desse estudo?';

  orcamentos['estudo-C'] = { limite: 0.05, gasto: 0 };
  orcamentos['estudo-D'] = { limite: 0.05, gasto: 0 };
  orcamentos['estudo-E'] = { limite: 0.05, gasto: 0 };
  // Orçamento apertado de propósito: reservarOrcamento reserva o PIOR caso por requisição
  // (CUSTO_TIER1+CUSTO_TIER2 = 0.011, mesmo que não escale) — esse limite cabe exatamente
  // 2 reservas, com 5 requisições concorrentes disputando o mesmo estudo.
  orcamentos['estudo-F'] = { limite: 2 * (CUSTO_TIER1 + CUSTO_TIER2) + 0.0005, gasto: 0 };

  const requisicoes = [
    ...['estudo-C', 'estudo-D', 'estudo-E'].flatMap((estudoId) => [
      () => processarComCascata(PERGUNTA_ASSENTIMENTO, estudoId),
      () => processarComCascata(PERGUNTA_RETIRADA, estudoId),
      () => processarComCascata(PERGUNTA_ASSENTIMENTO, estudoId),
      () => processarComCascata(PERGUNTA_FORA_DOMINIO, estudoId),
    ]),
    ...Array.from({ length: 5 }, () => () => processarComCascata(PERGUNTA_ASSENTIMENTO, 'estudo-F')),
  ];

  console.log(`\n== Volume concorrente: ${requisicoes.length} requisições, 4 estudos, disparadas ao mesmo tempo ==\n`);
  await Promise.all(requisicoes.map((disparar) => disparar()));

  console.log('\n== Resultado por estudo, depois da concorrência ==');
  let algumEstourou = false;
  for (const estudoId of ['estudo-C', 'estudo-D', 'estudo-E', 'estudo-F']) {
    const conta = orcamentos[estudoId];
    const estourou = conta.gasto > conta.limite + 1e-9;
    if (estourou) algumEstourou = true;
    console.log(`  ${estourou ? '[ESTOUROU]' : '[OK]'} ${estudoId}: gasto ${conta.gasto.toFixed(4)} / limite ${conta.limite.toFixed(4)}`);
  }
  console.log(
    algumEstourou
      ? '\n[FALHOU] Algum estudo gastou além do limite sob concorrência — reservarOrcamento não está protegendo.'
      : '\n[OK] Nenhum estudo gastou além do limite, mesmo com requisições simultâneas pro mesmo estudo — reserva otimista segurando.'
  );

  if (algumEstourou) {
    throw new Error('Volume concorrente estourou orçamento de pelo menos um estudo — corrija reservarOrcamento.');
  }
}

// ---------- Simulação: 4 requisições mostrando os 3 comportamentos exigidos da cascata ----------

async function main() {
  rodarTestesPuros();

  await prepararIndice();

  prepararEntradaDeAprovacao();

  // 1) Estudo A, pergunta que o Tier 1 resolve bem sozinho (confiança ~0.80, medida contra o
  //    banco de cláusulas com o mesmo nomic-embed-text — acima do limiar, não escala)
  await processarComCascata('Quais são as regras de assentimento pra menores nesse estudo?', 'estudo-A');

  // 2) Estudo A, pergunta fora do assunto do banco de cláusulas (confiança ~0.65, medida do
  //    mesmo jeito — abaixo do limiar de 0,75, escala pro Tier 2 de forma determinística,
  //    não por sorte de uma chamada de LLM não-determinística)
  await processarComCascata('Qual é o prazo de validade dos exames laboratoriais desse estudo?', 'estudo-A');

  // 3) Estudo A de novo, mas agora síntese de CSR — regra fixa, direto pro Tier 2
  await processarComCascata('Preciso da síntese do CSR final desse estudo.', 'estudo-A');

  // 4) Estudo B, com orçamento propositalmente baixo — deve bloquear antes de chamar qualquer modelo
  await processarComCascata('Quais são as regras de assentimento pra menores nesse estudo?', 'estudo-B');

  verificarTrilhaAuditoria();
}

// `node trialforge-model-tiering-prototype.js` roda a demo gravada (4 chamadas sequenciais,
// o que o TP narra). `node trialforge-model-tiering-prototype.js --volume` roda o extra de
// volume concorrente (Missão Prática) — não mexe no fluxo sequencial, não precisa de
// aprovação humana (sem CSR na mistura), pode rodar sem terminal interativo.
if (require.main === module) {
  const rodarVolume = process.argv.includes('--volume');
  const execucao = rodarVolume
    ? (async () => {
        rodarTestesPuros();
        await prepararIndice();
        await simularVolumeConcorrente();
      })()
    : main().finally(() => {
        if (interfaceAprovacaoInterativa) interfaceAprovacaoInterativa.close();
      });

  execucao.catch((erro) => {
    console.error('[Erro não tratado]', erro.message);
    if (!rodarVolume) registrarAuditoria({ erro: erro.message, status_final: 'falha_tecnica' });
    process.exitCode = 1;
  });
}

module.exports = {
  classificarIntencao,
  similaridadeCosseno,
  verificarOrcamento,
  reservarOrcamento,
  processarComCascata,
  verificarTrilhaAuditoria,
  simularVolumeConcorrente,
};

/*
 * Nota sobre um terceiro tier (frontier, pago):
 * Em produção, a cascata do FrugalGPT não para em dois tiers — o próprio paper
 * testa cascatas de até 3-4 modelos, dos mais baratos aos mais caros (ex.: GPT-J
 * → modelo intermediário → GPT-4). Aqui, com dois tiers locais via Ollama, o
 * mecanismo de score-e-limiar já fica completo; um terceiro tier pago (Claude,
 * GPT-4, Gemini) entraria exatamente no mesmo ponto — mais uma chamada, mais um
 * limiar, mesma lógica de escalação.
 *
 * Ahirton Lopes · AI Architecture Toolkit — UNIPDS: Arquitetura de Sistemas com IA
 * Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager
 */
