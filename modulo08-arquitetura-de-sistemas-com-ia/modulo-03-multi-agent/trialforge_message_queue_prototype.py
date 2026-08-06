"""
Ahirton Lopes · AI Architecture Toolkit
Artefato de Demo - Módulo 3.5

Protótipo: comunicação assíncrona entre os quatro agentes do TrialForge —
Protocolo, ICF, CSR e Supervisor — usando um equivalente mínimo do EventEmitter
do Node.js sobre asyncio (Slide 3). Demonstra TODOS os mecanismos do módulo
juntos, não só o padrão de comunicação:

  1) Sequential (Protocolo primeiro) + Parallel (ICF e CSR reagindo ao mesmo
     evento).
  2) CAP completo (Módulo 3.4) — os três mecanismos de verdade, não só
     narrados: TIMEOUT explícito (asyncio.wait_for contra um prazo real, não
     uma falha simulada por flag), RETRY COM LIMITE (loop de até 3 tentativas,
     desiste e segue em frente se todas falharem — Disponibilidade sobre
     Consistência), e IDEMPOTÊNCIA (registro que nunca duplica o documento,
     não importa quantas tentativas rodem).
  3) Verificação de consistência (Módulo 3.2, parágrafo 88 — "o Supervisor
     verifica se os critérios citados em cada um batem entre si"): o
     Protocolo é um recurso VERSIONADO e mutável, não um valor congelado —
     uma emenda pode chegar enquanto ICF/CSR já estão trabalhando com uma
     cópia mais antiga. Cada agente registra a versão que USOU e a versão
     que estava vigente quando ELE PRÓPRIO terminou; o Supervisor compara
     as duas para cada agente e só assim consegue detectar defasagem — sem
     esse registro, a divergência seria silenciosa.
  4) Compensação Saga de verdade (Módulo 3.4): quando o Supervisor detecta
     que um agente ficou defasado, ele regenera SÓ o resultado daquele
     agente com a versão corrigida — o outro agente, que não ficou
     defasado, nunca é retrabalhado.

IMPORTANTE — (2) é Teorema CAP, (3)+(4) é Saga. São dois mecanismos
DIFERENTES do Módulo 3.4, cada um resolvendo um problema diferente: (2)
trata falha técnica no meio da execução; (3)+(4) trata um problema de
conteúdo descoberto DEPOIS que o trabalho já tinha terminado com sucesso.
Não confundir os dois é o próprio ponto do Módulo 3.4.

Sem dependência externa (só asyncio, da biblioteca padrão) — os "agentes"
aqui são funções que simulam trabalho assíncrono (asyncio.sleep) e retornam
dado estruturado: o objetivo é o padrão de comunicação, não a qualidade de
um modelo — por isso este demo não chama nenhum LLM, diferente dos demais.

Versão em Python do mesmo exemplo de trialforge-message-queue-prototype.js
(a Missão Prática #03 pede o protótipo em JavaScript, conforme a ementa —
esta versão em Python é material de referência).

Uso: python trialforge_message_queue_prototype.py
"""

import asyncio
import time

# Tempos de simulação de trabalho, proporcionais aos timeouts reais definidos
# no Slide 2 (30s/45s/60s) mas escalados ÷100 pra manter a demo rápida — o que
# importa aqui é a proporção entre os três, não o valor absoluto em segundos.
TEMPO_PROTOCOLO_S = 0.3
TEMPO_ICF_S = 0.45
TEMPO_CSR_S = 0.6

# A emenda do comitê de ética dispara 500ms depois do protocolo:pronto —
# depois que o ICF já terminou (450ms), mas antes do CSR terminar (600ms).
# Não é uma corrida: são atrasos fixos e diferentes, a ordem de conclusão é
# determinística.
TEMPO_EMENDA_S = 0.5

CRITERIOS_INICIAIS = {"idade_minima": 13}

# Timeout explícito de verdade (Slide 2: 30s/45s/60s ÷100), com margem de
# segurança sobre o tempo normal de trabalho — não é o mesmo valor do tempo de
# trabalho, senão toda execução normal flertaria com o próprio timeout.
MARGEM_DE_SEGURANCA = 1.5
TIMEOUT_PROTOCOLO_S = round(TEMPO_PROTOCOLO_S * MARGEM_DE_SEGURANCA, 3)
TIMEOUT_ICF_S = round(TEMPO_ICF_S * MARGEM_DE_SEGURANCA, 3)
TIMEOUT_CSR_S = round(TEMPO_CSR_S * MARGEM_DE_SEGURANCA, 3)

# Simula um agente travado: demora bem mais que o próprio timeout, então
# nunca chega a responder a tempo — bem diferente de "lançou uma exceção".
TEMPO_ICF_TRAVADO_S = TIMEOUT_ICF_S * 3

