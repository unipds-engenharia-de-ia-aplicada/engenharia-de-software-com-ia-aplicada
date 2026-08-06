/**
 * Ahirton Lopes · AI Architecture Toolkit
 * Artefato de Demo - Módulo 3.5
 *
 * Protótipo: comunicação assíncrona entre os quatro agentes do TrialForge —
 * Protocolo, ICF, CSR e Supervisor — usando o EventEmitter nativo do Node.js
 * como fila de mensagens (Slide 3). Demonstra TODOS os mecanismos do módulo
 * juntos, não só o padrão de comunicação:
 *
 *   1) Sequential (Protocolo primeiro) + Parallel (ICF e CSR reagindo ao
 *      mesmo evento).
 *   2) CAP completo (Módulo 3.4) — os três mecanismos de verdade, não só
 *      narrados: TIMEOUT explícito (Promise.race contra um temporizador real,
 *      não uma falha simulada por flag), RETRY COM LIMITE (loop de até 3
 *      tentativas, desiste e segue em frente se todas falharem — Disponibilidade
 *      sobre Consistência), e IDEMPOTÊNCIA (registro que nunca duplica o
 *      documento, não importa quantas tentativas rodem).
 *   3) Verificação de consistência (Módulo 3.2, parágrafo 88 — "o Supervisor
 *      verifica se os critérios citados em cada um batem entre si"): o
 *      Protocolo é um recurso VERSIONADO e mutável, não um valor congelado —
 *      uma emenda pode chegar enquanto ICF/CSR já estão trabalhando com uma
 *      cópia mais antiga. Cada agente registra a versão que USOU e a versão
 *      que estava vigente quando ELE PRÓPRIO terminou; o Supervisor compara
 *      as duas para cada agente e só assim consegue detectar defasagem —
 *      sem esse registro, a divergência seria silenciosa.
 *   4) Compensação Saga de verdade (Módulo 3.4): quando o Supervisor detecta
 *      que um agente ficou defasado, ele regenera SÓ o resultado daquele
 *      agente com a versão corrigida — o outro agente, que não ficou
 *      defasado, nunca é retrabalhado.
 *
 * IMPORTANTE — (2) é Teorema CAP, (3)+(4) é Saga. São dois mecanismos
 * DIFERENTES do Módulo 3.4, cada um resolvendo um problema diferente:
 * (2) trata falha técnica no meio da execução; (3)+(4) trata um problema
 * de conteúdo descoberto DEPOIS que o trabalho já tinha terminado com
 * sucesso. Não confundir os dois é o próprio ponto do Módulo 3.4.
 *
 * Sem dependência externa (só o EventEmitter nativo) — os "agentes" aqui são
 * funções que simulam trabalho assíncrono (setTimeout) e retornam dado
 * estruturado: o objetivo é o padrão de comunicação, não a qualidade de um
 * modelo — por isso este demo não chama nenhum LLM, diferente dos demais.
 *
 * Uso: node trialforge-message-queue-prototype.js
 *
 * Existe uma versão idêntica em Python: trialforge_message_queue_prototype.py
 * (a Missão Prática #03 pede o protótipo em JavaScript, conforme a ementa —
 * Python é referência).
 */

const EventEmitter = require('events');

// Tempos de simulação de trabalho, proporcionais aos timeouts reais definidos
// no Slide 2 (30s/45s/60s) mas escalados ÷100 pra manter a demo rápida — o que
// importa aqui é a proporção entre os três, não o valor absoluto em segundos.
const TEMPO_PROTOCOLO_MS = 300;
const TEMPO_ICF_MS = 450;
const TEMPO_CSR_MS = 600;

// A emenda do comitê de ética dispara 500ms depois do protocolo:pronto —
// depois que o ICF já terminou (450ms), mas antes do CSR terminar (600ms).
// Não é uma corrida: são três setTimeout com atrasos fixos e diferentes, a
// ordem de conclusão é determinística.
const TEMPO_EMENDA_MS = 500;

const CRITERIOS_INICIAIS = { idadeMinima: 13 };

// Timeout explícito de verdade (Slide 2: 30s/45s/60s ÷100), com margem de
// segurança sobre o tempo normal de trabalho — não é o mesmo valor do tempo de
// trabalho, senão toda execução normal flertaria com o próprio timeout.
const MARGEM_DE_SEGURANCA = 1.5;
const TIMEOUT_PROTOCOLO_MS = Math.round(TEMPO_PROTOCOLO_MS * MARGEM_DE_SEGURANCA);
const TIMEOUT_ICF_MS = Math.round(TEMPO_ICF_MS * MARGEM_DE_SEGURANCA);
const TIMEOUT_CSR_MS = Math.round(TEMPO_CSR_MS * MARGEM_DE_SEGURANCA);

