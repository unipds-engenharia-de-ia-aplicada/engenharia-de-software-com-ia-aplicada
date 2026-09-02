/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 2.2
 *
 * Ferramenta: Deduplicação via MinHash+LSH, Balanceamento por Amostragem com
 * Temperatura, e Métricas Formais de Diversidade
 *
 * Versão profissional, nível mestrado/MBA: as três etapas usam método
 * formal e citável, não heurística ad hoc.
 *
 * 1) DEDUPLICAÇÃO - MinHash (Broder, 1997, "On the resemblance and containment
 *    of documents") + LSH banding pra geração de candidatos, seguido de
 *    refinamento com similaridade de Jaccard exata só sobre os candidatos.
 *    É a mesma família de técnica que Lee et al. (2021/2022, Google Research,
 *    "Deduplicating Training Data Makes Language Models Better", arXiv
 *    2107.06499) usam de verdade em produção (o "NEARDUP" do paper). Reduz
 *    o custo de O(n²) comparações exatas pra um número muito menor de
 *    candidatos, sem perder recall sobre as duplicatas reais - verificado
 *    empiricamente neste arquivo, não assumido.
 *
 * 2) BALANCEAMENTO - amostragem por temperatura (exponential smoothing),
 *    a mesma formulação usada por Raffel et al. (2020, T5, "Exploring the
 *    Limits of Transfer Learning with a Unified Text-to-Text Transformer")
 *    pra balancear proporção de tarefa no fine-tuning multi-task, adaptada
 *    por Xue et al. (2021, mT5, "mT5: A Massively Multilingual Pre-trained
 *    Text-to-Text Transformer") pra balancear proporção de idioma no
 *    pré-treino multilíngue: a probabilidade de amostrar a fonte i é
 *    proporcional a n_i^alpha, com alpha=1 sendo proporcional puro (sem
 *    suavização) e alpha→0 se aproximando de uniforme entre fontes. O
 *    mT5 usa alpha=0,3 na prática - mesmo valor usado aqui.
 *    A conversão de peso contínuo pra contagem inteira usa o método do
 *    maior resto (Hamilton/Hare-Niemeyer), o mesmo método formal de
 *    apuração de assento proporcional usado em sistemas eleitorais, com
 *    restrição de capacidade: nenhuma fonte é alocada acima do que ela
 *    realmente tem disponível - balancear não é inventar dado.
 *
 * 3) DIVERSIDADE - entropia de Shannon da distribuição por fonte, e o
 *    número efetivo de fontes (Hill number de ordem 1, exp(H) - ver Hill,
 *    1973, "Diversity and Evenness: A Unifying Notation and Its
 *    Consequences", e Jost, 2006, "Entropy and diversity"), que traduz a
 *    entropia pra uma escala interpretável: "quantas fontes igualmente
 *    representadas seriam equivalentes a esta distribuição real".
 *    Isso fecha o bullet 5 da ementa (avaliar a importância de qualidade
 *    e diversidade dos dados) com número formal, não só discurso.
 *
 * Uso: node dataset-cleaning-balancing-tool.js
 */

'use strict';

const assert = require('assert').strict;

/* --------------------------------------------------------------------------
 * 1. Geração do dataset simulado (mesma escala/casos da versão anterior)
 * -------------------------------------------------------------------------- */

function normalizarTexto(texto) {
  return texto.toLowerCase().replace(/\s+/g, ' ').trim();
}

function shingles(texto, n) {
  const palavras = normalizarTexto(texto).split(' ');
  const conjunto = new Set();
  for (let i = 0; i <= palavras.length - n; i++) {
    conjunto.add(palavras.slice(i, i + n).join(' '));
  }
  return conjunto;
}

function similaridadeJaccardExata(a, b, n = 5) {
  const sa = shingles(a, n);
  const sb = shingles(b, n);
  if (sa.size === 0 || sb.size === 0) return 0;
  let intersecao = 0;
  for (const s of sa) if (sb.has(s)) intersecao++;
  const uniao = sa.size + sb.size - intersecao;
  return uniao === 0 ? 0 : intersecao / uniao;
}

const LIMIAR_DUPLICATA = 0.55;

const TEMPLATES_AUTO = {
  'Oficina Estrela': (nome, placa, data, valor) =>
    `ATIVA ORCAMENTOS AUTOMOTIVOS OFICINA ESTRELA LTDA CNPJ 12.345.678/0001-90 Rua das Turbinas 450 Distrito Industrial ` +
    `Segurado: ${nome} Placa do veiculo: ${placa} Data do sinistro: ${data} ` +
    `Descricao do servico: reparo de lataria e pintura no para-choque dianteiro Valor total do reparo: R$ ${valor}`,
  'Auto Center Silva': (nome, placa, data, valor) =>
    `AUTO CENTER SILVA - FUNILARIA E PINTURA - CNPJ 98.765.432/0001-11 Av. dos Mecanicos 220 ` +
    `Cliente/Segurado: ${nome} Placa: ${placa} Data do atendimento: ${data} ` +
    `Servico executado: troca de para-lama e revisao de suspensao dianteira Valor: R$ ${valor}`,
  'Funilaria Rio Bonito': (nome, placa, data, valor) =>
    `FUNILARIA RIO BONITO ME CNPJ 45.111.222/0001-33 Rua Rio Bonito 88 ` +
    `Nome do segurado: ${nome} Placa do veiculo: ${placa} Data: ${data} ` +
    `Orcamento: substituicao de parachoque traseiro e polimento Valor total: R$ ${valor}`,
  'Oficina Nova Aliança': (nome, placa, data, valor) =>
    `OFICINA NOVA ALIANCA LTDA CNPJ 22.333.444/0001-55 Estrada Velha 1200 ` +
    `Segurado: ${nome} Placa do carro: ${placa} Data do orcamento: ${data} ` +
    `Descricao: reparo de amassado na porta dianteira Valor cobrado: R$ ${valor}`,
};

const TEMPLATES_SAUDE = {
  'Clínica Vitalis': (nome, procedimento, data, valor) =>
    `CLINICA VITALIS SAUDE OCUPACIONAL CNPJ 33.222.111/0001-44 Av. Paulista 900 ` +
    `Paciente/Beneficiario: ${nome} Procedimento: ${procedimento} Data do atendimento: ${data} ` +
    `Valor cobrado: R$ ${valor}`,
  'Hospital Santa Clara': (nome, procedimento, data, valor) =>
    `HOSPITAL SANTA CLARA CNPJ 66.555.444/0001-22 Rua das Acacias 310 ` +
    `Beneficiario: ${nome} Procedimento realizado: ${procedimento} Data: ${data} ` +
    `Valor total: R$ ${valor}`,
  'Centro Médico Bem Estar': (nome, procedimento, data, valor) =>
    `CENTRO MEDICO BEM ESTAR CNPJ 77.888.999/0001-66 Rua da Saude 45 ` +
    `Nome do beneficiario: ${nome} Procedimento: ${procedimento} Data da consulta: ${data} ` +
    `Valor cobrado: R$ ${valor}`,
};

const NOMES = [
  'Marcos Vinicius Andrade Pereira', 'Fernanda Costa Ribeiro', 'Joaquim Pedro Salgado',
  'Beatriz Nogueira Lima', 'Rafael Augusto Teixeira', 'Camila dos Santos Farias',
  'Eduardo Henrique Barros', 'Larissa Martins Cardoso', 'Thiago Moreira Duarte',
  'Patricia Alves Monteiro', 'Bruno Cesar Figueiredo', 'Juliana Rocha Pimentel',
  'Gustavo Henrique Vasconcelos', 'Renata Souza Albuquerque', 'Diego Fernandes Castro',
  'Mariana Lopes Guimaraes',
];
const PLACAS = [
  'QJK-4F82', 'RTL-9921', 'MNB-3310', 'PLW-7765', 'ZXC-2298', 'BVN-6641',
  'TYU-1183', 'GHJ-5529', 'FDS-8842', 'LKM-3376', 'OIU-9954', 'CVB-1120',
  'ASD-6673', 'WER-4481', 'XSW-2290', 'POI-7738',
];
const PROCEDIMENTOS = [
  'consulta cardiologica', 'exame de sangue completo', 'fisioterapia ortopedica',
  'consulta ortopedica', 'exame de imagem (ressonancia)', 'consulta psiquiatrica',
  'sessao de fonoaudiologia', 'exame oftalmologico', 'consulta dermatologica',
  'exame de densitometria ossea', 'consulta nutricional', 'sessao de acupuntura',
];
const VALORES = [
  '3.210,50', '1.870,00', '5.640,00', '2.430,75', '890,00', '4.120,30',
  '1.250,00', '3.980,60', '2.760,00', '6.310,90', '1.540,00', '2.990,25',
  '3.450,00', '1.780,50', '4.560,00', '2.220,80',
];
const DATAS = [
  '12/03/2026', '02/04/2026', '18/05/2026', '25/03/2026', '09/04/2026', '30/04/2026',
  '14/03/2026', '21/05/2026', '05/04/2026', '11/05/2026', '28/03/2026', '16/04/2026',
];

function gerarExemplo(caso, fonte, indice, camposOverride) {
  const nome = camposOverride?.nome ?? NOMES[indice % NOMES.length];
  const data = camposOverride?.data ?? DATAS[indice % DATAS.length];
  const valor = camposOverride?.valor ?? VALORES[indice % VALORES.length];

  let entrada, saida, instrucao;
  if (caso === 'amplitude-auto') {
    const placa = camposOverride?.placa ?? PLACAS[indice % PLACAS.length];
    entrada = TEMPLATES_AUTO[fonte](nome, placa, data, valor);
    saida = { segurado: nome, placa, valor: Number(valor.replace('.', '').replace(',', '.')) };
    instrucao = 'Extraia segurado, placa e valor do orçamento de oficina abaixo.';
  } else {
    const procedimento = camposOverride?.procedimento ?? PROCEDIMENTOS[indice % PROCEDIMENTOS.length];
    entrada = TEMPLATES_SAUDE[fonte](nome, procedimento, data, valor);
    saida = { beneficiario: nome, procedimento, valor: Number(valor.replace('.', '').replace(',', '.')) };
    instrucao = 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.';
  }

  return {
    instrucao,
    entrada,
    saida,
    metadata: { caso, fonte, id: `${caso}-${fonte}-${indice}` },
  };
}

function gerarDatasetSimulado() {
  const exemplos = [];

  for (let i = 0; i < 16; i++) exemplos.push(gerarExemplo('amplitude-auto', 'Oficina Estrela', i));
  for (let i = 0; i < 5; i++) exemplos.push(gerarExemplo('amplitude-auto', 'Auto Center Silva', i + 20));
  for (let i = 0; i < 4; i++) exemplos.push(gerarExemplo('amplitude-auto', 'Funilaria Rio Bonito', i + 30));
  for (let i = 0; i < 3; i++) exemplos.push(gerarExemplo('amplitude-auto', 'Oficina Nova Aliança', i + 40));

  exemplos[1] = { ...gerarExemplo('amplitude-auto', 'Oficina Estrela', 0), metadata: { caso: 'amplitude-auto', fonte: 'Oficina Estrela', id: 'amplitude-auto-Oficina Estrela-0-reenviado' } };
  const ocrRuido = gerarExemplo('amplitude-auto', 'Oficina Estrela', 2);
  ocrRuido.entrada = ocrRuido.entrada.replace('Placa do veiculo:', 'P1aca do veicu1o:');
  ocrRuido.metadata.id = 'amplitude-auto-Oficina Estrela-2-ruido-ocr';
  exemplos[3] = ocrRuido;

  for (let i = 0; i < 12; i++) exemplos.push(gerarExemplo('amplitude-saude-empresarial', 'Clínica Vitalis', i));
  for (let i = 0; i < 4; i++) exemplos.push(gerarExemplo('amplitude-saude-empresarial', 'Hospital Santa Clara', i + 20));
  for (let i = 0; i < 3; i++) exemplos.push(gerarExemplo('amplitude-saude-empresarial', 'Centro Médico Bem Estar', i + 30));

  const idxVitalis0 = exemplos.findIndex((e) => e.metadata.fonte === 'Clínica Vitalis' && e.metadata.id.endsWith('-0'));
  exemplos[idxVitalis0 + 1] = { ...gerarExemplo('amplitude-saude-empresarial', 'Clínica Vitalis', 0), metadata: { caso: 'amplitude-saude-empresarial', fonte: 'Clínica Vitalis', id: 'amplitude-saude-empresarial-Clínica Vitalis-0-reenviado' } };

  return exemplos;
}

/* --------------------------------------------------------------------------
 * 2. Deduplicação: MinHash + LSH banding + refinamento exato
 * -------------------------------------------------------------------------- */

const PRIMO_MERSENNE = 2147483647n; // 2^31 - 1

function hashString(s) {
  // djb2, hash de string determinístico, 32 bits sem sinal
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) + s.charCodeAt(i)) & 0xffffffff;
  return h >>> 0;
}

