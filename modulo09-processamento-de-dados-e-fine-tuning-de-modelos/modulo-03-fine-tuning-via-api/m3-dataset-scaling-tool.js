/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 3.2
 *
 * Gerador do dataset em escala de treino real (305 brutos -> 300 dedup ->
 * 200 balanceados, 120 Amplitude Auto + 80 Amplitude Saúde Empresarial),
 * o dataset que o job real da Vertex AI (tuningJobs/4180970763655839744)
 * de fato treinou. Reusa o pipeline formal do Módulo 2.2 (MinHash+LSH,
 * amostragem por temperatura, entropia de Shannon) importando as funções
 * direto do artefato já revisado, sem duplicar nenhuma linha de lógica --
 * este arquivo só escala o volume bruto de entrada, a limpeza/balanceamento
 * em si é 100% a mesma função que o Módulo 2.2 usa para os 34 exemplos
 * simulados.
 *
 * Uso: node m3-dataset-scaling-tool.js
 */

'use strict';

const assert = require('assert').strict;
const path = require('path');

const m22 = require(
  path.join(__dirname, '..', 'modulo-02-preparacao-datasets', 'dataset-cleaning-balancing-tool.js')
);

/* --------------------------------------------------------------------------
 * Pools de entidade ampliados (tamanhos coprimos entre si, evitando
 * colisão de ciclo modular quando o volume por fonte sobe pra dezenas de
 * exemplos -- mesma técnica e mesmo bug real corrigido durante a
 * construção original deste gerador: pools do mesmo tamanho colidiam
 * simultaneamente em nome+placa+valor pra fontes com mais de 40 exemplos).
 * -------------------------------------------------------------------------- */

const NOMES = [
  'Marcos Vinicius Andrade Pereira', 'Fernanda Costa Ribeiro', 'Joaquim Pedro Salgado',
  'Beatriz Nogueira Lima', 'Rafael Augusto Teixeira', 'Camila dos Santos Farias',
  'Eduardo Henrique Barros', 'Larissa Martins Cardoso', 'Thiago Moreira Duarte',
  'Patricia Alves Monteiro', 'Bruno Cesar Figueiredo', 'Juliana Rocha Pimentel',
  'Gustavo Henrique Vasconcelos', 'Renata Souza Albuquerque', 'Diego Fernandes Castro',
  'Mariana Lopes Guimaraes', 'Vinicius Almeida Correia', 'Sabrina Ferreira Nunes',
  'Leonardo Batista Cavalcanti', 'Priscila Andrade Melo', 'Rodrigo Tavares Siqueira',
  'Amanda Cristina Peixoto', 'Felipe Augusto Barbosa', 'Carolina Machado Freitas',
  'Anderson Luiz Ramalho', 'Vanessa Regina Coutinho', 'Fabio Junior Aragao',
  'Debora Cristina Vieira', 'Marcelo Souza Bittencourt', 'Tatiane Pereira Godoy',
  'Alexandre Costa Miranda', 'Cristiane Lopes Assuncao', 'Fernando Braga Quintanilha',
  'Simone Rocha Vilaca', 'Rogerio dos Santos Pena', 'Michele Aparecida Fonseca',
  'Wagner Luiz Bessa', 'Andreia Cristina Prado', 'Cesar Augusto Nascimento',
  'Roberta Lima Sarmento', 'Paulo Ricardo Andrade',
];

const PLACAS = [
  'QJK-4F82', 'RTL-9921', 'MNB-3310', 'PLW-7765', 'ZXC-2298', 'BVN-6641',
  'TYU-1183', 'GHJ-5529', 'FDS-8842', 'LKM-3376', 'OIU-9954', 'CVB-1120',
  'ASD-6673', 'WER-4481', 'XSW-2290', 'POI-7738', 'HGF-3391', 'MJU-6624',
  'NBV-1187', 'KLO-5540', 'ERT-8873', 'YUI-2216', 'CDE-9950', 'VBN-4483',
  'AZS-6617', 'QWE-1150', 'DFG-7784', 'RTY-3318', 'FGH-8852', 'TGB-2286',
  'YHN-5520', 'UJM-9954', 'IKM-4488', 'OLP-1122', 'WSX-6656', 'EDC-1190',
  'RFV-5524', 'TGB-9958', 'YHN-3392', 'UJM-7726', 'ZAQ-1128', 'XSW-6652', 'CDE-3396',
];