// Simula um agente travado: demora bem mais que o próprio timeout, então
// nunca chega a responder a tempo — bem diferente de "lançou uma exceção".
const TEMPO_ICF_TRAVADO_MS = TIMEOUT_ICF_MS * 3;

// "até três tentativas" (Slide 2, parágrafo sobre o Agente Protocolo) — mesmo
// limite aplicado de forma consistente na política de retry do ICF.
const MAX_TENTATIVAS = 3;

function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ErroDeTimeout extends Error {
  constructor(nomeAgente, timeoutMs) {
    super(`${nomeAgente}: timeout de ${timeoutMs}ms excedido — agente não respondeu a tempo.`);
    this.name = 'ErroDeTimeout';
  }
}

// Promise.race real contra um temporizador: se a promessa do agente não
// resolver dentro do timeout, quem "ganha a corrida" é o timeout — a diferença
// entre isso e um try/catch em volta do agente é que aqui ninguém precisa que
// o agente "avise" que travou; o Supervisor descobre sozinho, de fora.
function comTimeout(promessa, timeoutMs, nomeAgente) {
  return new Promise((resolve, reject) => {
    const temporizador = setTimeout(() => reject(new ErroDeTimeout(nomeAgente, timeoutMs)), timeoutMs);
    promessa.then(
      (valor) => {
        clearTimeout(temporizador);
        resolve(valor);
      },
      (erro) => {
        clearTimeout(temporizador);
        reject(erro);
      }
    );
  });
}

// ---------- Estado do Protocolo: um recurso VERSIONADO, não um valor congelado ----------
// (Módulo 3.4: "O Protocolo versão 1 não é apagado — ele é versionado, preservado
// como histórico, e uma versão 2 é criada com o critério corrigido.")

function criarEstadoProtocolo(criteriosIniciais) {
  return { versao: 1, criterios: { ...criteriosIniciais }, historico: [] };
}

function revisarProtocolo(estadoProtocolo, novosCriterios, motivo) {
  estadoProtocolo.historico.push({
    versaoAnterior: estadoProtocolo.versao,
    criteriosAnteriores: { ...estadoProtocolo.criterios },
    motivo,
  });
  estadoProtocolo.versao += 1;
  estadoProtocolo.criterios = { ...estadoProtocolo.criterios, ...novosCriterios };
}

// ---------- Os agentes (Slide 2: A Arquitetura Completa) ----------

async function agenteProtocolo(barramento, estudo, estadoProtocolo, ordemDeExecucao, opcoes = {}) {
  await aguardar(TEMPO_PROTOCOLO_MS);
  if (opcoes.forcarFalhaProtocolo) {
    throw new Error('Agente Protocolo: falha simulada ao gerar critérios.');
  }
  ordemDeExecucao.push('protocolo'); // registrado ANTES do emit: prova causal de que Sequential foi respeitado
  // Evento rico (parágrafos 62-64 do TP): carrega o dado completo — os critérios
  // estruturados, não só uma notificação vazia. É uma CÓPIA do estado atual, não
  // uma referência: revisões futuras no estadoProtocolo não mudam retroativamente
  // o que já foi publicado neste evento.
  const dado = { versao: estadoProtocolo.versao, criterios: { ...estadoProtocolo.criterios }, estudo };
  barramento.emit('protocolo:pronto', dado); // não-bloqueante: publica e segue em frente

  if (opcoes.comEmendaEtica) {
    // Simula uma emenda chegando de forma assíncrona, independente do fluxo
    // principal — exatamente como um comitê de ética revisaria um critério
    // dias ou semanas depois, sem nenhuma relação com o timing de ICF/CSR.
    setTimeout(() => {
      revisarProtocolo(
        estadoProtocolo,
        { idadeMinima: 12 },
        'Comitê de ética corrigiu a idade mínima de 13 para 12 anos.'
      );
    }, TEMPO_EMENDA_MS);
  }

  return dado;
}

// Registro idempotente: simula o "banco de documentos" do lado de fora do agente.
// A mesma chave nunca gera um segundo documento — só incrementa o contador de
// tentativas, que é exatamente o que permite um retry seguro (parágrafo 72-73
// do TP fala em "tentar de novo", mas retry só é seguro se for idempotente).
function registrarDocumento(documentosGerados, chave, resultado) {
  const existente = documentosGerados.get(chave);
  if (existente) {
    existente.tentativas += 1;
    return existente;
  }
  const registro = { resultado, tentativas: 1 };
  documentosGerados.set(chave, registro);
  return registro;
}