# "até três tentativas" (Slide 2, parágrafo sobre o Agente Protocolo) — mesmo
# limite aplicado de forma consistente na política de retry do ICF.
MAX_TENTATIVAS = 3


class ErroDeTimeout(Exception):
    def __init__(self, nome_agente, timeout_s):
        super().__init__(f"{nome_agente}: timeout de {timeout_s}s excedido — agente não respondeu a tempo.")


async def com_timeout(coro, timeout_s, nome_agente):
    """asyncio.wait_for já é um Promise.race real contra um prazo — se o
    agente não resolver a tempo, wait_for cancela a tarefa e levanta
    asyncio.TimeoutError, que aqui é traduzido pro nosso ErroDeTimeout com
    o nome do agente. O Supervisor descobre sozinho que o agente travou,
    sem precisar que o agente "avise" nada."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout_s)
    except asyncio.TimeoutError:
        raise ErroDeTimeout(nome_agente, timeout_s)


class Barramento:
    """Equivalente mínimo do EventEmitter nativo do Node.js — só o necessário
    pra replicar o padrão pub/sub deste protótipo em cima do asyncio."""

    def __init__(self):
        self._ouvinte_unico = {}

    def once(self, evento, ouvinte):
        self._ouvinte_unico[evento] = ouvinte

    def emit(self, evento, dado):
        ouvinte = self._ouvinte_unico.pop(evento, None)
        if ouvinte:
            asyncio.create_task(ouvinte(dado))  # não-bloqueante: publica e segue em frente


# ---------- Estado do Protocolo: um recurso VERSIONADO, não um valor congelado ----------
# (Módulo 3.4: "O Protocolo versão 1 não é apagado — ele é versionado, preservado
# como histórico, e uma versão 2 é criada com o critério corrigido.")


def criar_estado_protocolo(criterios_iniciais):
    return {"versao": 1, "criterios": dict(criterios_iniciais), "historico": []}


def revisar_protocolo(estado_protocolo, novos_criterios, motivo):
    estado_protocolo["historico"].append(
        {
            "versao_anterior": estado_protocolo["versao"],
            "criterios_anteriores": dict(estado_protocolo["criterios"]),
            "motivo": motivo,
        }
    )
    estado_protocolo["versao"] += 1
    estado_protocolo["criterios"] = {**estado_protocolo["criterios"], **novos_criterios}


# ---------- Os agentes (Slide 2: A Arquitetura Completa) ----------


async def agente_protocolo(barramento, estudo, estado_protocolo, ordem_de_execucao, opcoes=None):
    opcoes = opcoes or {}
    await asyncio.sleep(TEMPO_PROTOCOLO_S)
    if opcoes.get("forcar_falha_protocolo"):
        raise RuntimeError("Agente Protocolo: falha simulada ao gerar critérios.")
    ordem_de_execucao.append("protocolo")  # registrado ANTES do emit: prova causal de que Sequential foi respeitado
    # Evento rico (parágrafos 62-64 do TP): carrega o dado completo — os critérios
    # estruturados, não só uma notificação vazia. É uma CÓPIA do estado atual, não
    # uma referência: revisões futuras no estado_protocolo não mudam retroativamente
    # o que já foi publicado neste evento.
    dado = {"versao": estado_protocolo["versao"], "criterios": dict(estado_protocolo["criterios"]), "estudo": estudo}
    barramento.emit("protocolo:pronto", dado)

    if opcoes.get("com_emenda_etica"):
        # Simula uma emenda chegando de forma assíncrona, independente do fluxo
        # principal — exatamente como um comitê de ética revisaria um critério
        # dias ou semanas depois, sem nenhuma relação com o timing de ICF/CSR.
        loop = asyncio.get_event_loop()
        loop.call_later(
            TEMPO_EMENDA_S,
            revisar_protocolo,
            estado_protocolo,
            {"idade_minima": 12},
            "Comitê de ética corrigiu a idade mínima de 13 para 12 anos.",
        )

    return dado


def registrar_documento(documentos_gerados, chave, resultado):
    """Registro idempotente: simula o "banco de documentos" do lado de fora do
    agente. A mesma chave nunca gera um segundo documento — só incrementa o
    contador de tentativas, que é o que permite um retry seguro (parágrafo
    72-73 do TP fala em "tentar de novo", mas retry só é seguro se idempotente)."""
    existente = documentos_gerados.get(chave)
    if existente:
        existente["tentativas"] += 1
        return existente
    registro = {"resultado": resultado, "tentativas": 1}
    documentos_gerados[chave] = registro
    return registro


async def agente_icf(dado_protocolo, estado_protocolo, documentos_gerados, ordem_de_execucao, opcoes=None):
    opcoes = opcoes or {}
    ordem_de_execucao.append("icf:inicio")  # registrado ANTES do sleep: prova que só começa depois do protocolo:pronto
    # forcar_travamento_icf simula o agente travado (demora além do timeout) — bem
    # diferente de forcar_falha_icf, que simula uma exceção lançada dentro do próprio agente.
    await asyncio.sleep(TEMPO_ICF_TRAVADO_S if opcoes.get("forcar_travamento_icf") else TEMPO_ICF_S)
    chave = f"{dado_protocolo['versao']}:icf"
    resultado = {
        "agente": "ICF",
        "secao": (
            f"Assentimento gerado com idade mínima de {dado_protocolo['criterios']['idade_minima']} anos "
            f"(a partir da versão {dado_protocolo['versao']} do protocolo)."
        ),
        "criterio_usado": dict(dado_protocolo["criterios"]),
        "versao_usada": dado_protocolo["versao"],
        # Conferido na hora de concluir, não na hora de começar — é isso que permite
        # o Supervisor perceber se uma emenda chegou enquanto o ICF ainda trabalhava.
        "versao_ao_concluir": estado_protocolo["versao"],
    }
    # O documento é gravado ANTES da falha simulada: o cenário real que retry
    # precisa tratar não é "a tarefa nunca rodou", é "a tarefa rodou, mas a
    # confirmação se perdeu" (timeout de rede, ack perdido) — daí a necessidade
    # de idempotência, não só de tentar de novo.
    registro = registrar_documento(documentos_gerados, chave, resultado)
    if opcoes.get("forcar_falha_icf"):
        raise RuntimeError("Agente ICF: falha simulada na confirmação, depois do documento já ter sido gravado.")
    return {**resultado, "tentativas": registro["tentativas"]}


async def agente_csr(dado_protocolo, estado_protocolo, ordem_de_execucao):
    ordem_de_execucao.append("csr:inicio")  # registrado ANTES do sleep: prova que só começa depois do protocolo:pronto
    await asyncio.sleep(TEMPO_CSR_S)
    return {
        "agente": "CSR",
        "sintese": (
            f"Conformidade ICH E3 verificada com idade mínima de {dado_protocolo['criterios']['idade_minima']} anos "
            f"(a partir da versão {dado_protocolo['versao']} do protocolo)."
        ),
        "criterio_usado": dict(dado_protocolo["criterios"]),
        "versao_usada": dado_protocolo["versao"],
        "versao_ao_concluir": estado_protocolo["versao"],
    }


# ---------- Reação Parallel ao evento: gather() (bug) vs gather(return_exceptions=True) (correção) ----------


async def inscrever_reacao_paralela(barramento, estrategia, opcoes_falha, documentos_gerados, ordem_de_execucao, estado_protocolo):
    futuro = asyncio.get_event_loop().create_future()

    async def ao_receber(dado_protocolo):
        tarefa_icf = asyncio.create_task(
            com_timeout(
                agente_icf(dado_protocolo, estado_protocolo, documentos_gerados, ordem_de_execucao, opcoes_falha),
                TIMEOUT_ICF_S,
                "Agente ICF",
            )
        )
        tarefa_csr = asyncio.create_task(
            com_timeout(agente_csr(dado_protocolo, estado_protocolo, ordem_de_execucao), TIMEOUT_CSR_S, "Agente CSR")
        )

        if estrategia == "gather_sem_excecoes":
            try:
                resultado_icf, resultado_csr = await asyncio.gather(tarefa_icf, tarefa_csr)
                futuro.set_result(
                    {"ok": True, "resultado_icf": resultado_icf, "resultado_csr": resultado_csr, "resultado_csr_preservado": True}
                )
            except Exception as erro:
                # BUG (TP, parágrafos 68-71): sem return_exceptions, gather() rejeita tudo à
                # primeira falha — mesmo que o CSR tenha terminado bem, seu resultado se perde.
                futuro.set_result({"ok": False, "erro": str(erro), "resultado_csr_preservado": False})
        else:
            resultado_icf, resultado_csr = await asyncio.gather(tarefa_icf, tarefa_csr, return_exceptions=True)
            icf_ok = not isinstance(resultado_icf, Exception)
            csr_ok = not isinstance(resultado_csr, Exception)
            futuro.set_result(
                {
                    "ok": icf_ok and csr_ok,
                    "resultado_icf": resultado_icf if icf_ok else None,
                    "resultado_csr": resultado_csr if csr_ok else None,
                    "erro_icf": str(resultado_icf) if not icf_ok else None,
                    "resultado_csr_preservado": csr_ok,
                }
            )

    barramento.once("protocolo:pronto", ao_receber)
    return futuro


# ---------- Supervisor, mecanismo 1: decide a estratégia de retry (CAP) ----------
#
# IMPORTANTE — isto NÃO é o padrão Saga: o ICF falhou DENTRO da própria
# execução (uma exceção lançada na hora de gerar o documento), não é um
# problema descoberto DEPOIS por uma etapa posterior sobre um trabalho que já
# tinha terminado com sucesso. Pela definição do Módulo 3.4 (parágrafo 52),
# isso é Teorema CAP — timeout, retry com limite, idempotência — o mesmo
# exemplo do Agente ICF recebendo a mesma solicitação duas vezes que o
# próprio Módulo 3.4 já usa (parágrafo 42). Saga é o mecanismo 2, logo abaixo.


def decidir_estrategia_de_retry(reacao):
    if reacao["ok"]:
        return "nenhum_retry_necessario"
    if reacao["resultado_csr_preservado"]:
        return "retry_icf_apenas"  # só refaz quem falhou, preserva o CSR que já terminou
    return "retry_ambos"  # sem visibilidade de quem terminou bem, precisa refazer tudo


async def executar_icf_com_retry(dado_protocolo, estado_protocolo, documentos_gerados, ordem_de_execucao, opcoes_falha):
    """Retry COM LIMITE de verdade — não um único retry incondicional. Tenta até
    MAX_TENTATIVAS vezes, cada uma protegida pelo mesmo timeout real do
    despacho original; se a falha é transitória (o padrão comum: ack perdido,
    rede instável), a causa raiz já passou e a 2ª tentativa resolve. Se a
    falha é persistente, o loop esgota as tentativas e desiste — CAP manda
    decidir entre esperar mais ou seguir em frente sem aquele resultado
    (Disponibilidade sobre Consistência), não esperar pra sempre."""
    persistente = opcoes_falha.get("persistir_falha_no_retry")
    ultimo_erro = None
    for tentativa in range(1, MAX_TENTATIVAS + 1):
        opcoes_da_tentativa = (
            {
                "forcar_falha_icf": opcoes_falha.get("forcar_falha_icf"),
                "forcar_travamento_icf": opcoes_falha.get("forcar_travamento_icf"),
            }
            if persistente
            else {}
        )
        try:
            resultado = await com_timeout(
                agente_icf(dado_protocolo, estado_protocolo, documentos_gerados, ordem_de_execucao, opcoes_da_tentativa),
                TIMEOUT_ICF_S,
                "Agente ICF",
            )
            return {"sucesso": True, "resultado": resultado, "tentativas_feitas": tentativa}
        except Exception as erro:
            ultimo_erro = erro
    return {"sucesso": False, "erro": str(ultimo_erro), "tentativas_feitas": MAX_TENTATIVAS}


# ---------- Supervisor, mecanismo 2: verifica consistência (Módulo 3.2, parágrafo 88) ----------
#
# "O Supervisor... verifica se os critérios citados em cada um batem entre
# si." A checagem não compara ICF/CSR contra "o valor mais atual agora" — ela
# compara, PARA CADA AGENTE, a versão que ele usou contra a versão que já
# estava vigente quando ELE PRÓPRIO terminou. Um agente que termina ANTES de
# uma emenda chegar está correto (não há nada mais novo ainda); um agente que
# termina DEPOIS de uma emenda chegar, mas ainda carrega o valor antigo, ficou
# defasado — mesmo sem nenhuma exceção ter sido lançada em lugar nenhum.


def verificar_consistencia(resultado_icf, resultado_csr):
    icf_consistente = resultado_icf["versao_usada"] == resultado_icf["versao_ao_concluir"]
    csr_consistente = resultado_csr["versao_usada"] == resultado_csr["versao_ao_concluir"]
    agentes_divergentes = []
    if not icf_consistente:
        agentes_divergentes.append("ICF")
    if not csr_consistente:
        agentes_divergentes.append("CSR")
    return {
        "consistente": len(agentes_divergentes) == 0,
        "icf_consistente": icf_consistente,
        "csr_consistente": csr_consistente,
        "agentes_divergentes": agentes_divergentes,
    }


# ---------- Supervisor, mecanismo 2 (continuação): compensação Saga de verdade ----------
#
# (Módulo 3.4: "A compensação, ao contrário, desfaz apenas o que precisa ser
# desfeito... preservando o que já estava certo.") Só o agente que ficou
# defasado é regenerado, com a versão CORRIGIDA do protocolo — o outro agente,
# que já estava consistente, nunca é retrabalhado.


async def compensar_divergencia(agentes_divergentes, estado_protocolo, estudo, documentos_gerados, ordem_de_execucao):
    dado_atual = {"versao": estado_protocolo["versao"], "criterios": dict(estado_protocolo["criterios"]), "estudo": estudo}
    resultado = {}
    if "ICF" in agentes_divergentes:
        resultado["resultado_icf"] = await agente_icf(dado_atual, estado_protocolo, documentos_gerados, ordem_de_execucao, {})
    if "CSR" in agentes_divergentes:
        resultado["resultado_csr"] = await agente_csr(dado_atual, estado_protocolo, ordem_de_execucao)
    return resultado


# ---------- Fluxo completo: Sequential -> Parallel -> Supervisor (retry CAP + consistência Saga) ----------


async def rodar_fluxo_trialforge(estudo, estrategia="gather_com_excecoes", **opcoes_falha):
    # Escopo por fluxo, não módulo: cada chamada tem seu próprio "banco de
    # documentos", seu próprio registro de ordem de execução, e seu próprio
    # estado de protocolo — não compartilhados entre estudos.
    documentos_gerados = {}
    ordem_de_execucao = []
    estado_protocolo = criar_estado_protocolo(CRITERIOS_INICIAIS)
    barramento = Barramento()
    futuro_reacao = await inscrever_reacao_paralela(
        barramento, estrategia, opcoes_falha, documentos_gerados, ordem_de_execucao, estado_protocolo
    )  # inscreve ANTES do emit
    dado_protocolo = await com_timeout(
        agente_protocolo(barramento, estudo, estado_protocolo, ordem_de_execucao, opcoes_falha),
        TIMEOUT_PROTOCOLO_S,
        "Agente Protocolo",
    )  # Sequential
    reacao = await futuro_reacao  # Parallel já rodou concorrente enquanto isso resolvia
    decisao_supervisor = decidir_estrategia_de_retry(reacao)
    tentativas_retry = 0

    if decisao_supervisor == "retry_icf_apenas":
        # O retry de verdade, COM LIMITE (CAP, Módulo 3.4): reaproveita a MESMA
        # chave de idempotência em cada tentativa, provando que nenhuma delas
        # duplica o documento do ICF.
        resultado_retry = await executar_icf_com_retry(
            dado_protocolo, estado_protocolo, documentos_gerados, ordem_de_execucao, opcoes_falha
        )
        tentativas_retry = resultado_retry["tentativas_feitas"]
        if resultado_retry["sucesso"]:
            reacao = {**reacao, "resultado_icf": resultado_retry["resultado"], "ok": True}
            decisao_supervisor = "retry_icf_executado_com_sucesso"
        else:
            # CAP: o limite de tentativas esgotou — decide seguir em frente sem esse
            # resultado (Disponibilidade), em vez de esperar pra sempre (Consistência).
            reacao = {**reacao, "ok": False, "erro_icf": resultado_retry["erro"]}
            decisao_supervisor = "retry_esgotado_seguindo_sem_icf"

    tentativas_icf = documentos_gerados.get(f"{dado_protocolo['versao']}:icf", {}).get("tentativas", 0)

    # Mecanismo 2: só faz sentido verificar consistência quando os dois
    # resultados de conteúdo existem de verdade (depois do mecanismo 1 já ter
    # resolvido qualquer falha técnica).
    verificacao = None
    if reacao["ok"] and reacao.get("resultado_icf") and reacao.get("resultado_csr"):
        verificacao = verificar_consistencia(reacao["resultado_icf"], reacao["resultado_csr"])
        if not verificacao["consistente"]:
            compensacao_saga = await compensar_divergencia(
                verificacao["agentes_divergentes"], estado_protocolo, estudo, documentos_gerados, ordem_de_execucao
            )
            if "resultado_icf" in compensacao_saga:
                reacao = {**reacao, "resultado_icf": compensacao_saga["resultado_icf"]}
            if "resultado_csr" in compensacao_saga:
                reacao = {**reacao, "resultado_csr": compensacao_saga["resultado_csr"]}
            decisao_supervisor = "saga_compensacao_" + "_e_".join(verificacao["agentes_divergentes"]).lower()

    return {
        "dado_protocolo": dado_protocolo,
        "reacao": reacao,
        "decisao_supervisor": decisao_supervisor,
        "documentos_gerados": documentos_gerados,
        "tentativas_icf": tentativas_icf,
        "tentativas_retry": tentativas_retry,
        "ordem_de_execucao": ordem_de_execucao,
        "estado_protocolo": estado_protocolo,
        "verificacao": verificacao,
    }


# ---------- Testes automatizados ----------


async def rodar_testes():
    print("== Testes: trialforge_message_queue_prototype ==")
    passou = 0
    total = 0

    # 1) Evento rico: protocolo:pronto carrega versao + criterios estruturados
    total += 1
    resultado_feliz = await rodar_fluxo_trialforge("Estudo fase II")
    evento_eh_rico = resultado_feliz["dado_protocolo"]["versao"] == 1 and isinstance(
        resultado_feliz["dado_protocolo"]["criterios"].get("idade_minima"), int
    )
    print(f"  [{'OK' if evento_eh_rico else 'FALHOU'}] evento 'protocolo:pronto' carrega versao+criterios estruturados (evento rico)")
    if evento_eh_rico:
        passou += 1

    # 2) Caminho feliz: ICF e CSR completam, Supervisor não aciona retry nem compensação
    total += 1
    ok_feliz = (
        resultado_feliz["reacao"]["ok"]
        and resultado_feliz["decisao_supervisor"] == "nenhum_retry_necessario"
        and resultado_feliz["verificacao"] is not None
        and resultado_feliz["verificacao"]["consistente"] is True
    )
    print(f"  [{'OK' if ok_feliz else 'FALHOU'}] caminho feliz: ICF+CSR ok, sem retry, consistência confirmada")
    if ok_feliz:
        passou += 1

    # 3) BUG documentado: sem return_exceptions, falha do ICF perde o resultado bom do CSR
    total += 1
    resultado_bug = await rodar_fluxo_trialforge("Estudo fase II", estrategia="gather_sem_excecoes", forcar_falha_icf=True)
    bug_confirmado = resultado_bug["reacao"]["ok"] is False and resultado_bug["reacao"]["resultado_csr_preservado"] is False
    print(
        f"  [{'OK' if bug_confirmado else 'FALHOU'}] gather() sem return_exceptions: falha do ICF perde o resultado do CSR (bug do parágrafo 68-71)"
    )
    if bug_confirmado:
        passou += 1

    # 4) CORREÇÃO: com return_exceptions=True, o mesmo cenário preserva o resultado do CSR
    # e o Supervisor de fato executa o retry (não só decide, executa)
    total += 1
    resultado_corrigido = await rodar_fluxo_trialforge(
        "Estudo fase II", estrategia="gather_com_excecoes", forcar_falha_icf=True
    )
    correcao_confirmada = (
        resultado_corrigido["reacao"]["resultado_csr_preservado"] is True
        and resultado_corrigido["decisao_supervisor"] == "retry_icf_executado_com_sucesso"
        and resultado_corrigido["reacao"]["ok"] is True
    )
    print(
        f"  [{'OK' if correcao_confirmada else 'FALHOU'}] return_exceptions=True: CSR preservado, retry do ICF executado de verdade e com sucesso"
    )
    if correcao_confirmada:
        passou += 1

    # 4b) IDEMPOTÊNCIA: a mesma chave (versao:icf) não pode virar 2 documentos só
    # porque o agente foi chamado 2 vezes — tem que ficar 1 documento com 2 tentativas
    total += 1
    idempotencia_confirmada = (
        len(resultado_corrigido["documentos_gerados"]) == 1 and resultado_corrigido["tentativas_icf"] == 2
    )
    print(
        f"  [{'OK' if idempotencia_confirmada else 'FALHOU'}] Idempotência: 1 documento só (não 2) após falha + retry, com 2 tentativas registradas"
    )
    if idempotencia_confirmada:
        passou += 1

    # 5) Sequential respeitado: prova CAUSAL direta via ordem real de invocação,
    # não um proxy de tempo — 'protocolo' tem que aparecer no log ANTES de
    # 'icf:inicio' e 'csr:inicio', porque os dois só devem começar depois do
    # evento 'protocolo:pronto' disparar.
    total += 1
    resultado_ordem = await rodar_fluxo_trialforge("Estudo de ordem")
    ordem_de_execucao = resultado_ordem["ordem_de_execucao"]
    idx_protocolo = ordem_de_execucao.index("protocolo") if "protocolo" in ordem_de_execucao else -1
    idx_icf = ordem_de_execucao.index("icf:inicio") if "icf:inicio" in ordem_de_execucao else -1
    idx_csr = ordem_de_execucao.index("csr:inicio") if "csr:inicio" in ordem_de_execucao else -1
    sequential_respeitado = idx_protocolo != -1 and idx_protocolo < idx_icf and idx_protocolo < idx_csr
    print(
        f"  [{'OK' if sequential_respeitado else 'FALHOU'}] Sequential respeitado (prova causal): ordem real = {ordem_de_execucao}"
    )
    if sequential_respeitado:
        passou += 1

    # 6) DIVERGÊNCIA DETECTADA: com uma emenda chegando no meio do caminho, o CSR
    # (mais lento, termina depois da emenda) fica defasado; o ICF (mais rápido,
    # termina antes da emenda) continua consistente. Exatamente o exemplo do
    # Módulo 3.1/3.2: "idade mínima de doze anos" vs. "treze anos".
    total += 1
    resultado_divergencia = await rodar_fluxo_trialforge("Estudo com emenda", com_emenda_etica=True)
    verificacao_divergencia = resultado_divergencia["verificacao"]
    divergencia_detectada = (
        verificacao_divergencia is not None
        and verificacao_divergencia["consistente"] is False
        and verificacao_divergencia["icf_consistente"] is True
        and verificacao_divergencia["csr_consistente"] is False
        and verificacao_divergencia["agentes_divergentes"] == ["CSR"]
    )
    print(
        f"  [{'OK' if divergencia_detectada else 'FALHOU'}] Divergência detectada: ICF consistente, CSR defasado (só ele, exatamente como o Módulo 3.2 descreve)"
    )
    if divergencia_detectada:
        passou += 1

    # 7) COMPENSAÇÃO SAGA de verdade: só o CSR é regenerado, com a versão
    # corrigida (idade_minima=12); o ICF não é tocado — preserva o que já estava certo.
    total += 1
    csr_regenerado_com_versao_correta = (
        resultado_divergencia["reacao"]["resultado_csr"]["criterio_usado"]["idade_minima"] == 12
        and resultado_divergencia["reacao"]["resultado_csr"]["versao_usada"] == 2
        and resultado_divergencia["decisao_supervisor"] == "saga_compensacao_csr"
        and len(resultado_divergencia["estado_protocolo"]["historico"]) == 1
    )
    print(
        f"  [{'OK' if csr_regenerado_com_versao_correta else 'FALHOU'}] Compensação Saga: CSR regenerado com idade_minima=12 (versão 2), histórico do protocolo preservado"
    )
    if csr_regenerado_com_versao_correta:
        passou += 1

    # 8) TIMEOUT REAL detectado e recuperado: o ICF trava (demora além do próprio
    # timeout) — isso precisa ser um ErroDeTimeout de verdade, não uma exceção de
    # aplicação — e o retry (falha transitória, sem persistir_falha_no_retry) resolve
    # na primeira tentativa.
    total += 1
    resultado_timeout = await rodar_fluxo_trialforge("Estudo com agente travado", forcar_travamento_icf=True)
    erro_icf = resultado_timeout["reacao"].get("erro_icf") or ""
    timeout_detectado_e_recuperado = (
        "timeout" in erro_icf
        and resultado_timeout["decisao_supervisor"] == "retry_icf_executado_com_sucesso"
        and resultado_timeout["tentativas_retry"] == 1
    )
    print(
        f"  [{'OK' if timeout_detectado_e_recuperado else 'FALHOU'}] Timeout real detectado (wait_for, não exceção simulada) e recuperado no retry"
    )
    if timeout_detectado_e_recuperado:
        passou += 1

    # 9) RETRY ESGOTA O LIMITE: falha persistente (não transitória) — as 3
    # tentativas do retry também travam, o loop desiste depois de MAX_TENTATIVAS
    # e o Supervisor decide seguir em frente sem o resultado do ICF (CAP:
    # Disponibilidade sobre Consistência), não esperar pra sempre.
    total += 1
    resultado_esgotado = await rodar_fluxo_trialforge(
        "Estudo com falha persistente", forcar_travamento_icf=True, persistir_falha_no_retry=True
    )
    retry_esgotado = (
        resultado_esgotado["decisao_supervisor"] == "retry_esgotado_seguindo_sem_icf"
        and resultado_esgotado["tentativas_retry"] == MAX_TENTATIVAS
        and resultado_esgotado["reacao"]["ok"] is False
    )
    print(
        f"  [{'OK' if retry_esgotado else 'FALHOU'}] Retry com limite: esgota {MAX_TENTATIVAS} tentativas numa falha persistente, Supervisor segue sem o ICF"
    )
    if retry_esgotado:
        passou += 1

    print(f"Total: {total} teste(s), {passou} passou(passaram), {total - passou} falhou(falharam).\n")
    if passou != total:
        raise AssertionError(f"Testes falharam: {passou}/{total} — corrija antes de considerar o protótipo pronto.")


# ---------- Demonstração narrada, igual ao Slide 3 + parágrafos 68-73 do TP ----------


async def main():
    await rodar_testes()

    print("===== TRIALFORGE: FILA DE MENSAGENS (Barramento sobre asyncio) =====\n")

    print("[Cenário 1] Caminho feliz — Protocolo primeiro, depois ICF+CSR em paralelo:")
    feliz = await rodar_fluxo_trialforge("Estudo fase II, 12-17 anos")
    print("  Evento protocolo:pronto:", feliz["dado_protocolo"])
    print("  Resultado ICF:", feliz["reacao"]["resultado_icf"])
    print("  Resultado CSR:", feliz["reacao"]["resultado_csr"])
    print("  Decisão do Supervisor:", feliz["decisao_supervisor"])
    print("  Ordem real de execução:", " -> ".join(feliz["ordem_de_execucao"]))
    print()

    print("[Cenário 2] ICF falha, usando gather() sem return_exceptions (o bug do parágrafo 68-71):")
    bug = await rodar_fluxo_trialforge("Estudo fase II, 12-17 anos", estrategia="gather_sem_excecoes", forcar_falha_icf=True)
    print("  ok:", bug["reacao"]["ok"], "| resultado do CSR preservado?", bug["reacao"]["resultado_csr_preservado"])
    print("  -> O CSR terminou bem, mas o gather() rejeitou o lote inteiro: o resultado dele se perdeu.")
    print()

    print("[Cenário 3] Mesmo cenário, corrigido com return_exceptions=True — CAP + idempotência (parágrafo 72-73):")
    corrigido = await rodar_fluxo_trialforge(
        "Estudo fase II, 12-17 anos", estrategia="gather_com_excecoes", forcar_falha_icf=True
    )
    print("  Resultado do CSR preservado?", corrigido["reacao"]["resultado_csr_preservado"])
    print("  Decisão do Supervisor:", corrigido["decisao_supervisor"])
    print(
        f"  Documentos de ICF gravados: {len(corrigido['documentos_gerados'])} "
        f"({corrigido['tentativas_icf']} tentativas registradas nesse único documento)"
    )
    print("  -> O Supervisor não só decidiu o que refazer: refez de verdade, e o registro idempotente")
    print("     garantiu que a segunda tentativa não gerou um segundo documento de ICF.")
    print()

    print("[Cenário 4] Emenda do comitê de ética chega no meio do caminho — Saga de verdade:")
    divergencia = await rodar_fluxo_trialforge("Estudo com emenda ética", com_emenda_etica=True)
    print("  Verificação de consistência:", divergencia["verificacao"])
    print("  Decisão do Supervisor:", divergencia["decisao_supervisor"])
    print("  Resultado final do ICF (nunca tocado):", divergencia["reacao"]["resultado_icf"]["secao"])
    print("  Resultado final do CSR (regenerado):", divergencia["reacao"]["resultado_csr"]["sintese"])
    print("  Histórico de revisões do protocolo:", divergencia["estado_protocolo"]["historico"])
    print("  -> O ICF terminou ANTES da emenda chegar — seu resultado já nasceu correto, nunca precisou")
    print("     ser refeito. O CSR terminou DEPOIS da emenda, mas com o critério antigo — o Supervisor")
    print("     detectou e regenerou só a parte dele, exatamente como o Módulo 3.2 promete e o Módulo 3.4")
    print("     formaliza como compensação Saga: desfazer só o que precisa, preservando o que já estava certo.")
    print()

    print("[Cenário 5] CAP completo — timeout real, retry com limite, e o limite esgotando:")
    travado = await rodar_fluxo_trialforge("Estudo com agente travado", forcar_travamento_icf=True)
    print("  Erro do despacho original:", travado["reacao"].get("erro_icf"))
    print(
        "  Decisão do Supervisor:", travado["decisao_supervisor"], f"({travado['tentativas_retry']} tentativa(s) de retry)"
    )
    print("  -> O ICF travou de verdade (asyncio.wait_for contra um timeout real), não lançou uma exceção —")
    print("     e o retry resolveu na primeira tentativa, porque a causa raiz era transitória.")
    print()

    esgotado = await rodar_fluxo_trialforge(
        "Estudo com falha persistente", forcar_travamento_icf=True, persistir_falha_no_retry=True
    )
    print("  Agora com falha PERSISTENTE (não transitória):")
    print(
        "  Decisão do Supervisor:", esgotado["decisao_supervisor"], f"({esgotado['tentativas_retry']} tentativa(s) de retry)"
    )
    print(f"  Reação final ok? {esgotado['reacao']['ok']}")
    print(f"  -> {MAX_TENTATIVAS} tentativas esgotadas, o Supervisor desiste do ICF e segue em frente sem esse")
    print("     resultado — Disponibilidade sobre Consistência, a mesma escolha do Teorema CAP (Módulo 3.4),")
    print("     nunca esperar pra sempre por um agente que não vai responder.")
    print()


if __name__ == "__main__":
    asyncio.run(main())


# Ahirton Lopes · AI Architecture Toolkit — UNIPDS: Arquitetura de Sistemas com IA
# Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager
