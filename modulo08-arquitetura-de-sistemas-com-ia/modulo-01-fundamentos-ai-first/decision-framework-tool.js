/**
 * Ahirton Lopes · AI Architecture Toolkit
 * Artefato de Demo - Módulo 1.3
 *
 * Ferramenta: Checklist de Framework de Decisão de Três Perguntas, em código.
 * Referência: decision-framework-checklist.md (mesma pasta).
 *
 * Isso é lógica pura, 100% determinística: três perguntas booleanas viram uma
 * árvore de decisão simples, sem IA, sem modelo, sem chamada de rede nenhuma.
 * É o contraste pedagógico do módulo: quando a decisão é auditável e finita,
 * ela vira código com confiança total. Compare com o protótipo do Módulo 2.5
 * (react-agent-prototype.js), onde a decisão depende de julgamento de
 * linguagem natural e por isso não dá pra reduzir a uma árvore assim.
 *
 * Uso: node decision-framework-tool.js
 * Roda os testes automatizados e depois a demo, ambos no terminal.
 *
 * Mesmo padrão de nomenclatura dos outros protótipos da disciplina: este é o
 * par decision-framework-tool.js / decision_framework_tool.py. Esta versão em
 * JavaScript é a oficial da disciplina; a versão em Python é material de
 * referência espelhado, mesmo padrão dos outros módulos.
 */

'use strict';

const assert = require('assert').strict;

// As quatro classificações possíveis, exatamente como o texto do checklist.
// Centralizadas aqui pra evitar divergência de string entre a lógica e os testes.
const CLASSIFICACAO = {
  REGRA_DETERMINISTICA: 'Regra determinística',
  APPROVAL_GATE: 'Agente com Approval Gate obrigatório',
  AGENTE_AUTONOMO: 'Agente autônomo, com observabilidade completa',
  REGRA_ENUMERAVEL: 'Regra determinística (mesmo parecendo complexa, se é enumerável, é regra)',
};

/**
 * Aplica as três perguntas do checklist, em ordem, exatamente como a árvore:
 * Pergunta 1 decide sozinha quando é SIM (nem chega a olhar p2 ou p3); senão
 * passa pra Pergunta 2; senão passa pra Pergunta 3.
 *
 * @param {boolean} p1 Existe uma regra finita que cobre mais de 90% dos casos REAIS
 *                      (já observados, não hipotéticos)?
 * @param {boolean} p2 O erro é caro E a ação é irreversível (não dá pra desfazer depois)?
 * @param {boolean} p3 O comportamento da tarefa muda de acordo com o contexto de entrada?
 * @returns {string} uma das quatro classificações do checklist
 */
function classificarTarefa(p1, p2, p3) {
  if (p1) {
    return CLASSIFICACAO.REGRA_DETERMINISTICA;
  }
  if (p2) {
    return CLASSIFICACAO.APPROVAL_GATE;
  }
  if (p3) {
    return CLASSIFICACAO.AGENTE_AUTONOMO;
  }
  return CLASSIFICACAO.REGRA_ENUMERAVEL;
}

/**
 * Decompõe uma tarefa híbrida em subtarefas já classificadas, seguindo o
 * "Template: decompondo uma tarefa híbrida" do checklist. Não é uma lógica
 * nova: aplica classificarTarefa em cada subtarefa, uma de cada vez, e devolve
 * a mesma lista de entrada com o campo classificacao preenchido.
 *
 * @param {Array<{nome: string, tipo: string, p1: boolean, p2: boolean, p3: boolean}>} subtarefas
 * @returns {Array<{nome: string, tipo: string, p1: boolean, p2: boolean, p3: boolean, classificacao: string}>}
 */