async function agenteICF(dadoProtocolo, estadoProtocolo, documentosGerados, ordemDeExecucao, opcoes = {}) {
  ordemDeExecucao.push('icf:inicio'); // registrado ANTES do aguardar: prova que só começa depois do protocolo:pronto
  // forcarTravamentoICF simula o agente travado (demora além do timeout) — bem
  // diferente de forcarFalhaICF, que simula uma exceção lançada dentro do próprio agente.
  await aguardar(opcoes.forcarTravamentoICF ? TEMPO_ICF_TRAVADO_MS : TEMPO_ICF_MS);
  const chave = `${dadoProtocolo.versao}:icf`;
  const resultado = {
    agente: 'ICF',
    secao: `Assentimento gerado com idade mínima de ${dadoProtocolo.criterios.idadeMinima} anos (a partir da versão ${dadoProtocolo.versao} do protocolo).`,
    criterioUsado: { ...dadoProtocolo.criterios },
    versaoUsada: dadoProtocolo.versao,
    // Conferido na hora de concluir, não na hora de começar — é isso que permite
    // o Supervisor perceber se uma emenda chegou enquanto o ICF ainda trabalhava.
    versaoAoConcluir: estadoProtocolo.versao,
  };
  // O documento é gravado ANTES da falha simulada: o cenário real que retry
  // precisa tratar não é "a tarefa nunca rodou", é "a tarefa rodou, mas a
  // confirmação se perdeu" (timeout de rede, ack perdido) — daí a necessidade
  // de idempotência, não só de tentar de novo.
  const registro = registrarDocumento(documentosGerados, chave, resultado);
  if (opcoes.forcarFalhaICF) {
    throw new Error('Agente ICF: falha simulada na confirmação, depois do documento já ter sido gravado.');
  }
  return { ...resultado, tentativas: registro.tentativas };
}

async function agenteCSR(dadoProtocolo, estadoProtocolo, ordemDeExecucao) {
  ordemDeExecucao.push('csr:inicio'); // registrado ANTES do aguardar: prova que só começa depois do protocolo:pronto
  await aguardar(TEMPO_CSR_MS);
  return {
    agente: 'CSR',
    sintese: `Conformidade ICH E3 verificada com idade mínima de ${dadoProtocolo.criterios.idadeMinima} anos (a partir da versão ${dadoProtocolo.versao} do protocolo).`,
    criterioUsado: { ...dadoProtocolo.criterios },
    versaoUsada: dadoProtocolo.versao,
    versaoAoConcluir: estadoProtocolo.versao,
  };
}

// ---------- Reação Parallel ao evento: Promise.all (bug) vs Promise.allSettled (correção) ----------

function inscreverReacaoParalela(barramento, estrategia, opcoesFalha, documentosGerados, ordemDeExecucao, estadoProtocolo) {
  return new Promise((resolve) => {
    barramento.once('protocolo:pronto', async (dadoProtocolo) => {
      const tarefaICF = comTimeout(
        agenteICF(dadoProtocolo, estadoProtocolo, documentosGerados, ordemDeExecucao, opcoesFalha),
        TIMEOUT_ICF_MS,
        'Agente ICF'
      );
      const tarefaCSR = comTimeout(
        agenteCSR(dadoProtocolo, estadoProtocolo, ordemDeExecucao),
        TIMEOUT_CSR_MS,
        'Agente CSR'
      );

      if (estrategia === 'promise.all') {
        try {
          const [resultadoICF, resultadoCSR] = await Promise.all([tarefaICF, tarefaCSR]);
          resolve({ ok: true, resultadoICF, resultadoCSR, resultadoCSRPreservado: true });
        } catch (erro) {
          // BUG (TP, parágrafos 68-71): Promise.all rejeita tudo à primeira falha —
          // mesmo que o CSR tenha terminado bem, seu resultado nunca chega aqui.
          resolve({ ok: false, erro: erro.message, resultadoCSRPreservado: false });
        }
      } else {
        const [icf, csr] = await Promise.allSettled([tarefaICF, tarefaCSR]);
        resolve({
          ok: icf.status === 'fulfilled' && csr.status === 'fulfilled',
          resultadoICF: icf.status === 'fulfilled' ? icf.value : null,
          resultadoCSR: csr.status === 'fulfilled' ? csr.value : null,
          erroICF: icf.status === 'rejected' ? icf.reason.message : null,
          resultadoCSRPreservado: csr.status === 'fulfilled',
        });
      }
    });
  });
}

