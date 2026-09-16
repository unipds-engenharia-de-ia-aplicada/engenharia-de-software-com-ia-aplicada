/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 6.3 (gerado durante a produção do Módulo 6.2,
 * consumido pela Missão Prática #06 e pela demo de escala do Módulo 6.3)
 *
 * Gerador do dataset de produção real, escalado a partir do piloto de 200
 * exemplos do Módulo 3.2, seguindo a decisão do Módulo 5.4 (veredito:
 * escalar Amplitude Auto e Saúde Empresarial). Reusa o MESMO pipeline
 * formal do Módulo 2.2 (MinHash+LSH, amostragem por temperatura, entropia
 * de Shannon) via require direto -- zero lógica de limpeza/balanceamento
 * duplicada, só o gerador bruto muda.
 *
 * Duas diferenças reais frente ao gerador do Módulo 3.2 (não é só "mais
 * exemplos do mesmo jeito"):
 *   1) Mais fontes (10 oficinas, 8 clínicas, contra 6 e 5 antes) e pools de
 *      entidade maiores, todos coprimos entre si (mesma técnica do fix real
 *      do Módulo 3.2 pra evitar colisão de ciclo).
 *   2) Variedade de redação por fonte: cada oficina/clínica tem uma
 *      "persona" de escrita (bloco formal em caixa alta, texto corrido
 *      semi-formal, ou exportação abreviada por campo), um serviço/campo
 *      distrator real (apólice, corretor, franquia; convênio, CRM, guia)
 *      que NÃO faz parte do schema extraído -- obriga o modelo a selecionar
 *      campo, não só copiar tudo -- e um subconjunto com ruído real de OCR.
 *      No gerador do M3.2, cada oficina repetia sempre a MESMA frase de
 *      serviço; aqui o serviço/procedimento varia por exemplo dentro da
 *      mesma fonte.
 *
 * Uso: node m6-dataset-scaling-tool.js
 */

'use strict';

const assert = require('assert').strict;
const path = require('path');

const m22 = require(
  path.join(__dirname, '..', 'modulo-02-preparacao-datasets', 'dataset-cleaning-balancing-tool.js')
);

/* --------------------------------------------------------------------------
 * Pools de entidade (tamanhos coprimos entre si -- ver nota no cabeçalho).
 * -------------------------------------------------------------------------- */

const PRENOMES = [
  'Marcos', 'Fernanda', 'Joaquim', 'Beatriz', 'Rafael', 'Camila', 'Eduardo', 'Larissa',
  'Thiago', 'Patricia', 'Bruno', 'Juliana', 'Gustavo', 'Renata', 'Diego', 'Mariana',
  'Vinicius', 'Sabrina', 'Leonardo', 'Priscila', 'Rodrigo', 'Amanda', 'Felipe', 'Carolina',
  'Anderson', 'Vanessa', 'Fabio', 'Debora', 'Marcelo', 'Tatiane', 'Alexandre', 'Cristiane',
  'Fernando', 'Simone', 'Rogerio', 'Michele', 'Wagner', 'Andreia', 'Cesar', 'Roberta',
  'Paulo', 'Natalia', 'Henrique', 'Aline', 'Ricardo', 'Viviane', 'Daniel', 'Luciana',
  'Otavio', 'Gabriela', 'Ederson', 'Silvia', 'Igor',
]; // 53 (primo)

const SOBRENOMES = [
  'Andrade Pereira', 'Costa Ribeiro', 'Salgado', 'Nogueira Lima', 'Augusto Teixeira',
  'dos Santos Farias', 'Henrique Barros', 'Martins Cardoso', 'Moreira Duarte',
  'Alves Monteiro', 'Cesar Figueiredo', 'Rocha Pimentel', 'Henrique Vasconcelos',
  'Souza Albuquerque', 'Fernandes Castro', 'Lopes Guimaraes', 'Almeida Correia',
  'Ferreira Nunes', 'Batista Cavalcanti', 'Andrade Melo', 'Tavares Siqueira',
  'Cristina Peixoto', 'Augusto Barbosa', 'Machado Freitas', 'Luiz Ramalho',
  'Regina Coutinho', 'Junior Aragao', 'Cristina Vieira', 'Souza Bittencourt',
  'Pereira Godoy', 'Costa Miranda', 'Lopes Assuncao', 'Braga Quintanilha',
  'Rocha Vilaca', 'dos Santos Pena', 'Aparecida Fonseca', 'Luiz Bessa',
  'Cristina Prado', 'Augusto Nascimento', 'Lima Sarmento', 'Ricardo Andrade',
  'Bezerra Xavier', 'Werneck Sales',
]; // 43 (primo)