const PROCEDIMENTOS = [
  'consulta cardiologica', 'exame de sangue completo', 'fisioterapia ortopedica',
  'consulta ortopedica', 'exame de imagem (ressonancia)', 'consulta psiquiatrica',
  'sessao de fonoaudiologia', 'exame oftalmologico', 'consulta dermatologica',
  'exame de densitometria ossea', 'consulta nutricional', 'sessao de acupuntura',
  'consulta ginecologica', 'exame de urina completo', 'sessao de terapia ocupacional',
  'consulta endocrinologica', 'exame de eletrocardiograma', 'consulta neurologica',
  'sessao de pilates terapeutico', 'exame de audiometria', 'consulta pediatrica',
  'exame de mamografia', 'sessao de psicoterapia', 'consulta geriatrica',
  'consulta de clinica geral', 'exame de colonoscopia', 'sessao de fonoterapia',
  'consulta urologica', 'exame de tomografia',
];

const VALORES = [
  '3.210,50', '1.870,00', '5.640,00', '2.430,75', '890,00', '4.120,30',
  '1.250,00', '3.980,60', '2.760,00', '6.310,90', '1.540,00', '2.990,25',
  '3.450,00', '1.780,50', '4.560,00', '2.220,80', '5.120,00', '1.630,40',
  '3.870,00', '2.045,90', '4.780,60', '1.395,00', '6.020,50', '2.510,30',
  '3.660,00', '1.925,80', '4.310,00', '2.870,60', '5.480,00', '1.485,70',
  '3.120,00', '2.640,90', '4.950,00', '1.780,00', '3.390,60', '2.210,00',
  '5.870,00', '1.660,40', '4.120,00', '2.980,50', '3.780,90', '2.340,00', '4.910,60',
  '1.590,00', '3.260,40', '2.150,80', '4.430,00',
];

const DATAS = [
  '12/03/2026', '02/04/2026', '18/05/2026', '25/03/2026', '09/04/2026', '30/04/2026',
  '14/03/2026', '21/05/2026', '05/04/2026', '11/05/2026', '28/03/2026', '16/04/2026',
  '03/06/2026', '19/06/2026', '07/06/2026', '24/06/2026', '01/07/2026', '15/07/2026',
  '22/07/2026', '29/07/2026', '06/02/2026', '13/02/2026', '20/02/2026', '27/02/2026',
  '04/02/2026', '10/06/2026', '17/03/2026', '26/04/2026', '02/05/2026', '08/06/2026',
  '23/06/2026',
];

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
  'Mecânica Horizonte': (nome, placa, data, valor) =>
    `MECANICA HORIZONTE LTDA CNPJ 51.222.888/0001-19 Av. do Horizonte 640 ` +
    `Segurado: ${nome} Placa do veiculo: ${placa} Data do servico: ${data} ` +
    `Descricao: alinhamento e balanceamento apos colisao lateral Valor total: R$ ${valor}`,
  'Auto Reparos União': (nome, placa, data, valor) =>
    `AUTO REPAROS UNIAO ME CNPJ 63.444.777/0001-28 Rua da Uniao 305 ` +
    `Nome do segurado: ${nome} Placa: ${placa} Data do atendimento: ${data} ` +
    `Servico: troca de para-brisa trincado Valor cobrado: R$ ${valor}`,
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
  'Clínica São Rafael': (nome, procedimento, data, valor) =>
    `CLINICA SAO RAFAEL CNPJ 84.111.222/0001-37 Rua Sao Rafael 512 ` +
    `Paciente/Beneficiario: ${nome} Procedimento: ${procedimento} Data do atendimento: ${data} ` +
    `Valor total: R$ ${valor}`,
  'Instituto Saúde Plena': (nome, procedimento, data, valor) =>
    `INSTITUTO SAUDE PLENA LTDA CNPJ 91.333.555/0001-08 Av. da Saude Plena 78 ` +
    `Beneficiario: ${nome} Procedimento realizado: ${procedimento} Data: ${data} ` +
    `Valor cobrado: R$ ${valor}`,
};