/**
 * Gera k pares (a,b) de coeficientes de hash universal via LCG determinístico
 * (mesma semente sempre produz a mesma família de funções hash - necessário
 * pra reprodutibilidade: o resultado do MinHash não pode mudar de execução
 * pra execução).
 */
function gerarCoeficientesHash(k, semente) {
  let estado = semente >>> 0;
  function proximo() {
    estado = (Math.imul(estado, 1103515245) + 12345) >>> 0;
    return estado;
  }
  const coeficientes = [];
  for (let i = 0; i < k; i++) {
    coeficientes.push({ a: (proximo() % 2000000000) + 1, b: proximo() % 2000000000 });
  }
  return coeficientes;
}

function hashUniversal(x, a, b) {
  return Number((BigInt(a) * BigInt(x) + BigInt(b)) % PRIMO_MERSENNE);
}

/** Assinatura MinHash: k valores mínimos, um por função hash, sobre o conjunto de shingles. */
function assinaturaMinHash(shingleSet, coeficientes) {
  const baseHashes = [...shingleSet].map(hashString);
  return coeficientes.map(({ a, b }) => {
    let minimo = Infinity;
    for (const x of baseHashes) {
      const h = hashUniversal(x, a, b);
      if (h < minimo) minimo = h;
    }
    return minimo;
  });
}