// ---------- Supervisor, mecanismo 1: decide a estratégia de retry (CAP) ----------
//
// IMPORTANTE — isto NÃO é o padrão Saga: o ICF falhou DENTRO da própria
// execução (uma exceção lançada na hora de gerar o documento), não é um
// problema descoberto DEPOIS por uma etapa posterior sobre um trabalho que já
// tinha terminado com sucesso. Pela definição do Módulo 3.4 (parágrafo 52),
// isso é Teorema CAP — timeout, retry com limite, idempotência — o mesmo
// exemplo do Agente ICF recebendo a mesma solicitação duas vezes que o
// próprio Módulo 3.4 já usa (parágrafo 42). Saga é o mecanismo 2, logo abaixo.

function decidirEstrategiaDeRetry(reacao) {
  if (reacao.ok) return 'nenhum_retry_necessario';
  if (reacao.resultadoCSRPreservado) return 'retry_icf_apenas'; // só refaz quem falhou, preserva o CSR que já terminou
  return 'retry_ambos'; // sem visibilidade de quem terminou bem, precisa refazer tudo
}

// Retry COM LIMITE de verdade — não um único retry incondicional. Tenta até
// MAX_TENTATIVAS vezes, cada uma protegida pelo mesmo timeout real do
// despacho original; se a falha é transitória (o padrão comum: ack perdido,
// rede instável), a causa raiz já passou e a 2ª tentativa resolve. Se a falha
// é persistente, o loop esgota as tentativas e desiste — CAP manda decidir
// entre esperar mais ou seguir em frente sem aquele resultado (Disponibilidade
// sobre Consistência), não esperar pra sempre.
async function executarICFComRetry(dadoProtocolo, estadoProtocolo, documentosGerados, ordemDeExecucao, opcoesFalha) {
  const persistente = opcoesFalha.persistirFalhaNoRetry;
  let ultimoErro = null;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const opcoesDaTentativa = persistente
      ? { forcarFalhaICF: opcoesFalha.forcarFalhaICF, forcarTravamentoICF: opcoesFalha.forcarTravamentoICF }
      : {};
    try {
      const resultado = await comTimeout(
        agenteICF(dadoProtocolo, estadoProtocolo, documentosGerados, ordemDeExecucao, opcoesDaTentativa),
        TIMEOUT_ICF_MS,
        'Agente ICF'
      );
      return { sucesso: true, resultado, tentativasFeitas: tentativa };
    } catch (erro) {
      ultimoErro = erro;
    }
  }
  return { sucesso: false, erro: ultimoErro.message, tentativasFeitas: MAX_TENTATIVAS };
}

// ---------- Supervisor, mecanismo 2: verifica consistência (Módulo 3.2, parágrafo 88) ----------
//
// "O Supervisor... verifica se os critérios citados em cada um batem entre
// si." A checagem não compara ICF/CSR contra "o valor mais atual agora" — ela
// compara, PARA CADA AGENTE, a versão que ele usou contra a versão que já
// estava vigente quando ELE PRÓPRIO terminou. Um agente que termina ANTES de
// uma emenda chegar está correto (não há nada mais novo ainda); um agente que
// termina DEPOIS de uma emenda chegar, mas ainda carrega o valor antigo, ficou
// defasado — mesmo sem nenhuma exceção ter sido lançada em lugar nenhum.

function verificarConsistencia(resultadoICF, resultadoCSR) {
  const icfConsistente = resultadoICF.versaoUsada === resultadoICF.versaoAoConcluir;
  const csrConsistente = resultadoCSR.versaoUsada === resultadoCSR.versaoAoConcluir;
  const agentesDivergentes = [];
  if (!icfConsistente) agentesDivergentes.push('ICF');
  if (!csrConsistente) agentesDivergentes.push('CSR');
  return { consistente: agentesDivergentes.length === 0, icfConsistente, csrConsistente, agentesDivergentes };
}

// ---------- Supervisor, mecanismo 2 (continuação): compensação Saga de verdade ----------
//
// (Módulo 3.4: "A compensação, ao contrário, desfaz apenas o que precisa ser
// desfeito... preservando o que já estava certo.") Só o agente que ficou
// defasado é regenerado, com a versão CORRIGIDA do protocolo — o outro agente,
// que já estava consistente, nunca é retrabalhado.

async function compensarDivergencia(agentesDivergentes, estadoProtocolo, estudo, documentosGerados, ordemDeExecucao) {
  const dadoAtual = { versao: estadoProtocolo.versao, criterios: { ...estadoProtocolo.criterios }, estudo };
  const resultado = {};
  if (agentesDivergentes.includes('ICF')) {
    resultado.resultadoICF = await agenteICF(dadoAtual, estadoProtocolo, documentosGerados, ordemDeExecucao, {});
  }
  if (agentesDivergentes.includes('CSR')) {
    resultado.resultadoCSR = await agenteCSR(dadoAtual, estadoProtocolo, ordemDeExecucao);
  }
  return resultado;
}