const LETRAS_PLACA = [
  'QJK', 'RTL', 'MNB', 'PLW', 'ZXC', 'BVN', 'TYU', 'GHJ', 'FDS', 'LKM', 'OIU', 'CVB',
  'ASD', 'WER', 'XSW', 'POI', 'HGF', 'MJU', 'NBV', 'KLO', 'ERT', 'YUI', 'CDE', 'VBN',
  'AZS', 'QWE', 'DFG', 'RTY', 'FGH', 'TGB', 'YHN',
]; // 31 (primo)

function placaDoIndice(indice) {
  const letras = LETRAS_PLACA[indice % LETRAS_PLACA.length];
  const digitos = String(1000 + ((indice * 7 + 3) % 9000));
  return `${letras}-${digitos}`;
} // período 31 * 9000 = 279.000, muito acima de qualquer contagem por fonte aqui

function valorDoIndice(indice) {
  const centavos = ((indice * 37 + 11) % 700000) + 39000; // R$ 390,00 a R$ 7.389,99
  const reais = Math.floor(centavos / 100);
  const cent = centavos % 100;
  const reaisFmt = reais.toLocaleString('pt-BR');
  return `${reaisFmt},${String(cent).padStart(2, '0')}`;
}

function valorParaNumero(valorTexto) {
  return Number(valorTexto.replace(/\./g, '').replace(',', '.'));
}

function dataDoIndice(indice) {
  // 2026-01-05 a 2026-08-13 (janela real de operação da Amplitude até o
  // fechamento do case), formatado dd/mm/aaaa.
  const inicio = Date.UTC(2026, 0, 5);
  const fim = Date.UTC(2026, 7, 13);
  const totalDias = Math.round((fim - inicio) / 86400000);
  const offset = (indice * 17 + 5) % totalDias;
  const d = new Date(inicio + offset * 86400000);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

const SERVICOS_AUTO = [
  'reparo de lataria e pintura no para-choque dianteiro', 'troca de para-lama dianteiro esquerdo',
  'substituicao de parabrisa trincado', 'realinhamento e balanceamento pos-colisao lateral',
  'troca de retrovisor direito danificado', 'reparo de amassado na porta traseira',
  'pintura completa do capo', 'troca de farol dianteiro quebrado',
  'reparo de teto solar com vazamento', 'substituicao de para-choque traseiro',
  'troca de vidro lateral trincado', 'reparo de estrutura apos colisao traseira',
  'polimento e restauracao de pintura', 'troca de macaneta danificada',
  'reparo de amassado no teto', 'troca de lanterna traseira quebrada',
  'revisao de suspensao apos buraco na via', 'reparo de para-lama traseiro amassado',
  'troca de pneu furado sem conserto', 'realinhamento de direcao',
  'reparo de arranhao profundo na lateral', 'troca de espelho retrovisor esquerdo',
  'substituicao de radiador danificado em colisao frontal', 'reparo de porta-malas emperrado',
]; // 24

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
  'consulta urologica', 'exame de tomografia', 'consulta oncologica de acompanhamento',
  'exame de endoscopia digestiva', 'sessao de terapia de casal',
]; // 31

/* --------------------------------------------------------------------------
 * Personas de redação -- cada fonte escreve diferente. As 3 personas usam a
 * MESMA informação de fundo (schema-alvo idêntico), só muda como o
 * documento chega: bloco formal caixa-alta (padrão de sistema legado),
 * texto corrido semi-formal (padrão de e-mail/carta), e exportação
 * abreviada por campo (padrão de planilha/sistema simples). Isso é o que
 * torna o dataset "heterogêneo entre oficinas", promessa feita desde o
 * Módulo 2.1 e nunca antes cumprida no nível de redação, só no nível de
 * template fixo por fonte.
 * -------------------------------------------------------------------------- */