function similaridadeMinHashEstimada(assinaturaA, assinaturaB) {
  let iguais = 0;
  for (let i = 0; i < assinaturaA.length; i++) if (assinaturaA[i] === assinaturaB[i]) iguais++;
  return iguais / assinaturaA.length;
}

/**
 * LSH banding: divide a assinatura de k valores em b bandas de r valores
 * cada (k = b*r). Dois exemplos viram "candidatos" se colidirem em pelo
 * menos uma banda. Probabilidade de virar candidato dado a similaridade
 * real s: P(s) = 1 - (1 - s^r)^b - curva em S com ponto de corte aproximado
 * em s* = (1/b)^(1/r).
 */
function bandingLSH(assinaturas, b, r) {
  const baldes = new Map();
  const candidatos = new Set();
  assinaturas.forEach((assinatura, idx) => {
    for (let banda = 0; banda < b; banda++) {
      const fatia = assinatura.slice(banda * r, banda * r + r).join(',');
      const chave = `${banda}:${fatia}`;
      if (!baldes.has(chave)) baldes.set(chave, []);
      const balde = baldes.get(chave);
      for (const outroIdx of balde) {
        candidatos.add(outroIdx < idx ? `${outroIdx}-${idx}` : `${idx}-${outroIdx}`);
      }
      balde.push(idx);
    }
  });
  return candidatos;
}

