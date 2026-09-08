/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 4.2
 *
 * Converte o mesmo dataset real de 200 exemplos que o Módulo 3.2 subiu pro
 * Vertex AI (formato Gemini: contents/role/parts) pro formato que o MLX-LM
 * espera (messages: role/content), divide em train/valid/test, valida
 * hiperparâmetros antes de qualquer treino, e orquestra o processo local
 * mlx_lm.lora via child_process -- o equivalente, em treino local, à
 * chamada de rede que o Módulo 3.2 fez contra a API do Vertex AI. Aqui não
 * tem rede nenhuma: o "provedor" é a própria máquina.
 *
 * Uso: node local-lora-training-tool.js
 *
 * Par oficial desta disciplina: local-lora-training-tool.js (oficial) /
 * local_lora_training_tool.py (referência espelhada).
 */

'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DATASET_ORIGEM = path.join(__dirname, '..', 'modulo-03-fine-tuning-via-api', 'dataset-treinado.jsonl');
const DIR_DADOS_MLX = path.join(__dirname, 'mlx-data');

/* ============================================================================
 * 1. Conversão: formato Gemini (Módulo 3) -> formato MLX-LM (messages)
 * ========================================================================= */

function converterExemploParaMensagens(exemploGemini) {
  const turnoUsuario = exemploGemini.contents.find((c) => c.role === 'user');
  const turnoModelo = exemploGemini.contents.find((c) => c.role === 'model');
  if (!turnoUsuario || !turnoModelo) {
    throw new Error('exemplo incompleto: precisa de um turno "user" e um turno "model"');
  }
  return {
    messages: [
      { role: 'user', content: turnoUsuario.parts[0].text },
      { role: 'assistant', content: turnoModelo.parts[0].text },
    ],
  };
}

function extrairNomeEntidade(exemploMlx) {
  const turnoModelo = exemploMlx.messages[1];
  if (!turnoModelo) return null;
  try {
    const saida = JSON.parse(turnoModelo.content);
    return saida.segurado || saida.beneficiario || null;
  } catch {
    return null;
  }
}

/**
 * Divide a lista de exemplos em train/valid/test por proporção fixa,
 * agrupando por entidade (segurado/beneficiário) antes de dividir --
 * corrige vazamento real encontrado em 31/08: o dataset de origem tem só
 * vinte e oito pessoas sintéticas distintas nos duzentos exemplos, cada
 * uma repetida em vários templates de documento (até onze vezes a mesma
 * pessoa). Um corte sequencial simples deixava a mesma pessoa aparecer no
 * treino E no teste, só com cabeçalho de oficina/clínica diferente --
 * "exemplo nunca visto no treino" não era estritamente verdade no nível
 * de conteúdo. Determinístico (sem aleatoriedade, preservando a
 * reprodutibilidade que a versão anterior já buscava): ordena entidades
 * por contagem crescente, desempate alfabético, preenche teste primeiro,
 * depois validação, resto treino -- nenhuma entidade fica partida entre
 * splits.
 */
function dividirTrainValidTest(exemplos, proporcaoValid = 0.15, proporcaoTest = 0.05) {
  const n = exemplos.length;
  const nValid = Math.round(n * proporcaoValid);
  const nTest = Math.round(n * proporcaoTest);

  const grupos = new Map();
  const semEntidade = [];
  for (const ex of exemplos) {
    const nome = extrairNomeEntidade(ex);
    if (nome === null) {
      semEntidade.push(ex);
      continue;
    }
    if (!grupos.has(nome)) grupos.set(nome, []);
    grupos.get(nome).push(ex);
  }

  const entidadesOrdenadas = [...grupos.entries()].sort((a, b) => {
    if (a[1].length !== b[1].length) return a[1].length - b[1].length;
    return a[0].localeCompare(b[0]);
  });

  const test = [];
  const valid = [];
  const train = [];
  for (const [, grupo] of entidadesOrdenadas) {
    if (test.length < nTest) {
      test.push(...grupo);
    } else if (valid.length < nValid) {
      valid.push(...grupo);
    } else {
      train.push(...grupo);
    }
  }
  train.push(...semEntidade);

  return { train, valid, test };
}

