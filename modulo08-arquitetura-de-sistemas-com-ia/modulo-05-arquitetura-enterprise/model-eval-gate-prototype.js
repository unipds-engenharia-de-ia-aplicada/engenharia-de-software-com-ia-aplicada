/**
 * Ahirton Lopes · AI Architecture Toolkit
 * Artefato de Demo - Módulo 5.1
 *
 * Protótipo: Eval Gate de modelo — antes de promover um candidato pra processar
 * tráfego real, roda ele contra um golden set (perguntas com cláusula esperada
 * conhecida) e só promove se o score médio não regredir contra o baseline atual
 * além de uma tolerância. Mesmo espírito do canary do KServe (Módulo 5.1, slide
 * "Kubernetes: Escalar Sem Recriar") — só que o canary avisa DEPOIS que a versão
 * nova já está em produção recebendo tráfego real; o eval gate avisa ANTES de
 * promover, contra um conjunto de perguntas conhecidas.
 *
 * Modelos: Ollama local, gratuito, sem chave de API.
 *   - nomic-embed-text: embeddings reais (mesmo uso do Módulo 4.5/5.4).
 *   - gemma4:e2b: baseline — o Tier 1 já em uso desde o Módulo 4.5.
 *   - gemma4:e2b-mlx: candidato — variante MLX real e diferente do mesmo
 *     modelo, não fabricada; ambos já estão puxados localmente nesta máquina.
 *
 * O score usa o mesmo mecanismo de groundedness do Módulo 5.4 (g(pergunta,
 * resposta)): embedding da resposta gerada vs. embedding da cláusula esperada.
 *
 * Requer: 1) ollama pull nomic-embed-text && ollama pull gemma4:e2b && ollama pull gemma4:e2b-mlx
 *         2) npm install ollama
 * Uso:    node model-eval-gate-prototype.js
 *
 * Existe uma versão idêntica em Python: model_eval_gate_prototype.py.
 */

const ollama = require('ollama').default;

const MODELO_EMBEDDING = 'nomic-embed-text';
const MODELO_BASELINE = 'gemma4:e2b';
const MODELO_CANDIDATO = 'gemma4:e2b-mlx';

// Candidato pode ficar até essa fração abaixo do baseline sem bloquear a promoção —
// tolerância, não corte exato, mesma disciplina de calibração do Módulo 4.2/4.5. O
// Azure AI Foundry Model Router (Módulo 5.4) declara publicamente um modo "Balanceado"
// aceitando 1-2% de diferença de qualidade; num contexto farmacêutico regulado, faz
// sentido usar a ponta mais rígida dessa faixa, não a mais frouxa (Custo, 5-6%).
const TOLERANCIA_REGRESSAO = 0.02;

// Golden set: pergunta com cláusula esperada CONHECIDA de antemão (não é RAG buscando
// a cláusula — aqui a cláusula certa já está fixada, só se mede se o modelo, dado o
// contexto certo, produz uma resposta fiel a ele). Mesmo banco de cláusulas do
// TrialForge usado desde o Módulo 2.5/4.5/5.4, cobrindo os 3 domínios de agente.
const GOLDEN_SET = [
  {
    pergunta: 'Quais são as regras de assentimento pra menores nesse estudo?',
    clausula:
      'Para participantes entre 12 e 17 anos, é necessário assentimento por escrito, ' +
      'além do consentimento do responsável legal (RDC ANVISA 466/2012, Art. 4º).',
    fonte: 'RDC ANVISA 466/2012, Art. 4º',
  },
  {
    pergunta: 'O participante pode desistir do estudo a qualquer momento?',
    clausula:
      'O participante pode retirar seu consentimento a qualquer momento, sem necessidade ' +
      'de justificativa e sem prejuízo ao seu tratamento (RDC ANVISA 466/2012, Art. 5º).',
    fonte: 'RDC ANVISA 466/2012, Art. 5º',
  },
  {
    pergunta: 'Qual é o critério de idade mínima pra participar desse estudo?',
    clausula:
      'A idade mínima para participação no estudo é de doze anos completos na data ' +
      'da assinatura do assentimento, conforme a versão vigente do protocolo aprovada ' +
      'pelo comitê de ética.',
    fonte: 'Protocolo Clínico TrialForge, critério de inclusão nº 2',
  },
];

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

async function gerarResposta(modelo, pergunta, clausula, fonte) {
  const resposta = await ollama.chat({
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
        content: `Pergunta: ${pergunta}\n\nCláusula regulatória relevante: ${clausula}\nFonte: ${fonte}\n\nResponda usando essa cláusula.`,
      },
    ],
  });
  return resposta.message.content;
}

