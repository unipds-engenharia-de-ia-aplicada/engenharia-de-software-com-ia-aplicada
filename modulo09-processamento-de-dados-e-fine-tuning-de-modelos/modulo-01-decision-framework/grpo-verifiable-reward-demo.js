/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 1.3 (cheatsheet, espécie 7: GRPO / RFT)
 *
 * Mecanismo real do GRPO (Group Relative Policy Optimization), o algoritmo
 * usado pelo DeepSeek-R1-Zero e pelo DeepSeek-R1 (DeepSeek-AI, arXiv
 * 2501.12948; fórmula original em DeepSeekMath, Shao et al., arXiv
 * 2402.03300), e o mesmo princípio por trás do Reinforcement Fine-Tuning
 * (RFT) da OpenAI (graders no lugar de recompensa rule-based).
 *
 * Este script NÃO treina nada: reproduz de verdade o pedaço do algoritmo
 * que manda o sinal de aprendizado (amostragem de grupo -> recompensa
 * verificável -> vantagem relativa ao grupo). A atualização de peso via
 * gradiente de política fica fora de escopo, de propósito -- o ponto
 * pedagógico é tornar tangível COMO o GRPO decide "reforçar" ou "penalizar"
 * cada resposta do grupo, não reproduzir um loop de RL inteiro.
 *
 * Chamadas reais ao Ollama local (nenhuma saída de modelo é inventada).
 * Uso: node grpo-verifiable-reward-demo.js
 */

'use strict';

const assert = require('assert').strict;

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODELO = 'gemma4:e2b';
const TAMANHO_GRUPO = 6; // G no paper original (DeepSeekMath usa G=64; aqui, G pequeno pra demo ao vivo)
const TEMPERATURA = 1.0;
const EPS = 1e-4; // guarda contra divisão por zero quando o grupo empata (std=0)

const DOCUMENTO_SINISTRO = `
Amplitude Seguros - Comunicado de Sinistro (documento digitalizado, OCR, scan parcialmente ilegivel)
Ref. anterior (cancelada): AS-2Q25-0988zi
Apolice vigente: A5-2026-1l44/7 (numero de dificil leitura no scan)
Segurado: M4rcos Vin1cius Alm3ida Te1xeira (OCR com ruido no nome)
Tipo de sinistro: Colisao veicular (ou possivelmente "Colisao e furto", trecho cortado)
Data do incidente: 12/O7/2026 ou 17/02/2026 (data ambigua, dois carimbos sobrepostos)
Valor estimado do reparo: R$ 8.45O,OO (sujeito a pericia, valor preliminar)
Status atual: Em analise pericial
`;

const PROMPT_SCHEMA = `Extraia os dados do documento abaixo e responda APENAS com um JSON
valido, sem nenhum texto adicional, seguindo exatamente este schema:
{"claimant_name": string, "claim_type": string, "incident_date": "DD/MM/AAAA",
"estimated_amount_brl": number, "status": string,
"prioridade": "alta se estimated_amount_brl > 5000, senao baixa"}

Documento:
${DOCUMENTO_SINISTRO}
`;

const GABARITO = {
  claimant_name: 'Marcos Vinícius Almeida Teixeira',
  claim_type: 'Colisao veicular',
  incident_date: '12/07/2026',
  estimated_amount_brl: 8450.0,
  status: 'Em analise pericial',
  prioridade: 'alta',
};

/* --------------------------------------------------------------------------
 * 1. Chamada real ao Ollama e extração/recompensa
 * -------------------------------------------------------------------------- */

async function chamarOllama(prompt, temperatura) {
  const resposta = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELO,
      prompt,
      stream: false,
      options: { temperature: temperatura },
    }),
  });
  if (!resposta.ok) {
    throw new Error(`Ollama respondeu ${resposta.status} ${resposta.statusText}`);
  }
  const dados = await resposta.json();
  return dados.response;
}

