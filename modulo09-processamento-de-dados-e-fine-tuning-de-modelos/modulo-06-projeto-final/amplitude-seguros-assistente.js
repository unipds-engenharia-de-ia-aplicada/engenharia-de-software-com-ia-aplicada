/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 6.2
 *
 * O protótipo funcional que fecha os bullets 3 e 5 da ementa oficial do
 * Módulo 6: integra o modelo fine-tunado da Amplitude Seguros num fluxo
 * prático de uso (agente automatizado), chamando o modelo treinado via API
 * de verdade. Implementa os quatro passos desenhados no Módulo 6.1:
 *
 *   1. classificarDominio  -- NOVO
 *   2. rotear pro modelo certo -- reusa chamarModeloReal do Módulo 5.1
 *      (nuvem, padrão) ou chamar_modelo_local.py (local, flag --local)
 *   3. validar schema -- reusa avaliarAdequacaoSchema do Módulo 5.1
 *   4. formatarResposta -- NOVO
 *
 * Incerteza nunca vira resposta forçada (Módulo 6.1, Slide 10): um texto
 * fora do escopo aprovado, ou ambíguo entre os dois domínios aprovados, é
 * sinalizado e devolvido pro usuário, nunca extraído no chute.
 *
 * Uso:
 *   node amplitude-seguros-assistente.js "<texto do usuário>"
 *   node amplitude-seguros-assistente.js --local "<texto do usuário>"
 *   node amplitude-seguros-assistente.js --skip-tests "<texto do usuário>"
 *     (pula a suíte de 14 testes, útil pra chamadas repetidas na mesma sessão)
 *
 * Par oficial desta disciplina: amplitude-seguros-assistente.js é o único
 * arquivo (o bullet 5 da ementa pede especificamente JavaScript). O
 * caminho --local depende de chamar_modelo_local.py (mlx-lm não tem par em
 * JS, mesma exceção já estabelecida nos Módulos 4.2, 4.4 e 5.4).
 */

'use strict';

const assert = require('assert').strict;
const path = require('path');
const { spawnSync } = require('child_process');

const {
  chamarModeloReal,
  avaliarAdequacaoSchema,
} = require(path.join(__dirname, '..', 'modulo-05-avaliacao-modelos', 'model-evaluation-harness-tool.js'));

/* --------------------------------------------------------------------------
 * 1. Classificar domínio -- NOVO
 *
 * Vocabulário deliberadamente ESPECÍFICO de cada domínio, não genérico de
 * seguros: "sinistro" sozinho, por exemplo, aparece tanto em Auto quanto
 * em Atendimento ao Cliente (contestação de sinistro), então NÃO entra na
 * lista -- entraria como falso sinal pros dois casos.
 * -------------------------------------------------------------------------- */

const PALAVRAS_AUTO = ['placa', 'veículo', 'veiculo', 'oficina', 'funilaria', 'para-choque', 'parachoque', 'lataria', 'pintura'];
const PALAVRAS_SAUDE = ['beneficiário', 'beneficiario', 'procedimento', 'clínica', 'clinica', 'consulta', 'exame', 'hospital', 'paciente', 'convênio', 'convenio'];

function contarOcorrencias(textoMinusculo, palavras) {
  return palavras.reduce((soma, palavra) => (textoMinusculo.includes(palavra) ? soma + 1 : soma), 0);
}

function classificarDominio(texto) {
  const textoMinusculo = texto.toLowerCase();
  const scoreAuto = contarOcorrencias(textoMinusculo, PALAVRAS_AUTO);
  const scoreSaude = contarOcorrencias(textoMinusculo, PALAVRAS_SAUDE);

  // score empatado (inclusive 0-0) → null, nunca decide no chute
  if (scoreAuto === 0 && scoreSaude === 0) {
    return { dominio: null, motivo: 'fora_do_escopo', scoreAuto, scoreSaude };
  }
  if (scoreAuto === scoreSaude) {
    return { dominio: null, motivo: 'ambiguo', scoreAuto, scoreSaude };
  }
  return {
    dominio: scoreAuto > scoreSaude ? 'amplitude-auto' : 'amplitude-saude-empresarial',
    motivo: 'ok',
    scoreAuto,
    scoreSaude,
  };
}

const INSTRUCOES = {
  'amplitude-auto': 'Extraia segurado, placa e valor do orçamento de oficina abaixo.',
  'amplitude-saude-empresarial': 'Extraia beneficiário, procedimento e valor do recibo médico abaixo.',
};

/* --------------------------------------------------------------------------
 * 2. Rotear pro modelo certo -- nuvem (reusa Módulo 5.1) ou local (novo)
 * -------------------------------------------------------------------------- */