function blocoFormalAuto(cabecalho, nome, placa, data, valor, servico, distrator) {
  return `${cabecalho} Segurado: ${nome} Placa do veiculo: ${placa} Data do sinistro: ${data} ` +
    `Descricao do servico: ${servico} ${distrator} Valor total do reparo: R$ ${valor}`;
}

function textoCorridoAuto(cabecalho, nome, placa, data, valor, servico, distrator) {
  return `${cabecalho} Prezados, segue o orcamento referente ao veiculo placa ${placa}, em nome do segurado ${nome}. ` +
    `O atendimento ocorreu em ${data} e o servico realizado foi: ${servico}. ${distrator} ` +
    `O valor total ficou em R$ ${valor}.`;
}

function exportacaoAbreviadaAuto(cabecalho, nome, placa, data, valor, servico, distrator) {
  return `${cabecalho} | Segurado: ${nome} | Placa: ${placa} | Data: ${data} | Servico: ${servico} | ${distrator} | Valor: R$ ${valor}`;
}

function blocoFormalSaude(cabecalho, nome, procedimento, data, valor, distrator) {
  return `${cabecalho} Paciente/Beneficiario: ${nome} Procedimento: ${procedimento} Data do atendimento: ${data} ` +
    `${distrator} Valor cobrado: R$ ${valor}`;
}

function textoCorridoSaude(cabecalho, nome, procedimento, data, valor, distrator) {
  return `${cabecalho} Informamos que o beneficiario ${nome} foi atendido em ${data} para realizacao de ${procedimento}. ` +
    `${distrator} O valor cobrado pelo procedimento foi de R$ ${valor}.`;
}

function exportacaoAbreviadaSaude(cabecalho, nome, procedimento, data, valor, distrator) {
  return `${cabecalho} | Beneficiario: ${nome} | Procedimento: ${procedimento} | Data: ${data} | ${distrator} | Valor: R$ ${valor}`;
}

const PERSONAS_AUTO = [blocoFormalAuto, textoCorridoAuto, exportacaoAbreviadaAuto];
const PERSONAS_SAUDE = [blocoFormalSaude, textoCorridoSaude, exportacaoAbreviadaSaude];

const FONTES_AUTO = [
  ['Oficina Estrela', 'ATIVA ORCAMENTOS AUTOMOTIVOS OFICINA ESTRELA LTDA CNPJ 12.345.678/0001-90 Rua das Turbinas 450 Distrito Industrial', 0, 620],
  ['Auto Center Silva', 'AUTO CENTER SILVA - FUNILARIA E PINTURA - CNPJ 98.765.432/0001-11 Av. dos Mecanicos 220', 1, 470],
  ['Funilaria Rio Bonito', 'FUNILARIA RIO BONITO ME CNPJ 45.111.222/0001-33 Rua Rio Bonito 88', 2, 360],
  ['Oficina Nova Aliança', 'OFICINA NOVA ALIANCA LTDA CNPJ 22.333.444/0001-55 Estrada Velha 1200', 0, 280],
  ['Mecânica Horizonte', 'MECANICA HORIZONTE LTDA CNPJ 51.222.888/0001-19 Av. do Horizonte 640', 1, 210],
  ['Auto Reparos União', 'AUTO REPAROS UNIAO ME CNPJ 63.444.777/0001-28 Rua da Uniao 305', 2, 160],
  ['Funilaria Cardoso & Filhos', 'FUNILARIA CARDOSO E FILHOS LTDA CNPJ 71.222.900/0001-05 Av. Industrial 812', 0, 115],
  ['Oficina Vale do Sol', 'OFICINA VALE DO SOL ME CNPJ 84.556.321/0001-77 Rua do Vale 210', 1, 80],
  ['CarroCerto Funilaria', 'CARROCERTO FUNILARIA E PINTURA LTDA CNPJ 19.887.001/0001-42 Av. Brasil 1450', 2, 55],
  ['Reparadora Metropolitana', 'REPARADORA METROPOLITANA ME CNPJ 27.334.660/0001-19 Rua Metropolitana 99', 0, 30],
];

