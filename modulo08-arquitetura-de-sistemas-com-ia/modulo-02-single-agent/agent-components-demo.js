/**
 * Ahirton Lopes · AI Architecture Toolkit
 * Artefato de Demo - Módulo 2.1
 *
 * Cinco mini-demonstrações, uma por peça da anatomia de um agente único
 * (Memória, Planejamento, Ferramentas, Ação, Approval Gate) — cada uma isolada
 * e rodável sozinha, sem o loop ReAct inteiro (isso é o Módulo 2.2) e sem o
 * schema formal de ferramenta (isso é o Módulo 2.4). O objetivo aqui é só
 * tornar cada peça tangível, uma de cada vez, antes de montá-las juntas nos
 * próximos vídeos do módulo.
 *
 * Contexto: TrialForge, Agente ICF (gera a seção de assentimento do Termo de
 * Consentimento a partir do protocolo do estudo).
 *
 * Requer (só a seção de Planejamento chama o modelo de verdade):
 *   1) Ollama instalado e rodando (ollama.com), com `ollama pull gemma4:e2b`
 *   2) npm install ollama
 * Uso: node agent-components-demo.js
 *
 * Existe uma versão idêntica em Python: agent_components_demo.py
 */

const ollama = require('ollama').default;
const MODELO = 'gemma4:e2b';

// ============================================================
// 1. MEMÓRIA — curto prazo (efêmera) vs longo prazo (persistida)
// ============================================================

function memoriaCurtoPrazo(protocolo) {
  // Vive só durante esta requisição: some quando a função termina, nunca é
  // reaproveitada pelo próximo protocolo que chegar.
  return [
    { role: 'system', content: 'Você redige seções de ICF para estudos clínicos.' },
    { role: 'user', content: `Protocolo: ${protocolo}` },
  ];
}

// Simula um "banco" simples só pra mostrar o princípio de memória persistida
// entre chamadas — em produção seria um banco de dados de verdade.
const bancoDeUsuarios = new Map();

function memoriaLongoPrazo(usuarioId, preferenciaNova) {
  const historico = bancoDeUsuarios.get(usuarioId) ?? { interacoes: 0, preferencias: [] };
  historico.interacoes += 1;
  if (preferenciaNova) historico.preferencias.push(preferenciaNova);
  bancoDeUsuarios.set(usuarioId, historico);
  return { ...historico };
}

function testarMemoria() {
  console.log('== Testes: memória de longo prazo persiste entre chamadas ==');
  bancoDeUsuarios.clear();
  const primeira = memoriaLongoPrazo('usuario-teste', 'prefere respostas curtas');
  const segunda = memoriaLongoPrazo('usuario-teste', 'prefere tom formal');
  const ok = segunda.interacoes === 2 && segunda.preferencias.length === 2 && primeira.interacoes === 1;
  console.log(`  [${ok ? 'OK' : 'FALHOU'}] duas chamadas com o mesmo usuarioId acumulam estado`);
  if (!ok) throw new Error('memoriaLongoPrazo não está persistindo corretamente entre chamadas');
  bancoDeUsuarios.clear();
  console.log();
}

function demonstrarMemoria() {
  console.log('===== 1. MEMÓRIA =====');

  const contexto = memoriaCurtoPrazo('Estudo fase II, público-alvo 12-17 anos, terapia oncológica experimental.');
  console.log(`[Curto prazo] Contexto construído para esta requisição: ${contexto.length} mensagem(ns).`);
  console.log('  -> O Agente ICF do TrialForge só precisa disso: cada protocolo é um caso novo,');
  console.log('     memória de longo prazo aqui seria custo sem benefício (canvas do Módulo 2.1).');
  console.log();

  console.log('[Longo prazo] Simulando um assistente diferente, que acompanha o mesmo usuário ao longo do tempo:');
  console.log('  1ª interação:', memoriaLongoPrazo('usuario-42', 'prefere respostas curtas'));
  console.log('  2ª interação:', memoriaLongoPrazo('usuario-42', 'prefere tom formal'));
  console.log('  -> Repare: a segunda chamada já sabe da primeira. Isso só vale a pena quando');
  console.log('     a tarefa se repete com o mesmo contexto ao longo do tempo — o oposto do ICF.');
  console.log();
}

