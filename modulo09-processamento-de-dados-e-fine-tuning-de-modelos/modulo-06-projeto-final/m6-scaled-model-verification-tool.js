/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 6.3
 *
 * Reavaliação real do modelo escalado (3.000 exemplos, tuningJobs/8278721957516541952)
 * contra os mesmos 3 conjuntos já usados no Módulo 5 (teste retido do M5.1, Round 1 e
 * Round 2 do M5.3), pra comparar com o piloto de 200 exemplos de forma justa e
 * reproduzível. Reusa gerarConjuntoTesteRetido/avaliarAdequacaoSchema/avaliarPrecisaoPorCampo
 * do harness do Módulo 5.1 direto (sem duplicar lógica de avaliação) -- só a constante de
 * endpoint muda, porque o harness do M5.1 é sobre o modelo de 200, não sobre este.
 *
 * Os 2 conjuntos de invariância (Round 1/Round 2) do Módulo 5.3 não são exportados no
 * module.exports daquele arquivo, então os mesmos 12 exemplos escritos à mão são
 * reproduzidos aqui literalmente, pra não depender de reescrever o arquivo do M5.3.
 *
 * Uso: node m6-scaled-model-verification-tool.js
 * Requer: ENDPOINT_MODULO32 (endpoint do SEU modelo de 200 exemplos,
 * Módulo 3.2) e ENDPOINT_MODULO63 (endpoint do SEU modelo escalado, 3.000
 * exemplos) definidas -- veja README.md, seção "Antes de rodar".
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

const {
  gerarConjuntoTesteRetido,
  avaliarAdequacaoSchema,
  avaliarPrecisaoPorCampo,
} = require(path.join(__dirname, '..', 'modulo-05-avaliacao-modelos', 'model-evaluation-harness-tool.js'));

const REGIAO = 'us-central1';
// CONFIGURAÇÃO: cada aluno usa os próprios endpoints -- nenhum valor padrão
// aponta pro autor do curso. ENDPOINT_ANTIGO é o mesmo endpoint do Módulo
// 3.2 (200 exemplos), ENDPOINT_NOVO é o do seu modelo escalado (3.000
// exemplos), se você tiver treinado um.
const ENDPOINT_ANTIGO = process.env.ENDPOINT_MODULO32; // 200 exemplos (Módulo 3.2)
if (!ENDPOINT_ANTIGO) {
  throw new Error('Defina a variável de ambiente ENDPOINT_MODULO32 com o endpoint do seu modelo publicado no Módulo 3.2 antes de rodar este script.');
}
const ENDPOINT_NOVO = process.env.ENDPOINT_MODULO63; // 3.000 exemplos (modelo escalado, Módulo 6.3)
if (!ENDPOINT_NOVO) {
  throw new Error('Defina a variável de ambiente ENDPOINT_MODULO63 com o endpoint do seu modelo escalado antes de rodar este script.');
}

function obterTokenAcesso() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function chamarModelo(endpoint, exemplo) {
  const token = obterTokenAcesso();
  const url = `https://${REGIAO}-aiplatform.googleapis.com/v1/${endpoint}:generateContent`;
  const textoUsuario = `${exemplo.instrucao}\n\n${exemplo.entrada}`;
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: textoUsuario }] }],
      generationConfig: { temperature: 0 },
    }),
  });
  if (!resposta.ok) {
    throw new Error(`Falha ao chamar o modelo: ${resposta.status} ${resposta.statusText}`);
  }
  const dados = await resposta.json();
  return dados.candidates[0].content.parts[0].text;
}