// ---------- Fluxo completo: Sequential -> Parallel -> Supervisor (retry CAP + consistência Saga) ----------

async function rodarFluxoTrialForge(estudo, { estrategia = 'promise.allSettled', ...opcoesFalha } = {}) {
  // Escopo por fluxo, não módulo: cada chamada tem seu próprio "banco de
  // documentos", seu próprio registro de ordem de execução, e seu próprio
  // estado de protocolo — não compartilhados entre estudos.
  const documentosGerados = new Map();
  const ordemDeExecucao = [];
  const estadoProtocolo = criarEstadoProtocolo(CRITERIOS_INICIAIS);
  const barramento = new EventEmitter();
  const reacaoPromise = inscreverReacaoParalela(
    barramento,
    estrategia,
    opcoesFalha,
    documentosGerados,
    ordemDeExecucao,
    estadoProtocolo
  ); // inscreve ANTES do emit
  const dadoProtocolo = await comTimeout(
    agenteProtocolo(barramento, estudo, estadoProtocolo, ordemDeExecucao, opcoesFalha),
    TIMEOUT_PROTOCOLO_MS,
    'Agente Protocolo'
  ); // Sequential
  let reacao = await reacaoPromise; // Parallel já rodou concorrente enquanto isso resolvia
  let decisaoSupervisor = decidirEstrategiaDeRetry(reacao);
  let tentativasRetry = 0;

  if (decisaoSupervisor === 'retry_icf_apenas') {
    // O retry de verdade, COM LIMITE (CAP, Módulo 3.4): reaproveita a MESMA
    // chave de idempotência em cada tentativa, provando que nenhuma delas
    // duplica o documento do ICF.
    const resultadoRetry = await executarICFComRetry(dadoProtocolo, estadoProtocolo, documentosGerados, ordemDeExecucao, opcoesFalha);
    tentativasRetry = resultadoRetry.tentativasFeitas;
    if (resultadoRetry.sucesso) {
      reacao = { ...reacao, resultadoICF: resultadoRetry.resultado, ok: true };
      decisaoSupervisor = 'retry_icf_executado_com_sucesso';
    } else {
      // CAP: o limite de tentativas esgotou — decide seguir em frente sem esse
      // resultado (Disponibilidade), em vez de esperar pra sempre (Consistência).
      reacao = { ...reacao, ok: false, erroICF: resultadoRetry.erro };
      decisaoSupervisor = 'retry_esgotado_seguindo_sem_icf';
    }
  }

  const tentativasICF = documentosGerados.get(`${dadoProtocolo.versao}:icf`)?.tentativas ?? 0;

  // Mecanismo 2: só faz sentido verificar consistência quando os dois
  // resultados de conteúdo existem de verdade (depois do mecanismo 1 já ter
  // resolvido qualquer falha técnica).
  let verificacao = null;
  let compensacaoSaga = null;
  if (reacao.ok && reacao.resultadoICF && reacao.resultadoCSR) {
    verificacao = verificarConsistencia(reacao.resultadoICF, reacao.resultadoCSR);
    if (!verificacao.consistente) {
      compensacaoSaga = await compensarDivergencia(
        verificacao.agentesDivergentes,
        estadoProtocolo,
        estudo,
        documentosGerados,
        ordemDeExecucao
      );
      if (compensacaoSaga.resultadoICF) reacao = { ...reacao, resultadoICF: compensacaoSaga.resultadoICF };
      if (compensacaoSaga.resultadoCSR) reacao = { ...reacao, resultadoCSR: compensacaoSaga.resultadoCSR };
      decisaoSupervisor = `saga_compensacao_${verificacao.agentesDivergentes.join('_e_').toLowerCase()}`;
    }
  }

  return {
    dadoProtocolo,
    reacao,
    decisaoSupervisor,
    documentosGerados,
    tentativasICF,
    tentativasRetry,
    ordemDeExecucao,
    estadoProtocolo,
    verificacao,
  };
}

// ---------- Testes automatizados ----------

