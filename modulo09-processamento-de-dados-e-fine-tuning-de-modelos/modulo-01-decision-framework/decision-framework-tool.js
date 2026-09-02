/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 1.2
 *
 * Ferramenta: Framework de 4 Perguntas (Módulo 1.1), versão de análise de
 * decisão financeira -- o mesmo framework conceitual do M1.1, mas com o
 * ferramental de decisão que um comitê de investimento de verdade usaria:
 *
 *   0. Gate de governança/compliance (LGPD) -- roda ANTES de tudo: base
 *      legal definida e, se o dado for de categoria sensível, DPA assinado
 *      com o provedor de fine-tuning. Binário, não ponderável -- reprovação
 *      aqui bloqueia o caso de graça, sem gastar o resto do pipeline.
 *   1. AHP (Analytic Hierarchy Process, Saaty 1980) -- os pesos das 4
 *      perguntas não são escolhidos a dedo, são derivados de uma matriz de
 *      comparação pareada, com Razão de Consistência (CR) calculada pra
 *      provar que o julgamento não é arbitrário nem contraditório.
 *   2. NPV/DCF (fluxo de caixa descontado) -- custo de treinar vs. economia
 *      recorrente de rodar o modelo fine-tunado em vez de prompt+RAG, mês a
 *      mês, com breakeven real, não só "vale a pena" binário.
 *   3. Simulação de Monte Carlo -- os parâmetros de negócio (crescimento de
 *      volume, custo por chamada) não são um número fixo, são uma
 *      distribuição triangular; 10.000 simulações dão a probabilidade real
 *      de retorno positivo, não um único cenário otimista.
 *   4. Real Options -- pro caso que falha especificamente por dado
 *      insuficiente (não por tarefa errada), a resposta certa não é "não",
 *      é "ainda não": o valor de ESPERAR N meses acumulando mais dado é
 *      calculado e comparado contra decidir agora com risco elevado.
 *   5. Análise de sensibilidade -- qual parâmetro pesa mais na decisão,
 *      ranqueado (estilo tornado chart, impresso como lista ordenada).
 *
 * O gate continua existindo e continua sendo soberano: nenhuma técnica acima
 * troca "uma pergunta abaixo do limiar reprova o caso inteiro" por média.
 * O que essas técnicas adicionam é profundidade DEPOIS do gate: quanto
 * vale a decisão em dinheiro, sob incerteza, e qual é o valor de esperar
 * quando esperar é uma opção real.
 *
 * Os casos, a matriz AHP e os parâmetros financeiros vêm de
 * amplitude-seguros-casos.json -- nada de negócio está hardcoded aqui.
 *
 * Uso: node decision-framework-tool.js
 *
 * Par oficial desta disciplina: decision-framework-tool.js (oficial) /
 * decision_framework_tool.py (referência espelhada).
 */

'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

const RECOMENDACAO = {
  FINE_TUNING: 'Fine-tuning vale a pena',
  CONTINUAR_PROMPT_RAG: 'Continue com prompt + RAG. Fine-tuning ainda não.',
  ESPERAR: 'Espere acumular dado, depois treine.',
  BLOQUEADO_POR_GOVERNANCA: 'Bloqueado: resolva a governança do dado antes de reavaliar.',
};

const PERGUNTAS = {
  p1: 'A tarefa é estreita e repetida, ou aberta e variável?',
  p2: 'Já esgotou prompt engineering + RAG + roteamento, sem chegar na qualidade/custo/latência necessários?',
  p3: 'Tem dado de exemplo suficiente, diverso e de qualidade pra treinar?',
  p4: 'A tarefa é estável o bastante pra não virar esteira de retreino constante?',
};

const CHAVES_PERGUNTAS = ['p1', 'p2', 'p3', 'p4'];

// Random Index de Saaty (n=4) -- tabela padrão do método AHP, usada pra
// normalizar o Índice de Consistência (CI) em Razão de Consistência (CR).
const RANDOM_INDEX_N4 = 0.90;

function carregarConfiguracao() {
  const caminho = path.join(__dirname, 'amplitude-seguros-casos.json');
  const bruto = fs.readFileSync(caminho, 'utf8');
  return JSON.parse(bruto);
}

/* ============================================================================
 * 0. Gate de governança/compliance (LGPD) -- roda ANTES do AHP
 *
 *    Diferente das 4 perguntas ponderadas por AHP, governança não é um fator
 *    que um volume de dado ou retorno financeiro alto possa compensar: é
 *    binário, e reprova o caso ali, sem gastar o resto do pipeline (AHP,
 *    NPV, Monte Carlo, Real Options) num caso que nem pode prosseguir.
 * ========================================================================= */

/**
 * @param {object} caso precisa ter caso.governanca = {dadoSensivelLGPD,
 *   baseLegalDefinida, dpaAssinado}
 * @returns {{aprovado: boolean, motivos: string[]}}
 */
function validarGovernancaDado(caso) {
  const g = caso.governanca;
  const motivos = [];

  if (!g.baseLegalDefinida) {
    motivos.push('sem base legal definida pro tratamento do dado (LGPD Art. 7º/11)');
  }
  if (g.dadoSensivelLGPD && !g.dpaAssinado) {
    motivos.push('dado de categoria sensível (LGPD Art. 5º, II) sem DPA assinado com o provedor de fine-tuning');
  }

  return { aprovado: motivos.length === 0, motivos };
}

/* ============================================================================
 * 0.5 Risco operacional: continuidade do provedor
 *
 *    Não é um gate (não bloqueia nada) nem um score (não dá pra quantificar
 *    "risco de descontinuação" sem virar chute) -- é um checklist qualitativo
 *    de fato verificado, pra lembrar que "sim, vale a pena" ainda depende de
 *    o provedor escolhido continuar existindo. Achado real desta disciplina
 *    (pesquisa feita pro Módulo 3): dois dos principais provedores de
 *    fine-tuning self-serve já saíram do mercado ou estão saindo.
 * ========================================================================= */

const RISCOS_OPERACIONAIS_PROVEDOR = [
  {
    provedor: 'OpenAI self-serve (platform.openai.com)',
    status: 'Descontinuando',
    detalhe: 'Orgs novas já bloqueadas pra criar job desde 7/mai/2026; quem não usa há 60 dias perde acesso em 2/jul/2026; fecha pra todo mundo em 6/jan/2027.',
    fonte: 'developers.openai.com/api/docs/deprecations',
  },
  {
    provedor: 'Google AI Studio / Gemini API',
    status: 'Morto',
    detalhe: 'Fine-tuning descontinuado desde maio/2025. Gemini 1.5 Flash-001 foi o último modelo suportado.',
    fonte: 'ai.google.dev/gemini-api/docs/model-tuning',
  },
];

function listarRiscosOperacionaisProvedor() {
  return RISCOS_OPERACIONAIS_PROVEDOR;
}

/* ============================================================================
 * 1. AHP -- Analytic Hierarchy Process (Saaty)
 * ========================================================================= */

/**
 * Deriva o vetor de prioridades (pesos) de uma matriz de comparação pareada
 * pelo método da média geométrica das linhas (row geometric mean method) --
 * alternativa padrão e mais simples ao autovetor principal, com resultado
 * equivalente pra matrizes pequenas e bem-comportadas como esta (n=4).
 *
 * @param {number[][]} matriz matriz de comparação pareada n x n
 * @returns {number[]} vetor de pesos, soma 1.0
 */
function derivarPesosAHP(matriz) {
  const n = matriz.length;
  const mediasGeometricas = matriz.map((linha) => {
    const produto = linha.reduce((p, v) => p * v, 1);
    return Math.pow(produto, 1 / n);
  });
  const soma = mediasGeometricas.reduce((s, v) => s + v, 0);
  return mediasGeometricas.map((v) => v / soma);
}

