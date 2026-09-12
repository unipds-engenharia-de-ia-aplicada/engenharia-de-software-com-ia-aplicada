/**
 * Ahirton Lopes · Fine-Tuning Toolkit
 * Artefato de Demo - Módulo 5.4 (alternativa em JavaScript)
 *
 * MESMA avaliacao do avaliacao_modelo_local_tool.py, pelo caminho
 * alternativo: em vez da API Python do mlx_lm (que carrega o modelo uma
 * vez e roda as 11 avaliacoes no mesmo processo), este arquivo chama o
 * CLI de geracao do mlx_lm via subprocesso -- `python3 -m mlx_lm
 * generate` -- o mesmo padrao que o Modulo 4.2 usou pra disparar o
 * treino a partir do JavaScript.
 *
 * A limitacao que faz a versao Python ser a demo principal fica visivel
 * aqui de proposito: cada chamada do CLI recarrega o modelo inteiro
 * (~10 GB) do zero, entao as 11 avaliacoes pagam 11 carregamentos. O
 * tempo de cada chamada e impresso na tela pra mostrar esse custo. O
 * resultado da avaliacao (schema, precisao) e o MESMO nos dois
 * caminhos, mesma vara de medir do Modulo 5.1.
 *
 * Uso: node avaliacao-modelo-local-tool.js
 */

'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const harness = require(path.join(__dirname, 'model-evaluation-harness-tool.js'));

const MODELO_BASE = 'mlx-community/gemma-4-e2b-it-bf16';
const ADAPTADOR = path.join(__dirname, '..', 'modulo-04-lora-e-peft', 'mlx-adapters'); // LoRA rank 8

/* --------------------------------------------------------------------------
 * Chamada do modelo local via CLI (subprocesso, recarrega o modelo por chamada)
 * -------------------------------------------------------------------------- */

function chamarModeloLocalViaCLI(exemplo) {
  const textoUsuario = `${exemplo.instrucao}\n\n${exemplo.entrada}`;
  // O CLI aplica o chat template do tokenizer sozinho ao --prompt, o mesmo
  // template que montar_prompt aplica na versao Python.
  const resultado = spawnSync('python3', [
    '-m', 'mlx_lm', 'generate',
    '--model', MODELO_BASE,
    '--adapter-path', ADAPTADOR,
    '--prompt', textoUsuario,
    '--max-tokens', '150',
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });

  if (resultado.status !== 0) {
    throw new Error(`CLI falhou (exit ${resultado.status}): ${resultado.stderr.slice(0, 400)}`);
  }
  // Saida do CLI: a geracao vem entre duas linhas "==========".
  const partes = resultado.stdout.split('==========');
  if (partes.length < 3) {
    throw new Error(`saida do CLI em formato inesperado: ${resultado.stdout.slice(0, 400)}`);
  }
  return partes[1].trim();
}

/* --------------------------------------------------------------------------
 * Testes automatizados (sem carregar o modelo -- so a forma do conjunto)
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
  console.log('== Testes: reuso do conjunto de teste retido do Módulo 5.1 ==');

  testar('o mesmo conjunto retido do Módulo 5.1 (11 exemplos) está disponível pra reuso', () => {
    assert.equal(harness.gerarConjuntoTesteRetido().length, 11);
  });

  testar('adaptador LoRA rank 8 do Módulo 4.2 existe em disco', () => {
    assert.ok(fs.existsSync(ADAPTADOR), `adaptador não encontrado em ${ADAPTADOR}`);
  });

  console.log();
  console.log(`Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ${testesComFalha} falhou(falharam).`);
  if (testesComFalha > 0) {
    throw new Error(`${testesComFalha} teste(s) falharam. A implementação não bate com a especificação.`);
  }
}

/* --------------------------------------------------------------------------
 * Execucao principal -- 11 chamadas do CLI, 11 recarregamentos do modelo
 * -------------------------------------------------------------------------- */

function main() {
  rodarTestes();

  console.log();
  console.log(`== Avaliação real via CLI: ${MODELO_BASE} + adaptador LoRA rank 8, um subprocesso por exemplo ==`);
  const conjuntoTeste = harness.gerarConjuntoTesteRetido();
  console.log(`${conjuntoTeste.length} exemplos, os mesmos usados pra avaliar o modelo do Vertex AI, nunca vistos no treino.`);
  console.log('Cada chamada recarrega o modelo inteiro (~10 GB) -- o tempo impresso é o custo desse caminho.\n');

  let somaPrecisao = 0;
  let schemasValidos = 0;
  let sucessos = 0;
  const falhas = [];

  for (const exemplo of conjuntoTeste) {
    const inicio = Date.now();
    let textoResposta;
    try {
      textoResposta = chamarModeloLocalViaCLI(exemplo);
    } catch (erro) {
      console.log(`${exemplo.metadata.id}: [FALHOU] ${erro.message}`);
      falhas.push({ id: exemplo.metadata.id, erro: erro.message });
      continue;
    }
    const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

    const schema = harness.avaliarAdequacaoSchema(exemplo.metadata.caso, textoResposta);
    const precisao = schema.valido
      ? harness.avaliarPrecisaoPorCampo(exemplo.saida, schema.campos)
      : { precisao: 0, acertos: 0, total: Object.keys(exemplo.saida).length };

    if (schema.valido) schemasValidos += 1;
    somaPrecisao += precisao.precisao;
    sucessos += 1;

    console.log(
      `${exemplo.metadata.id}: schema ${schema.valido ? 'válido' : 'INVÁLIDO'}, ` +
      `precisão ${(precisao.precisao * 100).toFixed(0)}% (${precisao.acertos}/${precisao.total}) ` +
      `[${segundos}s, modelo recarregado]`
    );
  }

  if (falhas.length > 0) {
    console.log(`\n${falhas.length}/${conjuntoTeste.length} exemplo(s) falharam na geração local -- verifique o modelo/adaptador.`);
  }
  if (sucessos === 0) {
    throw new Error('Nenhum exemplo processado com sucesso -- verifique o modelo/adaptador local.');
  }

  console.log(`\nAdequação de schema: ${schemasValidos}/${sucessos}`);
  console.log(`Precisão média por campo: ${(somaPrecisao / sucessos * 100).toFixed(1)}%`);
  console.log();
  console.log('-----------------------------------------------------------------------------');
  console.log('Mesmo conjunto retido, mesma vara de medir, mesmo resultado da versão Python.');
  console.log('A diferença é o custo: aqui o modelo foi recarregado a cada exemplo. É por');
  console.log('isso que a demo principal deste módulo usa a API Python, que carrega uma vez só.');
  console.log('-----------------------------------------------------------------------------');
}

if (require.main === module) {
  try {
    main();
  } catch (erro) {
    console.error(`\nErro: ${erro.message}`);
    console.error('Verifique se o MLX-LM está instalado e se o modelo/adaptador estão acessíveis, e tente de novo.');
    if (process.env.DEBUG) {
      console.error(erro.stack);
    }
    process.exitCode = 1;
  }
}

/*
 * Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
 * Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
 */
