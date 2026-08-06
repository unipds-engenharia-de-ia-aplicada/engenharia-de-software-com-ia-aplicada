/**
 * Ahirton Lopes · AI Architecture Toolkit
 * Artefato de Demo - Módulo 2.5
 *
 * Protótipo: Agente único do TrialForge (geração da seção de assentimento do ICF)
 * Padrão: loop ReAct (Módulo 2.2) + ferramenta com schema tipado (Módulo 2.4)
 * Sem fila de mensagens — isso fica para o Módulo 3 (multi-agente).
 *
 * Modelo: Ollama local, rodando gemma4:e2b (~7.2GB de download) — gratuito, sem chave
 * de API, sem cartão, roda inteiro na sua máquina. Alternativas pagas (Claude, Gemini,
 * GPT) estão em demos/provedores-pagos.js — mesmo loop ReAct, só a chamada ao modelo
 * muda. É a mesma lição do diagrama de referência do Módulo 1.2: o modelo é a única
 * peça que se troca; Orquestrador, ferramenta e critério de parada não mudam nadinha.
 *
 * Trade-off de rodar local (detalhado no TP do Módulo 2.5): grátis, privado, sem rate
 * limit, mas exige espaço em disco e RAM, e a qualidade de resposta é mais limitada que
 * um modelo de fronteira. É decisão de prototipagem/aprendizado, não de produção — em
 * produção real (Módulo 5), essa escolha pesaria escala e conformidade, não custo zero.
 *
 * Requer: 1) instalar o Ollama (ollama.com), deixar rodando em segundo plano, e rodar
 *            `ollama pull gemma4:e2b` (~7.2GB — faça esse download com calma antes)
 *         2) npm install ollama
 * Uso:    node react-agent-prototype.js
 *
 * Existe uma versão idêntica em Python: react_agent_prototype.py (a Missão Prática
 * #02 pede o protótipo em JavaScript, conforme a ementa — a versão Python é só referência).
 */

const ollama = require('ollama').default;

const MAX_ITERACOES = 4;
// Em Mac com Apple Silicon, 'gemma4:e2b-mlx' é mais rápido e mais leve (testado e funcionando).
const MODELO = 'gemma4:e2b';

// Ferramenta tipada (Módulo 2.4): schema explícito, nunca texto livre
const buscarClausulaRegulatoria = {
  type: 'function',
  function: {
    name: 'buscar_clausula_regulatoria',
    description:
      'Busca cláusulas regulatórias de estudos clínicos por tema e jurisdição. Use quando precisar de texto normativo (ANVISA ou FDA) para compor uma seção do documento.',
    parameters: {
      type: 'object',
      properties: {
        tema: { type: 'string' },
        jurisdicao: { type: 'string', enum: ['ANVISA', 'FDA'] },
      },
      required: ['tema', 'jurisdicao'],
    },
  },
};

// Execução real da ferramenta — sempre determinística, nunca é o modelo quem executa.
// Busca por palavra-chave, não string exata: o modelo formula o "tema" em linguagem
// natural (ex.: "Assentimento para menores de idade em estudos clínicos"), então a
// busca real por trás dessa ferramenta seria vetorial (RAG, Módulo 1.2/2.2) — aqui
// simulamos isso com um match por palavra-chave em vez de comparação exata.
async function executarBuscaClausula(argumentosBrutos) {
  const { tema, jurisdicao } = argumentosBrutos || {};

  // O modelo às vezes formula a chamada com um parâmetro faltando ou grafado errado
  // (testado de verdade: já vimos "jurisdicicao" em vez de "jurisdicao"). Validar aqui,
  // em vez de confiar cegamente, evita um crash silencioso ou um resultado errado por
  // undefined escapar sem ninguém perceber — a ferramenta trata isso como falha própria,
  // não deixa o erro estourar pro chamador.
  if (typeof tema !== 'string' || typeof jurisdicao !== 'string') {
    return {
      texto: null,
      fonte: null,
      aviso: `parâmetro inválido ou ausente na chamada da ferramenta: ${JSON.stringify(argumentosBrutos)}`,
    };
  }

  const temaNormalizado = tema.toLowerCase();
  // Testado de verdade: o modelo às vezes formula o tema com "adolescente" ou
  // "pediátrico" em vez de "menor" — um match de palavra única era frágil demais
  // pra depender da sorte da frase exata que o modelo escolhe.
  const mencionaMenorDeIdade = ['menor', 'adolescente', 'pediátric'].some((palavra) =>
    temaNormalizado.includes(palavra)
  );

  if (jurisdicao === 'ANVISA' && mencionaMenorDeIdade) {
    return {
      texto:
        'Para participantes entre 12 e 17 anos, é necessário assentimento por escrito, ' +
        'além do consentimento do responsável legal (RDC ANVISA 466/2012, Art. 4º).',
      fonte: 'RDC ANVISA 466/2012, Art. 4º',
    };
  }

  return {
    texto: null,
    fonte: null,
    aviso: `não encontrado: nenhuma cláusula sobre "${tema}" na jurisdição ${jurisdicao}. Tente outra jurisdição ou revise o tema.`,
  };
}