const FONTES_SAUDE = [
  ['Clínica Vitalis', 'CLINICA VITALIS SAUDE OCUPACIONAL CNPJ 33.222.111/0001-44 Av. Paulista 900', 0, 520],
  ['Hospital Santa Clara', 'HOSPITAL SANTA CLARA CNPJ 66.555.444/0001-22 Rua das Acacias 310', 1, 380],
  ['Centro Médico Bem Estar', 'CENTRO MEDICO BEM ESTAR CNPJ 77.888.999/0001-66 Rua da Saude 45', 2, 290],
  ['Clínica São Rafael', 'CLINICA SAO RAFAEL CNPJ 84.111.222/0001-37 Rua Sao Rafael 512', 0, 200],
  ['Instituto Saúde Plena', 'INSTITUTO SAUDE PLENA LTDA CNPJ 91.333.555/0001-08 Av. da Saude Plena 78', 1, 140],
  ['Clínica Vida Nova', 'CLINICA VIDA NOVA LTDA CNPJ 38.221.775/0001-63 Rua Vida Nova 340', 2, 95],
  ['Policlínica Bem-Te-Vi', 'POLICLINICA BEM-TE-VI ME CNPJ 55.902.114/0001-88 Av. das Palmeiras 260', 0, 60],
  ['Centro Clínico Horizonte Azul', 'CENTRO CLINICO HORIZONTE AZUL LTDA CNPJ 62.447.209/0001-31 Rua Horizonte Azul 15', 1, 35],
];

function distratorAuto(indice) {
  const apolice = 400000 + ((indice * 53 + 7) % 590000);
  const sinistro = 800000 + ((indice * 61 + 3) % 190000);
  const franquia = 90000 + ((indice * 29 + 11) % 260000);
  const franquiaFmt = `${Math.floor(franquia / 100).toLocaleString('pt-BR')},${String(franquia % 100).padStart(2, '0')}`;
  const opcoes = [
    `Apolice no ${apolice}, franquia aplicada de R$ ${franquiaFmt}.`,
    `Numero do sinistro: SIN-${sinistro}.`,
    `Corretor responsavel: corretagem interna Amplitude Seguros.`,
  ];
  return opcoes[indice % opcoes.length];
}

function distratorSaude(indice) {
  const guia = 700000 + ((indice * 43 + 5) % 290000);
  const crm = 40000 + ((indice * 31 + 13) % 90000);
  const opcoes = [
    `Convenio: Amplitude Saude Empresarial.`,
    `Guia no ${guia}, CRM do medico responsavel: ${crm}/SP.`,
    `Empresa vinculada: contrato corporativo Amplitude Saude Empresarial.`,
  ];
  return opcoes[indice % opcoes.length];
}

/* --------------------------------------------------------------------------
 * Ruído de OCR (mesma técnica do M2.2/M3.2: 1<->l, 0<->o em palavras-chave),
 * aplicado a uma fração real dos exemplos de cada fonte grande (não plantado
 * artificialmente só em 1-2 exemplos como antes -- aqui reflete um problema
 * de digitalização recorrente, não um caso isolado).
 * -------------------------------------------------------------------------- */

function aplicarRuidoOcr(texto, indice) {
  if (indice % 11 !== 0) return texto; // ~9% dos exemplos, taxa realista de scan degradado
  return texto
    .replace(/Placa/g, 'P1aca')
    .replace(/veiculo/g, 've1cu1o')
    .replace(/Valor/g, 'Va1or')
    .replace(/cobrado/g, 'cobrad0');
}

/* --------------------------------------------------------------------------
 * Geração de exemplo individual
 * -------------------------------------------------------------------------- */

function nomeDoIndice(indice) {
  return `${PRENOMES[indice % PRENOMES.length]} ${SOBRENOMES[(indice * 7 + 3) % SOBRENOMES.length]}`;
}

function gerarExemploAuto(fonte, cabecalho, personaIdx, indiceGlobal, indiceFonte) {
  const nome = nomeDoIndice(indiceGlobal);
  const placa = placaDoIndice(indiceGlobal);
  const data = dataDoIndice(indiceGlobal);
  const valor = valorDoIndice(indiceGlobal);
  const servico = SERVICOS_AUTO[(indiceGlobal * 5 + 2) % SERVICOS_AUTO.length];
  const distrator = distratorAuto(indiceGlobal);
  const persona = PERSONAS_AUTO[personaIdx];

  let entrada = persona(cabecalho, nome, placa, data, valor, servico, distrator);
  entrada = aplicarRuidoOcr(entrada, indiceFonte);

  return {
    instrucao: 'Extraia segurado, placa e valor do orçamento de oficina abaixo.',
    entrada,
    saida: { segurado: nome, placa, valor: valorParaNumero(valor) },
    metadata: { caso: 'amplitude-auto', fonte, id: `amplitude-auto-${fonte}-${indiceFonte}` },
  };
}