function chamarModeloLocal(instrucao, entrada) {
  const scriptLocal = path.join(__dirname, 'chamar_modelo_local.py');
  const resultado = spawnSync('python3', [scriptLocal], {
    input: JSON.stringify({ instrucao, entrada }),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (resultado.error) {
    // O processo nem chegou a rodar (ex.: "python3" ausente do PATH) --
    // resultado.stderr fica undefined nesse caso, a causa real está aqui.
    throw new Error(`Falha ao chamar o modelo local: não foi possível executar "python3" (${resultado.error.message}). Verifique se o Python está instalado e no PATH.`);
  }
  if (resultado.status !== 0) {
    throw new Error(`Falha ao chamar o modelo local: ${resultado.stderr}`);
  }
  return resultado.stdout.trim();
}

async function chamarModelo(dominio, texto, opcoes = {}) {
  const { local = false, chamarLocalFn = chamarModeloLocal, chamarNuvemFn = chamarModeloReal } = opcoes;
  const instrucao = INSTRUCOES[dominio];
  if (local) {
    return chamarLocalFn(instrucao, texto);
  }
  return chamarNuvemFn({ instrucao, entrada: texto });
}

/* --------------------------------------------------------------------------
 * 3. Validar, em duas camadas -- avaliarAdequacaoSchema (Módulo 5.1) e a
 *    camada nova abaixo
 * -------------------------------------------------------------------------- */

/**
 * avaliarAdequacaoSchema (Módulo 5.1) confere só se as CHAVES batem -- não
 * se o TIPO de cada valor faz sentido. Sem isso, um "valor" não numérico
 * passa como sucesso e vira "R$ NaN" na resposta final, apresentado com a
 * mesma confiança de um resultado correto. Checagem adicional, só neste
 * módulo (não altera o harness compartilhado do Módulo 5.1, que outros
 * vídeos já testaram e narraram).
 */
function avaliarConsistenciaDeValores(dominio, campos) {
  const problemas = [];
  if (!Number.isFinite(Number(campos.valor)) || campos.valor === '' || campos.valor === null) {
    problemas.push('valor não é um número válido');
  }
  const camposTexto = dominio === 'amplitude-auto' ? ['segurado', 'placa'] : ['beneficiario', 'procedimento'];
  camposTexto.forEach((campo) => {
    if (typeof campos[campo] !== 'string' || campos[campo].trim() === '') {
      problemas.push(`${campo} está vazio ou não é texto`);
    }
  });
  return { valido: problemas.length === 0, problemas };
}

/* --------------------------------------------------------------------------
 * 4. Formatar resposta -- NOVO
 * -------------------------------------------------------------------------- */

function formatarMoeda(valor) {
  return `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatarResposta(dominio, campos) {
  if (dominio === 'amplitude-auto') {
    return `Recebi seu orçamento. Segurado: ${campos.segurado}, placa: ${campos.placa}, valor: ${formatarMoeda(campos.valor)}. Confirma esses dados?`;
  }
  return `Recebi seu recibo médico. Beneficiário: ${campos.beneficiario}, procedimento: ${campos.procedimento}, valor: ${formatarMoeda(campos.valor)}. Confirma esses dados?`;
}

/* --------------------------------------------------------------------------
 * Orquestração dos quatro passos
 * -------------------------------------------------------------------------- */

async function processarMensagem(texto, opcoes = {}) {
  const classificacao = classificarDominio(texto);

  if (classificacao.motivo === 'fora_do_escopo') {
    return {
      tipo: 'fora_do_escopo',
      mensagem: 'Isso parece um caso fora do escopo aprovado pro Amplitude Auto e Saúde Empresarial (ex.: Atendimento ao Cliente). Encaminhando pra um especialista humano.',
      classificacao,
    };
  }
  if (classificacao.motivo === 'ambiguo') {
    return {
      tipo: 'ambiguo',
      mensagem: 'Não consegui identificar com confiança se isso é um caso de Amplitude Auto ou de Saúde Empresarial. Pode confirmar qual dos dois é?',
      classificacao,
    };
  }

  const textoResposta = await chamarModelo(classificacao.dominio, texto, opcoes);
  const schema = avaliarAdequacaoSchema(classificacao.dominio, textoResposta);

  if (!schema.valido) {
    return {
      tipo: 'schema_invalido',
      mensagem: 'O modelo não devolveu um resultado completo dessa vez. Tente reformular a mensagem ou tente de novo.',
      classificacao,
      schema,
      textoResposta,
    };
  }

  const consistencia = avaliarConsistenciaDeValores(classificacao.dominio, schema.campos);
  if (!consistencia.valido) {
    return {
      tipo: 'schema_invalido',
      mensagem: 'O modelo devolveu os campos certos, mas com um valor que não faz sentido (ex.: valor não numérico). Tente reformular a mensagem ou tente de novo.',
      classificacao,
      schema,
      textoResposta,
      consistencia,
    };
  }

  return {
    tipo: 'sucesso',
    mensagem: formatarResposta(classificacao.dominio, schema.campos),
    classificacao,
    schema,
    campos: schema.campos,
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
  console.log('== Testes: amplitude-seguros-assistente ==');

  testar('mensagem real de Auto (texto corrido, não o gerador) classifica como amplitude-auto', () => {
    const r = classificarDominio('Bom dia, segue o orçamento da oficina Rio Bonito pro veículo do segurado Carlos Eduardo Matos Silva, placa QWE-4521, conserto do para-lama, valor total R$ 1.870,50.');
    assert.equal(r.dominio, 'amplitude-auto');
    assert.equal(r.motivo, 'ok');
  });

  testar('mensagem real de Saúde (texto corrido) classifica como amplitude-saude-empresarial', () => {
    const r = classificarDominio('Olá, envio o recibo da Clínica Vitalis. Beneficiária Ana Paula Ferreira Souza, procedimento consulta cardiológica, valor R$ 350,00.');
    assert.equal(r.dominio, 'amplitude-saude-empresarial');
    assert.equal(r.motivo, 'ok');
  });

  testar('mensagem de Atendimento ao Cliente (fora do escopo) não vira nenhum dos dois domínios', () => {
    const r = classificarDominio('Preciso contestar a negativa de cobertura do meu sinistro, acho que não foi avaliado corretamente, quero abrir uma reclamação.');
    assert.equal(r.dominio, null);
    assert.equal(r.motivo, 'fora_do_escopo');
  });

  testar('mensagem com vocabulário dos dois domínios ao mesmo tempo é sinalizada como ambígua, não decidida no chute', () => {
    const r = classificarDominio('Preciso de ajuda com meu caso: tem uma questão de placa do veículo e também um procedimento de exame envolvido.');
    assert.equal(r.dominio, null);
    assert.equal(r.motivo, 'ambiguo');
    assert.ok(r.scoreAuto > 0 && r.scoreSaude > 0 && r.scoreAuto === r.scoreSaude);
  });

  testar('avaliarConsistenciaDeValores rejeita valor não numérico (achado real: virava "R$ NaN" apresentado como sucesso)', () => {
    const r = avaliarConsistenciaDeValores('amplitude-auto', { segurado: 'X', placa: 'Y', valor: 'não informado' });
    assert.equal(r.valido, false);
    assert.ok(r.problemas.some((p) => p.includes('valor')));
  });

  testar('avaliarConsistenciaDeValores aceita campos válidos', () => {
    const r = avaliarConsistenciaDeValores('amplitude-auto', { segurado: 'X', placa: 'Y', valor: 1870.5 });
    assert.equal(r.valido, true);
    assert.equal(r.problemas.length, 0);
  });

  testar('formatarResposta produz confirmação em linguagem natural pra Auto', () => {
    const msg = formatarResposta('amplitude-auto', { segurado: 'Ana', placa: 'ABC-1234', valor: 1000 });
    assert.ok(msg.includes('Ana') && msg.includes('ABC-1234') && msg.includes('R$ 1.000,00'));
  });

  testar('formatarResposta produz confirmação em linguagem natural pra Saúde', () => {
    const msg = formatarResposta('amplitude-saude-empresarial', { beneficiario: 'Bruno', procedimento: 'consulta', valor: 250.5 });
    assert.ok(msg.includes('Bruno') && msg.includes('consulta') && msg.includes('R$ 250,50'));
  });

  await testarAsync('processarMensagem, caso fora do escopo, não chama o modelo (sem custo de API)', async () => {
    const r = await processarMensagem('Quero contestar a negativa de cobertura do sinistro, isso é uma reclamação.');
    assert.equal(r.tipo, 'fora_do_escopo');
  });

  await testarAsync('processarMensagem, caso ambíguo, não chama o modelo (sem custo de API)', async () => {
    const r = await processarMensagem('Preciso de ajuda com meu caso: tem uma questão de placa do veículo e também um procedimento de exame envolvido.');
    assert.equal(r.tipo, 'ambiguo');
  });

  await testarAsync('processarMensagem, caso real de Auto, chama o endpoint de verdade e devolve confirmação válida', async () => {
    const r = await processarMensagem('Segue orçamento da Oficina Boa Vista: segurado Ricardo Alves Monteiro, placa JBR-9021, valor do reparo R$ 2.820,00.');
    assert.equal(r.tipo, 'sucesso');
    assert.equal(r.classificacao.dominio, 'amplitude-auto');
    assert.ok(r.mensagem.includes('Ricardo Alves Monteiro'));
  });

  await testarAsync('processarMensagem, JSON malformado (chave de fechamento ausente) vira schema_invalido, não sucesso silencioso', async () => {
    const r = await processarMensagem(
      'Segue orçamento da Oficina Boa Vista: segurado João Silva, placa ABC-1234, valor do reparo R$ 100,00.',
      { chamarNuvemFn: async () => '{"segurado":"João Silva","placa":"ABC-1234","valor":100' }
    );
    assert.equal(r.tipo, 'schema_invalido');
    assert.equal(r.schema.valido, false);
    assert.ok(r.schema.motivo.includes('JSON'), `motivo esperado mencionar JSON, veio "${r.schema.motivo}"`);
  });

  await testarAsync('chamarModelo roteia pro caminho local (nunca a nuvem) quando opcoes.local=true', async () => {
    let chamouLocal = false;
    let chamouNuvem = false;
    const resultado = await chamarModelo('amplitude-auto', 'texto qualquer', {
      local: true,
      chamarLocalFn: async () => { chamouLocal = true; return 'resposta local'; },
      chamarNuvemFn: async () => { chamouNuvem = true; return 'resposta nuvem'; },
    });
    assert.equal(chamouLocal, true, 'esperava que o caminho local fosse chamado');
    assert.equal(chamouNuvem, false, 'não esperava que o caminho de nuvem fosse chamado');
    assert.equal(resultado, 'resposta local');
  });

  await testarAsync('chamarModelo roteia pra nuvem (nunca o local) quando opcoes.local está ausente/false', async () => {
    let chamouLocal = false;
    let chamouNuvem = false;
    const resultado = await chamarModelo('amplitude-auto', 'texto qualquer', {
      chamarLocalFn: async () => { chamouLocal = true; return 'resposta local'; },
      chamarNuvemFn: async () => { chamouNuvem = true; return 'resposta nuvem'; },
    });
    assert.equal(chamouLocal, false, 'não esperava que o caminho local fosse chamado');
    assert.equal(chamouNuvem, true, 'esperava que o caminho de nuvem fosse chamado');
    assert.equal(resultado, 'resposta nuvem');
  });

  console.log();
  console.log(
    `Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), `
    + `${testesComFalha} falhou(falharam).`
  );

  if (testesComFalha > 0) {
    throw new Error(`${testesComFalha} teste(s) falharam. A implementação não bate com a especificação.`);
  }
}

/* --------------------------------------------------------------------------
 * CLI
 * -------------------------------------------------------------------------- */

const FLAGS_CONHECIDAS = ['--local', '--skip-tests'];

async function main() {
  const argv = process.argv.slice(2);

  const flagDesconhecida = argv.find((a) => a.startsWith('--') && !FLAGS_CONHECIDAS.includes(a));
  if (flagDesconhecida) {
    console.error(`Flag desconhecida: "${flagDesconhecida}". Flags aceitas: ${FLAGS_CONHECIDAS.join(', ')}.`);
    console.error('Uso: node amplitude-seguros-assistente.js [--local] [--skip-tests] "<texto do usuário>"');
    process.exitCode = 1;
    return;
  }

  const local = argv.includes('--local');
  const skipTests = argv.includes('--skip-tests');
  const texto = argv.filter((a) => a !== '--local' && a !== '--skip-tests').join(' ');

  if (!skipTests) {
    await rodarTestes();
  }

  if (!texto) {
    console.log('\nUso: node amplitude-seguros-assistente.js [--local] [--skip-tests] "<texto do usuário>"');
    return;
  }

  console.log(`\n== Processando mensagem ==`);
  console.log(`Entrada: "${texto}"\n`);
  const resultado = await processarMensagem(texto, { local });
  const modeloUsado = (resultado.tipo === 'fora_do_escopo' || resultado.tipo === 'ambiguo')
    ? 'nenhum modelo chamado, filtro de classificação'
    : (local ? 'modelo local' : 'Vertex AI');
  console.log(`[${resultado.tipo}] (${modeloUsado}) ${resultado.mensagem}`);
}

if (require.main === module) {
  main().catch((erro) => {
    console.error(`\nErro: ${erro.message}`);
    if (process.argv.includes('--local')) {
      console.error('Verifique o checkpoint MLX (rode colab-local-model-notebook.ipynb até o Passo 4, ou treine com mlx_lm lora), a instalação do mlx-lm, e se python3 está no PATH.');
    } else {
      console.error('Verifique a autenticação (gcloud auth login) e a conexão de rede, e tente de novo.');
    }
    if (process.env.DEBUG) {
      console.error(erro.stack);
    }
    process.exitCode = 1;
  });
}

module.exports = {
  classificarDominio,
  formatarMoeda,
  formatarResposta,
  avaliarConsistenciaDeValores,
  processarMensagem,
};

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