function gerarConjuntoInvariancia() {
  return [
    { metadata: { id: 'invariancia-auto-001', caso: 'amplitude-auto' }, instrucao: 'Extraia segurado, placa e valor do orçamento de oficina abaixo.', entrada: 'Oficina Mecânica Torque Real, CNPJ 44.333.222/0001-11. Cliente segurado: Fernanda Lima. Chapa do carro: XYZ-9988. Serviço de suspensão dianteira. Total a pagar: 1.200,50', saida: { segurado: 'Fernanda Lima', placa: 'XYZ-9988', valor: 1200.5 } },
    { metadata: { id: 'invariancia-auto-002', caso: 'amplitude-auto' }, instrucao: 'Extraia segurado, placa e valor do orçamento de oficina abaixo.', entrada: 'Auto Center Bandeirantes. Atendente responsável: Carlos Souza. Segurado: Juliana Ferreira Neves. Placa do veículo: MER-4521. Troca de para-choque traseiro. Valor total do reparo: R$ 890,00', saida: { segurado: 'Juliana Ferreira Neves', placa: 'MER-4521', valor: 890.0 } },
    { metadata: { id: 'invariancia-auto-003', caso: 'amplitude-auto' }, instrucao: 'Extraia segurado, placa e valor do orçamento de oficina abaixo.', entrada: 'O veículo de Ricardo Alves Monteiro, placa BRA-2119, deu entrada na Oficina Estrela Sul para reparo de amassado na porta dianteira. O orçamento fechado ficou em R$ 2.340,90.', saida: { segurado: 'Ricardo Alves Monteiro', placa: 'BRA-2119', valor: 2340.9 } },
    { metadata: { id: 'invariancia-saude-001', caso: 'amplitude-saude-empresarial' }, instrucao: 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.', entrada: 'Clínica São Rafael. Paciente atendido: Marcos Lopes Guimarães. Procedimento: exame de sangue completo. Valor a cobrar: 340,00', saida: { beneficiario: 'Marcos Lopes Guimarães', procedimento: 'exame de sangue completo', valor: 340.0 } },
    { metadata: { id: 'invariancia-saude-002', caso: 'amplitude-saude-empresarial' }, instrucao: 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.', entrada: 'Dr. Fernando Costa (CRM 55231) atendeu o paciente/beneficiário Juliana Ferreira Neves para consulta de cardiologia. Valor cobrado: R$ 890,00.', saida: { beneficiario: 'Juliana Ferreira Neves', procedimento: 'consulta de cardiologia', valor: 890.0 } },
    { metadata: { id: 'invariancia-saude-003', caso: 'amplitude-saude-empresarial' }, instrucao: 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.', entrada: 'A consulta de dermatologia realizada para Paulo Moreira Duarte, na Clínica Vitalis, custou R$ 1.150,00, conforme recibo emitido nesta data.', saida: { beneficiario: 'Paulo Moreira Duarte', procedimento: 'consulta de dermatologia', valor: 1150.0 } },
  ];
}

function gerarConjuntoInvarianciaSevero() {
  return [
    { metadata: { id: 'invariancia-severo-auto-001', caso: 'amplitude-auto' }, instrucao: 'Extraia segurado, placa e valor do orçamento de oficina abaixo.', entrada: 'Oi, aqui é da oficina! O carro da Camila Duarte Nogueira já tá pronto, placa QWE-3344. Ficou 3200 reais o conserto do motor, pode vir buscar.', saida: { segurado: 'Camila Duarte Nogueira', placa: 'QWE-3344', valor: 3200.0 } },
    { metadata: { id: 'invariancia-severo-auto-002', caso: 'amplitude-auto' }, instrucao: 'Extraia segurado, placa e valor do orçamento de oficina abaixo.', entrada: 'Segurado: Bruno Tavares Costa. Placa: LMN-7712. O reparo total do para-lama ficou em três mil e quinhentos reais.', saida: { segurado: 'Bruno Tavares Costa', placa: 'LMN-7712', valor: 3500.0 } },
    { metadata: { id: 'invariancia-severo-auto-003', caso: 'amplitude-auto' }, instrucao: 'Extraia segurado, placa e valor do orçamento de oficina abaixo.', entrada: 'Relatório da oficina: dois veículos em reparo hoje. O primeiro, placa AAA-1111, é de Marcelo Dias, ainda aguardando peça, orçamento não fechado. O segundo, do segurado Patricia Almeida Rocha, placa BBB-2222, teve o orçamento aprovado em R$ 1.780,00.', saida: { segurado: 'Patricia Almeida Rocha', placa: 'BBB-2222', valor: 1780.0 } },
    { metadata: { id: 'invariancia-severo-saude-001', caso: 'amplitude-saude-empresarial' }, instrucao: 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.', entrada: 'Boa tarde! Segue o valor do exame da Camila Duarte Nogueira: raio-x do tórax, ficou 450 reais.', saida: { beneficiario: 'Camila Duarte Nogueira', procedimento: 'raio-x do tórax', valor: 450.0 } },
    { metadata: { id: 'invariancia-severo-saude-002', caso: 'amplitude-saude-empresarial' }, instrucao: 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.', entrada: 'Beneficiário: Bruno Tavares Costa. Procedimento: consulta de oftalmologia. O valor cobrado foi mil e cem reais.', saida: { beneficiario: 'Bruno Tavares Costa', procedimento: 'consulta de oftalmologia', valor: 1100.0 } },
    { metadata: { id: 'invariancia-severo-saude-003', caso: 'amplitude-saude-empresarial' }, instrucao: 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.', entrada: 'Relatório da clínica: dois atendimentos hoje. O primeiro, para o beneficiário Marcelo Dias, consulta de rotina, ainda sem cobrança definida, avaliação em andamento. O segundo, da beneficiária Patricia Almeida Rocha, exame de ressonância magnética, valor R$ 2.900,00.', saida: { beneficiario: 'Patricia Almeida Rocha', procedimento: 'exame de ressonância magnética', valor: 2900.0 } },
  ];
}

async function avaliarConjunto(endpoint, exemplos) {
  const resultados = [];
  for (const exemplo of exemplos) {
    const textoResposta = await chamarModelo(endpoint, exemplo);
    const schema = avaliarAdequacaoSchema(exemplo.metadata.caso, textoResposta);
    const precisao = schema.valido
      ? avaliarPrecisaoPorCampo(exemplo.saida, schema.campos)
      : { precisao: 0 };
    resultados.push({ id: exemplo.metadata.id, schemaValido: schema.valido, precisao: precisao.precisao });
  }
  const schemasValidos = resultados.filter((r) => r.schemaValido).length;
  const precisaoMedia = resultados.reduce((s, r) => s + r.precisao, 0) / resultados.length;
  return { resultados, schemasValidos, total: resultados.length, precisaoMedia };
}

/* --------------------------------------------------------------------------
 * Testes automatizados (offline, não tocam rede)
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
  console.log('== Testes: conjuntos de verificação ==');
  const assert = require('assert').strict;

  testar('conjunto de invariância (Round 1) tem 6 exemplos, 3 Auto + 3 Saúde', () => {
    const c = gerarConjuntoInvariancia();
    assert.equal(c.length, 6);
    assert.equal(c.filter((e) => e.metadata.caso === 'amplitude-auto').length, 3);
  });

  testar('conjunto de invariância severa (Round 2) tem 6 exemplos, 3 Auto + 3 Saúde', () => {
    const c = gerarConjuntoInvarianciaSevero();
    assert.equal(c.length, 6);
    assert.equal(c.filter((e) => e.metadata.caso === 'amplitude-auto').length, 3);
  });

  testar('endpoint novo e antigo são distintos (comparação não compara o modelo com ele mesmo)', () => {
    assert.notEqual(ENDPOINT_ANTIGO, ENDPOINT_NOVO);
  });

  console.log();
  console.log(`Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ${testesComFalha} falhou(falharam).`);
}

/* --------------------------------------------------------------------------
 * Execução principal: roda os 3 conjuntos contra os dois endpoints
 * -------------------------------------------------------------------------- */

async function main() {
  rodarTestes();

  console.log();
  console.log('== Reavaliação real: modelo de 200 exemplos vs. modelo de 3.000 exemplos ==');
  console.log('(mesmo harness, mesmos 3 conjuntos do Módulo 5, endpoints diferentes)\n');

  for (const [rotulo, endpoint] of [['ANTIGO (200 exemplos)', ENDPOINT_ANTIGO], ['NOVO (3.000 exemplos)', ENDPOINT_NOVO]]) {
    console.log(`--- Modelo ${rotulo} ---`);
    const retido = await avaliarConjunto(endpoint, gerarConjuntoTesteRetido());
    const round1 = await avaliarConjunto(endpoint, gerarConjuntoInvariancia());
    const round2 = await avaliarConjunto(endpoint, gerarConjuntoInvarianciaSevero());
    console.log(`Teste retido: ${retido.schemasValidos}/${retido.total} schema, ${(retido.precisaoMedia * 100).toFixed(1)}% precisão`);
    console.log(`Round 1:      ${round1.schemasValidos}/${round1.total} schema, ${(round1.precisaoMedia * 100).toFixed(1)}% precisão`);
    console.log(`Round 2:      ${round2.schemasValidos}/${round2.total} schema, ${(round2.precisaoMedia * 100).toFixed(1)}% precisão`);
    console.log();
  }
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
  ENDPOINT_ANTIGO,
  ENDPOINT_NOVO,
  gerarConjuntoInvariancia,
  gerarConjuntoInvarianciaSevero,
  avaliarConjunto,
};

// Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
// Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