async function rodarTestes() {
  console.log('== Testes: trialforge-message-queue-prototype ==');
  let passou = 0;
  let total = 0;

  // 1) Evento rico: protocolo:pronto carrega versão + critérios estruturados
  total++;
  const resultadoFeliz = await rodarFluxoTrialForge('Estudo fase II');
  const eventoEhRico =
    resultadoFeliz.dadoProtocolo.versao === 1 && typeof resultadoFeliz.dadoProtocolo.criterios.idadeMinima === 'number';
  console.log(`  [${eventoEhRico ? 'OK' : 'FALHOU'}] evento 'protocolo:pronto' carrega versao+criterios estruturados (evento rico)`);
  if (eventoEhRico) passou++;

  // 2) Caminho feliz: ICF e CSR completam, Supervisor não aciona retry nem compensação
  total++;
  const okFeliz =
    resultadoFeliz.reacao.ok &&
    resultadoFeliz.decisaoSupervisor === 'nenhum_retry_necessario' &&
    resultadoFeliz.verificacao?.consistente === true;
  console.log(`  [${okFeliz ? 'OK' : 'FALHOU'}] caminho feliz: ICF+CSR ok, sem retry, consistência confirmada`);
  if (okFeliz) passou++;

  // 3) BUG documentado: com Promise.all, falha do ICF perde o resultado bom do CSR
  total++;
  const resultadoBug = await rodarFluxoTrialForge('Estudo fase II', {
    estrategia: 'promise.all',
    forcarFalhaICF: true,
  });
  const bugConfirmado = resultadoBug.reacao.ok === false && resultadoBug.reacao.resultadoCSRPreservado === false;
  console.log(`  [${bugConfirmado ? 'OK' : 'FALHOU'}] Promise.all: falha do ICF perde o resultado do CSR (bug do parágrafo 68-71)`);
  if (bugConfirmado) passou++;

  // 4) CORREÇÃO: com Promise.allSettled, o mesmo cenário preserva o resultado do CSR
  // e o Supervisor de fato executa o retry (não só decide, executa)
  total++;
  const resultadoCorrigido = await rodarFluxoTrialForge('Estudo fase II', {
    estrategia: 'promise.allSettled',
    forcarFalhaICF: true,
  });
  const correcaoConfirmada =
    resultadoCorrigido.reacao.resultadoCSRPreservado === true &&
    resultadoCorrigido.decisaoSupervisor === 'retry_icf_executado_com_sucesso' &&
    resultadoCorrigido.reacao.ok === true;
  console.log(
    `  [${correcaoConfirmada ? 'OK' : 'FALHOU'}] Promise.allSettled: CSR preservado, retry do ICF executado de verdade e com sucesso`
  );
  if (correcaoConfirmada) passou++;

  // 4b) IDEMPOTÊNCIA: a mesma chave (versao:icf) não pode virar 2 documentos só
  // porque o agente foi chamado 2 vezes — tem que ficar 1 documento com 2 tentativas
  total++;
  const idempotenciaConfirmada =
    resultadoCorrigido.documentosGerados.size === 1 && resultadoCorrigido.tentativasICF === 2;
  console.log(
    `  [${idempotenciaConfirmada ? 'OK' : 'FALHOU'}] Idempotência: 1 documento só (não 2) após falha + retry, com 2 tentativas registradas`
  );
  if (idempotenciaConfirmada) passou++;

  // 5) Sequential respeitado: prova CAUSAL direta via ordem real de invocação,
  // não um proxy de tempo — 'protocolo' tem que aparecer no log ANTES de
  // 'icf:inicio' e 'csr:inicio', porque os dois só devem começar depois do
  // evento 'protocolo:pronto' disparar.
  total++;
  const resultadoOrdem = await rodarFluxoTrialForge('Estudo de ordem');
  const { ordemDeExecucao } = resultadoOrdem;
  const idxProtocolo = ordemDeExecucao.indexOf('protocolo');
  const idxICF = ordemDeExecucao.indexOf('icf:inicio');
  const idxCSR = ordemDeExecucao.indexOf('csr:inicio');
  const sequentialRespeitado = idxProtocolo !== -1 && idxProtocolo < idxICF && idxProtocolo < idxCSR;
  console.log(
    `  [${sequentialRespeitado ? 'OK' : 'FALHOU'}] Sequential respeitado (prova causal): ordem real = [${ordemDeExecucao.join(', ')}]`
  );
  if (sequentialRespeitado) passou++;

  // 6) DIVERGÊNCIA DETECTADA: com uma emenda chegando no meio do caminho, o CSR
  // (mais lento, termina depois da emenda) fica defasado; o ICF (mais rápido,
  // termina antes da emenda) continua consistente. Exatamente o exemplo do
  // Módulo 3.1/3.2: "idade mínima de doze anos" vs. "treze anos".
  total++;
  const resultadoDivergencia = await rodarFluxoTrialForge('Estudo com emenda', { comEmendaEtica: true });
  const divergenciaDetectada =
    resultadoDivergencia.verificacao?.consistente === false &&
    resultadoDivergencia.verificacao.icfConsistente === true &&
    resultadoDivergencia.verificacao.csrConsistente === false &&
    resultadoDivergencia.verificacao.agentesDivergentes.length === 1 &&
    resultadoDivergencia.verificacao.agentesDivergentes[0] === 'CSR';
  console.log(
    `  [${divergenciaDetectada ? 'OK' : 'FALHOU'}] Divergência detectada: ICF consistente, CSR defasado (só ele, exatamente como o Módulo 3.2 descreve)`
  );
  if (divergenciaDetectada) passou++;

  // 7) COMPENSAÇÃO SAGA de verdade: só o CSR é regenerado, com a versão
  // corrigida (idadeMinima=12); o ICF não é tocado — preserva o que já estava certo.
  total++;
  const csrRegeneradoComVersaoCorreta =
    resultadoDivergencia.reacao.resultadoCSR.criterioUsado.idadeMinima === 12 &&
    resultadoDivergencia.reacao.resultadoCSR.versaoUsada === 2 &&
    resultadoDivergencia.decisaoSupervisor === 'saga_compensacao_csr' &&
    resultadoDivergencia.estadoProtocolo.historico.length === 1;
  console.log(
    `  [${csrRegeneradoComVersaoCorreta ? 'OK' : 'FALHOU'}] Compensação Saga: CSR regenerado com idadeMinima=12 (versão 2), histórico do protocolo preservado`
  );
  if (csrRegeneradoComVersaoCorreta) passou++;

  // 8) TIMEOUT REAL detectado e recuperado: o ICF trava (demora além do próprio
  // timeout) — isso precisa ser um ErroDeTimeout de verdade, não uma exceção de
  // aplicação — e o retry (falha transitória, sem persistirFalhaNoRetry) resolve
  // na primeira tentativa.
  total++;
  const resultadoTimeout = await rodarFluxoTrialForge('Estudo com agente travado', { forcarTravamentoICF: true });
  const timeoutDetectadoERecuperado =
    resultadoTimeout.reacao.erroICF?.includes('timeout') &&
    resultadoTimeout.decisaoSupervisor === 'retry_icf_executado_com_sucesso' &&
    resultadoTimeout.tentativasRetry === 1;
  console.log(
    `  [${timeoutDetectadoERecuperado ? 'OK' : 'FALHOU'}] Timeout real detectado (Promise.race, não exceção simulada) e recuperado no retry`
  );
  if (timeoutDetectadoERecuperado) passou++;

  // 9) RETRY ESGOTA O LIMITE: falha persistente (não transitória) — as 3
  // tentativas do retry também travam, o loop desiste depois de MAX_TENTATIVAS
  // e o Supervisor decide seguir em frente sem o resultado do ICF (CAP:
  // Disponibilidade sobre Consistência), não esperar pra sempre.
  total++;
  const resultadoEsgotado = await rodarFluxoTrialForge('Estudo com falha persistente', {
    forcarTravamentoICF: true,
    persistirFalhaNoRetry: true,
  });
  const retryEsgotado =
    resultadoEsgotado.decisaoSupervisor === 'retry_esgotado_seguindo_sem_icf' &&
    resultadoEsgotado.tentativasRetry === MAX_TENTATIVAS &&
    resultadoEsgotado.reacao.ok === false;
  console.log(
    `  [${retryEsgotado ? 'OK' : 'FALHOU'}] Retry com limite: esgota ${MAX_TENTATIVAS} tentativas numa falha persistente, Supervisor segue sem o ICF`
  );
  if (retryEsgotado) passou++;

  console.log(`Total: ${total} teste(s), ${passou} passou(passaram), ${total - passou} falhou(falharam).\n`);
  if (passou !== total) {
    throw new Error(`Testes falharam: ${passou}/${total} — corrija antes de considerar o protótipo pronto.`);
  }
}