function prepararDadosMlx(caminhoDatasetOrigem, dirSaida) {
  const linhas = fs.readFileSync(caminhoDatasetOrigem, 'utf8').trim().split('\n');
  const exemplosGemini = linhas.map((l) => JSON.parse(l));
  const exemplosMlx = exemplosGemini.map(converterExemploParaMensagens);
  const { train, valid, test } = dividirTrainValidTest(exemplosMlx);

  fs.mkdirSync(dirSaida, { recursive: true });
  const escrever = (nome, exemplos) => {
    const conteudo = exemplos.map((e) => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(path.join(dirSaida, nome), conteudo);
  };
  escrever('train.jsonl', train);
  escrever('valid.jsonl', valid);
  escrever('test.jsonl', test);

  return { total: exemplosMlx.length, train: train.length, valid: valid.length, test: test.length };
}

/* ============================================================================
 * 2. Validação de hiperparâmetros (mesma disciplina do Módulo 3.3, aplicada
 *    aos hiperparâmetros específicos de LoRA local, antes de qualquer
 *    processo ser criado)
 * ========================================================================= */

function validarHiperparametrosLora(config) {
  const erros = [];
  if (!Number.isInteger(config.iters) || config.iters <= 0) {
    erros.push('iters precisa ser um inteiro positivo');
  }
  if (!Number.isInteger(config.batchSize) || config.batchSize <= 0) {
    erros.push('batchSize precisa ser um inteiro positivo');
  }
  if (typeof config.learningRate !== 'number' || config.learningRate <= 0 || config.learningRate > 1) {
    erros.push('learningRate precisa estar entre 0 (exclusivo) e 1');
  }
  if (!['lora', 'full'].includes(config.fineTuneType)) {
    erros.push('fineTuneType precisa ser "lora" ou "full"');
  }
  return { valido: erros.length === 0, erros };
}

/* ============================================================================
 * 3. Orquestração: monta o comando e roda mlx_lm.lora local via
 *    child_process, igual em espírito à chamada de rede do Módulo 3.2 --
 *    só que aqui o "provedor" é a própria máquina, sem chamada de API
 * ========================================================================= */

function montarArgumentosLora(config) {
  return [
    '-m', 'mlx_lm', 'lora',
    '--model', config.model,
    '--train',
    '--data', config.dataDir,
    '--fine-tune-type', config.fineTuneType,
    '--iters', String(config.iters),
    '--batch-size', String(config.batchSize),
    '--learning-rate', String(config.learningRate),
    '--adapter-path', config.adapterPath,
  ];
}

/**
 * Extrai as linhas "Iter N: Val loss X" e "Iter N: Train loss X" da saída
 * real do mlx_lm.lora. Função pura, testável sem rodar o processo de
 * verdade -- mesmo padrão de injeção de dependência do Módulo 3.4, só que
 * aqui a "dependência" é o parser do texto, não uma função de rede.
 */
function extrairMetricas(textoSaida) {
  const iteracoes = [];
  const regexValLoss = /Iter (\d+): Val loss ([\d.]+)/g;
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = regexValLoss.exec(textoSaida)) !== null) {
    iteracoes.push({ iter: Number(m[1]), valLoss: Number(m[2]) });
  }
  return iteracoes;
}

/**
 * Recebe a lista de {iter, valLoss} que extrairMetricas devolve e
 * diagnostica onde está a melhor iteração (menor val loss, a escolha que
 * early stopping faria), se o treino parou cedo demais (val loss ainda
 * caindo forte no último ponto medido, sinal de subtreino) ou tarde demais
 * (val loss subiu em relação ao mínimo, sinal de overfitting).
 */