// ============================================================
// 2. PLANEJAMENTO — chain-of-thought (quase de graça) vs reflexão (chamada a mais)
// ============================================================

async function chainOfThought(pergunta) {
  const inicio = Date.now();
  const resposta = await ollama.chat({
    model: MODELO,
    messages: [{ role: 'user', content: `Pense passo a passo, de forma breve, antes de responder: ${pergunta}` }],
  });
  return { texto: resposta.message.content, duracaoMs: Date.now() - inicio, chamadas: 1 };
}

async function chainOfThoughtMaisReflexao(pergunta) {
  const inicio = Date.now();
  const primeira = await ollama.chat({
    model: MODELO,
    messages: [{ role: 'user', content: pergunta }],
  });
  const critica = await ollama.chat({
    model: MODELO,
    messages: [
      { role: 'user', content: pergunta },
      { role: 'assistant', content: primeira.message.content },
      {
        role: 'user',
        content: 'Releia sua resposta acima. Ela tem algum erro ou imprecisão? Responda só "sim" ou "não" e, se sim, qual.',
      },
    ],
  });
  return { texto: critica.message.content, duracaoMs: Date.now() - inicio, chamadas: 2 };
}

async function demonstrarPlanejamento() {
  console.log('===== 2. PLANEJAMENTO =====');
  const pergunta =
    'Um estudo com público-alvo de 12 a 17 anos precisa de assentimento do participante, além do consentimento do responsável?';

  const cot = await chainOfThought(pergunta);
  console.log(`[Chain-of-thought] ${cot.chamadas} chamada ao modelo, ${cot.duracaoMs}ms.`);

  const reflexao = await chainOfThoughtMaisReflexao(pergunta);
  console.log(`[+ Reflexão]        ${reflexao.chamadas} chamadas ao modelo, ${reflexao.duracaoMs}ms.`);

  console.log(
    `  -> Reflexão levou ${(reflexao.duracaoMs / cot.duracaoMs).toFixed(1)}x mais tempo que chain-of-thought sozinho,`
  );
  console.log('     porque é uma chamada inteira a mais, não só um raciocínio mais longo na mesma chamada.');
  console.log('     Essa é a distinção de custo que o canvas do Módulo 2.1 registra.');
  console.log();
}

// ============================================================
// 3. FERRAMENTAS — função determinística que o agente aciona
// ============================================================

// Versão mínima, só pra tornar tangível "ferramenta = função determinística
// que o agente delega". O schema formal (JSON, enum, validação de parâmetro)
// é o Módulo 2.4 — aqui é só a peça em isolamento.
function buscarClausulaAssentimento(faixaEtaria) {
  const cobreMenor = faixaEtaria.some((idade) => idade < 18);
  if (!cobreMenor) {
    return { texto: null, aviso: 'população adulta: cláusula de assentimento não se aplica' };
  }
  return {
    texto:
      'Para participantes entre 12 e 17 anos, é necessário assentimento por escrito, além do ' +
      'consentimento do responsável legal (RDC ANVISA 466/2012, Art. 4º).',
    fonte: 'RDC ANVISA 466/2012, Art. 4º',
  };
}

function testarFerramenta() {
  console.log('== Testes: buscarClausulaAssentimento (determinístico) ==');
  const menor = buscarClausulaAssentimento([12, 15, 17]);
  const adulto = buscarClausulaAssentimento([25, 40, 55]);
  const okMenor = menor.texto !== null;
  const okAdulto = adulto.texto === null;
  console.log(`  [${okMenor ? 'OK' : 'FALHOU'}] faixa com menor de idade encontra cláusula`);
  console.log(`  [${okAdulto ? 'OK' : 'FALHOU'}] faixa só de adultos não encontra cláusula`);
  if (!okMenor || !okAdulto) throw new Error('buscarClausulaAssentimento não está classificando corretamente');
  console.log();
}