function extrairJson(texto) {
  const match = texto.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Recompensa mecanicamente checável: fração de campos exatamente corretos.
 * Esta é a peça que o GRPO e o RFT chamam de "grader" -- não há modelo de
 * recompensa aprendido aqui, só comparação direta contra o gabarito.
 */
function recompensaVerificavel(candidatoJson) {
  if (!candidatoJson) return 0.0;
  let acertos = 0;
  for (const [campo, esperado] of Object.entries(GABARITO)) {
    const obtido = candidatoJson[campo];
    if (typeof esperado === 'number') {
      const numObtido = Number(obtido);
      if (!Number.isNaN(numObtido) && Math.abs(numObtido - esperado) < 0.01) acertos += 1;
    } else if (String(obtido ?? '').trim().toLowerCase() === String(esperado).trim().toLowerCase()) {
      acertos += 1;
    }
  }
  return acertos / Object.keys(GABARITO).length;
}

/**
 * A_i = (r_i - média(r)) / desvio_padrao(r), o coração do GRPO: o próprio
 * grupo vira a linha de base, sem precisar de um modelo de valor (critic)
 * separado como no PPO clássico.
 */
function vantagemRelativaAoGrupo(recompensas) {
  const media = recompensas.reduce((a, b) => a + b, 0) / recompensas.length;
  const variancia = recompensas.reduce((soma, r) => soma + (r - media) ** 2, 0) / recompensas.length;
  const desvio = Math.sqrt(variancia);
  const desvioEfetivo = desvio > 0 ? desvio : EPS;
  const vantagens = recompensas.map((r) => (r - media) / desvioEfetivo);
  return { vantagens, media, desvio };
}

/* --------------------------------------------------------------------------
 * 2. Testes automatizados (partes determinísticas)
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
  console.log('== Testes: extração de JSON ==');

  testar('extrai JSON cercado de texto solto', () => {
    const resultado = extrairJson('texto antes {"a": 1, "b": 2} texto depois');
    assert.deepEqual(resultado, { a: 1, b: 2 });
  });

  testar('retorna null quando não há JSON', () => {
    assert.equal(extrairJson('isso nao tem json nenhum'), null);
  });

  testar('retorna null pra JSON malformado, não lança exceção', () => {
    assert.equal(extrairJson('{"a": invalido}'), null);
  });

  console.log();
  console.log('== Testes: recompensa verificável ==');

  testar('candidato idêntico ao gabarito recebe recompensa 1.0', () => {
    assert.equal(recompensaVerificavel(GABARITO), 1.0);
  });

  testar('candidato sem JSON válido recebe recompensa 0.0', () => {
    assert.equal(recompensaVerificavel(null), 0.0);
  });

  testar('um campo errado em seis reduz a recompensa proporcionalmente (5/6)', () => {
    const parcial = { ...GABARITO, status: 'campo errado' };
    assert.ok(Math.abs(recompensaVerificavel(parcial) - 5 / 6) < 1e-9);
  });

  testar('diferença de arredondamento (<0,01) no valor ainda conta como acerto', () => {
    const candidato = { ...GABARITO, estimated_amount_brl: 8450.001 };
    assert.equal(recompensaVerificavel(candidato), 1.0);
  });

  console.log();
  console.log('== Testes: vantagem relativa ao grupo (GRPO) ==');

  testar('grupo com variância real: melhor recompensa vira vantagem positiva, pior vira negativa', () => {
    const { vantagens, media } = vantagemRelativaAoGrupo([1.0, 0.5, 0.0]);
    assert.ok(Math.abs(media - 0.5) < 1e-9);
    assert.ok(vantagens[0] > 0 && vantagens[2] < 0);
    assert.ok(Math.abs(vantagens[1]) < 1e-9);
  });

  testar('grupo degenerado (todas as recompensas iguais) produz vantagem zero em todo mundo, sem dividir por zero', () => {
    const { vantagens, desvio } = vantagemRelativaAoGrupo([0.83, 0.83, 0.83, 0.83]);
    assert.equal(desvio, 0.0);
    assert.ok(vantagens.every((v) => v === 0.0));
  });

  testar('recompensas iguais dentro do grupo recebem exatamente a mesma vantagem', () => {
    const { vantagens } = vantagemRelativaAoGrupo([1.0, 1.0, 0.0, 0.0]);
    assert.equal(vantagens[0], vantagens[1]);
    assert.equal(vantagens[2], vantagens[3]);
    assert.ok(vantagens[0] > vantagens[2]);
  });

  console.log();
  console.log(`Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ${testesComFalha} falhou(falharam).`);
}

/* --------------------------------------------------------------------------
 * 3. Execução principal: amostragem real de grupo + cálculo real de vantagem
 * -------------------------------------------------------------------------- */

async function main() {
  rodarTestes();

  console.log();
  console.log("== Amostragem real de grupo (o passo que o GRPO chama de 'rollout') ==");
  console.log(`Modelo: ${MODELO}  |  tamanho do grupo G=${TAMANHO_GRUPO}  |  temperatura=${TEMPERATURA}`);
  console.log('Mesma pergunta, G respostas reais e independentes, geradas agora, sem cache.\n');

  try {
    await chamarOllama('teste de conexao', 0.1);
  } catch (erro) {
    console.log(`Não foi possível conectar ao Ollama local em ${OLLAMA_URL}: ${erro.message}`);
    console.log("Rode 'ollama serve' e confirme que o modelo 'gemma4:e2b' está disponível ('ollama list').");
    return;
  }

  const recompensas = [];
  for (let i = 0; i < TAMANHO_GRUPO; i += 1) {
    let bruto;
    try {
      bruto = await chamarOllama(PROMPT_SCHEMA, TEMPERATURA);
    } catch (erro) {
      console.log(`  [${i}] chamada ao Ollama falhou (${erro.message}) -- pulando esta amostra do grupo.`);
      continue;
    }
    const candidato = extrairJson(bruto);
    const r = recompensaVerificavel(candidato);
    recompensas.push(r);

    const divergencias = [];
    if (candidato) {
      for (const [campo, esperado] of Object.entries(GABARITO)) {
        const obtido = candidato[campo];
        let bate;
        if (typeof esperado === 'number') {
          const numObtido = Number(obtido);
          bate = !Number.isNaN(numObtido) && Math.abs(numObtido - esperado) < 0.01;
        } else {
          bate = String(obtido ?? '').trim().toLowerCase() === String(esperado).trim().toLowerCase();
        }
        if (!bate) {
          divergencias.push(`${campo}=${JSON.stringify(obtido)} (gabarito=${JSON.stringify(esperado)})`);
        }
      }
    }
    console.log(`  [${i}] recompensa=${r.toFixed(2)}  json_valido=${candidato !== null}  divergencias=${JSON.stringify(divergencias)}`);
  }

  if (recompensas.length === 0) {
    console.log('\nNenhuma amostra completou (todas as chamadas ao Ollama falharam) -- sem grupo pra calcular vantagem.');
    return;
  }

  const { vantagens, media, desvio } = vantagemRelativaAoGrupo(recompensas);

  console.log(`\nGrupo completo: media(r)=${media.toFixed(3)}  desvio_padrao(r)=${desvio.toFixed(3)}`);

  if (desvio === 0.0) {
    console.log();
    console.log('GRUPO DEGENERADO: todas as G respostas receberam a mesma recompensa.');
    console.log('Isso NÃO é um bug deste script -- é um limite real e documentado do GRPO:');
    console.log('quando o grupo inteiro acerta (ou erra) igual, a vantagem de todo mundo');
    console.log('vira zero e o sinal de aprendizado desaparece nessa rodada. O paper DAPO');
    console.log('(Yu et al., arXiv 2503.14476) descreve exatamente esse caso e propõe');
    console.log("'amostragem dinâmica' como correção: descartar grupos unânimes e");
    console.log('re-amostrar até achar um grupo com variância real.');
  } else {
    console.log();
    console.log(`${'i'.padStart(2)}  ${'recompensa'.padStart(10)}  ${'vantagem A_i'.padStart(13)}  interpretação`);
    console.log('-'.repeat(74));
    recompensas.forEach((r, i) => {
      const a = vantagens[i];
      let tag;
      if (a > 0) tag = 'reforçaria essa resposta (A>0)';
      else if (a < 0) tag = 'penalizaria essa resposta (A<0)';
      else tag = 'neutro (A=0)';
      console.log(`${String(i).padStart(2)}  ${r.toFixed(2).padStart(10)}  ${a.toFixed(3).padStart(13)}  ${tag}`);
    });
  }

  console.log();
  console.log('A_i = (r_i - média(r)) / desvio_padrão(r) é o sinal que o GRPO usa pra');
  console.log('atualizar a política -- o próprio grupo vira a linha de base, sem precisar');
  console.log('de um modelo de valor (critic) separado como no PPO/RLHF clássico.');
  console.log('Nenhum peso do modelo foi atualizado por este script -- fim do demo.');
}

main().catch((erro) => {
  console.error('Erro inesperado:', erro);
  process.exitCode = 1;
});

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