function analisarCurvaConvergencia(metricas, limiarPlatô = 0.03) {
  if (metricas.length < 2) {
    throw new Error('precisa de pelo menos 2 pontos pra analisar convergência');
  }
  const ordenado = [...metricas].sort((a, b) => a.iter - b.iter);
  const melhor = ordenado.reduce((min, m) => (m.valLoss < min.valLoss ? m : min));
  const penultimo = ordenado[ordenado.length - 2];
  const ultimo = ordenado[ordenado.length - 1];
  const quedaRelativaFinal = (penultimo.valLoss - ultimo.valLoss) / penultimo.valLoss;
  return {
    melhorIteracao: melhor.iter,
    melhorValLoss: melhor.valLoss,
    quedaRelativaFinal,
    aindaCaindoForte: quedaRelativaFinal > limiarPlatô,
    sinalDeOverfitting: ultimo.valLoss > melhor.valLoss * (1 + limiarPlatô) && melhor.iter !== ultimo.iter,
  };
}

/**
 * Roda o processo local de verdade, spawnFn injetável pra permitir teste
 * sem executar treino real (default: child_process.spawn real).
 */
function rodarTreinoLocal(config, aoReceberLinha = () => {}, spawnFn = spawn) {
  return new Promise((resolve, reject) => {
    const args = montarArgumentosLora(config);
    const processo = spawnFn(config.pythonBin, args, { cwd: config.cwd });
    let saidaCompleta = '';

    processo.stdout.on('data', (chunk) => {
      const texto = chunk.toString();
      saidaCompleta += texto;
      aoReceberLinha(texto);
    });
    processo.stderr.on('data', (chunk) => {
      const texto = chunk.toString();
      saidaCompleta += texto;
      aoReceberLinha(texto);
    });
    processo.on('close', (codigo) => {
      if (codigo !== 0) {
        reject(new Error(`mlx_lm.lora saiu com código ${codigo}`));
        return;
      }
      resolve({ saidaCompleta, metricas: extrairMetricas(saidaCompleta) });
    });
    processo.on('error', reject);
  });
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
  console.log('== Testes: conversão Gemini -> messages ==');

  testar('converte um exemplo com turno user e model pro formato messages', () => {
    const exemplo = {
      contents: [
        { role: 'user', parts: [{ text: 'pergunta' }] },
        { role: 'model', parts: [{ text: 'resposta' }] },
      ],
    };
    const convertido = converterExemploParaMensagens(exemplo);
    assert.deepEqual(convertido, {
      messages: [
        { role: 'user', content: 'pergunta' },
        { role: 'assistant', content: 'resposta' },
      ],
    });
  });

  testar('rejeita exemplo sem turno "model"', () => {
    assert.throws(() => converterExemploParaMensagens({ contents: [{ role: 'user', parts: [{ text: 'x' }] }] }));
  });

  console.log();
  console.log('== Testes: divisão train/valid/test ==');

  testar('divide 200 exemplos de entidades únicas em proporção 80/15/5 sem perder nenhum', () => {
    const exemplos = Array.from({ length: 200 }, (_, i) => ({
      messages: [{ role: 'user', content: `ex${i}` }, { role: 'assistant', content: JSON.stringify({ segurado: `Pessoa ${i}`, placa: 'ABC-1234', valor: 100 }) }],
    }));
    const { train, valid, test } = dividirTrainValidTest(exemplos);
    assert.equal(train.length + valid.length + test.length, 200);
    assert.equal(valid.length, 30);
    assert.equal(test.length, 10);
    assert.equal(train.length, 160);
  });

  testar('nenhuma entidade fica partida entre splits, mesmo quando repete muitas vezes', () => {
    const exemplos = [];
    for (let p = 0; p < 20; p += 1) {
      const repeticoes = p < 5 ? 11 : 3;
      for (let r = 0; r < repeticoes; r += 1) {
        exemplos.push({
          messages: [
            { role: 'user', content: `ex${p}-${r}` },
            { role: 'assistant', content: JSON.stringify({ segurado: `Pessoa ${p}`, placa: 'ABC-1234', valor: 100 }) },
          ],
        });
      }
    }
    const { train, valid, test } = dividirTrainValidTest(exemplos);
    const nomeDoSplit = (msgs) => JSON.parse(msgs.messages[1].content).segurado;
    const splitPorNome = new Map();
    for (const [rotulo, lista] of [['train', train], ['valid', valid], ['test', test]]) {
      for (const ex of lista) {
        const nome = nomeDoSplit(ex);
        if (splitPorNome.has(nome)) {
          assert.equal(splitPorNome.get(nome), rotulo, `${nome} apareceu em mais de um split`);
        } else {
          splitPorNome.set(nome, rotulo);
        }
      }
    }
  });

  testar('a divisão é determinística: mesma entrada, mesma saída, sem embaralhar', () => {
    const exemplos = Array.from({ length: 20 }, (_, i) => ({
      messages: [{ role: 'user', content: `ex${i}` }, { role: 'assistant', content: JSON.stringify({ segurado: `Pessoa ${i}`, placa: 'ABC-1234', valor: 100 }) }],
    }));
    const r1 = dividirTrainValidTest(exemplos);
    const r2 = dividirTrainValidTest(exemplos);
    assert.deepEqual(r1, r2);
  });

  console.log();
  console.log('== Testes: validação de hiperparâmetros ==');

  testar('config válida passa sem erro', () => {
    const r = validarHiperparametrosLora({
      iters: 20, batchSize: 1, learningRate: 1e-5, fineTuneType: 'lora',
    });
    assert.equal(r.valido, true);
    assert.deepEqual(r.erros, []);
  });

  testar('iters zero ou negativo é rejeitado', () => {
    const r = validarHiperparametrosLora({
      iters: 0, batchSize: 1, learningRate: 1e-5, fineTuneType: 'lora',
    });
    assert.equal(r.valido, false);
    assert.ok(r.erros.some((e) => e.includes('iters')));
  });

  testar('learningRate fora de (0, 1] é rejeitado', () => {
    const r = validarHiperparametrosLora({
      iters: 20, batchSize: 1, learningRate: 1.5, fineTuneType: 'lora',
    });
    assert.equal(r.valido, false);
    assert.ok(r.erros.some((e) => e.includes('learningRate')));
  });

  testar('fineTuneType fora da lista permitida é rejeitado', () => {
    const r = validarHiperparametrosLora({
      iters: 20, batchSize: 1, learningRate: 1e-5, fineTuneType: 'qlora-turbo',
    });
    assert.equal(r.valido, false);
    assert.ok(r.erros.some((e) => e.includes('fineTuneType')));
  });

  console.log();
  console.log('== Testes: extração de métricas da saída real do processo ==');

  testar('extrai val loss de uma saída real de mlx_lm.lora, múltiplas iterações', () => {
    const saidaFake = [
      'Trainable parameters: 0.147% (6.816M/4628.569M)',
      'Iter 1: Val loss 4.839, Val took 12.3s',
      'Iter 10: Val loss 1.204, Val took 11.9s',
      'Iter 20: Val loss 0.380, Val took 12.1s',
    ].join('\n');
    const metricas = extrairMetricas(saidaFake);
    assert.equal(metricas.length, 3);
    assert.deepEqual(metricas[0], { iter: 1, valLoss: 4.839 });
    assert.deepEqual(metricas[2], { iter: 20, valLoss: 0.380 });
  });

  testar('saída sem nenhuma linha de val loss retorna lista vazia, não erro', () => {
    const metricas = extrairMetricas('nenhuma métrica aqui');
    assert.deepEqual(metricas, []);
  });

  console.log();
  console.log('== Testes: orquestração do processo (com processo falso injetado) ==');

  await testarAsync('rodarTreinoLocal resolve com métricas quando o processo falso termina com código 0', async () => {
    const EventEmitter = require('events');
    function spawnFalso() {
      const proc = new EventEmitter();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      setImmediate(() => {
        proc.stdout.emit('data', Buffer.from('Iter 1: Val loss 4.839\n'));
        proc.stdout.emit('data', Buffer.from('Iter 20: Val loss 0.380\n'));
        proc.emit('close', 0);
      });
      return proc;
    }
    const resultado = await rodarTreinoLocal(
      {
        pythonBin: 'python3', model: 'x', dataDir: 'y', fineTuneType: 'lora', iters: 20, batchSize: 1, learningRate: 1e-5, adapterPath: 'z', cwd: '.',
      },
      () => {},
      spawnFalso
    );
    assert.equal(resultado.metricas.length, 2);
    assert.equal(resultado.metricas[1].valLoss, 0.380);
  });

  await testarAsync('rodarTreinoLocal rejeita quando o processo falso termina com código diferente de 0', async () => {
    const EventEmitter = require('events');
    function spawnFalsoComErro() {
      const proc = new EventEmitter();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      setImmediate(() => proc.emit('close', 1));
      return proc;
    }
    await assert.rejects(() => rodarTreinoLocal(
      {
        pythonBin: 'python3', model: 'x', dataDir: 'y', fineTuneType: 'lora', iters: 20, batchSize: 1, learningRate: 1e-5, adapterPath: 'z', cwd: '.',
      },
      () => {},
      spawnFalsoComErro
    ));
  });

  console.log();
  console.log('== Testes: análise da curva de convergência ==');

  testar('20 iterações (o treino real deste módulo): ainda caindo forte, sem overfitting, é subtreino', () => {
    // curva real do treino de 20 iterações deste módulo (mlx_lm.lora, steps-per-eval 5)
    const curva20Iters = [
      { iter: 1, valLoss: 4.752 },
      { iter: 5, valLoss: 2.923 },
      { iter: 10, valLoss: 1.567 },
      { iter: 15, valLoss: 1.173 },
      { iter: 20, valLoss: 0.907 },
    ];
    const r = analisarCurvaConvergencia(curva20Iters);
    assert.equal(r.melhorIteracao, 20);
    assert.equal(r.aindaCaindoForte, true, 'val loss caiu mais de 22% entre iter 15 e 20, isso é subtreino, não convergência');
    assert.equal(r.sinalDeOverfitting, false);
  });

  testar('120 iterações (mesmo treino, estendido): melhor iteração em 90, overfitting a partir de 100', () => {
    // mesmo treino, estendido pra 120 iterações real (steps-per-eval 10)
    const curva120Iters = [
      { iter: 1, valLoss: 4.752 },
      { iter: 10, valLoss: 1.533 },
      { iter: 20, valLoss: 0.916 },
      { iter: 30, valLoss: 0.687 },
      { iter: 40, valLoss: 0.624 },
      { iter: 50, valLoss: 0.536 },
      { iter: 60, valLoss: 0.553 },
      { iter: 70, valLoss: 0.513 },
      { iter: 80, valLoss: 0.504 },
      { iter: 90, valLoss: 0.474 },
      { iter: 100, valLoss: 0.485 },
      { iter: 110, valLoss: 0.496 },
      { iter: 120, valLoss: 0.520 },
    ];
    const r = analisarCurvaConvergencia(curva120Iters);
    assert.equal(r.melhorIteracao, 90, 'iter 90 tem o menor val loss (0,474), não a última iteração');
    assert.equal(r.aindaCaindoForte, false, 'entre iter 110 e 120 o val loss piorou, não é mais queda forte');
    assert.equal(r.sinalDeOverfitting, true, 'val loss em 120 (0,520) já é pior que o mínimo em 90 (0,474)');
  });

  testar('rejeita análise com menos de 2 pontos', () => {
    assert.throws(() => analisarCurvaConvergencia([{ iter: 1, valLoss: 1.0 }]));
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
 * Demo: preparar dados de verdade a partir do dataset real do Módulo 3
 * -------------------------------------------------------------------------- */

function rodarPreparacaoDeVerdade() {
  console.log();
  console.log('===== Preparando dados reais pro treino local (a partir do dataset do Módulo 3) =====\n');
  const stats = prepararDadosMlx(DATASET_ORIGEM, DIR_DADOS_MLX);
  console.log(`Dataset de origem: ${DATASET_ORIGEM}`);
  console.log(`Total de exemplos: ${stats.total}`);
  console.log(`  train.jsonl: ${stats.train} exemplos`);
  console.log(`  valid.jsonl: ${stats.valid} exemplos`);
  console.log(`  test.jsonl:  ${stats.test} exemplos`);
  console.log(`Escrito em: ${DIR_DADOS_MLX}`);
  return stats;
}

/* --------------------------------------------------------------------------
 * Demo: curva de convergência de verdade -- a mesma configuração deste
 * módulo, repetida com iters=20 (val loss final 0,895 na tela do vídeo,
 * 0,907 nesta repetição -- ruído normal entre corridas) e, pra comparação,
 * estendida pra iters=120 com steps-per-eval mais fino. Números reais,
 * capturados rodando `python3 -m mlx_lm lora` de verdade nesta máquina.
 * -------------------------------------------------------------------------- */

function rodarDemoCurvaConvergencia() {
  console.log();
  console.log('===== Curva de convergência: o treino de 20 iterações ainda estava caindo? =====\n');

  const curva20Iters = [
    { iter: 1, valLoss: 4.752 },
    { iter: 5, valLoss: 2.923 },
    { iter: 10, valLoss: 1.567 },
    { iter: 15, valLoss: 1.173 },
    { iter: 20, valLoss: 0.907 },
  ];
  const analise20 = analisarCurvaConvergencia(curva20Iters);
  console.log('Repetição das 20 iterações originais (val loss final 0,895 na tela do vídeo, 0,907 aqui -- ruído normal):');
  curva20Iters.forEach((m) => console.log(`  Iter ${String(m.iter).padStart(2)}: val loss ${m.valLoss.toFixed(3)}`));
  console.log(`  -> melhor iteração: ${analise20.melhorIteracao} (val loss ${analise20.melhorValLoss.toFixed(3)})`);
  console.log(`  -> queda relativa entre os 2 últimos pontos medidos: ${(analise20.quedaRelativaFinal * 100).toFixed(1)}%`);
  console.log(`  -> ainda caindo forte? ${analise20.aindaCaindoForte}  (limiar: 3%)`);
  console.log(`  -> sinal de overfitting? ${analise20.sinalDeOverfitting}`);

  console.log();
  console.log('Mesmo treino, estendido pra 120 iterações (pra ver o que 20 iterações não mostra):');
  const curva120Iters = [
    { iter: 1, valLoss: 4.752 },
    { iter: 10, valLoss: 1.533 },
    { iter: 20, valLoss: 0.916 },
    { iter: 30, valLoss: 0.687 },
    { iter: 40, valLoss: 0.624 },
    { iter: 50, valLoss: 0.536 },
    { iter: 60, valLoss: 0.553 },
    { iter: 70, valLoss: 0.513 },
    { iter: 80, valLoss: 0.504 },
    { iter: 90, valLoss: 0.474 },
    { iter: 100, valLoss: 0.485 },
    { iter: 110, valLoss: 0.496 },
    { iter: 120, valLoss: 0.520 },
  ];
  const analise120 = analisarCurvaConvergencia(curva120Iters);
  curva120Iters.forEach((m) => console.log(`  Iter ${String(m.iter).padStart(3)}: val loss ${m.valLoss.toFixed(3)}`));
  console.log(`  -> melhor iteração: ${analise120.melhorIteracao} (val loss ${analise120.melhorValLoss.toFixed(3)})`);
  console.log(`  -> queda relativa entre os 2 últimos pontos medidos: ${(analise120.quedaRelativaFinal * 100).toFixed(1)}%`);
  console.log(`  -> ainda caindo forte? ${analise120.aindaCaindoForte}  (limiar: 3%)`);
  console.log(`  -> sinal de overfitting? ${analise120.sinalDeOverfitting}`);
  console.log();
  console.log(
    'Conclusão: em iters=20 o val loss ainda estava caindo mais de 20% a cada 5 iterações -- '
    + 'não é convergência, é subtreino, o treino parou antes de terminar de aprender. Estendendo '
    + 'pra 120 iterações, o val loss melhora até a iteração 90, e as iterações 100 a 120 já '
    + 'mostram sinal de piora (early stopping pararia em 90, não em 120).'
  );
  return { analise20Iters: analise20, analise120Iters: analise120 };
}

if (require.main === module) {
  rodarTestes()
    .then(() => rodarPreparacaoDeVerdade())
    .then(() => rodarDemoCurvaConvergencia())
    .catch((erro) => {
      console.error(erro);
      process.exit(1);
    });
}

module.exports = {
  converterExemploParaMensagens,
  dividirTrainValidTest,
  prepararDadosMlx,
  validarHiperparametrosLora,
  montarArgumentosLora,
  extrairMetricas,
  analisarCurvaConvergencia,
  rodarTreinoLocal,
};

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