const MINHASH_K = 32; // número de funções hash (produção real usa 100+; 32 já dá erro de aproximação baixo nesta escala, verificado nos testes)
const MINHASH_SEMENTE = 42;
const LSH_BANDAS = 8;
const LSH_LINHAS = 4; // k = bandas * linhas = 32

/**
 * Pipeline completo de deduplicação: gera assinatura MinHash de cada
 * exemplo do caso, usa LSH pra achar candidatos (evitando comparação
 * O(n²) completa), e refina cada candidato com Jaccard exato antes de
 * decidir se é duplicata de verdade.
 */
function encontrarQuaseDuplicatasMinHashLSH(exemplos) {
  const coeficientes = gerarCoeficientesHash(MINHASH_K, MINHASH_SEMENTE);
  const resultadosPorCaso = {};
  let totalParesForcaBruta = 0;
  let totalCandidatosLSH = 0;
  const paresDuplicata = [];

  for (const caso of ['amplitude-auto', 'amplitude-saude-empresarial']) {
    const itens = exemplos.map((e, idx) => ({ e, idx })).filter((x) => x.e.metadata.caso === caso);
    const assinaturas = itens.map((x) => assinaturaMinHash(shingles(x.e.entrada, 5), coeficientes));
    const candidatosLocais = bandingLSH(assinaturas, LSH_BANDAS, LSH_LINHAS);
    const paresForcaBruta = (itens.length * (itens.length - 1)) / 2;

    let confirmados = 0;
    for (const chave of candidatosLocais) {
      const [li, lj] = chave.split('-').map(Number);
      const simExata = similaridadeJaccardExata(itens[li].e.entrada, itens[lj].e.entrada);
      if (simExata >= LIMIAR_DUPLICATA) {
        confirmados++;
        paresDuplicata.push({
          i: itens[li].idx,
          j: itens[lj].idx,
          similaridade: simExata,
        });
      }
    }

    resultadosPorCaso[caso] = {
      itensNoCaso: itens.length,
      paresForcaBruta,
      candidatosLSH: candidatosLocais.size,
      duplicatasConfirmadas: confirmados,
      reducaoPercentual: paresForcaBruta === 0 ? 0 : 100 * (1 - candidatosLocais.size / paresForcaBruta),
    };
    totalParesForcaBruta += paresForcaBruta;
    totalCandidatosLSH += candidatosLocais.size;
  }

  return { paresDuplicata, resultadosPorCaso, totalParesForcaBruta, totalCandidatosLSH };
}

function removerQuaseDuplicatas(exemplos) {
  const { paresDuplicata, resultadosPorCaso, totalParesForcaBruta, totalCandidatosLSH } = encontrarQuaseDuplicatasMinHashLSH(exemplos);
  const remover = new Set(paresDuplicata.map((p) => p.j)); // mantém a primeira ocorrência
  const mantidos = exemplos.filter((_, idx) => !remover.has(idx));
  return { mantidos, paresDuplicata, resultadosPorCaso, totalParesForcaBruta, totalCandidatosLSH, removidos: remover.size };
}

/* --------------------------------------------------------------------------
 * 3. Balanceamento: amostragem por temperatura + alocação capacitada
 *    (maior resto / Hamilton, com restrição de capacidade por fonte)
 * -------------------------------------------------------------------------- */

const ALPHA_TEMPERATURA = 0.3; // mesmo valor usado por Xue et al. 2021 (mT5) pra suavizar mistura de idioma

function contarPorFonte(exemplos, caso) {
  const doCaso = exemplos.filter((e) => e.metadata.caso === caso);
  const contagem = {};
  for (const e of doCaso) contagem[e.metadata.fonte] = (contagem[e.metadata.fonte] || 0) + 1;
  return contagem;
}