/**
 * Calcula a Razão de Consistência (CR) da matriz de comparação pareada.
 * CR < 0.10 é o limiar padrão de Saaty pra considerar o julgamento
 * consistente o bastante pra confiar nos pesos derivados.
 *
 * @param {number[][]} matriz
 * @param {number[]} pesos vetor de prioridades já derivado
 * @returns {{lambdaMax: number, ci: number, cr: number, consistente: boolean}}
 */
function calcularConsistenciaAHP(matriz, pesos) {
  const n = matriz.length;
  // Aw: matriz aplicada ao vetor de pesos
  const Aw = matriz.map((linha) => linha.reduce((s, v, j) => s + v * pesos[j], 0));
  // lambda_max aproximado: média de (Aw_i / w_i)
  const razoes = Aw.map((v, i) => v / pesos[i]);
  const lambdaMax = razoes.reduce((s, v) => s + v, 0) / n;
  const ci = (lambdaMax - n) / (n - 1);
  const cr = ci / RANDOM_INDEX_N4;
  return { lambdaMax, ci, cr, consistente: cr < 0.10 };
}

/**
 * Agrega várias matrizes de comparação pareada (uma por avaliador) numa
 * única matriz de julgamento agregado, pela média geométrica de cada
 * célula -- método AIJ (Aggregation of Individual Judgments), o padrão
 * recomendado por Saaty pra decisão em grupo. Ao contrário de tirar a
 * média aritmética dos pesos finais de cada avaliador (AIP), a média
 * geométrica célula a célula preserva a propriedade recíproca da matriz
 * (a[j][i] === 1/a[i][j]), então o resultado ainda é uma matriz de
 * comparação pareada válida, e pode ser passado direto pra
 * derivarPesosAHP/calcularConsistenciaAHP sem nenhuma outra mudança no
 * pipeline. Um comitê de 1 avaliador reduz exatamente ao caso original
 * (matriz única).
 *
 * @param {number[][][]} matrizes uma matriz n x n por avaliador
 * @returns {number[][]} matriz agregada n x n
 */
function agregarMatrizesComite(matrizes) {
  const nAvaliadores = matrizes.length;
  const n = matrizes[0].length;
  const agregada = [];
  for (let i = 0; i < n; i += 1) {
    const linha = [];
    for (let j = 0; j < n; j += 1) {
      let produto = 1;
      for (const matriz of matrizes) {
        produto *= matriz[i][j];
      }
      linha.push(Math.pow(produto, 1 / nAvaliadores));
    }
    agregada.push(linha);
  }
  return agregada;
}

/* ============================================================================
 * 2. Gate de 4 perguntas com score de confiança (mesma regra do M1.1/M1.2)
 * ========================================================================= */

function avaliarFramework(scores, pesos, limiarVerde) {
  const sinaisPorPergunta = {};
  const perguntasFalhas = [];

  CHAVES_PERGUNTAS.forEach((chave, indice) => {
    const score = scores[chave];
    const verde = score >= limiarVerde;
    sinaisPorPergunta[chave] = { score, sinal: verde ? 'VERDE' : 'VERMELHO' };
    if (!verde) perguntasFalhas.push(indice + 1);
  });

  const pesosObj = {};
  CHAVES_PERGUNTAS.forEach((chave, i) => { pesosObj[chave] = pesos[i]; });
  const scoreComposto = CHAVES_PERGUNTAS.reduce((soma, chave) => soma + scores[chave] * pesosObj[chave], 0);

  const aprovado = perguntasFalhas.length === 0;
  // "só falha por dado" -- a única reprovação que Real Options resolve
  const falhaSoDado = perguntasFalhas.length === 1 && perguntasFalhas[0] === 3;

  return {
    aprovado,
    falhaSoDado,
    // aprovado === "sim, faça fine-tuning" -- mas isso NÃO escolhe a técnica
    // (LoRA local vs. full fine-tuning vs. API gerenciada): essa é uma
    // segunda decisão, em aberto até os Módulos 3 e 4.
    decisaoTecnicaEmAberto: aprovado,
    recomendacao: aprovado ? RECOMENDACAO.FINE_TUNING : RECOMENDACAO.CONTINUAR_PROMPT_RAG,
    perguntasFalhas,
    scoreComposto: Number(scoreComposto.toFixed(4)),
    sinaisPorPergunta,
  };
}

/**
 * Orquestra o pipeline completo: governança primeiro (bloqueador, grátis),
 * só entra no AHP/gate de 4 perguntas se a governança aprovar. Reprovação
 * de governança nunca chega a calcular AHP, NPV, Monte Carlo ou Real
 * Options -- não há "score alto o bastante" que compense.
 *
 * @returns {{bloqueadoPorGovernanca: boolean, motivosGovernanca?: string[]} & Partial<ReturnType<avaliarFramework>>}
 */
function avaliarCasoCompleto(caso, pesos, limiarVerde) {
  const governanca = validarGovernancaDado(caso);
  if (!governanca.aprovado) {
    return {
      bloqueadoPorGovernanca: true,
      motivosGovernanca: governanca.motivos,
      aprovado: false,
      recomendacao: RECOMENDACAO.BLOQUEADO_POR_GOVERNANCA,
    };
  }
  return { bloqueadoPorGovernanca: false, ...avaliarFramework(caso.scores, pesos, limiarVerde) };
}

/* ============================================================================
 * 3. NPV / DCF -- fluxo de caixa descontado, fine-tuning vs. status quo
 * ========================================================================= */

/**
 * Converte um bloco `financeiro` (onde crescimento/custos são distribuições
 * triangulares {min,moda,max}) num conjunto de parâmetros determinísticos
 * usando o valor "moda" (mais provável) de cada um -- o cenário único que
 * `calcularNPV` e `analisarSensibilidade` usam como ponto de partida antes
 * de variar ou amostrar.
 */
function paramsDeterministicos(financeiro) {
  return {
    volumeInicialMensal: financeiro.volumeInicialMensal,
    crescimentoMensal: financeiro.crescimentoMensal.moda,
    custoPorChamadaStatusQuo: financeiro.custoPorChamadaStatusQuo.moda,
    custoPorChamadaFineTuned: financeiro.custoPorChamadaFineTuned.moda,
    custoTreinamento: financeiro.custoTreinamento,
    horizonteMeses: financeiro.horizonteMeses,
    taxaDescontoMensal: financeiro.taxaDescontoMensal,
  };
}

/**
 * Calcula o NPV de migrar pra um modelo fine-tunado: economia mensal
 * (volume x diferença de custo por chamada), descontada mês a mês, menos o
 * custo de treinar. Volume cresce geometricamente pela taxa informada.
 *
 * @returns {{npv: number, mesBreakeven: number|null, fluxos: Array}}
 */
function calcularNPV(params) {
  const {
    volumeInicialMensal,
    crescimentoMensal,
    custoPorChamadaStatusQuo,
    custoPorChamadaFineTuned,
    custoTreinamento,
    horizonteMeses,
    taxaDescontoMensal,
    atrasoMeses = 0,
  } = params;

  let npv = -custoTreinamento;
  let volume = volumeInicialMensal;
  const fluxos = [];
  let mesBreakeven = null;

  for (let mes = 1; mes <= horizonteMeses; mes += 1) {
    volume *= 1 + crescimentoMensal;
    let economiaDescontada = 0;
    // durante o atraso (esperando dado), não há economia: ainda se paga o status quo
    if (mes > atrasoMeses) {
      const economiaMes = volume * (custoPorChamadaStatusQuo - custoPorChamadaFineTuned);
      const fatorDesconto = Math.pow(1 + taxaDescontoMensal, mes);
      economiaDescontada = economiaMes / fatorDesconto;
      npv += economiaDescontada;
    }
    if (mesBreakeven === null && npv > 0) mesBreakeven = mes;
    fluxos.push({ mes, volume, economiaDescontada, npvAcumulado: npv });
  }

  return { npv: Number(npv.toFixed(2)), mesBreakeven, fluxos };
}