// ---------- Testes automatizados da ferramenta (determinística, sem chamar o modelo) ----------
// Mesma disciplina do Módulo 1.3 (decision-framework-tool.js): o que é determinístico no nosso
// próprio código ganha teste automatizado; a redação exata do modelo, e se ele decide chamar a
// ferramenta ou não, fica pra observação ao vivo em simularInteracao(), não pra assert aqui.
// Estes casos cobrem os dois bugs reais encontrados testando contra o modelo de verdade nesta
// sessão: a grafia "jurisdicicao" (parâmetro mal formado) e o tema formulado com "adolescente"/
// "pediátrico" em vez de "menor".
const CASOS_TESTE_FERRAMENTA = [
  { tema: 'Assentimento para menores de idade em estudos clínicos', jurisdicao: 'ANVISA', esperaAchar: true },
  { tema: 'Consentimento de adolescentes em pesquisa', jurisdicao: 'ANVISA', esperaAchar: true },
  { tema: 'Cuidados pediátricos em ensaio clínico', jurisdicao: 'ANVISA', esperaAchar: true },
  { tema: 'Consentimento informado de população adulta', jurisdicao: 'ANVISA', esperaAchar: false },
  { tema: 'Assentimento para menores de idade', jurisdicao: 'FDA', esperaAchar: false }, // jurisdição errada
  { tema: 'Termo de Consentimento Livre e Esclarecido (TCLE)', jurisdicao: 'ANVISA', esperaAchar: false },
];

async function rodarTestesFerramenta() {
  console.log('== Testes: executarBuscaClausula (determinístico, 6 casos + 1 de parâmetro inválido) ==');
  let passou = 0;

  for (const caso of CASOS_TESTE_FERRAMENTA) {
    const resultado = await executarBuscaClausula({ tema: caso.tema, jurisdicao: caso.jurisdicao });
    const achou = resultado.texto !== null;
    const ok = achou === caso.esperaAchar;
    console.log(
      `  [${ok ? 'OK' : 'FALHOU'}] tema="${caso.tema}", jurisdicao=${caso.jurisdicao} -> ` +
        `achou=${achou} (esperado=${caso.esperaAchar})`
    );
    if (ok) passou++;
  }

  // Reproduz o bug real já corrigido: parâmetro grafado errado ("jurisdicicao") não pode
  // estourar exceção pro chamador, tem que virar aviso de falha própria da ferramenta.
  const casoInvalido = await executarBuscaClausula({ tema: 'x', jurisdicicao: 'ANVISA' });
  const invalidoOk = casoInvalido.texto === null && typeof casoInvalido.aviso === 'string';
  console.log(
    `  [${invalidoOk ? 'OK' : 'FALHOU'}] parâmetro mal formado ("jurisdicicao") tratado como ` +
      `falha própria da ferramenta -> ${invalidoOk}`
  );
  if (invalidoOk) passou++;

  const total = CASOS_TESTE_FERRAMENTA.length + 1;
  console.log(`Total: ${total} teste(s), ${passou} passou(passaram), ${total - passou} falhou(falharam).\n`);
  if (passou !== total) {
    throw new Error(`Testes da ferramenta falharam: ${passou}/${total} — corrija antes de rodar a simulação.`);
  }
}

// ---------- Retry com backoff (chamada ao modelo, não à ferramenta) ----------
// Distingue falha transitória (rede, timeout — vale tentar de novo) de falha terminal
// (ex.: modelo não existe no Ollama — retry não resolve, é erro de configuração).
// Sem isso, qualquer soneca de rede escalava pro Approval Gate sem necessidade.
function ehErroTransitorio(erro) {
  if (erro.status_code === 404) return false; // modelo não encontrado: configuração, não rede
  const codigo = erro.code || '';
  const mensagem = (erro.message || '').toLowerCase();
  return (
    codigo === 'ECONNREFUSED' ||
    codigo === 'ETIMEDOUT' ||
    codigo === 'ECONNRESET' ||
    mensagem.includes('timeout') ||
    mensagem.includes('fetch failed') ||
    mensagem.includes('econnrefused')
  );
}