/** Peso de amostragem por fonte: p_i proporcional a n_i^alpha (Raffel et al. 2020; Xue et al. 2021). */
function pesosAmostragemPorTemperatura(contagens, alpha) {
  const fontes = Object.keys(contagens);
  const pesosBrutos = fontes.map((f) => Math.pow(contagens[f], alpha));
  const soma = pesosBrutos.reduce((a, b) => a + b, 0);
  const pesos = {};
  fontes.forEach((f, i) => { pesos[f] = pesosBrutos[i] / soma; });
  return pesos;
}

/** Método do maior resto (Hamilton/Hare-Niemeyer): converte pesos contínuos em contagem inteira que soma exatamente ao alvo. */
function alocarMaiorResto(pesos, alvo) {
  const fontes = Object.keys(pesos);
  const quotas = fontes.map((f) => pesos[f] * alvo);
  const base = quotas.map(Math.floor);
  const alocadoBase = base.reduce((a, b) => a + b, 0);
  const restos = fontes.map((f, i) => ({ f, resto: quotas[i] - base[i] })).sort((a, b) => b.resto - a.resto);
  const faltam = alvo - alocadoBase;
  const resultado = {};
  fontes.forEach((f, i) => { resultado[f] = base[i]; });
  for (let i = 0; i < faltam; i++) resultado[restos[i].f] += 1;
  return resultado;
}

/**
 * Alocação capacitada: aplica o peso por temperatura, mas nunca aloca mais
 * do que a fonte realmente tem disponível (balancear não é inventar dado
 * duplicando exemplo). Fontes que estourariam a capacidade são fixadas no
 * máximo disponível, e o alvo restante é redistribuído por temperatura
 * entre as fontes que sobraram - processo iterativo até estabilizar.
 */
function alocarComCapacidade(contagens, alpha, alvoTotal) {
  let fontesAtivas = Object.keys(contagens);
  let alvoRestante = alvoTotal;
  const resultado = {};
  const maxIteracoes = Object.keys(contagens).length + 1;

  for (let iter = 0; iter < maxIteracoes && fontesAtivas.length > 0; iter++) {
    const contagensAtivas = {};
    fontesAtivas.forEach((f) => { contagensAtivas[f] = contagens[f]; });
    const pesos = pesosAmostragemPorTemperatura(contagensAtivas, alpha);
    const tentativa = alocarMaiorResto(pesos, alvoRestante);

    const excedentes = fontesAtivas.filter((f) => tentativa[f] > contagens[f]);
    if (excedentes.length === 0) {
      fontesAtivas.forEach((f) => { resultado[f] = tentativa[f]; });
      break;
    }
    excedentes.forEach((f) => {
      resultado[f] = contagens[f];
      alvoRestante -= contagens[f];
    });
    fontesAtivas = fontesAtivas.filter((f) => !excedentes.includes(f));
  }
  return resultado;
}

function balancearPorTemperatura(exemplos, caso, alpha, alvoTotal) {
  const contagens = contarPorFonte(exemplos, caso);
  const alocacao = alocarComCapacidade(contagens, alpha, alvoTotal);
  const doCaso = exemplos.filter((e) => e.metadata.caso === caso);
  const outros = exemplos.filter((e) => e.metadata.caso !== caso);

  const contadorUsado = {};
  const selecionados = [];
  for (const e of doCaso) {
    const fonte = e.metadata.fonte;
    contadorUsado[fonte] = contadorUsado[fonte] || 0;
    if (contadorUsado[fonte] < alocacao[fonte]) {
      selecionados.push(e);
      contadorUsado[fonte]++;
    }
  }
  return { exemplos: [...outros, ...selecionados], alocacao, contagens };
}

/* --------------------------------------------------------------------------
 * 4. Diversidade: entropia de Shannon + número efetivo de fontes (Hill number)
 * -------------------------------------------------------------------------- */

function distribuicaoDe(contagens) {
  const total = Object.values(contagens).reduce((a, b) => a + b, 0);
  const dist = {};
  Object.keys(contagens).forEach((f) => { dist[f] = total === 0 ? 0 : contagens[f] / total; });
  return dist;
}

/** Entropia de Shannon em nats (log natural). H=0 significa uma única fonte dominando tudo. */
function entropiaShannon(distribuicao) {
  return -Object.values(distribuicao)
    .filter((p) => p > 0)
    .reduce((soma, p) => soma + p * Math.log(p), 0);
}

/** Número efetivo de fontes (Hill number de ordem 1) = exp(H). Interpretação: "equivalente a quantas fontes igualmente representadas". */
function numeroEfetivoFontes(distribuicao) {
  return Math.exp(entropiaShannon(distribuicao));
}

/* --------------------------------------------------------------------------
 * 5. Pipeline completo
 * -------------------------------------------------------------------------- */