// ---------- Demonstração narrada, igual ao Slide 3 + parágrafos 68-73 do TP ----------

async function main() {
  await rodarTestes();

  console.log('===== TRIALFORGE: FILA DE MENSAGENS (EventEmitter) =====\n');

  console.log('[Cenário 1] Caminho feliz — Protocolo primeiro, depois ICF+CSR em paralelo:');
  const feliz = await rodarFluxoTrialForge('Estudo fase II, 12-17 anos');
  console.log('  Evento protocolo:pronto:', feliz.dadoProtocolo);
  console.log('  Resultado ICF:', feliz.reacao.resultadoICF);
  console.log('  Resultado CSR:', feliz.reacao.resultadoCSR);
  console.log('  Decisão do Supervisor:', feliz.decisaoSupervisor);
  console.log('  Ordem real de execução:', feliz.ordemDeExecucao.join(' -> '));
  console.log();

  console.log('[Cenário 2] ICF falha, usando Promise.all (o bug do parágrafo 68-71):');
  const bug = await rodarFluxoTrialForge('Estudo fase II, 12-17 anos', {
    estrategia: 'promise.all',
    forcarFalhaICF: true,
  });
  console.log('  ok:', bug.reacao.ok, '| resultado do CSR preservado?', bug.reacao.resultadoCSRPreservado);
  console.log('  -> O CSR terminou bem, mas Promise.all rejeitou o lote inteiro: o resultado dele se perdeu.');
  console.log();

  console.log('[Cenário 3] Mesmo cenário, corrigido com Promise.allSettled — CAP + idempotência (parágrafo 72-73):');
  const corrigido = await rodarFluxoTrialForge('Estudo fase II, 12-17 anos', {
    estrategia: 'promise.allSettled',
    forcarFalhaICF: true,
  });
  console.log('  Resultado do CSR preservado?', corrigido.reacao.resultadoCSRPreservado);
  console.log('  Decisão do Supervisor:', corrigido.decisaoSupervisor);
  console.log(
    `  Documentos de ICF gravados: ${corrigido.documentosGerados.size} (${corrigido.tentativasICF} tentativas registradas nesse único documento)`
  );
  console.log('  -> O Supervisor não só decidiu o que refazer: refez de verdade, e o registro idempotente');
  console.log('     garantiu que a segunda tentativa não gerou um segundo documento de ICF.');
  console.log();

  console.log('[Cenário 4] Emenda do comitê de ética chega no meio do caminho — Saga de verdade:');
  const divergencia = await rodarFluxoTrialForge('Estudo com emenda ética', { comEmendaEtica: true });
  console.log('  Verificação de consistência:', divergencia.verificacao);
  console.log('  Decisão do Supervisor:', divergencia.decisaoSupervisor);
  console.log('  Resultado final do ICF (nunca tocado):', divergencia.reacao.resultadoICF.secao);
  console.log('  Resultado final do CSR (regenerado):', divergencia.reacao.resultadoCSR.sintese);
  console.log('  Histórico de revisões do protocolo:', divergencia.estadoProtocolo.historico);
  console.log('  -> O ICF terminou ANTES da emenda chegar — seu resultado já nasceu correto, nunca precisou');
  console.log('     ser refeito. O CSR terminou DEPOIS da emenda, mas com o critério antigo — o Supervisor');
  console.log('     detectou e regenerou só a parte dele, exatamente como o Módulo 3.2 promete e o Módulo 3.4');
  console.log('     formaliza como compensação Saga: desfazer só o que precisa, preservando o que já estava certo.');
  console.log();

  console.log('[Cenário 5] CAP completo — timeout real, retry com limite, e o limite esgotando:');
  const travado = await rodarFluxoTrialForge('Estudo com agente travado', { forcarTravamentoICF: true });
  console.log('  Erro do despacho original:', travado.reacao.erroICF);
  console.log('  Decisão do Supervisor:', travado.decisaoSupervisor, `(${travado.tentativasRetry} tentativa(s) de retry)`);
  console.log('  -> O ICF travou de verdade (Promise.race contra um timeout real), não lançou uma exceção —');
  console.log('     e o retry resolveu na primeira tentativa, porque a causa raiz era transitória.');
  console.log();

  const esgotado = await rodarFluxoTrialForge('Estudo com falha persistente', {
    forcarTravamentoICF: true,
    persistirFalhaNoRetry: true,
  });
  console.log('  Agora com falha PERSISTENTE (não transitória):');
  console.log('  Decisão do Supervisor:', esgotado.decisaoSupervisor, `(${esgotado.tentativasRetry} tentativa(s) de retry)`);
  console.log(`  Reação final ok? ${esgotado.reacao.ok}`);
  console.log(`  -> ${MAX_TENTATIVAS} tentativas esgotadas, o Supervisor desiste do ICF e segue em frente sem esse`);
  console.log('     resultado — Disponibilidade sobre Consistência, a mesma escolha do Teorema CAP (Módulo 3.4),');
  console.log('     nunca esperar pra sempre por um agente que não vai responder.');
  console.log();
}

if (require.main === module) {
  main().catch((erro) => {
    console.error('[Erro não tratado]', erro.message);
    process.exitCode = 1;
  });
}

module.exports = {
  agenteProtocolo,
  agenteICF,
  agenteCSR,
  rodarFluxoTrialForge,
  decidirEstrategiaDeRetry,
  verificarConsistencia,
  criarEstadoProtocolo,
  revisarProtocolo,
};

/*
 * Ahirton Lopes · AI Architecture Toolkit — UNIPDS: Arquitetura de Sistemas com IA
 * Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager
 */