// Simula um candidato REGREDIDO por bug de config, não por modelo pior: o mesmo
// baseline, mas sem a cláusula no contexto — o tipo de falha que acontece quando o
// RAG do Módulo 4.1 para de injetar contexto silenciosamente (deploy quebrado, prompt
// template regredido), não quando alguém escolhe um modelo pior de propósito. Ao
// contrário da comparação e2b vs. e2b-mlx (dois modelos reais, score parecido, decisão
// que pode virar entre execuções por variância de amostragem do próprio modelo), essa
// falta de contexto é determinística: o modelo tem que responder de memória, sem a
// cláusula, então o score contra a cláusula real cai de forma confiável, não por sorte.
async function gerarRespostaSemContexto(modelo, pergunta) {
  const resposta = await ollama.chat({
    model: modelo,
    messages: [
      {
        role: 'system',
        content: 'Você redige respostas curtas e precisas sobre regras de estudos clínicos.',
      },
      { role: 'user', content: `Pergunta: ${pergunta}` },
    ],
  });
  return resposta.message.content;
}

async function avaliarCandidato(modelo, goldenSet) {
  let somaScores = 0;
  for (const item of goldenSet) {
    const texto = await gerarResposta(modelo, item.pergunta, item.clausula, item.fonte);
    const [embResposta, embClausula] = await Promise.all([embedar(texto), embedar(item.clausula)]);
    const score = similaridadeCosseno(embResposta, embClausula);
    somaScores += score;
    console.log(`  [Eval] "${item.pergunta.slice(0, 55)}..." -> score ${score.toFixed(3)}`);
  }
  return somaScores / goldenSet.length;
}

async function avaliarCandidatoSemContexto(modelo, goldenSet) {
  let somaScores = 0;
  for (const item of goldenSet) {
    const texto = await gerarRespostaSemContexto(modelo, item.pergunta);
    const [embResposta, embClausula] = await Promise.all([embedar(texto), embedar(item.clausula)]);
    const score = similaridadeCosseno(embResposta, embClausula);
    somaScores += score;
    console.log(`  [Eval] "${item.pergunta.slice(0, 55)}..." -> score ${score.toFixed(3)}`);
  }
  return somaScores / goldenSet.length;
}

async function main() {
  console.log(`\n[Eval Gate] Avaliando BASELINE (${MODELO_BASELINE}) contra golden set de ${GOLDEN_SET.length} perguntas...`);
  const scoreBaseline = await avaliarCandidato(MODELO_BASELINE, GOLDEN_SET);
  console.log(`[Eval Gate] Baseline: score médio ${scoreBaseline.toFixed(3)}`);

  console.log(`\n== Cenário 1: candidato real (variante MLX do mesmo modelo) ==`);
  console.log(`[Eval Gate] Avaliando CANDIDATO (${MODELO_CANDIDATO}) contra o mesmo golden set...`);
  const scoreCandidato1 = await avaliarCandidato(MODELO_CANDIDATO, GOLDEN_SET);
  console.log(`[Eval Gate] Candidato: score médio ${scoreCandidato1.toFixed(3)}`);
  const diferenca1 = scoreCandidato1 - scoreBaseline;
  const promove1 = diferenca1 >= -TOLERANCIA_REGRESSAO;
  console.log(`[Eval Gate] Diferença: ${diferenca1 >= 0 ? '+' : ''}${diferenca1.toFixed(3)} | Tolerância: -${TOLERANCIA_REGRESSAO}`);
  console.log(`[Eval Gate] Decisão: ${promove1 ? 'PROMOVE' : 'BLOQUEIA'} — caso limite, dois modelos reais e parecidos; pode mudar entre execuções por variância do próprio modelo, por isso a decisão nunca deve ser no olho, sempre pelo gate.`);

  console.log(`\n== Cenário 2: candidato regredido por config, não por modelo pior ==`);
  console.log(`[Eval Gate] Avaliando ${MODELO_BASELINE} SEM a cláusula no contexto (simula bug de RAG/config, mesmo modelo)...`);
  const scoreCandidato2 = await avaliarCandidatoSemContexto(MODELO_BASELINE, GOLDEN_SET);
  console.log(`[Eval Gate] Candidato regredido: score médio ${scoreCandidato2.toFixed(3)}`);
  const diferenca2 = scoreCandidato2 - scoreBaseline;
  const promove2 = diferenca2 >= -TOLERANCIA_REGRESSAO;
  console.log(`[Eval Gate] Diferença: ${diferenca2 >= 0 ? '+' : ''}${diferenca2.toFixed(3)} | Tolerância: -${TOLERANCIA_REGRESSAO}`);
  console.log(`[Eval Gate] Decisão: ${promove2 ? 'PROMOVE' : 'BLOQUEIA'} — mesmo modelo, contexto perdido; o gate pega uma regressão de config que nenhuma troca de modelo causou.`);

  return { scoreBaseline, scoreCandidato1, promove1, scoreCandidato2, promove2 };
}

if (require.main === module) {
  main().catch((erro) => {
    console.error('[Erro não tratado]', erro.message);
    process.exitCode = 1;
  });
}

module.exports = { avaliarCandidato, similaridadeCosseno, main };

/*
 * Ahirton Lopes · AI Architecture Toolkit — UNIPDS: Arquitetura de Sistemas com IA
 * Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager
 */