async function chamarModeloComRetry(payload, tentativasMax = 3) {
  let ultimoErro;
  for (let tentativa = 1; tentativa <= tentativasMax; tentativa++) {
    try {
      return await ollama.chat(payload);
    } catch (erro) {
      ultimoErro = erro;
      if (!ehErroTransitorio(erro) || tentativa === tentativasMax) {
        throw erro; // erro terminal, ou já esgotou as tentativas: sobe pro catch-all
      }
      const esperaMs = 500 * 2 ** (tentativa - 1); // 500ms, 1s, 2s...
      console.log(
        `[Retry] Falha transitória na chamada ao modelo (tentativa ${tentativa}/${tentativasMax}): ` +
          `${erro.message}. Tentando de novo em ${esperaMs}ms.`
      );
      await new Promise((resolve) => setTimeout(resolve, esperaMs));
    }
  }
  throw ultimoErro;
}

/**
 * Loop ReAct: Pensamento -> Ação -> Observação -> Resposta Final
 * Critério de parada explícito no orquestrador (Módulo 2.2), nunca deixado para o modelo.
 *
 * `maxIteracoes` tem default calibrado (4). O único lugar que o sobrescreve é o cenário
 * de demonstração do escalonamento em simularInteracao() — ver comentário lá.
 *
 * Retorna também `trilha`: um trace de DESENVOLVIMENTO (uma entrada por volta do loop,
 * com o que o modelo decidiu e quanto tempo levou), pra você inspecionar o raciocínio
 * enquanto constrói. Isso não é observabilidade de produção — a trilha de auditoria
 * formal, em escala, com retenção e consulta, é tema do Módulo 5.2. Aqui é só pra debugar.
 */
async function agenteICF(protocolo, { maxIteracoes = MAX_ITERACOES } = {}) {
  const historico = [
    {
      role: 'system',
      content:
        'Você redige seções de ICF para estudos clínicos. Sempre que precisar de uma cláusula ' +
        'regulatória, chame a ferramenta em vez de perguntar ao usuário ou de escrever de memória. ' +
        'Nunca peça esclarecimento ao usuário: decida os parâmetros da ferramenta a partir do ' +
        'protocolo fornecido.',
    },
    {
      role: 'user',
      content:
        `Protocolo do estudo: ${protocolo}\n\n` +
        'Jurisdição regulatória deste estudo: ANVISA.\n\n' +
        'Gere a seção de assentimento do ICF (Termo de Consentimento) para este estudo, se aplicável. ' +
        'Use a ferramenta disponível para buscar a cláusula regulatória correta antes de escrever o texto.',
    },
  ];

  const trilha = [];

  for (let volta = 1; volta <= maxIteracoes; volta++) {
    const inicioVolta = Date.now();

    // Pensamento: o modelo decide, com base no histórico acumulado, se já sabe o suficiente
    const resposta = await chamarModeloComRetry({
      model: MODELO,
      messages: historico,
      tools: [buscarClausulaRegulatoria],
    });

    const chamada = resposta.message.tool_calls?.[0];
    const duracaoMs = Date.now() - inicioVolta;

    if (!chamada) {
      // Resposta Final: o modelo decidiu que já tem o que precisa
      trilha.push({ volta, acao: 'resposta_final', duracao_ms: duracaoMs });
      return { rascunho: resposta.message.content, iteracoes: volta, trilha };
    }

    // Ação: executa a ferramenta fora do modelo (código determinístico)
    const observacao = await executarBuscaClausula(chamada.function.arguments);
    trilha.push({
      volta,
      acao: 'chamou_ferramenta',
      ferramenta: chamada.function.name,
      argumentos: chamada.function.arguments,
      observacao,
      duracao_ms: duracaoMs,
    });

    // Observação: volta como novo contexto para o próximo Pensamento
    historico.push(
      resposta.message,
      { role: 'tool', tool_name: chamada.function.name, content: JSON.stringify(observacao) }
    );
  }

  // Limite de iterações atingido sem convergência: nunca falha silenciosamente
  return {
    rascunho: null,
    escalarParaAprovacaoHumana: true,
    motivo: `não convergiu em ${maxIteracoes} volta(s)`,
    trilha,
  };
}

function imprimirTrilha(trilha) {
  console.log('  [Trilha de desenvolvimento — não é a trilha de auditoria do Módulo 5.2]');
  for (const passo of trilha) {
    if (passo.acao === 'chamou_ferramenta') {
      console.log(
        `    volta ${passo.volta} (${passo.duracao_ms}ms): chamou ${passo.ferramenta}(` +
          `${JSON.stringify(passo.argumentos)}) -> ${JSON.stringify(passo.observacao)}`
      );
    } else {
      console.log(`    volta ${passo.volta} (${passo.duracao_ms}ms): decidiu que já tinha o suficiente, respondeu`);
    }
  }
}

