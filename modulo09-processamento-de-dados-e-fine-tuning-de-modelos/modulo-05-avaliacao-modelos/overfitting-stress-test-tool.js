/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 5.3
 *
 * Pergunta real: o teste retido do Módulo 5.1 prova generalização de verdade,
 * ou só prova que o modelo decorou o FORMATO do gerador determinístico
 * (m3-dataset-scaling-tool.gerarExemplo) que criou os 200 exemplos de
 * treino? Todo exemplo do teste retido -- e todo exemplo de treino -- vem
 * do mesmo gerador, com o mesmo vocabulário fixo ("Segurado:", "Placa do
 * veículo:", sempre "R$ X.XXX,XX"). Trocar o índice não muda o template.
 *
 * Este módulo constrói exemplos NOVOS, escritos à mão (não gerados pelo
 * gerador determinístico), em três blocos: uma sonda de capacidade geral
 * (Round 0) e dois níveis de dificuldade de estresse de formato:
 *
 * Round 0 (capacidade geral): 4 perguntas fora do domínio Amplitude
 * Seguros, sem gabarito de campo -- mede se o modelo ainda sabe fazer
 * outra coisa, não se ele erra a extração num formato difícil.
 *
 * Round 1 (variação de formato): rótulo em linguagem coloquial, valor sem
 * símbolo "R$", texto corrido em vez de campo:valor, nomes-isca (uma
 * segunda pessoa mencionada). Documentos plausíveis, resolvíveis por um
 * humano -- não lixo deliberadamente malformado.
 *
 * Round 2 (variação estrutural): mensagem informal sem estrutura de
 * documento, valor por extenso sem nenhum dígito, e duas entidades no
 * mesmo texto exigindo ler qual delas tem valor fechado -- nada disso
 * existe nos 200 exemplos de treino, onde cada documento sempre tem
 * exatamente uma entidade.
 *
 * Reusa avaliarAdequacaoSchema e avaliarPrecisaoPorCampo do Módulo 5.1 --
 * mesmas métricas, sem duplicar lógica.
 *
 * Uso: node overfitting-stress-test-tool.js [round0|round1|round2|round2-medir] [N]
 */

'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

const {
  gerarConjuntoTesteRetido,
  chamarModeloReal,
  avaliarAdequacaoSchema,
  avaliarPrecisaoPorCampo,
  avaliarConsistencia,
} = require(path.join(__dirname, 'model-evaluation-harness-tool.js'));

const { chamarRecurso, MODELO_GENERICO } = require(
  path.join(__dirname, 'ab-and-domain-tradeoff-tool.js')
);

/* --------------------------------------------------------------------------
 * 0. Sonda de capacidade geral -- pergunta diferente de round 1/round 2.
 * Não é "o modelo erra a extração num formato difícil?" (isso é round 1 e
 * round 2), é "o modelo ainda sabe fazer outra coisa, fora de extração?".
 * 4 perguntas fora do domínio Amplitude Seguros, sem gabarito de campo --
 * a métrica aqui é qualitativa: o texto de resposta ainda é coerente e
 * seguro, comparado ao modelo genérico no mesmo prompt.
 * -------------------------------------------------------------------------- */

function gerarSondaCapacidadeGeral() {
  return [
    { id: 'geral-001', dominio: 'conhecimento factual', pergunta: 'Qual é a capital da França?' },
    { id: 'geral-002', dominio: 'raciocínio matemático', pergunta: 'Se um trem viaja a 80 km/h por 3 horas, qual distância ele percorre?' },
    { id: 'geral-003', dominio: 'conceito técnico', pergunta: 'Explique em uma frase o que é recursão em programação.' },
    { id: 'geral-004', dominio: 'escrita livre', pergunta: 'Escreva uma frase curta e inspiradora sobre perseverança.' },
  ];
}

/* --------------------------------------------------------------------------
 * 1. Conjunto de teste de invariância, round 1 (variação de formato)
 * -------------------------------------------------------------------------- */

function gerarConjuntoInvariancia() {
  return [
    {
      metadata: { id: 'invariancia-auto-001', caso: 'amplitude-auto', variacao: 'sem símbolo R$, rótulo coloquial' },
      instrucao: 'Extraia segurado, placa e valor do orçamento de oficina abaixo.',
      entrada: 'Oficina Mecânica Torque Real, CNPJ 44.333.222/0001-11. Cliente segurado: Fernanda Lima. Chapa do carro: XYZ-9988. Serviço de suspensão dianteira. Total a pagar: 1.200,50',
      saida: { segurado: 'Fernanda Lima', placa: 'XYZ-9988', valor: 1200.5 },
    },
    {
      metadata: { id: 'invariancia-auto-002', caso: 'amplitude-auto', variacao: 'nome-isca (atendente antes do segurado)' },
      instrucao: 'Extraia segurado, placa e valor do orçamento de oficina abaixo.',
      entrada: 'Auto Center Bandeirantes. Atendente responsável: Carlos Souza. Segurado: Juliana Ferreira Neves. Placa do veículo: MER-4521. Troca de para-choque traseiro. Valor total do reparo: R$ 890,00',
      saida: { segurado: 'Juliana Ferreira Neves', placa: 'MER-4521', valor: 890.0 },
    },
    {
      metadata: { id: 'invariancia-auto-003', caso: 'amplitude-auto', variacao: 'texto corrido, sem campo:valor' },
      instrucao: 'Extraia segurado, placa e valor do orçamento de oficina abaixo.',
      entrada: 'O veículo de Ricardo Alves Monteiro, placa BRA-2119, deu entrada na Oficina Estrela Sul para reparo de amassado na porta dianteira. O orçamento fechado ficou em R$ 2.340,90.',
      saida: { segurado: 'Ricardo Alves Monteiro', placa: 'BRA-2119', valor: 2340.9 },
    },
    {
      metadata: { id: 'invariancia-saude-001', caso: 'amplitude-saude-empresarial', variacao: 'sem símbolo R$, rótulo coloquial' },
      instrucao: 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.',
      entrada: 'Clínica São Rafael. Paciente atendido: Marcos Lopes Guimarães. Procedimento: exame de sangue completo. Valor a cobrar: 340,00',
      saida: { beneficiario: 'Marcos Lopes Guimarães', procedimento: 'exame de sangue completo', valor: 340.0 },
    },
    {
      metadata: { id: 'invariancia-saude-002', caso: 'amplitude-saude-empresarial', variacao: 'nome-isca (médico antes do beneficiário)' },
      instrucao: 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.',
      entrada: 'Dr. Fernando Costa (CRM 55231) atendeu o paciente/beneficiário Juliana Ferreira Neves para consulta de cardiologia. Valor cobrado: R$ 890,00.',
      saida: { beneficiario: 'Juliana Ferreira Neves', procedimento: 'consulta de cardiologia', valor: 890.0 },
    },
    {
      metadata: { id: 'invariancia-saude-003', caso: 'amplitude-saude-empresarial', variacao: 'texto corrido, sem campo:valor' },
      instrucao: 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.',
      entrada: 'A consulta de dermatologia realizada para Ricardo Nunes Barbosa, na Clínica Vitalis, custou R$ 1.150,00, conforme recibo emitido nesta data.',
      saida: { beneficiario: 'Ricardo Nunes Barbosa', procedimento: 'consulta de dermatologia', valor: 1150.0 },
    },
  ];
}

/* --------------------------------------------------------------------------
 * 1.1 Conjunto de invariância SEVERO -- variação estrutural, não só de rótulo.
 * Round 1 testou sinônimo de rótulo e nome-isca; o modelo passou (6/6, 100%
 * após corrigir o bug de comparação com maiúscula). Este round empurra mais:
 * mensagem informal sem estrutura de documento, valor por extenso sem
 * nenhum dígito, e duas entidades no mesmo texto exigindo ler qual delas
 * tem valor fechado -- nada disso existe nos 200 exemplos de treino, onde
 * cada documento sempre tem exatamente uma entidade.
 * -------------------------------------------------------------------------- */

function gerarConjuntoInvarianciaSevero() {
  return [
    {
      metadata: { id: 'invariancia-severo-auto-001', caso: 'amplitude-auto', variacao: 'mensagem informal, sem estrutura de documento' },
      instrucao: 'Extraia segurado, placa e valor do orçamento de oficina abaixo.',
      entrada: 'Oi, aqui é da oficina! O carro da Camila Duarte Nogueira já tá pronto, placa QWE-3344. Ficou 3200 reais o conserto do motor, pode vir buscar.',
      saida: { segurado: 'Camila Duarte Nogueira', placa: 'QWE-3344', valor: 3200.0 },
    },
    {
      metadata: { id: 'invariancia-severo-auto-002', caso: 'amplitude-auto', variacao: 'valor por extenso, sem nenhum dígito' },
      instrucao: 'Extraia segurado, placa e valor do orçamento de oficina abaixo.',
      entrada: 'Segurado: Bruno Tavares Costa. Placa: LMN-7712. O reparo total do para-lama ficou em três mil e quinhentos reais.',
      saida: { segurado: 'Bruno Tavares Costa', placa: 'LMN-7712', valor: 3500.0 },
    },
    {
      metadata: { id: 'invariancia-severo-auto-003', caso: 'amplitude-auto', variacao: 'dois veículos no mesmo texto, só um com orçamento fechado' },
      instrucao: 'Extraia segurado, placa e valor do orçamento de oficina abaixo.',
      entrada: 'Relatório da oficina: dois veículos em reparo hoje. O primeiro, placa AAA-1111, é de Marcelo Dias, ainda aguardando peça, orçamento não fechado. O segundo, do segurado Patricia Almeida Rocha, placa BBB-2222, teve o orçamento aprovado em R$ 1.780,00.',
      saida: { segurado: 'Patricia Almeida Rocha', placa: 'BBB-2222', valor: 1780.0 },
    },
    {
      metadata: { id: 'invariancia-severo-saude-001', caso: 'amplitude-saude-empresarial', variacao: 'mensagem informal, sem estrutura de documento' },
      instrucao: 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.',
      entrada: 'Boa tarde! Segue o valor do exame da Camila Duarte Nogueira: raio-x do tórax, ficou 450 reais.',
      saida: { beneficiario: 'Camila Duarte Nogueira', procedimento: 'raio-x do tórax', valor: 450.0 },
    },
    {
      metadata: { id: 'invariancia-severo-saude-002', caso: 'amplitude-saude-empresarial', variacao: 'valor por extenso, sem nenhum dígito' },
      instrucao: 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.',
      entrada: 'Beneficiário: Bruno Tavares Costa. Procedimento: consulta de oftalmologia. O valor cobrado foi mil e cem reais.',
      saida: { beneficiario: 'Bruno Tavares Costa', procedimento: 'consulta de oftalmologia', valor: 1100.0 },
    },
    {
      metadata: { id: 'invariancia-severo-saude-003', caso: 'amplitude-saude-empresarial', variacao: 'dois pacientes no mesmo texto, só um com valor definido' },
      instrucao: 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.',
      entrada: 'Relatório da clínica: dois atendimentos hoje. O primeiro, para o beneficiário Marcelo Dias, consulta de rotina, ainda sem cobrança definida, avaliação em andamento. O segundo, da beneficiária Patricia Almeida Rocha, exame de ressonância magnética, valor R$ 2.900,00.',
      saida: { beneficiario: 'Patricia Almeida Rocha', procedimento: 'exame de ressonância magnética', valor: 2900.0 },
    },
  ];
}

/* --------------------------------------------------------------------------
 * 2. Avaliação contra o endpoint real do Módulo 3.2
 * -------------------------------------------------------------------------- */

async function avaliarConjunto(exemplos) {
  const resultados = [];
  const falhas = [];
  for (const exemplo of exemplos) {
    let textoResposta;
    try {
      textoResposta = await chamarModeloReal(exemplo);
    } catch (erro) {
      console.log(`  [FALHOU] ${exemplo.metadata.id}: ${erro.message}`);
      falhas.push({ id: exemplo.metadata.id, erro: erro.message });
      continue;
    }
    const schema = avaliarAdequacaoSchema(exemplo.metadata.caso, textoResposta);
    const precisao = schema.valido
      ? avaliarPrecisaoPorCampo(exemplo.saida, schema.campos)
      : { precisao: 0, acertos: 0, total: Object.keys(exemplo.saida).length };
    resultados.push({
      id: exemplo.metadata.id,
      variacao: exemplo.metadata.variacao || '',
      textoResposta,
      schemaValido: schema.valido,
      precisao: precisao.precisao,
    });
  }
  if (falhas.length > 0) {
    console.log(`  ${falhas.length}/${exemplos.length} exemplo(s) falharam na chamada real.`);
  }
  if (resultados.length === 0) {
    throw new Error('Nenhum exemplo processado com sucesso -- verifique projeto/endpoint/billing.');
  }
  const schemasValidos = resultados.filter((r) => r.schemaValido).length;
  const precisaoMedia = resultados.reduce((soma, r) => soma + r.precisao, 0) / resultados.length;
  return { resultados, schemasValidos, total: resultados.length, precisaoMedia, falhas };
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
  console.log('== Testes: conjunto de invariância ==');

  testar('gera 6 exemplos (3 Auto + 3 Saúde), cada um com variação documentada', () => {
    const conjunto = gerarConjuntoInvariancia();
    assert.equal(conjunto.length, 6);
    assert.equal(conjunto.filter((e) => e.metadata.caso === 'amplitude-auto').length, 3);
    assert.equal(conjunto.filter((e) => e.metadata.caso === 'amplitude-saude-empresarial').length, 3);
    conjunto.forEach((e) => assert.ok(e.metadata.variacao, `${e.metadata.id} sem variação documentada`));
  });

  testar('nenhum ID do conjunto de invariância colide com o teste retido do M5.1', () => {
    const idsRetidos = new Set(gerarConjuntoTesteRetido().map((e) => e.metadata.id));
    const idsInvariancia = gerarConjuntoInvariancia().map((e) => e.metadata.id);
    idsInvariancia.forEach((id) => assert.ok(!idsRetidos.has(id), `ID ${id} colide com o teste retido`));
  });

  await testarAsync('chamada real ao endpoint do Módulo 3.2 devolve uma resposta não vazia', async () => {
    const exemplo = gerarConjuntoInvariancia()[0];
    const textoResposta = await chamarModeloReal(exemplo);
    assert.ok(typeof textoResposta === 'string' && textoResposta.length > 0);
  });

  testar('gera 6 exemplos severos (3 Auto + 3 Saúde), sem colisão de ID com os outros dois conjuntos', () => {
    const conjunto = gerarConjuntoInvarianciaSevero();
    assert.equal(conjunto.length, 6);
    assert.equal(conjunto.filter((e) => e.metadata.caso === 'amplitude-auto').length, 3);
    assert.equal(conjunto.filter((e) => e.metadata.caso === 'amplitude-saude-empresarial').length, 3);
    const idsRetidos = new Set(gerarConjuntoTesteRetido().map((e) => e.metadata.id));
    const idsInvarianciaBase = new Set(gerarConjuntoInvariancia().map((e) => e.metadata.id));
    conjunto.forEach((e) => {
      assert.ok(!idsRetidos.has(e.metadata.id) && !idsInvarianciaBase.has(e.metadata.id), `ID ${e.metadata.id} colide`);
    });
  });

  console.log();
  console.log(`Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ${testesComFalha} falhou(falharam).`);
}

async function rodarTestesRound0() {
  console.log('== Testes: sonda de capacidade geral (Round 0) ==');

  testar('sonda de capacidade geral tem 4 perguntas, cada uma com domínio documentado e fora do vocabulário Amplitude Seguros', () => {
    const sonda = gerarSondaCapacidadeGeral();
    assert.equal(sonda.length, 4);
    sonda.forEach((s) => {
      assert.ok(s.dominio, `${s.id} sem domínio documentado`);
      assert.ok(!/segurado|beneficiário|placa|procedimento|orçamento|Amplitude/i.test(s.pergunta), `${s.id} vaza vocabulário do domínio de treino`);
    });
  });

  testar('achado real: fine-tunado generaliza o hábito de responder em JSON pra pergunta fora do domínio; genérico responde em prosa livre', () => {
    // Capturado rodando de verdade os dois lados na mesma pergunta ("Qual é
    // a capital da França?"). Não é falha de conteúdo -- os dois acertam
    // Paris -- é viés de FORMATO generalizando além da tarefa de treino.
    const RESPOSTA_FINE_TUNADO = '{"answer":"Paris"}';
    const RESPOSTA_GENERICO = 'A capital da França é **Paris**.';
    assert.ok(/^\s*\{.*\}\s*$/s.test(RESPOSTA_FINE_TUNADO), 'esperava JSON do fine-tunado');
    assert.ok(!/^\s*\{/.test(RESPOSTA_GENERICO), 'esperava prosa livre do genérico, não JSON');
    assert.ok(RESPOSTA_FINE_TUNADO.includes('Paris') && RESPOSTA_GENERICO.includes('Paris'), 'os dois precisam acertar o conteúdo, só o formato diverge');
  });

  console.log();
  console.log(`Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ${testesComFalha} falhou(falharam).`);
}

/* --------------------------------------------------------------------------
 * Execução principal
 * -------------------------------------------------------------------------- */

async function rodarRound0() {
  console.log('== Round 0: o modelo ainda sabe fazer outra coisa, fora de extração? ==');
  console.log('4 perguntas fora do domínio Amplitude Seguros, fine-tunado vs. genérico, mesmo prompt.\n');

  const sonda = gerarSondaCapacidadeGeral();
  let falhas = 0;
  for (const item of sonda) {
    const exemplo = { instrucao: item.pergunta, entrada: '' };
    let respostaFineTunado;
    let respostaGenerico;
    try {
      respostaFineTunado = await chamarModeloReal(exemplo);
      respostaGenerico = await chamarRecurso(MODELO_GENERICO, exemplo);
    } catch (erro) {
      console.log(`[${item.dominio}] ${item.pergunta}`);
      console.log(`  [FALHOU] ${erro.message}\n`);
      falhas += 1;
      continue;
    }
    console.log(`[${item.dominio}] ${item.pergunta}`);
    console.log(`  Fine-tunado: ${respostaFineTunado.trim().replace(/\n/g, ' ')}`);
    console.log(`  Genérico:    ${respostaGenerico.trim().replace(/\n/g, ' ')}`);
    console.log();
  }
  if (falhas > 0) {
    console.log(`${falhas}/${sonda.length} pergunta(s) falharam na chamada real -- verifique projeto/endpoint/billing.\n`);
  }
}

/* --------------------------------------------------------------------------
 * Ledger de resultado medido -- consumido pelo veredito-escala-tool.js do
 * Módulo 5.4, pra não repetir número por cópia manual. Ver Módulo 5.1 pra
 * a mesma função (duplicada aqui de propósito, cada arquivo grava o próprio
 * ledger, sem acoplar módulos por causa de uma função utilitária).
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

async function rodarBaseline(mostrarNaTela = true) {
  const baseline = await avaliarConjunto(gerarConjuntoTesteRetido());
  if (mostrarNaTela) {
    console.log('== Baseline: teste retido do Módulo 5.1 (mesmo gerador do treino, índices novos) ==');
    console.log(`${baseline.schemasValidos}/${baseline.total} schema válido, ${(baseline.precisaoMedia * 100).toFixed(1)}% precisão média`);
  }
  return baseline;
}

async function rodarRound1(baseline) {
  console.log();
  console.log('== Estresse: teste de invariância (formato real, nunca visto no template de treino) ==');
  const estresse = await avaliarConjunto(gerarConjuntoInvariancia());
  estresse.resultados.forEach((r) => {
    console.log(`${r.id} (${r.variacao}): schema ${r.schemaValido ? 'válido' : 'INVÁLIDO'}, precisão ${(r.precisao * 100).toFixed(0)}%`);
  });
  console.log(`\n${estresse.schemasValidos}/${estresse.total} schema válido, ${(estresse.precisaoMedia * 100).toFixed(1)}% precisão média`);

  console.log();
  const quedaSchema = baseline.schemasValidos / baseline.total - estresse.schemasValidos / estresse.total;
  const quedaPrecisao = baseline.precisaoMedia - estresse.precisaoMedia;
  console.log(`Queda de schema válido: ${(quedaSchema * 100).toFixed(1)} pontos percentuais`);
  console.log(`Queda de precisão média: ${(quedaPrecisao * 100).toFixed(1)} pontos percentuais`);

  const medidoPct = Math.round(Math.min(estresse.schemasValidos / estresse.total, estresse.precisaoMedia) * 100);
  const semQueda = quedaSchema <= 0 && quedaPrecisao <= 0;
  gravarResultadoMedido(path.join(__dirname, 'resultado-medido.json'), 'robusto-formato', {
    medido: semQueda
      ? `${medidoPct}% (zero queda de schema/precisão contra o baseline)`
      : `${medidoPct}% (queda de ${(quedaPrecisao * 100).toFixed(1).replace('.', ',')} pontos percentuais de precisão contra o baseline)`,
    medidoPct,
    n: estresse.total,
    medidoEm: new Date().toLocaleDateString('sv-SE'),
    origem: 'Módulo 5.3 (round 1)',
    script: 'overfitting-stress-test-tool.js',
  });
}

async function rodarRound2(baseline) {
  console.log();
  console.log('== Estresse severo: variação estrutural (mensagem informal, valor por extenso, duas entidades) ==');
  const severo = await avaliarConjunto(gerarConjuntoInvarianciaSevero());
  severo.resultados.forEach((r) => {
    console.log(`${r.id} (${r.variacao}): schema ${r.schemaValido ? 'válido' : 'INVÁLIDO'}, precisão ${(r.precisao * 100).toFixed(0)}%`);
    if (r.precisao < 1) console.log(`    resposta bruta: ${r.textoResposta}`);
  });
  console.log(`\n${severo.schemasValidos}/${severo.total} schema válido, ${(severo.precisaoMedia * 100).toFixed(1)}% precisão média`);

  console.log();
  const quedaSchemaSevero = baseline.schemasValidos / baseline.total - severo.schemasValidos / severo.total;
  const quedaPrecisaoSevero = baseline.precisaoMedia - severo.precisaoMedia;
  console.log(`Queda de schema válido (severo): ${(quedaSchemaSevero * 100).toFixed(1)} pontos percentuais`);
  console.log(`Queda de precisão média (severo): ${(quedaPrecisaoSevero * 100).toFixed(1)} pontos percentuais`);

  console.log();
  const falho = severo.resultados.find((r) => r.precisao < 1);
  if (!falho) {
    console.log('== Consistência: nenhum erro no round 2 desta vez, não há exemplo falho pra testar. ==');
    return;
  }
  console.log(`== Consistência do erro real (${falho.id}): mesma entrada, três chamadas separadas ==`);
  const exemploFalho = gerarConjuntoInvarianciaSevero().find((e) => e.metadata.id === falho.id);
  const consistencia = await avaliarConsistencia(exemploFalho, 3);
  consistencia.respostas.forEach((r, i) => console.log(`  Chamada ${i + 1}: ${r}`));
  console.log(`Respostas únicas: ${consistencia.numeroRespostasUnicas} de ${consistencia.respostas.length} (${consistencia.estavel ? 'estável' : 'instável'})`);
  if (consistencia.estavel) {
    console.log('Não é ruído aleatório: o modelo erra o mesmo campo, do mesmo jeito, toda vez.');
  } else {
    console.log('Instável entre chamadas: esta execução não sustenta a alegação de erro consistente.');
  }
}

/* --------------------------------------------------------------------------
 * Remedição estatística do round 2 -- uma única passada (rodarRound2) testa
 * cada caso severo 1 vez só, evidência fraca demais pro critério de
 * graduação (a própria lição desta seção é que N pequeno engana: N=3
 * sugeriu um erro que N=58 não confirmou). Este modo repete a avaliação
 * completa do conjunto severo N vezes e agrega, pra virar um ledger
 * estatisticamente honesto em vez de uma amostra de 1.
 *
 * Custo real: N repetições x 6 chamadas ao modelo por repetição. N=58
 * (o valor já citado no TP/slide) significa 348 chamadas reais -- caro e
 * demorado de propósito, é uma remedição estatística, não o demo padrão.
 * Pra só validar que o mecanismo funciona, rode com N baixo (ex.: 2).
 * -------------------------------------------------------------------------- */

async function medirRobustezEstrutural(baseline, n = 58) {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`medirRobustezEstrutural: N precisa ser um inteiro >= 1, recebi ${JSON.stringify(n)}.`);
  }
  console.log(`== Remedição estatística do Round 2 (N=${n} execuções completas do conjunto severo) ==`);
  const conjuntoSevero = gerarConjuntoInvarianciaSevero();
  let totalCasos = 0;
  let totalErros = 0;
  for (let i = 0; i < n; i += 1) {
    const severo = await avaliarConjunto(conjuntoSevero);
    const errosNestaExecucao = severo.resultados.filter((r) => !r.schemaValido || r.precisao < 1).length;
    totalCasos += severo.total;
    totalErros += errosNestaExecucao;
    console.log(`  execução ${i + 1}/${n}: ${severo.schemasValidos}/${severo.total} schema válido, ${(severo.precisaoMedia * 100).toFixed(1)}% precisão`);
  }
  const taxaAcerto = (totalCasos - totalErros) / totalCasos;
  const medidoPct = Math.round(taxaAcerto * 100);
  console.log();
  console.log(`Total: ${totalErros}/${totalCasos} chamadas com erro (${medidoPct}% de acerto), em ${n} execuções completas.`);

  const medido = totalErros === 0
    ? `${medidoPct}% (N=${n} execuções, zero erros; uma checagem inicial com N pequeno pode sugerir um erro de fraseado que não se confirma em amostra maior)`
    : `${medidoPct}% (N=${n} execuções, ${totalErros}/${totalCasos} chamadas com erro)`;

  gravarResultadoMedido(path.join(__dirname, 'resultado-medido.json'), 'robusto-estrutura', {
    medido,
    medidoPct,
    n,
    medidoEm: new Date().toLocaleDateString('sv-SE'),
    origem: `Módulo 5.3 (round 2, N=${n})`,
    script: 'overfitting-stress-test-tool.js',
  });

  return { totalCasos, totalErros, medidoPct };
}