// Nome completo é recombinado de primeiro-nome x sobrenome, cada um extraído
// do próprio pool de NOMES mas usado com um passo distinto e um tamanho de
// pool distinto (41 e 37, primos entre si) -- o período antes de repetir a
// combinação completa vira 41*37=1517, bem acima de qualquer contagem real
// por fonte deste dataset, sem precisar digitar nome novo nenhum.
const PRENOMES = NOMES.map((n) => n.split(' ')[0]);
const SOBRENOMES = NOMES.slice(0, 37).map((n) => n.split(' ').slice(1).join(' '));

// Placa, valor, procedimento e data (arrays acima) NÃO têm o mesmo cuidado de
// período que o nome: vêm de pools bem menores -- 43, 47, 29 e 31 entradas,
// respectivamente -- sem escolha de tamanhos primos entre si. Diferente do
// nome, eles REPETEM string exata assim que o índice ultrapassa o tamanho do
// pool: um exemplo gerado com índice 5000 (o offset que o harness do Módulo
// 5.1 usa pro conjunto de teste retido, justamente pra garantir nome nunca
// visto no treino) tem nome genuinamente novo, mas placa e valor que já
// apareceram no treino, só que atribuídos a outra pessoa -- confirmado na
// prática: índice 5000 gera "Roberta Costa Ribeiro" com a mesma placa
// TGB-2286 de Gustavo Souza Albuquerque (índice baixo, treino) e o mesmo
// valor 2220,80 de Leonardo Batista Cavalcanti (treino).
//
// Isso não invalida o teste retido desta disciplina: numa tarefa de extração,
// a resposta certa está escrita no próprio texto de entrada -- o modelo não
// precisa lembrar nada do treino pra acertar, só precisa ler. Mas é uma
// limitação real de design, e vale saber antes de reaproveitar este gerador
// pra outro problema seu: se o seu caso de uso depende de todo campo (não só
// o nome) ser genuinamente inédito no teste retido -- por exemplo, se o
// modelo puder "colar" a resposta certa direto da memória de treino em vez
// de precisar ler --, aumente os pools até passar do maior índice que
// pretende usar, ou aplique a mesma ideia do comentário do nome, dois
// tamanhos de pool primos entre si multiplicam o período antes de repetir --
// ou derive placa/valor/data por hash do índice em vez de indexar numa lista
// fixa pequena.
function gerarExemplo(caso, fonte, indice) {
  const nome = `${PRENOMES[indice % PRENOMES.length]} ${SOBRENOMES[(indice * 7 + 3) % SOBRENOMES.length]}`;
  const data = DATAS[(indice * 7 + 3) % DATAS.length];
  const valor = VALORES[(indice * 11 + 5) % VALORES.length];

  let entrada, saida, instrucao;
  if (caso === 'amplitude-auto') {
    const placa = PLACAS[(indice * 13 + 2) % PLACAS.length];
    entrada = TEMPLATES_AUTO[fonte](nome, placa, data, valor);
    saida = { segurado: nome, placa, valor: Number(valor.replace('.', '').replace(',', '.')) };
    instrucao = 'Extraia segurado, placa e valor do orçamento de oficina abaixo.';
  } else {
    const procedimento = PROCEDIMENTOS[(indice * 5 + 1) % PROCEDIMENTOS.length];
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

const FONTES_AUTO = [
  ['Oficina Estrela', 60],
  ['Auto Center Silva', 40],
  ['Funilaria Rio Bonito', 30],
  ['Oficina Nova Aliança', 25],
  ['Mecânica Horizonte', 15],
  ['Auto Reparos União', 10],
];

const FONTES_SAUDE = [
  ['Clínica Vitalis', 50],
  ['Hospital Santa Clara', 30],
  ['Centro Médico Bem Estar', 20],
  ['Clínica São Rafael', 12],
  ['Instituto Saúde Plena', 8],
];

function gerarDatasetBruto() {
  const exemplos = [];

  for (const [fonte, n] of FONTES_AUTO) {
    for (let i = 0; i < n; i++) exemplos.push(gerarExemplo('amplitude-auto', fonte, i));
  }
  for (const [fonte, n] of FONTES_SAUDE) {
    for (let i = 0; i < n; i++) exemplos.push(gerarExemplo('amplitude-saude-empresarial', fonte, i));
  }

  // Planta quase-duplicatas de propósito (mesmo padrão do Módulo 2.2:
  // reenvio exato + ruído de OCR), em proporção maior por conta do volume maior.
  const buscarPorId = (id) => exemplos.find((e) => e.metadata.id === id);

  exemplos.push({
    ...buscarPorId('amplitude-auto-Oficina Estrela-0'),
    metadata: { caso: 'amplitude-auto', fonte: 'Oficina Estrela', id: 'amplitude-auto-Oficina Estrela-0-reenviado' },
  });
  exemplos.push({
    ...buscarPorId('amplitude-auto-Auto Center Silva-0'),
    metadata: { caso: 'amplitude-auto', fonte: 'Auto Center Silva', id: 'amplitude-auto-Auto Center Silva-0-reenviado' },
  });

  const ocrRuidoAuto = { ...buscarPorId('amplitude-auto-Oficina Estrela-5') };
  ocrRuidoAuto.entrada = ocrRuidoAuto.entrada.replace('Placa do veiculo:', 'P1aca do veicu1o:');
  ocrRuidoAuto.metadata = { caso: 'amplitude-auto', fonte: 'Oficina Estrela', id: 'amplitude-auto-Oficina Estrela-5-ruido-ocr' };
  exemplos.push(ocrRuidoAuto);

  exemplos.push({
    ...buscarPorId('amplitude-saude-empresarial-Clínica Vitalis-0'),
    metadata: { caso: 'amplitude-saude-empresarial', fonte: 'Clínica Vitalis', id: 'amplitude-saude-empresarial-Clínica Vitalis-0-reenviado' },
  });

  const ocrRuidoSaude = { ...buscarPorId('amplitude-saude-empresarial-Clínica Vitalis-10') };
  ocrRuidoSaude.entrada = ocrRuidoSaude.entrada.replace('Valor cobrado:', 'Va1or cobrad0:');
  ocrRuidoSaude.metadata = { caso: 'amplitude-saude-empresarial', fonte: 'Clínica Vitalis', id: 'amplitude-saude-empresarial-Clínica Vitalis-10-ruido-ocr' };
  exemplos.push(ocrRuidoSaude);

  return exemplos;
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
  console.log('== Testes: geração e escala do dataset ==');

  const bruto = gerarDatasetBruto();

  testar('dataset bruto tem 305 exemplos (183 Auto + 122 Saúde Empresarial)', () => {
    assert.equal(bruto.length, 305);
    assert.equal(bruto.filter((e) => e.metadata.caso === 'amplitude-auto').length, 183);
    assert.equal(bruto.filter((e) => e.metadata.caso === 'amplitude-saude-empresarial').length, 122);
  });

  testar('nenhum id de exemplo se repete no bruto (gerador não colide)', () => {
    const ids = bruto.map((e) => e.metadata.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  const resultado = m22.limparEBalancear(bruto, {
    alvos: { 'amplitude-auto': 120, 'amplitude-saude-empresarial': 80 },
  });

  testar('pipeline reduz 305 -> 300 (dedup) -> 200 (balanceado), zero falso positivo', () => {
    assert.equal(resultado.original, 305);
    assert.equal(resultado.apósDedup, 300);
    assert.equal(resultado.final, 200);
  });

  testar('dataset final bate exatamente com o job real: 120 Auto + 80 Saúde Empresarial', () => {
    assert.equal(resultado.exemplosFinal.filter((e) => e.metadata.caso === 'amplitude-auto').length, 120);
    assert.equal(resultado.exemplosFinal.filter((e) => e.metadata.caso === 'amplitude-saude-empresarial').length, 80);
  });

  testar('N efetivo de fontes sobe com o balanceamento, Auto e Saúde Empresarial', () => {
    const rAuto = resultado.relatorioPorCaso['amplitude-auto'];
    const rSaude = resultado.relatorioPorCaso['amplitude-saude-empresarial'];
    assert.ok(rAuto.nEfetivoDepois > rAuto.nEfetivoAntes);
    assert.ok(rSaude.nEfetivoDepois > rSaude.nEfetivoAntes);
    assert.ok(Math.abs(rAuto.nEfetivoAntes - 5.160) < 0.01);
    assert.ok(Math.abs(rAuto.nEfetivoDepois - 5.723) < 0.01);
    assert.ok(Math.abs(rSaude.nEfetivoAntes - 4.140) < 0.01);
    assert.ok(Math.abs(rSaude.nEfetivoDepois - 4.706) < 0.01);
  });

  testar('nenhuma fonte perde exemplo além do necessário (alocação capacitada respeitada)', () => {
    const rAuto = resultado.relatorioPorCaso['amplitude-auto'];
    for (const fonte of Object.keys(rAuto.contagensDepois)) {
      assert.ok(rAuto.contagensDepois[fonte] <= rAuto.contagensAntes[fonte]);
    }
  });

  console.log();
  console.log(`Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ${testesComFalha} falhou(falharam).`);

  return resultado;
}

/* --------------------------------------------------------------------------
 * Execução principal
 * -------------------------------------------------------------------------- */

function main() {
  const resultado = rodarTestes();

  console.log();
  console.log('== Pipeline: escalando o dataset simulado do Módulo 2.2 pro volume real de treino ==');
  console.log(`Bruto: ${resultado.original} exemplos -> Dedup: ${resultado.apósDedup} -> Balanceado: ${resultado.final}`);
  console.log(`Total de pares força-bruta comparados: ${resultado.totalParesForcaBruta}, candidatos via LSH: ${resultado.totalCandidatosLSH}`);

  for (const [caso, r] of Object.entries(resultado.relatorioPorCaso)) {
    console.log(`\n--- ${caso} ---`);
    console.log('Antes:', Object.entries(r.contagensAntes).map(([f, n]) => `${f}=${n}`).join(', '));
    console.log(`Entropia antes: ${r.entropiaAntes.toFixed(4)} | N efetivo: ${r.nEfetivoAntes.toFixed(3)} (de ${Object.keys(r.contagensAntes).length} fontes)`);
    console.log('Depois:', Object.entries(r.contagensDepois).map(([f, n]) => `${f}=${n}`).join(', '));
    console.log(`Entropia depois: ${r.entropiaDepois.toFixed(4)} | N efetivo: ${r.nEfetivoDepois.toFixed(3)}`);
  }

  console.log();
  console.log(`Dataset final: ${resultado.exemplosFinal.length} exemplos, prontos pra conversão e upload (Módulo 3.2).`);
}

if (require.main === module) {
  main();
}

module.exports = { gerarDatasetBruto, gerarExemplo, FONTES_AUTO, FONTES_SAUDE };

// Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
// Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