function gerarExemploSaude(fonte, cabecalho, personaIdx, indiceGlobal, indiceFonte) {
  const nome = nomeDoIndice(indiceGlobal);
  const procedimento = PROCEDIMENTOS[(indiceGlobal * 5 + 1) % PROCEDIMENTOS.length];
  const data = dataDoIndice(indiceGlobal);
  const valor = valorDoIndice(indiceGlobal);
  const distrator = distratorSaude(indiceGlobal);
  const persona = PERSONAS_SAUDE[personaIdx];

  let entrada = persona(cabecalho, nome, procedimento, data, valor, distrator);
  entrada = aplicarRuidoOcr(entrada, indiceFonte);

  return {
    instrucao: 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.',
    entrada,
    saida: { beneficiario: nome, procedimento, valor: valorParaNumero(valor) },
    metadata: { caso: 'amplitude-saude-empresarial', fonte, id: `amplitude-saude-empresarial-${fonte}-${indiceFonte}` },
  };
}

function gerarDatasetBruto() {
  const exemplos = [];
  let contadorGlobal = 0;

  for (const [fonte, cabecalho, personaIdx, n] of FONTES_AUTO) {
    for (let i = 0; i < n; i++) {
      exemplos.push(gerarExemploAuto(fonte, cabecalho, personaIdx, contadorGlobal, i));
      contadorGlobal++;
    }
  }
  for (const [fonte, cabecalho, personaIdx, n] of FONTES_SAUDE) {
    for (let i = 0; i < n; i++) {
      exemplos.push(gerarExemploSaude(fonte, cabecalho, personaIdx, contadorGlobal, i));
      contadorGlobal++;
    }
  }

  // Quase-duplicatas plantadas de propósito (reenvio exato + ruído de OCR
  // isolado), proporcional ao volume maior -- mesmo padrão do M2.2/M3.2.
  const buscarPorId = (id) => exemplos.find((e) => e.metadata.id === id);
  const reenvios = [
    'amplitude-auto-Oficina Estrela-0', 'amplitude-auto-Auto Center Silva-0',
    'amplitude-auto-Funilaria Rio Bonito-0', 'amplitude-auto-Oficina Nova Aliança-0',
    'amplitude-saude-empresarial-Clínica Vitalis-0', 'amplitude-saude-empresarial-Hospital Santa Clara-0',
    'amplitude-saude-empresarial-Centro Médico Bem Estar-0',
  ];
  for (const id of reenvios) {
    const original = buscarPorId(id);
    exemplos.push({ ...original, metadata: { ...original.metadata, id: `${id}-reenviado` } });
  }

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
  console.log('== Testes: geração e escala do dataset (Módulo 6) ==');

  const bruto = gerarDatasetBruto();

  testar('nenhum id de exemplo se repete no bruto (gerador não colide)', () => {
    const ids = bruto.map((e) => e.metadata.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  testar('todo exemplo tem os 3 campos do schema do seu caso preenchidos', () => {
    for (const e of bruto) {
      if (e.metadata.caso === 'amplitude-auto') {
        assert.ok(e.saida.segurado && e.saida.placa && Number.isFinite(e.saida.valor));
      } else {
        assert.ok(e.saida.beneficiario && e.saida.procedimento && Number.isFinite(e.saida.valor));
      }
    }
  });

  const alvos = { 'amplitude-auto': 1800, 'amplitude-saude-empresarial': 1200 };
  const resultado = m22.limparEBalancear(bruto, { alvos });

  // Achado real, não plantado: rodando o detector real contra os 4.107
  // exemplos brutos, ele pegou 8 duplicatas, não as 7 plantadas de
  // propósito (reenvio exato por fonte). A 8ª é uma colisão orgânica --
  // "Instituto Saúde Plena-12" e "-108" -- mesma persona, mesmo
  // procedimento (sessão de terapia de casal) e mesmo distrator, com
  // similaridade de 0,556, logo acima do limiar de 0,55. Mesma lição já
  // registrada no Módulo 3.2: em escala maior, sempre validar rodando o
  // próprio detector contra o dataset real, nunca assumir que só as
  // duplicatas plantadas de propósito existem.
  testar('detector real encontra 8 duplicatas: 7 plantadas + 1 colisão orgânica real', () => {
    assert.equal(resultado.duplicatasRemovidas, 8);
  });

  testar('pipeline entrega exatamente os alvos de escala (1.800 Auto + 1.200 Saúde Empresarial)', () => {
    assert.equal(resultado.exemplosFinal.filter((e) => e.metadata.caso === 'amplitude-auto').length, 1800);
    assert.equal(resultado.exemplosFinal.filter((e) => e.metadata.caso === 'amplitude-saude-empresarial').length, 1200);
  });

  testar('nenhuma fonte perde exemplo além do necessário (alocação capacitada respeitada)', () => {
    for (const caso of ['amplitude-auto', 'amplitude-saude-empresarial']) {
      const r = resultado.relatorioPorCaso[caso];
      for (const fonte of Object.keys(r.contagensDepois)) {
        assert.ok(r.contagensDepois[fonte] <= r.contagensAntes[fonte]);
      }
    }
  });

  testar('diversidade (N efetivo de fontes) sobe ou mantém após o balanceamento, nos dois casos', () => {
    const rAuto = resultado.relatorioPorCaso['amplitude-auto'];
    const rSaude = resultado.relatorioPorCaso['amplitude-saude-empresarial'];
    assert.ok(rAuto.nEfetivoDepois >= rAuto.nEfetivoAntes);
    assert.ok(rSaude.nEfetivoDepois >= rSaude.nEfetivoAntes);
  });

  console.log();
  console.log(`Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ${testesComFalha} falhou(falharam).`);

  if (testesComFalha > 0) {
    throw new Error(`${testesComFalha} teste(s) falharam.`);
  }

  return resultado;
}

/* --------------------------------------------------------------------------
 * Execução principal
 * -------------------------------------------------------------------------- */

function main() {
  const resultado = rodarTestes();

  console.log();
  console.log('== Pipeline: escalando o dataset real do Módulo 3.2 pro volume de produção (Módulo 6) ==');
  console.log(`Bruto: ${resultado.original} exemplos -> Dedup: ${resultado.apósDedup} -> Balanceado: ${resultado.final}`);
  console.log(`Total de pares força-bruta comparados: ${resultado.totalParesForcaBruta}, candidatos via LSH: ${resultado.totalCandidatosLSH}`);
  console.log(`Duplicatas removidas: ${resultado.duplicatasRemovidas}`);

  for (const [caso, r] of Object.entries(resultado.relatorioPorCaso)) {
    console.log(`\n--- ${caso} ---`);
    console.log(`Fontes reais: ${Object.keys(r.contagensAntes).length}`);
    console.log('Antes:', Object.entries(r.contagensAntes).map(([f, n]) => `${f}=${n}`).join(', '));
    console.log(`Entropia antes: ${r.entropiaAntes.toFixed(4)} | N efetivo: ${r.nEfetivoAntes.toFixed(3)}`);
    console.log('Depois:', Object.entries(r.contagensDepois).map(([f, n]) => `${f}=${n}`).join(', '));
    console.log(`Entropia depois: ${r.entropiaDepois.toFixed(4)} | N efetivo: ${r.nEfetivoDepois.toFixed(3)}`);
  }

  const amostraAuto = resultado.exemplosFinal.find((e) => e.metadata.caso === 'amplitude-auto');
  const amostraSaude = resultado.exemplosFinal.find((e) => e.metadata.caso === 'amplitude-saude-empresarial');
  console.log('\n--- Amostra real (prova de redação variada) ---');
  console.log('Auto:', amostraAuto.entrada);
  console.log('Saúde:', amostraSaude.entrada);

  console.log(`\nDataset final: ${resultado.exemplosFinal.length} exemplos, prontos pra conversão e upload (Módulo 6).`);
}

if (require.main === module) {
  main();
}

module.exports = {
  gerarDatasetBruto, gerarExemploAuto, gerarExemploSaude, FONTES_AUTO, FONTES_SAUDE,
  placaDoIndice, valorDoIndice, dataDoIndice, valorParaNumero, nomeDoIndice,
};

// Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
// Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