function demonstrarFerramentas() {
  console.log('===== 3. FERRAMENTAS =====');
  console.log('[Caso 1] Estudo com participantes de 12 a 17 anos:');
  console.log('  ', buscarClausulaAssentimento([12, 15, 17]));
  console.log('[Caso 2] Estudo só com adultos:');
  console.log('  ', buscarClausulaAssentimento([25, 40, 55]));
  console.log('  -> O agente não "sabe" essa regra de cor: ele delega pra uma função');
  console.log('     determinística, porque é isso que sistemas determinísticos fazem melhor.');
  console.log();
}

// ============================================================
// 4 e 5. AÇÃO + APPROVAL GATE — nem toda ação executa direto
// ============================================================

function executarOuGatear(acaoProposta) {
  if (acaoProposta.requerAprovacao) {
    return {
      status: 'aguardando_aprovacao',
      mensagem:
        `Ação "${acaoProposta.tipo}" NÃO executada. Aguardando Approval Gate ` +
        '(Módulo 1.3, Pergunta 2: erro caro e irreversível).',
    };
  }
  return {
    status: 'executada',
    resultado: acaoProposta.executar(),
  };
}

function testarGate() {
  console.log('== Testes: executarOuGatear ==');
  const semGate = executarOuGatear({ tipo: 'x', requerAprovacao: false, executar: () => 'feito' });
  const comGate = executarOuGatear({ tipo: 'y', requerAprovacao: true, executar: () => 'nunca deveria rodar' });
  const okSemGate = semGate.status === 'executada' && semGate.resultado === 'feito';
  const okComGate = comGate.status === 'aguardando_aprovacao' && comGate.resultado === undefined;
  console.log(`  [${okSemGate ? 'OK' : 'FALHOU'}] ação sem gate executa direto`);
  console.log(`  [${okComGate ? 'OK' : 'FALHOU'}] ação com gate nunca chega a executar`);
  if (!okSemGate || !okComGate) throw new Error('executarOuGatear não está bloqueando/liberando corretamente');
  console.log();
}

function demonstrarAcaoEGate() {
  console.log('===== 4 e 5. AÇÃO + APPROVAL GATE =====');

  const gerarRascunho = {
    tipo: 'gerar_rascunho_icf',
    requerAprovacao: false, // rascunho não é a versão final, pode ser gerado direto
    executar: () => 'Rascunho da seção de assentimento gerado.',
  };
  console.log('[Ação 1: gerar rascunho]      ', executarOuGatear(gerarRascunho));

  const notificarEventoAdverso = {
    tipo: 'notificar_evento_adverso_regulatorio',
    requerAprovacao: true, // escrita real + erro caro e irreversível (Módulo 2.4)
    executar: () => 'Notificação enviada à ANVISA.', // nunca chega a rodar sozinha
  };
  console.log('[Ação 2: notificar evento adverso]', executarOuGatear(notificarEventoAdverso));

  console.log('  -> Mesma "capacidade de ação" nos dois casos. A diferença que decide se');
  console.log('     executa direto ou pausa pro Approval Gate não é técnica, é a Pergunta 2');
  console.log('     do Módulo 1.3: o erro é caro E irreversível?');
  console.log();
}

// ============================================================

async function rodarTestes() {
  testarMemoria();
  testarFerramenta();
  testarGate();
}

async function main() {
  await rodarTestes();
  demonstrarMemoria();
  await demonstrarPlanejamento();
  demonstrarFerramentas();
  demonstrarAcaoEGate();
}

if (require.main === module) {
  main().catch((erro) => {
    console.error('[Erro não tratado]', erro.message);
  });
}

module.exports = {
  memoriaCurtoPrazo,
  memoriaLongoPrazo,
  chainOfThought,
  chainOfThoughtMaisReflexao,
  buscarClausulaAssentimento,
  executarOuGatear,
};

/*
 * Ahirton Lopes · AI Architecture Toolkit — UNIPDS: Arquitetura de Sistemas com IA
 * Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager
 */