function limparEBalancear(exemplos, { alpha = ALPHA_TEMPERATURA, alvos } = {}) {
  const dedup = removerQuaseDuplicatas(exemplos);
  let atual = dedup.mantidos;
  const relatorioPorCaso = {};

  for (const caso of ['amplitude-auto', 'amplitude-saude-empresarial']) {
    const contagensAntes = contarPorFonte(atual, caso);
    const distAntes = distribuicaoDe(contagensAntes);
    const alvo = alvos[caso];

    const resultado = balancearPorTemperatura(atual, caso, alpha, alvo);
    atual = resultado.exemplos;

    const contagensDepois = contarPorFonte(atual, caso);
    const distDepois = distribuicaoDe(contagensDepois);

    relatorioPorCaso[caso] = {
      contagensAntes,
      distAntes,
      entropiaAntes: entropiaShannon(distAntes),
      nEfetivoAntes: numeroEfetivoFontes(distAntes),
      contagensDepois,
      distDepois,
      entropiaDepois: entropiaShannon(distDepois),
      nEfetivoDepois: numeroEfetivoFontes(distDepois),
      alocacao: resultado.alocacao,
    };
  }

  return {
    original: exemplos.length,
    apósDedup: dedup.mantidos.length,
    duplicatasRemovidas: dedup.removidos,
    resultadosDedupPorCaso: dedup.resultadosPorCaso,
    totalParesForcaBruta: dedup.totalParesForcaBruta,
    totalCandidatosLSH: dedup.totalCandidatosLSH,
    final: atual.length,
    relatorioPorCaso,
    exemplosFinal: atual,
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

function rodarTestes() {
  console.log('== Testes: MinHash - assinatura e estimativa de similaridade ==');

  const dataset = gerarDatasetSimulado();
  const coeficientes = gerarCoeficientesHash(MINHASH_K, MINHASH_SEMENTE);

  testar('assinatura MinHash de texto idêntico produz similaridade estimada 1.0', () => {
    const e = dataset.find((x) => x.metadata.id === 'amplitude-auto-Oficina Estrela-0');
    const sig = assinaturaMinHash(shingles(e.entrada, 5), coeficientes);
    assert.equal(similaridadeMinHashEstimada(sig, sig), 1);
  });

  testar('MinHash aproxima Jaccard exato com erro menor que 0,1 pra duplicata exata', () => {
    const a = dataset.find((x) => x.metadata.id === 'amplitude-auto-Oficina Estrela-0');
    const b = dataset.find((x) => x.metadata.id === 'amplitude-auto-Oficina Estrela-0-reenviado');
    const sigA = assinaturaMinHash(shingles(a.entrada, 5), coeficientes);
    const sigB = assinaturaMinHash(shingles(b.entrada, 5), coeficientes);
    const estimado = similaridadeMinHashEstimada(sigA, sigB);
    const exato = similaridadeJaccardExata(a.entrada, b.entrada);
    assert.ok(Math.abs(estimado - exato) < 0.1, `erro muito alto: exato=${exato}, estimado=${estimado}`);
  });

  testar('MinHash aproxima Jaccard exato com erro menor que 0,15 pra duplicata com ruído de OCR', () => {
    const a = dataset.find((x) => x.metadata.id === 'amplitude-auto-Oficina Estrela-2');
    const b = dataset.find((x) => x.metadata.id === 'amplitude-auto-Oficina Estrela-2-ruido-ocr');
    const sigA = assinaturaMinHash(shingles(a.entrada, 5), coeficientes);
    const sigB = assinaturaMinHash(shingles(b.entrada, 5), coeficientes);
    const estimado = similaridadeMinHashEstimada(sigA, sigB);
    const exato = similaridadeJaccardExata(a.entrada, b.entrada);
    assert.ok(Math.abs(estimado - exato) < 0.15, `erro muito alto: exato=${exato}, estimado=${estimado}`);
  });

  console.log();
  console.log('== Testes: LSH banding - geração de candidatos ==');

  const dedupResultado = encontrarQuaseDuplicatasMinHashLSH(dataset);

  testar('LSH encontra exatamente os 3 pares de quase-duplicata plantados (recall perfeito)', () => {
    assert.equal(dedupResultado.paresDuplicata.length, 3);
  });

  testar('LSH reduz o número de comparações em pelo menos 80% frente à força bruta', () => {
    const reducao = 1 - dedupResultado.totalCandidatosLSH / dedupResultado.totalParesForcaBruta;
    assert.ok(reducao >= 0.8, `redução de só ${(reducao * 100).toFixed(1)}%`);
  });

  testar('nenhum par não-duplicata (mesmo template, sinistro diferente) é confirmado como duplicata', () => {
    const idsDuplicata = new Set(dedupResultado.paresDuplicata.flatMap((p) => [dataset[p.i].metadata.id, dataset[p.j].metadata.id]));
    const idsEsperados = new Set([
      'amplitude-auto-Oficina Estrela-0', 'amplitude-auto-Oficina Estrela-0-reenviado',
      'amplitude-auto-Oficina Estrela-2', 'amplitude-auto-Oficina Estrela-2-ruido-ocr',
      'amplitude-saude-empresarial-Clínica Vitalis-0', 'amplitude-saude-empresarial-Clínica Vitalis-0-reenviado',
    ]);
    assert.deepEqual(idsDuplicata, idsEsperados);
  });

  console.log();
  console.log('== Testes: deduplicação - pipeline completo ==');

  testar('remoção de quase-duplicata tira exatamente 3 exemplos', () => {
    const { removidos } = removerQuaseDuplicatas(dataset);
    assert.equal(removidos, 3);
  });

  console.log();
  console.log('== Testes: amostragem por temperatura - pesos ==');

  testar('alpha=1 (sem suavização) reproduz a distribuição proporcional original', () => {
    const contagens = { A: 8, B: 2 };
    const pesos = pesosAmostragemPorTemperatura(contagens, 1);
    assert.ok(Math.abs(pesos.A - 0.8) < 1e-9);
    assert.ok(Math.abs(pesos.B - 0.2) < 1e-9);
  });

  testar('alpha menor suaviza a distribuição em direção à uniforme', () => {
    const contagens = { A: 8, B: 2 };
    const pesosBaixoAlpha = pesosAmostragemPorTemperatura(contagens, 0.3);
    const pesosAltoAlpha = pesosAmostragemPorTemperatura(contagens, 1);
    // com alpha menor, a fonte dominante (A) perde peso relativo em direção a 50%
    assert.ok(pesosBaixoAlpha.A < pesosAltoAlpha.A);
    assert.ok(pesosBaixoAlpha.B > pesosAltoAlpha.B);
  });

  console.log();
  console.log('== Testes: alocação por maior resto - soma exata ==');

  testar('alocação sem restrição de capacidade soma exatamente ao alvo', () => {
    const pesos = { A: 0.5, B: 0.3, C: 0.2 };
    const aloc = alocarMaiorResto(pesos, 17);
    const soma = Object.values(aloc).reduce((a, b) => a + b, 0);
    assert.equal(soma, 17);
  });

  console.log();
  console.log('== Testes: alocação capacitada - nunca excede o disponível ==');

  testar('alocação capacitada nunca aloca mais que a capacidade real de nenhuma fonte', () => {
    const contagens = { 'Oficina Estrela': 14, 'Auto Center Silva': 5, 'Funilaria Rio Bonito': 4, 'Oficina Nova Aliança': 3 };
    for (const alvo of [26, 22, 20, 18]) {
      const aloc = alocarComCapacidade(contagens, ALPHA_TEMPERATURA, alvo);
      for (const f of Object.keys(aloc)) {
        assert.ok(aloc[f] <= contagens[f], `${f}: alocado ${aloc[f]} > capacidade ${contagens[f]}`);
      }
    }
  });

  testar('alocação capacitada soma exatamente ao alvo em todos os casos testados', () => {
    const contagens = { 'Oficina Estrela': 14, 'Auto Center Silva': 5, 'Funilaria Rio Bonito': 4, 'Oficina Nova Aliança': 3 };
    for (const alvo of [26, 22, 20, 18]) {
      const aloc = alocarComCapacidade(contagens, ALPHA_TEMPERATURA, alvo);
      const soma = Object.values(aloc).reduce((a, b) => a + b, 0);
      assert.equal(soma, alvo);
    }
  });

  console.log();
  console.log('== Testes: diversidade - entropia e número efetivo de fontes ==');

  testar('distribuição uniforme entre N fontes tem número efetivo de fontes = N', () => {
    const dist = { A: 0.25, B: 0.25, C: 0.25, D: 0.25 };
    assert.ok(Math.abs(numeroEfetivoFontes(dist) - 4) < 1e-9);
  });

  testar('uma única fonte concentrando tudo tem entropia zero e número efetivo 1', () => {
    const dist = { A: 1.0, B: 0, C: 0 };
    assert.ok(Math.abs(entropiaShannon(dist)) < 1e-9);
    assert.ok(Math.abs(numeroEfetivoFontes(dist) - 1) < 1e-9);
  });

  testar('suavizar com alpha menor aumenta a entropia (nunca diminui)', () => {
    const contagens = { A: 14, B: 5, C: 4, D: 3 };
    const hAlto = entropiaShannon(pesosAmostragemPorTemperatura(contagens, 1.0));
    const hBaixo = entropiaShannon(pesosAmostragemPorTemperatura(contagens, 0.3));
    assert.ok(hBaixo > hAlto);
  });

  console.log();
  console.log('== Testes: pipeline completo ponta a ponta ==');

  testar('pipeline completo produz dataset final menor que o original, com diversidade maior', () => {
    const resultado = limparEBalancear(dataset, {
      alvos: { 'amplitude-auto': 20, 'amplitude-saude-empresarial': 14 },
    });
    assert.equal(resultado.duplicatasRemovidas, 3);
    assert.ok(resultado.final < resultado.original);
    assert.ok(resultado.relatorioPorCaso['amplitude-auto'].nEfetivoDepois > resultado.relatorioPorCaso['amplitude-auto'].nEfetivoAntes);
    assert.ok(resultado.relatorioPorCaso['amplitude-saude-empresarial'].nEfetivoDepois > resultado.relatorioPorCaso['amplitude-saude-empresarial'].nEfetivoAntes);
    assert.ok(resultado.exemplosFinal.some((e) => e.metadata.caso === 'amplitude-auto'));
    assert.ok(resultado.exemplosFinal.some((e) => e.metadata.caso === 'amplitude-saude-empresarial'));
  });

  console.log();
  console.log(
    `Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ` +
      `${testesComFalha} falhou(falharam).`
  );

  if (testesComFalha > 0) {
    throw new Error(`${testesComFalha} teste(s) falharam. A implementação não bate com a especificação.`);
  }

  return dataset;
}

/* --------------------------------------------------------------------------
 * Demo
 * -------------------------------------------------------------------------- */

function formatarPct(p) {
  return `${(p * 100).toFixed(1)}%`;
}

function rodarDemo(dataset) {
  console.log();
  console.log('===== Demo: MinHash+LSH, amostragem por temperatura, e diversidade formal =====');

  const dedup = encontrarQuaseDuplicatasMinHashLSH(dataset);
  console.log(`\nDataset simulado: ${dataset.length} exemplos.\n`);
  console.log('--- Deduplicação (MinHash k=32 + LSH banding b=8,r=4) ---');
  for (const [caso, r] of Object.entries(dedup.resultadosPorCaso)) {
    console.log(
      `${caso}: ${r.itensNoCaso} exemplos, ${r.paresForcaBruta} pares força-bruta -> ${r.candidatosLSH} candidatos LSH ` +
        `(redução de ${r.reducaoPercentual.toFixed(1)}%), ${r.duplicatasConfirmadas} duplicata(s) confirmada(s) após refino exato.`
    );
  }
  console.log(`\nTotal geral: ${dedup.totalParesForcaBruta} pares força-bruta -> ${dedup.totalCandidatosLSH} candidatos LSH.`);

  const resultado = limparEBalancear(dataset, {
    alvos: { 'amplitude-auto': 20, 'amplitude-saude-empresarial': 14 },
  });

  console.log(`\n--- Pipeline: ${resultado.original} -> ${resultado.apósDedup} (dedup) -> ${resultado.final} (balanceado por temperatura, alpha=${ALPHA_TEMPERATURA}) ---`);

  for (const [caso, r] of Object.entries(resultado.relatorioPorCaso)) {
    console.log(`\n--- ${caso} ---`);
    console.log('  Antes:', Object.entries(r.contagensAntes).map(([f, n]) => `${f}=${n} (${formatarPct(r.distAntes[f])})`).join(', '));
    console.log(`  Entropia antes: ${r.entropiaAntes.toFixed(4)} nats | Número efetivo de fontes: ${r.nEfetivoAntes.toFixed(3)} (de ${Object.keys(r.contagensAntes).length} fontes reais)`);
    console.log('  Depois:', Object.entries(r.contagensDepois).map(([f, n]) => `${f}=${n} (${formatarPct(r.distDepois[f])})`).join(', '));
    console.log(`  Entropia depois: ${r.entropiaDepois.toFixed(4)} nats | Número efetivo de fontes: ${r.nEfetivoDepois.toFixed(3)}`);
  }

  console.log('\n-----------------------------------------------------------------------------');
  console.log('MinHash+LSH reduz a busca de quase-duplicata de O(n²) pra um número muito menor');
  console.log('de candidatos, sem perder nenhuma duplicata real (recall verificado nos testes).');
  console.log('A amostragem por temperatura (mesmo método do T5/mT5) troca corte arbitrário por');
  console.log('peso formal, nunca inventando exemplo além da capacidade real de cada fonte, e o');
  console.log('número efetivo de fontes prova, em número, que o dataset final é mais diverso.');
  console.log('-----------------------------------------------------------------------------');
}

if (require.main === module) {
  const dataset = rodarTestes();
  rodarDemo(dataset);
}

module.exports = {
  gerarDatasetSimulado,
  similaridadeJaccardExata,
  assinaturaMinHash,
  similaridadeMinHashEstimada,
  gerarCoeficientesHash,
  bandingLSH,
  encontrarQuaseDuplicatasMinHashLSH,
  removerQuaseDuplicatas,
  pesosAmostragemPorTemperatura,
  alocarMaiorResto,
  alocarComCapacidade,
  balancearPorTemperatura,
  entropiaShannon,
  numeroEfetivoFontes,
  distribuicaoDe,
  limparEBalancear,
  MINHASH_K,
  LSH_BANDAS,
  LSH_LINHAS,
  ALPHA_TEMPERATURA,
  LIMIAR_DUPLICATA,
};

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