function decomporTarefaHibrida(subtarefas) {
  return subtarefas.map((subtarefa) => ({
    ...subtarefa,
    classificacao: classificarTarefa(subtarefa.p1, subtarefa.p2, subtarefa.p3),
  }));
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

function rodarTestes() {
  console.log('== Testes: árvore pura (Bloco 1, as 4 combinações do checklist) ==');

  // Caso 1: p1=true -> Regra determinística, não importa p2/p3 ("qualquer").
  // Testamos as 4 combinações de p2/p3 pra provar que elas de fato não importam.
  testar('p1=true, p2=true,  p3=true  -> Regra determinística', () => {
    assert.equal(classificarTarefa(true, true, true), CLASSIFICACAO.REGRA_DETERMINISTICA);
  });
  testar('p1=true, p2=true,  p3=false -> Regra determinística', () => {
    assert.equal(classificarTarefa(true, true, false), CLASSIFICACAO.REGRA_DETERMINISTICA);
  });
  testar('p1=true, p2=false, p3=true  -> Regra determinística', () => {
    assert.equal(classificarTarefa(true, false, true), CLASSIFICACAO.REGRA_DETERMINISTICA);
  });
  testar('p1=true, p2=false, p3=false -> Regra determinística', () => {
    assert.equal(classificarTarefa(true, false, false), CLASSIFICACAO.REGRA_DETERMINISTICA);
  });

  // Caso 2: p1=false, p2=true -> Approval Gate, não importa p3 ("qualquer").
  testar('p1=false, p2=true, p3=true  -> Agente com Approval Gate obrigatório', () => {
    assert.equal(classificarTarefa(false, true, true), CLASSIFICACAO.APPROVAL_GATE);
  });
  testar('p1=false, p2=true, p3=false -> Agente com Approval Gate obrigatório', () => {
    assert.equal(classificarTarefa(false, true, false), CLASSIFICACAO.APPROVAL_GATE);
  });

  // Caso 3: p1=false, p2=false, p3=true -> Agente autônomo.
  testar('p1=false, p2=false, p3=true  -> Agente autônomo, com observabilidade completa', () => {
    assert.equal(classificarTarefa(false, false, true), CLASSIFICACAO.AGENTE_AUTONOMO);
  });

  // Caso 4: p1=false, p2=false, p3=false -> Regra determinística (enumerável).
  testar('p1=false, p2=false, p3=false -> Regra determinística (enumerável)', () => {
    assert.equal(classificarTarefa(false, false, false), CLASSIFICACAO.REGRA_ENUMERAVEL);
  });

  console.log();
  console.log('== Testes: decomposição de tarefa híbrida (Bloco 2, referência TrialForge) ==');

  // Nota honesta sobre a especificação: das quatro linhas da tabela de referência
  // do checklist (seção "Referência: TrialForge - Emenda de Protocolo"), só estas
  // duas abaixo mapeiam de forma limpa pra uma única resposta p1/p2/p3. "Rotear
  // pela criticidade" e "Regenerar documentos afetados" misturam regra e gate
  // condicional de um jeito mais sutil que a árvore pura de três perguntas não
  // representa sozinha, por isso ficam de fora do teste automatizado. Isso é uma
  // limitação real da árvore, não um bug desta implementação.
  const subtarefasReferencia = [
    {
      nome: 'Extrair o que mudou entre versões do protocolo',
      tipo: 'Extração/Interpretação',
      // Não é regra enumerável: é extração/interpretação de linguagem
      // natural sobre o texto do protocolo.
      p1: false,
      // A extração em si não causa, diretamente, um erro caro e irreversível.
      p2: false,
      // O comportamento muda bastante conforme o que de fato mudou entre
      // as duas versões do protocolo.
      p3: true,
    },
    {
      nome: 'Classificar o tipo de emenda (administrativa/substancial)',
      tipo: 'Decisão de Negócio',
      // Segue um critério fixo definido pela ANVISA, coberto no vídeo do
      // Módulo 1.3: regra finita cobre os casos reais.
      p1: true,
      p2: false,
      p3: false,
    },
  ];

  const resultado = decomporTarefaHibrida(subtarefasReferencia);

  testar('"Extrair o que mudou entre versões do protocolo" -> Agente autônomo, com observabilidade completa', () => {
    assert.equal(resultado[0].classificacao, CLASSIFICACAO.AGENTE_AUTONOMO);
  });
  testar('"Classificar o tipo de emenda (administrativa/substancial)" -> Regra determinística', () => {
    assert.equal(resultado[1].classificacao, CLASSIFICACAO.REGRA_DETERMINISTICA);
  });
  testar('decomporTarefaHibrida preserva nome e tipo de cada subtarefa na saída', () => {
    assert.equal(resultado[0].nome, subtarefasReferencia[0].nome);
    assert.equal(resultado[0].tipo, subtarefasReferencia[0].tipo);
    assert.equal(resultado[1].nome, subtarefasReferencia[1].nome);
    assert.equal(resultado[1].tipo, subtarefasReferencia[1].tipo);
  });

  console.log();
  console.log(
    `Total: ${totalTestes} teste(s), ${totalTestes - testesComFalha} passou(passaram), ` +
      `${testesComFalha} falhou(falharam).`
  );

  if (testesComFalha > 0) {
    throw new Error(`${testesComFalha} teste(s) falharam. A implementação não bate com a especificação.`);
  }
}

/**
 * Demo: imprime os 4 casos do Bloco 1 e a decomposição da tarefa híbrida do
 * Bloco 2 de forma legível no terminal, mesmo espírito da Missão Prática:
 * mostrar o mecanismo funcionando, não só os testes passando silenciosamente.
 */
function rodarDemo() {
  console.log();
  console.log('===== Demo: as 4 combinações da árvore pura =====');
  const casos = [
    { rotulo: 'Caso 1', p1: true, p2: false, p3: false },
    { rotulo: 'Caso 2', p1: false, p2: true, p3: false },
    { rotulo: 'Caso 3', p1: false, p2: false, p3: true },
    { rotulo: 'Caso 4', p1: false, p2: false, p3: false },
  ];
  for (const caso of casos) {
    const classificacao = classificarTarefa(caso.p1, caso.p2, caso.p3);
    console.log(`  ${caso.rotulo}: p1=${caso.p1}, p2=${caso.p2}, p3=${caso.p3} -> ${classificacao}`);
  }

  console.log();
  console.log('===== Demo: decompondo a tarefa híbrida (referência TrialForge, Emenda de Protocolo) =====');
  const subtarefas = [
    {
      nome: 'Extrair o que mudou entre versões do protocolo',
      tipo: 'Extração/Interpretação',
      p1: false,
      p2: false,
      p3: true,
    },
    {
      nome: 'Classificar o tipo de emenda (administrativa/substancial)',
      tipo: 'Decisão de Negócio',
      p1: true,
      p2: false,
      p3: false,
    },
  ];
  const decomposicao = decomporTarefaHibrida(subtarefas);
  for (const subtarefa of decomposicao) {
    console.log(`  [${subtarefa.tipo}] ${subtarefa.nome}`);
    console.log(`    p1=${subtarefa.p1}, p2=${subtarefa.p2}, p3=${subtarefa.p3} -> ${subtarefa.classificacao}`);
  }

  console.log();
  console.log('  Nota: as outras duas linhas da tabela de referência do checklist ("Rotear pela');
  console.log('  criticidade" e "Regenerar documentos afetados") misturam regra e gate condicional');
  console.log('  de um jeito que não mapeia limpo pra uma única resposta p1/p2/p3. Ficam de fora');
  console.log('  desta demo e dos testes automatizados por essa razão, não por engano.');
}

if (require.main === module) {
  rodarTestes();
  rodarDemo();
}

module.exports = { classificarTarefa, decomporTarefaHibrida, CLASSIFICACAO };

/*
 * Ahirton Lopes · AI Architecture Toolkit — UNIPDS: Arquitetura de Sistemas com IA
 * Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager
 */