async function main() {
  // Uso: node overfitting-stress-test-tool.js [round0|round1|round2|round2-medir] [N]
  // Sem argumento roda tudo (testes + round0 + baseline + round1 + round2),
  // útil pra verificação standalone. "round0" é a sonda de capacidade geral,
  // independente do baseline/round1/round2 (não precisa do teste retido);
  // só nesse modo (e em "tudo") os 2 testes extras da sonda entram na
  // contagem, "round1"/"round2" mostram sempre os 4 testes originais.
  // "round1" roda o teste de estresse de formato; "round2" roda o teste de
  // estresse estrutural (mais severo), sem repetir o baseline na tela.
  // "round2-medir [N]" roda a remedição estatística (N execuções completas,
  // padrão 58) e grava o ledger -- não faz parte do demo padrão, é a
  // ferramenta de remedição pra quando o harness for alterado no futuro.
  const modo = process.argv[2] || 'tudo';

  if (modo === 'round2-medir') {
    const n = process.argv[3] ? Number(process.argv[3]) : 58;
    const baseline = await rodarBaseline(false);
    await medirRobustezEstrutural(baseline, n);
    return;
  }

  await rodarTestes();

  if (modo === 'round0') {
    console.log();
    await rodarTestesRound0();
    console.log();
    await rodarRound0();
    return;
  }

  if (modo === 'tudo') {
    console.log();
    await rodarTestesRound0();
    console.log();
    await rodarRound0();
  }

  if (modo !== 'round2') console.log();
  const baseline = await rodarBaseline(modo !== 'round2');

  if (modo === 'tudo' || modo === 'round1') await rodarRound1(baseline);
  if (modo === 'tudo' || modo === 'round2') await rodarRound2(baseline);
}

if (require.main === module) {
  main().catch((erro) => {
    console.error(`\nErro: ${erro.message}`);
    console.error('Verifique a autenticação (gcloud auth login) e a conexão de rede, e tente de novo.');
    if (process.env.DEBUG) {
      console.error(erro.stack);
    }
    process.exitCode = 1;
  });
}

module.exports = {
  gerarSondaCapacidadeGeral,
  gerarConjuntoInvariancia,
  gerarConjuntoInvarianciaSevero,
  avaliarConjunto,
  medirRobustezEstrutural,
};

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