/* ============================================================================
 * 4. Simulação de Monte Carlo -- incerteza nos parâmetros de negócio
 * ========================================================================= */

/**
 * Amostra de uma distribuição triangular via inversão de CDF -- método
 * padrão pra simular parâmetros com estimativa min/mais-provável/max, quando
 * não se tem dado histórico suficiente pra ajustar uma distribuição melhor
 * (que é exatamente o caso de negócio aqui).
 */
function amostrarTriangular(min, moda, max, rng = Math.random) {
  const u = rng();
  const f = (moda - min) / (max - min);
  if (u < f) {
    return min + Math.sqrt(u * (max - min) * (moda - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - moda));
}

function percentil(valoresOrdenados, p) {
  const indice = Math.min(valoresOrdenados.length - 1, Math.floor(p * valoresOrdenados.length));
  return valoresOrdenados[indice];
}

/**
 * Roda N simulações de NPV amostrando crescimento e custo por chamada de
 * distribuições triangulares, devolvendo a distribuição de resultados --
 * não um número só, uma faixa com probabilidade real de sucesso.
 *
 * @param {number} n número de simulações (padrão 10.000)
 * @param {Function} rng gerador de número aleatório injetável (pra teste determinístico)
 */
function simularMonteCarlo(financeiro, n = 10000, rng = Math.random) {
  const resultados = [];
  for (let i = 0; i < n; i += 1) {
    const crescimento = amostrarTriangular(
      financeiro.crescimentoMensal.min,
      financeiro.crescimentoMensal.moda,
      financeiro.crescimentoMensal.max,
      rng
    );
    const custoStatusQuo = amostrarTriangular(
      financeiro.custoPorChamadaStatusQuo.min,
      financeiro.custoPorChamadaStatusQuo.moda,
      financeiro.custoPorChamadaStatusQuo.max,
      rng
    );
    const custoFineTuned = amostrarTriangular(
      financeiro.custoPorChamadaFineTuned.min,
      financeiro.custoPorChamadaFineTuned.moda,
      financeiro.custoPorChamadaFineTuned.max,
      rng
    );
    const { npv } = calcularNPV({
      volumeInicialMensal: financeiro.volumeInicialMensal,
      crescimentoMensal: crescimento,
      custoPorChamadaStatusQuo: custoStatusQuo,
      custoPorChamadaFineTuned: custoFineTuned,
      custoTreinamento: financeiro.custoTreinamento,
      horizonteMeses: financeiro.horizonteMeses,
      taxaDescontoMensal: financeiro.taxaDescontoMensal,
    });
    resultados.push(npv);
  }
  resultados.sort((a, b) => a - b);
  const media = resultados.reduce((s, v) => s + v, 0) / n;
  const probabilidadePositivo = resultados.filter((v) => v > 0).length / n;

  return {
    media: Number(media.toFixed(2)),
    p5: Number(percentil(resultados, 0.05).toFixed(2)),
    p50: Number(percentil(resultados, 0.50).toFixed(2)),
    p95: Number(percentil(resultados, 0.95).toFixed(2)),
    probabilidadePositivo: Number(probabilidadePositivo.toFixed(4)),
    n,
  };
}

/* ============================================================================
 * 5. Real Options -- precificação binomial do valor de esperar (só se aplica
 *    quando a única reprovação é dado insuficiente: é o único tipo de "não"
 *    que o tempo resolve sozinho, sem mudar nada na decisão em si)
 * ========================================================================= */

/**
 * Valor presente BRUTO dos fluxos de economia, sem subtrair o custo de
 * treino -- é o "S" (valor do ativo subjacente) da árvore binomial abaixo.
 * calcularNPV já subtrai custoTreinamento uma única vez em t=0, então basta
 * somar de volta.
 */
function calcularValorPresenteFluxos(params) {
  return calcularNPV(params).npv + params.custoTreinamento;
}

/**
 * Deriva a volatilidade mensal do valor presente bruto a partir da MESMA
 * simulação de Monte Carlo usada na Parte 4 (mesmas distribuições
 * triangulares de crescimento e custo) -- desvio padrão do log-retorno de
 * cada simulação em relação à mediana. É o sigma que alimenta os fatores de
 * alta/baixa (u/d) da árvore binomial: sem isso, não há opção de verdade,
 * só duas datas comparadas.
 */
function derivarVolatilidade(financeiro, n = 10000, rng = Math.random) {
  const valores = [];
  for (let i = 0; i < n; i += 1) {
    const crescimento = amostrarTriangular(
      financeiro.crescimentoMensal.min,
      financeiro.crescimentoMensal.moda,
      financeiro.crescimentoMensal.max,
      rng
    );
    const custoStatusQuo = amostrarTriangular(
      financeiro.custoPorChamadaStatusQuo.min,
      financeiro.custoPorChamadaStatusQuo.moda,
      financeiro.custoPorChamadaStatusQuo.max,
      rng
    );
    const custoFineTuned = amostrarTriangular(
      financeiro.custoPorChamadaFineTuned.min,
      financeiro.custoPorChamadaFineTuned.moda,
      financeiro.custoPorChamadaFineTuned.max,
      rng
    );
    valores.push(
      calcularValorPresenteFluxos({
        volumeInicialMensal: financeiro.volumeInicialMensal,
        crescimentoMensal: crescimento,
        custoPorChamadaStatusQuo: custoStatusQuo,
        custoPorChamadaFineTuned: custoFineTuned,
        custoTreinamento: financeiro.custoTreinamento,
        horizonteMeses: financeiro.horizonteMeses,
        taxaDescontoMensal: financeiro.taxaDescontoMensal,
      })
    );
  }
  valores.sort((a, b) => a - b);
  const mediana = percentil(valores, 0.5);
  const logRetornos = valores.filter((v) => v > 0 && mediana > 0).map((v) => Math.log(v / mediana));
  const media = logRetornos.reduce((s, v) => s + v, 0) / logRetornos.length;
  const variancia = logRetornos.reduce((s, v) => s + (v - media) ** 2, 0) / (logRetornos.length - 1);
  return Math.sqrt(variancia);
}

/**
 * Precifica o valor de esperar como uma opção real de verdade: árvore
 * binomial (Cox-Ross-Rubinstein) sobre o valor presente bruto dos fluxos,
 * com volatilidade derivada da própria simulação de Monte Carlo da Parte 4.
 * A incerteza do negócio se resolve mês a mês durante a espera; no fim do
 * prazo (quando o dado amadureceu o bastante pra passar no gate de novo),
 * o modelo exerce só se valer a pena -- é uma opção americana com uma única
 * janela de exercício, o desenho padrão pra "esperar informação chegar".
 * Sem essa árvore, não é Real Options, é só comparar dois NPVs de datas
 * diferentes -- essa era a versão anterior desta função.
 */
function precificarOpcaoDeEsperar(financeiro, scoreAtualP3, limiarVerde, n = 10000, rng = Math.random) {
  const { opcaoReal } = financeiro;
  const mesesParaEsperar = Math.ceil((opcaoReal.scoreAlvo - scoreAtualP3) / opcaoReal.taxaCrescimentoScorePorMes);
  const { custoTreinamento } = financeiro;

  // S0: valor presente bruto no cenário mais provável, sem a penalidade de
  // erro por dado insuficiente -- o valor do projeto se a decisão amadurecer
  const s0 = calcularValorPresenteFluxos({
    volumeInicialMensal: financeiro.volumeInicialMensal,
    crescimentoMensal: financeiro.crescimentoMensal.moda,
    custoPorChamadaStatusQuo: financeiro.custoPorChamadaStatusQuo.moda,
    custoPorChamadaFineTuned: financeiro.custoPorChamadaFineTuned.moda,
    custoTreinamento,
    horizonteMeses: financeiro.horizonteMeses,
    taxaDescontoMensal: financeiro.taxaDescontoMensal,
  });

  const sigma = derivarVolatilidade(financeiro, n, rng);
  const deltaT = 1; // 1 passo = 1 mês, mesma unidade de mesesParaEsperar
  const r = financeiro.taxaDescontoMensal;
  const u = Math.exp(sigma * Math.sqrt(deltaT));
  const d = 1 / u;
  const p = (Math.exp(r * deltaT) - d) / (u - d);

  // valores terminais do ativo em cada nó, depois de N meses de incerteza
  // resolvida passo a passo (distribuição binomial padrão CRR)
  let valoresOpcao = [];
  for (let j = 0; j <= mesesParaEsperar; j += 1) {
    const sFinal = s0 * u ** (mesesParaEsperar - j) * d ** j;
    valoresOpcao.push(Math.max(sFinal - custoTreinamento, 0));
  }

  // indução retroativa até o valor da opção hoje (F0)
  for (let passo = mesesParaEsperar; passo > 0; passo -= 1) {
    const proximoPasso = [];
    for (let j = 0; j < passo; j += 1) {
      const valorEsperado = p * valoresOpcao[j] + (1 - p) * valoresOpcao[j + 1];
      proximoPasso.push(valorEsperado / Math.exp(r * deltaT));
    }
    valoresOpcao = proximoPasso;
  }
  const valorOpcaoEsperar = Number(valoresOpcao[0].toFixed(2));

  // decidir agora: sem esperar a incerteza se resolver, com a penalidade de
  // erro por dado insuficiente já embutida no custo por chamada
  const sAgora = calcularValorPresenteFluxos({
    volumeInicialMensal: financeiro.volumeInicialMensal,
    crescimentoMensal: financeiro.crescimentoMensal.moda,
    custoPorChamadaStatusQuo: financeiro.custoPorChamadaStatusQuo.moda,
    custoPorChamadaFineTuned: financeiro.custoPorChamadaFineTuned.moda + opcaoReal.custoDeErroEsperadoPorChamada,
    custoTreinamento,
    horizonteMeses: financeiro.horizonteMeses,
    taxaDescontoMensal: financeiro.taxaDescontoMensal,
  });
  const valorExercerAgora = Number(Math.max(sAgora - custoTreinamento, 0).toFixed(2));

  const valorDeEsperar = Number((valorOpcaoEsperar - valorExercerAgora).toFixed(2));

  return {
    mesesParaEsperar,
    sigma: Number(sigma.toFixed(4)),
    u: Number(u.toFixed(4)),
    d: Number(d.toFixed(4)),
    probabilidadeRiscoNeutra: Number(p.toFixed(4)),
    valorPresenteFluxosBrutos: Number(s0.toFixed(2)),
    valorExercerAgora,
    valorOpcaoEsperar,
    valorDeEsperar,
    recomendacao: valorDeEsperar > 0 ? RECOMENDACAO.ESPERAR : RECOMENDACAO.FINE_TUNING,
    // "esperar" não é o fim da história -- é um compromisso de reavaliar
    // depois. Pra Amplitude Saúde Empresarial, essa reavaliação acontece
    // de verdade no Módulo 3.2 (reavaliacao-saude-empresarial.js), rodando
    // este mesmo decision-framework-tool.js contra o score projetado.
    reavaliacaoAgendadaEm: 'Módulo 3.2',
  };
}

/* ============================================================================
 * 6. Análise de sensibilidade -- qual parâmetro pesa mais na decisão
 * ========================================================================= */

/**
 * Varia cada parâmetro financeiro em +/- percentualVariacao (padrão 20%),
 * mantendo os demais no valor mais provável, e mede o quanto o NPV oscila --
 * ranqueado do maior impacto pro menor (estilo tornado chart).
 */
function analisarSensibilidade(financeiro, percentualVariacao = 0.2) {
  const base = {
    volumeInicialMensal: financeiro.volumeInicialMensal,
    crescimentoMensal: financeiro.crescimentoMensal.moda,
    custoPorChamadaStatusQuo: financeiro.custoPorChamadaStatusQuo.moda,
    custoPorChamadaFineTuned: financeiro.custoPorChamadaFineTuned.moda,
    custoTreinamento: financeiro.custoTreinamento,
    horizonteMeses: financeiro.horizonteMeses,
    taxaDescontoMensal: financeiro.taxaDescontoMensal,
  };

  const parametrosVariaveis = ['crescimentoMensal', 'custoPorChamadaStatusQuo', 'custoPorChamadaFineTuned', 'custoTreinamento'];
  const resultado = parametrosVariaveis.map((chave) => {
    const valorBase = base[chave];
    const baixo = { ...base, [chave]: valorBase * (1 - percentualVariacao) };
    const alto = { ...base, [chave]: valorBase * (1 + percentualVariacao) };
    const npvBaixo = calcularNPV(baixo).npv;
    const npvAlto = calcularNPV(alto).npv;
    return {
      parametro: chave,
      npvBaixo,
      npvAlto,
      amplitude: Number(Math.abs(npvAlto - npvBaixo).toFixed(2)),
    };
  });

  resultado.sort((a, b) => b.amplitude - a.amplitude);
  return resultado;
}

/* --------------------------------------------------------------------------
 * Testes automatizados (module assert nativo do Node, sem dependência externa)
 * Rodar com: node decision-framework-tool.js
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

function rodarTestes(config) {
  const pesosAHP = derivarPesosAHP(config.ahp.matriz);
  const consistenciaAHP = calcularConsistenciaAHP(config.ahp.matriz, pesosAHP);
  const { limiarVerde, casos } = config;

  console.log('== Testes: AHP (pesos derivados + consistência) ==');

  testar('os pesos AHP somam 1.0', () => {
    const soma = pesosAHP.reduce((s, v) => s + v, 0);
    assert.ok(Math.abs(soma - 1.0) < 1e-9, `soma = ${soma}`);
  });

  testar('pergunta 3 (dado suficiente) recebe o maior peso AHP', () => {
    const indiceP3 = CHAVES_PERGUNTAS.indexOf('p3');
    const maiorPeso = Math.max(...pesosAHP);
    assert.equal(pesosAHP[indiceP3], maiorPeso);
  });

  testar('a matriz de comparação é consistente (CR < 0.10, padrão de Saaty)', () => {
    assert.ok(consistenciaAHP.consistente, `CR = ${consistenciaAHP.cr}, esperado < 0.10`);
  });

  console.log();
  console.log('== Testes: governança (bloqueia antes do AHP, não é compensável por score) ==');

  testar('caso sem base legal é bloqueado, mesmo com scores perfeitos', () => {
    const casoHipotetico = {
      scores: { p1: 0.9, p2: 0.9, p3: 0.9, p4: 0.9 },
      governanca: { dadoSensivelLGPD: false, baseLegalDefinida: false, dpaAssinado: true },
    };
    const r = avaliarCasoCompleto(casoHipotetico, pesosAHP, limiarVerde);
    assert.equal(r.bloqueadoPorGovernanca, true);
    assert.equal(r.aprovado, false);
    assert.equal(r.scoreComposto, undefined, 'não deveria nem calcular AHP pra um caso bloqueado');
  });

  testar('dado sensível sem DPA é bloqueado, mesmo com scores perfeitos', () => {
    const casoHipotetico = {
      scores: { p1: 0.9, p2: 0.9, p3: 0.9, p4: 0.9 },
      governanca: { dadoSensivelLGPD: true, baseLegalDefinida: true, dpaAssinado: false },
    };
    const r = avaliarCasoCompleto(casoHipotetico, pesosAHP, limiarVerde);
    assert.equal(r.bloqueadoPorGovernanca, true);
    assert.ok(r.motivosGovernanca[0].includes('DPA'));
  });

  testar('dado sensível COM DPA passa a governança normalmente', () => {
    const casoHipotetico = {
      scores: { p1: 0.9, p2: 0.9, p3: 0.9, p4: 0.9 },
      governanca: { dadoSensivelLGPD: true, baseLegalDefinida: true, dpaAssinado: true },
    };
    const r = avaliarCasoCompleto(casoHipotetico, pesosAHP, limiarVerde);
    assert.equal(r.bloqueadoPorGovernanca, false);
    assert.equal(r.aprovado, true);
  });

  testar('os 3 casos reais da Amplitude Seguros passam na governança (nenhum deveria bloquear)', () => {
    casos.forEach((caso) => {
      const g = validarGovernancaDado(caso);
      assert.equal(g.aprovado, true, `${caso.nome} deveria passar: ${g.motivos.join('; ')}`);
    });
  });

  testar('Amplitude Saúde Empresarial é o único caso onde o DPA realmente é exigido (dado sensível)', () => {
    const casoSaude = casos.find((c) => c.id === 'amplitude-saude-empresarial');
    const outrosCasos = casos.filter((c) => c.id !== 'amplitude-saude-empresarial');
    assert.equal(casoSaude.governanca.dadoSensivelLGPD, true);
    outrosCasos.forEach((c) => assert.equal(c.governanca.dadoSensivelLGPD, false));
  });

  console.log();
  console.log('== Testes: risco operacional de provedor (checklist qualitativo, sem score fabricado) ==');

  testar('lista tem os 2 provedores reais verificados nesta disciplina, com fonte cada um', () => {
    const riscos = listarRiscosOperacionaisProvedor();
    assert.equal(riscos.length, 2);
    riscos.forEach((r) => {
      assert.ok(r.fonte && r.fonte.length > 0, `${r.provedor} sem fonte`);
      assert.ok(['Descontinuando', 'Morto'].includes(r.status));
    });
  });

  console.log();
  console.log('== Testes: gate reprova sozinho, não importa a média ==');

  testar('score exatamente no limiar conta como sinal verde', () => {
    const r = avaliarFramework({ p1: limiarVerde, p2: 0.9, p3: 0.9, p4: 0.9 }, pesosAHP, limiarVerde);
    assert.equal(r.sinaisPorPergunta.p1.sinal, 'VERDE');
    assert.equal(r.aprovado, true);
  });

  testar('as 4 com score alto -> aprovado, sem pergunta falha', () => {
    const r = avaliarFramework({ p1: 0.9, p2: 0.9, p3: 0.9, p4: 0.9 }, pesosAHP, limiarVerde);
    assert.equal(r.aprovado, true);
    assert.deepEqual(r.perguntasFalhas, []);
  });

  testar('aprovado no gate deixa a escolha de técnica (LoRA/full/API) em aberto -- não é a mesma decisão', () => {
    const aprovado = avaliarFramework({ p1: 0.9, p2: 0.9, p3: 0.9, p4: 0.9 }, pesosAHP, limiarVerde);
    const reprovado = avaliarFramework({ p1: 0.2, p2: 0.9, p3: 0.9, p4: 0.9 }, pesosAHP, limiarVerde);
    assert.equal(aprovado.decisaoTecnicaEmAberto, true);
    assert.equal(reprovado.decisaoTecnicaEmAberto, false, 'sem aprovação, não existe decisão de técnica a abrir');
  });

  testar('pergunta 3 abaixo do limiar -> reprovado, falha = [3], falhaSoDado = true', () => {
    const r = avaliarFramework({ p1: 0.9, p2: 0.9, p3: 0.2, p4: 0.9 }, pesosAHP, limiarVerde);
    assert.equal(r.aprovado, false);
    assert.deepEqual(r.perguntasFalhas, [3]);
    assert.equal(r.falhaSoDado, true);
  });

  testar('pergunta 1 abaixo do limiar -> reprovado, falhaSoDado = false (não é caso de esperar)', () => {
    const r = avaliarFramework({ p1: 0.2, p2: 0.9, p3: 0.9, p4: 0.9 }, pesosAHP, limiarVerde);
    assert.equal(r.falhaSoDado, false);
  });

  console.log();
  console.log('== Testes: NPV/DCF (caso determinístico, sem crescimento) ==');

  testar('NPV sem crescimento bate com fórmula fechada de anuidade (PV = C x [1-(1+r)^-T]/r)', () => {
    const params = {
      volumeInicialMensal: 1000,
      crescimentoMensal: 0,
      custoPorChamadaStatusQuo: 0.05,
      custoPorChamadaFineTuned: 0.02,
      custoTreinamento: 1000,
      horizonteMeses: 12,
      taxaDescontoMensal: 0.01,
    };
    const { npv } = calcularNPV(params);
    const economiaPorChamada = 0.05 - 0.02;
    const fluxoMensal = 1000 * economiaPorChamada; // volume constante (cresce 0%, mas o código aplica *(1+0) todo mês = igual)
    const pvAnuidade = fluxoMensal * (1 - Math.pow(1.01, -12)) / 0.01;
    const npvEsperado = -1000 + pvAnuidade;
    assert.ok(Math.abs(npv - npvEsperado) < 0.5, `npv=${npv}, esperado ~${npvEsperado.toFixed(2)}`);
  });

  testar('NPV com atraso não gera economia durante os meses de espera', () => {
    const params = {
      volumeInicialMensal: 1000,
      crescimentoMensal: 0,
      custoPorChamadaStatusQuo: 0.05,
      custoPorChamadaFineTuned: 0.02,
      custoTreinamento: 0,
      horizonteMeses: 3,
      taxaDescontoMensal: 0,
      atrasoMeses: 3,
    };
    const { npv } = calcularNPV(params);
    assert.equal(npv, 0, 'sem custo de treino e todo o horizonte em atraso, NPV deve ficar zerado');
  });

  console.log();
  console.log('== Testes: Monte Carlo (sanidade estatística, RNG semeado) ==');

  testar('amostragem triangular determinística converge pra média teórica (min+moda+max)/3', () => {
    let seed = 42;
    const rngDeterministico = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const amostras = [];
    for (let i = 0; i < 20000; i += 1) amostras.push(amostrarTriangular(0.01, 0.03, 0.05, rngDeterministico));
    const media = amostras.reduce((s, v) => s + v, 0) / amostras.length;
    const mediaTeorica = (0.01 + 0.03 + 0.05) / 3;
    assert.ok(Math.abs(media - mediaTeorica) < 0.002, `média amostrada=${media}, teórica=${mediaTeorica}`);
  });

  testar('Monte Carlo do caso Auto (financeiro forte) dá probabilidade alta de NPV positivo', () => {
    const casoAuto = casos.find((c) => c.id === 'amplitude-auto');
    const mc = simularMonteCarlo(casoAuto.financeiro, 2000);
    assert.ok(mc.probabilidadePositivo > 0.9, `probabilidade=${mc.probabilidadePositivo}, esperado > 0.9`);
  });

  console.log();
  console.log('== Testes: Real Options (árvore binomial do valor de esperar) ==');

  testar('esperar tem valor positivo quando o custo de erro por dado insuficiente é alto', () => {
    const casoSaude = casos.find((c) => c.id === 'amplitude-saude-empresarial');
    const opcao = precificarOpcaoDeEsperar(casoSaude.financeiro, casoSaude.scores.p3, limiarVerde, 2000);
    assert.ok(opcao.mesesParaEsperar > 0, 'deveria precisar de meses positivos de espera');
    assert.equal(opcao.recomendacao, RECOMENDACAO.ESPERAR);
    assert.ok(opcao.valorDeEsperar > 0, `valorDeEsperar=${opcao.valorDeEsperar}, esperado > 0`);
  });

  testar('a volatilidade derivada do Monte Carlo é positiva e os fatores u/d são consistentes (u = 1/d)', () => {
    const casoSaude = casos.find((c) => c.id === 'amplitude-saude-empresarial');
    const opcao = precificarOpcaoDeEsperar(casoSaude.financeiro, casoSaude.scores.p3, limiarVerde, 2000);
    assert.ok(opcao.sigma > 0, `sigma=${opcao.sigma}, esperado > 0`);
    // u e d vêm arredondados a 4 casas na saída pública; tolerância compatível com esse arredondamento
    assert.ok(Math.abs(opcao.u * opcao.d - 1) < 1e-3, `u*d deveria ser ~1 (CRR recombinante), deu ${opcao.u * opcao.d}`);
    assert.ok(opcao.probabilidadeRiscoNeutra > 0 && opcao.probabilidadeRiscoNeutra < 1, `p=${opcao.probabilidadeRiscoNeutra}, esperado em (0,1)`);
  });

  testar('"esperar" vem com o compromisso de reavaliação agendada, não é ponto final', () => {
    const casoSaude = casos.find((c) => c.id === 'amplitude-saude-empresarial');
    const opcao = precificarOpcaoDeEsperar(casoSaude.financeiro, casoSaude.scores.p3, limiarVerde, 2000);
    assert.equal(opcao.reavaliacaoAgendadaEm, 'Módulo 3.2');
  });

  console.log();
  console.log('== Testes: Sensibilidade ==');

  testar('análise de sensibilidade retorna os 4 parâmetros ranqueados por amplitude decrescente', () => {
    const casoAuto = casos.find((c) => c.id === 'amplitude-auto');
    const sens = analisarSensibilidade(casoAuto.financeiro);
    assert.equal(sens.length, 4);
    for (let i = 1; i < sens.length; i += 1) {
      assert.ok(sens[i - 1].amplitude >= sens[i].amplitude, 'lista deveria estar ordenada decrescente');
    }
  });

  console.log();
  console.log('== Testes: aplicação aos três casos reais da Amplitude Seguros ==');

  const casoAuto = casos.find((c) => c.id === 'amplitude-auto');
  const casoSaude = casos.find((c) => c.id === 'amplitude-saude-empresarial');
  const casoAtendimento = casos.find((c) => c.id === 'amplitude-atendimento-cliente');
  const resultadoAuto = avaliarFramework(casoAuto.scores, pesosAHP, limiarVerde);
  const resultadoSaude = avaliarFramework(casoSaude.scores, pesosAHP, limiarVerde);
  const resultadoAtendimento = avaliarFramework(casoAtendimento.scores, pesosAHP, limiarVerde);

  testar('Amplitude Auto -> aprovado no gate', () => {
    assert.equal(resultadoAuto.aprovado, true);
  });

  testar('Amplitude Saúde Empresarial -> reprovado só por dado (elegível a Real Options)', () => {
    assert.equal(resultadoSaude.aprovado, false);
    assert.equal(resultadoSaude.falhaSoDado, true);
  });

  testar('Amplitude Atendimento ao Cliente -> reprovado em p1 e p4, com p2 e p3 fortes (não elegível a Real Options)', () => {
    assert.equal(resultadoAtendimento.aprovado, false);
    assert.deepEqual(resultadoAtendimento.perguntasFalhas, [1, 4]);
    assert.equal(resultadoAtendimento.falhaSoDado, false, 'não pode ser falhaSoDado: reprova em 2 perguntas, e p3 está verde');
    assert.equal(resultadoAtendimento.sinaisPorPergunta.p3.sinal, 'VERDE', 'dado sobrando não deveria salvar esse caso');
    assert.equal(resultadoAtendimento.recomendacao, RECOMENDACAO.CONTINUAR_PROMPT_RAG);
  });

  console.log();
  console.log(
    `Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ` +
      `${testesComFalha} falhou(falharam).`
  );

  if (testesComFalha > 0) {
    throw new Error(`${testesComFalha} teste(s) falharam. A implementação não bate com a especificação.`);
  }

  return {
    pesosAHP, consistenciaAHP, casoAuto, casoSaude, casoAtendimento, resultadoAuto, resultadoSaude, resultadoAtendimento,
  };
}

/* --------------------------------------------------------------------------
 * Demo
 * -------------------------------------------------------------------------- */

function imprimirGovernanca(caso) {
  const g = validarGovernancaDado(caso);
  const detalhe = caso.governanca.dadoSensivelLGPD
    ? 'dado de categoria sensível (LGPD Art. 5º, II) -- DPA verificado.'
    : 'dado pessoal comum, não sensível.';
  console.log(`  [Governança] ${g.aprovado ? 'APROVADO' : 'BLOQUEADO'} -- ${detalhe} Base legal: ${caso.governanca.baseLegalDescricao}`);
}

function imprimirCasoAprovado(caso, resultado) {
  console.log(`\n===== ${caso.nome} =====`);
  console.log(`Tarefa: ${caso.tarefa}\n`);
  imprimirGovernanca(caso);
  CHAVES_PERGUNTAS.forEach((chave, i) => {
    const s = resultado.sinaisPorPergunta[chave];
    console.log(`  Pergunta ${i + 1} [${s.sinal}, score ${s.score.toFixed(2)}]: ${PERGUNTAS[chave]}`);
  });
  console.log(`\n  Score composto (AHP): ${resultado.scoreComposto.toFixed(2)}`);
  console.log(`  Recomendação (gate): ${resultado.recomendacao}`);
  console.log(`  Decisão de técnica (LoRA local, full fine-tuning, ou API gerenciada): EM ABERTO -- Módulos 3 e 4\n`);

  const npv = calcularNPV(paramsDeterministicos(caso.financeiro));
  console.log(`  --- Análise financeira (DCF) ---`);
  console.log(`  Custo de treino: R$ ${caso.financeiro.custoTreinamento.toFixed(2)}`);
  console.log(`  NPV em ${caso.financeiro.horizonteMeses} meses (cenário mais provável): R$ ${npv.npv.toFixed(2)}`);
  console.log(`  Breakeven: ${npv.mesBreakeven ? `mês ${npv.mesBreakeven}` : 'não atinge no horizonte'}`);

  const mc = simularMonteCarlo(caso.financeiro, 10000);
  console.log(`\n  --- Monte Carlo (10.000 simulações, incerteza de crescimento e custo) ---`);
  console.log(`  NPV médio: R$ ${mc.media.toFixed(2)} | P5: R$ ${mc.p5.toFixed(2)} | P50: R$ ${mc.p50.toFixed(2)} | P95: R$ ${mc.p95.toFixed(2)}`);
  console.log(`  Probabilidade de NPV positivo: ${(mc.probabilidadePositivo * 100).toFixed(1)}%`);

  const sens = analisarSensibilidade(caso.financeiro);
  console.log(`\n  --- Sensibilidade (ranking por impacto no NPV, +/-20%) ---`);
  sens.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.parametro}: amplitude de R$ ${s.amplitude.toFixed(2)}`);
  });
}

function imprimirCasoReprovadoPorDado(caso, resultado, limiarVerde) {
  console.log(`\n===== ${caso.nome} =====`);
  console.log(`Tarefa: ${caso.tarefa}\n`);
  imprimirGovernanca(caso);
  CHAVES_PERGUNTAS.forEach((chave, i) => {
    const s = resultado.sinaisPorPergunta[chave];
    console.log(`  Pergunta ${i + 1} [${s.sinal}, score ${s.score.toFixed(2)}]: ${PERGUNTAS[chave]}`);
  });
  console.log(`\n  Score composto (AHP): ${resultado.scoreComposto.toFixed(2)}`);
  console.log(`  Pergunta que reprovou no gate: ${resultado.perguntasFalhas.join(', ')} (dado suficiente)`);
  console.log(`  Isso é um "ainda não", não um "não" -- elegível a análise de Real Options.\n`);

  const opcao = precificarOpcaoDeEsperar(caso.financeiro, caso.scores.p3, limiarVerde);
  console.log(`  --- Real Options: árvore binomial, decidir agora vs. esperar ---`);
  console.log(`  Meses até o score de dado cruzar o limiar: ${opcao.mesesParaEsperar}`);
  console.log(`  Volatilidade mensal (derivada do Monte Carlo, 10.000 simulações): ${(opcao.sigma * 100).toFixed(2)}%`);
  console.log(`  Fatores da árvore CRR: alta u=${opcao.u} | baixa d=${opcao.d} | prob. risco-neutra p=${opcao.probabilidadeRiscoNeutra}`);
  console.log(`  Valor do ativo hoje (fluxos brutos, cenário mais provável): R$ ${opcao.valorPresenteFluxosBrutos.toFixed(2)}`);
  console.log(`  Valor de exercer agora (com risco de retrabalho por dado insuficiente): R$ ${opcao.valorExercerAgora.toFixed(2)}`);
  console.log(`  Valor da opção de esperar (indução retroativa na árvore): R$ ${opcao.valorOpcaoEsperar.toFixed(2)}`);
  console.log(`  Valor de esperar (diferença): R$ ${opcao.valorDeEsperar.toFixed(2)}`);
  console.log(`  Recomendação: ${opcao.recomendacao}`);
  console.log(`  Reavaliação agendada em: ${opcao.reavaliacaoAgendadaEm} (roda este mesmo código de verdade, não é spoiler do resultado)`);
}

function imprimirCasoReprovadoGeral(caso, resultado) {
  console.log(`\n===== ${caso.nome} =====`);
  console.log(`Tarefa: ${caso.tarefa}\n`);
  imprimirGovernanca(caso);
  CHAVES_PERGUNTAS.forEach((chave, i) => {
    const s = resultado.sinaisPorPergunta[chave];
    console.log(`  Pergunta ${i + 1} [${s.sinal}, score ${s.score.toFixed(2)}]: ${PERGUNTAS[chave]}`);
  });
  console.log(`\n  Score composto (AHP): ${resultado.scoreComposto.toFixed(2)}`);
  console.log(`  Perguntas que reprovaram no gate: ${resultado.perguntasFalhas.join(' e ')}`);
  console.log('  Reparem: a pergunta 3 (dado suficiente) está VERDE, com folga. Não é falta de dado.');
  console.log('  Não é "falha só por dado" -- não é elegível a Real Options. Esperar não resolve nada aqui,');
  console.log('  porque o que falta não é tempo, é a tarefa ter formato fixo e não mudar de regra toda hora.');
  console.log(`  Recomendação: ${resultado.recomendacao}`);
}

function imprimirCasoBloqueadoPorGovernanca(nome, tarefa, caso) {
  console.log(`\n===== ${nome} (hipotético) =====`);
  console.log(`Tarefa: ${tarefa}\n`);
  const g = validarGovernancaDado(caso);
  console.log(`  [Governança] BLOQUEADO -- motivo(s): ${g.motivos.join('; ')}`);
  console.log(`  Recomendação: ${RECOMENDACAO.BLOQUEADO_POR_GOVERNANCA}`);
  console.log('  Nenhum AHP, NPV, Monte Carlo ou Real Options foi calculado -- não há score que compense isso.');
}

function rodarDemo(config, {
  pesosAHP, consistenciaAHP, casoAuto, casoSaude, casoAtendimento, resultadoAuto, resultadoSaude, resultadoAtendimento,
}) {
  console.log();
  console.log('===== Demo: Framework de 4 Perguntas -- versão de análise de decisão financeira =====');
  console.log(`\nPesos derivados por AHP: p1=${pesosAHP[0].toFixed(3)}  p2=${pesosAHP[1].toFixed(3)}  p3=${pesosAHP[2].toFixed(3)}  p4=${pesosAHP[3].toFixed(3)}`);
  console.log(`Consistência do julgamento: lambda_max=${consistenciaAHP.lambdaMax.toFixed(4)}  CI=${consistenciaAHP.ci.toFixed(4)}  CR=${consistenciaAHP.cr.toFixed(4)} (${consistenciaAHP.consistente ? 'consistente, CR < 0.10' : 'INCONSISTENTE'})`);

  imprimirCasoAprovado(casoAuto, resultadoAuto);
  imprimirCasoReprovadoPorDado(casoSaude, resultadoSaude, config.limiarVerde);
  imprimirCasoReprovadoGeral(casoAtendimento, resultadoAtendimento);

  console.log('\n-----------------------------------------------------------------------------');
  console.log('Três casos, três respostas diferentes. Auto: sim. Saúde Empresarial: ainda não,');
  console.log('só falta dado, e dado é questão de tempo. Atendimento ao Cliente: não -- mesmo com');
  console.log('o maior volume de todos e prompt/RAG já esgotado, a tarefa em si é aberta e instável');
  console.log('demais. Mais dado não resolve um problema que não é de dado.');
  console.log('-----------------------------------------------------------------------------');
}

/**
 * Conteúdo extra opcional, NÃO chamado por padrão no fluxo principal (ver
 * `if (require.main === module)` mais abaixo): caso hipotético de gate de
 * governança bloqueado, e o panorama de risco operacional de provedor.
 * Ambos ficam de fora da saída padrão do script porque, no vídeo do Módulo
 * 1.3, o primeiro já está coberto pelos testes automatizados narrados antes,
 * e o segundo é spoiler do cheatsheet do Slide 9. Continuam disponíveis pra
 * quem quiser chamar `rodarDemoExtras()` manualmente (ex.: na missão
 * prática, pra explorar o restante do código).
 */
function rodarDemoExtras() {
  console.log('\n===== E se a governança não tivesse sido resolvida? (caso hipotético, pra provar o gate) =====');
  imprimirCasoBloqueadoPorGovernanca(
    'Amplitude Saúde Empresarial, num mundo sem DPA',
    'Mesmo caso de Saúde Empresarial, mas sem o DPA assinado com o provedor de fine-tuning',
    {
      governanca: { dadoSensivelLGPD: true, baseLegalDefinida: true, dpaAssinado: false },
    }
  );
  console.log('\nRepare: os scores de p1-p4 nem importam aqui. O gate de governança roda ANTES do AHP,');
  console.log('e bloqueia de graça -- sem gastar o resto do pipeline num caso que nem pode prosseguir.');

  console.log('\n===== Risco operacional: o provedor escolhido ainda vai existir? =====');
  listarRiscosOperacionaisProvedor().forEach((r) => {
    console.log(`  [${r.status}] ${r.provedor}`);
    console.log(`    ${r.detalhe}`);
    console.log(`    Fonte: ${r.fonte}`);
  });
  console.log('\nNão é um score: "vale a pena" também depende do provedor escolhido continuar existindo.');
  console.log('Módulo 3 detalha o provedor real usado no resto desta disciplina (Vertex AI).');
}

/**
 * Demonstra AHP de comitê: 3 avaliadores hipotéticos julgam as mesmas 4
 * perguntas de forma diferente entre si, e o resultado é agregado numa
 * única matriz (AIJ), em vez de usar o julgamento de uma pessoa só, como
 * no restante do módulo. Não substitui a matriz real usada nos 3 casos da
 * Amplitude Seguros (Auto, Saúde Empresarial, Atendimento ao Cliente), que
 * segue vindo de amplitude-seguros-casos.json -- é um exemplo à parte, pra
 * mostrar como o mesmo código escala de "1 julgamento" pra "comitê".
 */
function rodarDemoAhpComite() {
  console.log('\n===== AHP de comitê: agregando o julgamento de vários avaliadores =====');

  const matrizGestorProduto = [
    [1, 1, 1 / 3, 0.5],
    [1, 1, 1 / 3, 0.5],
    [3, 3, 1, 2],
    [2, 2, 0.5, 1],
  ];
  const matrizCompliance = [
    [1, 2, 1 / 5, 1 / 3],
    [0.5, 1, 1 / 5, 1 / 3],
    [5, 5, 1, 3],
    [3, 3, 1 / 3, 1],
  ];
  const matrizEngenharia = [
    [1, 1, 0.5, 1],
    [1, 1, 0.5, 1],
    [2, 2, 1, 2],
    [1, 1, 0.5, 1],
  ];

  const avaliadores = [
    ['Gestor de produto (mesmo julgamento usado nos 3 casos reais)', matrizGestorProduto],
    ['Compliance (prioriza p3 ainda mais, dado sensível pesa mais)', matrizCompliance],
    ['Engenharia (perguntas mais equilibradas entre si)', matrizEngenharia],
  ];
  for (const [nome, matriz] of avaliadores) {
    const pesos = derivarPesosAHP(matriz);
    console.log(`\n  ${nome}`);
    console.log(`    pesos: p1=${pesos[0].toFixed(3)}  p2=${pesos[1].toFixed(3)}  p3=${pesos[2].toFixed(3)}  p4=${pesos[3].toFixed(3)}`);
  }

  const matrizes = avaliadores.map(([, matriz]) => matriz);
  const matrizAgregada = agregarMatrizesComite(matrizes);
  const pesosComite = derivarPesosAHP(matrizAgregada);
  const consistenciaComite = calcularConsistenciaAHP(matrizAgregada, pesosComite);

  console.log('\n  --- Agregado do comitê (média geométrica célula a célula, método AIJ) ---');
  console.log(`    pesos: p1=${pesosComite[0].toFixed(3)}  p2=${pesosComite[1].toFixed(3)}  p3=${pesosComite[2].toFixed(3)}  p4=${pesosComite[3].toFixed(3)}`);
  console.log(`    consistência: cr=${consistenciaComite.cr.toFixed(4)} (${consistenciaComite.consistente ? 'consistente, CR < 0.10' : 'INCONSISTENTE'})`);
  console.log('\n  O peso de p3 no comitê fica entre o do gestor de produto e o de compliance, puxado');
  console.log('  pra baixo pela visão mais equilibrada da engenharia -- exatamente o que se espera de');
  console.log('  uma agregação: nenhum avaliador domina sozinho o resultado final.');

  console.log('\n  --- Reaplicando o peso do comitê aos 3 casos reais da Amplitude Seguros ---');
  const config = carregarConfiguracao();
  const casoAuto = config.casos.find((c) => c.id === 'amplitude-auto');
  const casoSaude = config.casos.find((c) => c.id === 'amplitude-saude-empresarial');
  const casoAtendimento = config.casos.find((c) => c.id === 'amplitude-atendimento-cliente');
  const pesosOriginaisReal = derivarPesosAHP(config.ahp.matriz);
  [
    ['Amplitude Auto', casoAuto],
    ['Amplitude Saúde Empresarial', casoSaude],
    ['Amplitude Atendimento ao Cliente', casoAtendimento],
  ].forEach(([nome, caso]) => {
    const vereditoOriginal = avaliarFramework(caso.scores, pesosOriginaisReal, config.limiarVerde);
    const vereditoComite = avaliarFramework(caso.scores, pesosComite, config.limiarVerde);
    const mudou = vereditoOriginal.aprovado !== vereditoComite.aprovado;
    console.log(`    ${nome}: original ${vereditoOriginal.aprovado ? 'aprovado' : 'reprovado'} (score ${vereditoOriginal.scoreComposto.toFixed(3)}) -> comitê ${vereditoComite.aprovado ? 'aprovado' : 'reprovado'} (score ${vereditoComite.scoreComposto.toFixed(3)})${mudou ? '  [VEREDITO MUDOU]' : ''}`);
  });
  console.log('\n  Os três vereditos batem com o peso de um avaliador só: a decisão é robusta a quem,');
  console.log('  especificamente, preencheu a matriz -- não só a diferença de peso, o veredito final.');

  testar('comitê não muda o veredito de nenhum dos 3 casos reais', () => {
    [casoAuto, casoSaude, casoAtendimento].forEach((caso) => {
      const original = avaliarFramework(caso.scores, pesosOriginaisReal, config.limiarVerde).aprovado;
      const comite = avaliarFramework(caso.scores, pesosComite, config.limiarVerde).aprovado;
      assert.equal(original, comite, `veredito de ${caso.id} mudou entre matriz única e comitê`);
    });
  });

  console.log('\n  --- Teste de regressão: comitê de 1 avaliador reproduz o resultado original ---');
  const matrizSolo = agregarMatrizesComite([matrizGestorProduto]);
  const pesosSolo = derivarPesosAHP(matrizSolo);
  const pesosOriginais = derivarPesosAHP(matrizGestorProduto);

  testar('comitê de 1 avaliador reproduz exatamente os pesos do AHP de matriz única', () => {
    pesosSolo.forEach((v, i) => assert.ok(Math.abs(v - pesosOriginais[i]) < 1e-9, `${v} != ${pesosOriginais[i]}`));
  });

  testar('a matriz agregada do comitê ainda é reciprocamente válida (a[j][i] = 1/a[i][j])', () => {
    const n = matrizAgregada.length;
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        assert.ok(Math.abs(matrizAgregada[i][j] * matrizAgregada[j][i] - 1.0) < 1e-9);
      }
    }
  });

  testar('os pesos agregados do comitê somam 1.0', () => {
    assert.ok(Math.abs(pesosComite.reduce((s, v) => s + v, 0) - 1.0) < 1e-9);
  });

  return { pesosComite, consistenciaComite };
}

if (require.main === module) {
  const config = carregarConfiguracao();
  const resultado = rodarTestes(config);
  rodarDemo(config, resultado);
  rodarDemoAhpComite();
  console.log();
  console.log(
    `Total geral: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ` +
      `${testesComFalha} falhou(falharam).`
  );
}

module.exports = {
  validarGovernancaDado,
  avaliarCasoCompleto,
  listarRiscosOperacionaisProvedor,
  avaliarFramework,
  derivarPesosAHP,
  calcularConsistenciaAHP,
  agregarMatrizesComite,
  calcularNPV,
  amostrarTriangular,
  simularMonteCarlo,
  calcularValorPresenteFluxos,
  derivarVolatilidade,
  precificarOpcaoDeEsperar,
  analisarSensibilidade,
  RECOMENDACAO,
  PERGUNTAS,
  CHAVES_PERGUNTAS,
  carregarConfiguracao,
};

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