/**
 * Simula três interações reais entre a Mariana (usuária) e o agente, cobrindo os três
 * comportamentos que a Missão Prática #02 pede que o aluno demonstre no próprio protótipo:
 * convergência normal, ferramenta sem resultado, e não-convergência com escalonamento.
 */
async function simularInteracao() {
  // ---------- Cenário 1: convergência normal, a cláusula existe ----------
  console.log('===== Cenário 1: convergência normal (cláusula encontrada) =====');
  const protocolo1 = 'Estudo fase II, público-alvo entre 12 e 17 anos, terapia oncológica experimental.';
  console.log('[Mariana submete o protocolo ao Gateway]');
  console.log('  ', protocolo1);
  console.log();

  const resultado1 = await agenteICF(protocolo1);
  console.log(`[Agente ICF] Rascunho gerado após ${resultado1.iteracoes} volta(s) de loop, rodando localmente:`);
  console.log('  ', resultado1.rascunho);
  imprimirTrilha(resultado1.trilha);
  console.log('[Sistema] Rascunho aguardando revisão do Approval Gate antes de virar versão oficial.');
  console.log();

  // ---------- Cenário 2: ferramenta não encontra cláusula ----------
  console.log('===== Cenário 2: ferramenta não encontra cláusula (população adulta) =====');
  const protocolo2 =
    'Estudo fase III, população adulta (18-65 anos), diabetes tipo 2, sem envolvimento de menores de idade.';
  console.log('[Mariana submete o protocolo ao Gateway]');
  console.log('  ', protocolo2);
  console.log();

  const resultado2 = await agenteICF(protocolo2);
  imprimirTrilha(resultado2.trilha);
  if (resultado2.escalarParaAprovacaoHumana) {
    console.log('[Orquestrador] Loop não convergiu —', resultado2.motivo);
    console.log('[Sistema] Encaminhando ao Approval Gate para intervenção manual.');
  } else {
    console.log(`[Agente ICF] Respondeu após ${resultado2.iteracoes} volta(s), sem achar cláusula específica.`);
    console.log(
      '[Atenção] Repare na trilha: mesmo sem achar a cláusula, o modelo escreveu um rascunho genérico ' +
        'em vez de escalar — desviando da instrução do system prompt. É exatamente esse tipo de desvio ' +
        'que a trilha existe para flagrar, e por isso o Approval Gate revisa antes de qualquer coisa virar oficial.'
    );
  }
  console.log();

  // ---------- Cenário 3: não convergência, escalonamento ----------
  // maxIteracoes forçado a 1 só aqui: testamos e o modelo real, mesmo sem achar a cláusula,
  // tende a responder algo em vez de insistir por várias voltas (ver o desvio do Cenário 2)
  // — comportamento de LLM não é 100% previsível. Forçar o limiar garante que este cenário
  // sempre demonstre o mecanismo de escalonamento de forma confiável. Em produção, o
  // limiar calibrado continua sendo MAX_ITERACOES = 4, não 1.
  console.log('===== Cenário 3: não convergência, escalonamento (limiar forçado a 1 volta pra demo confiável) =====');
  const protocolo3 = 'Estudo fase III, população adulta, diabetes tipo 2, sem envolvimento de menores de idade.';
  console.log('[Mariana submete o protocolo ao Gateway]');
  console.log('  ', protocolo3);
  console.log();

  const resultado3 = await agenteICF(protocolo3, { maxIteracoes: 1 });
  imprimirTrilha(resultado3.trilha);
  if (resultado3.escalarParaAprovacaoHumana) {
    console.log('[Orquestrador] Loop não convergiu —', resultado3.motivo);
    console.log('[Sistema] Encaminhando ao Approval Gate para intervenção manual — nunca falha silenciosamente.');
  } else {
    console.log('[Atenção] O modelo convergiu na única volta permitida antes mesmo de precisar escalar.');
  }
}

async function main() {
  await rodarTestesFerramenta();
  await simularInteracao();
}

if (require.main === module) {
  main().catch((erro) => {
    console.error('[Erro não tratado]', erro.message);
    console.log('[Sistema] Encaminhando ao Approval Gate — falha técnica também é motivo de escalonamento.');
  });
}

module.exports = { agenteICF, executarBuscaClausula, rodarTestesFerramenta };

/*
 * Ahirton Lopes · AI Architecture Toolkit — UNIPDS: Arquitetura de Sistemas com IA
 * Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager
 */
