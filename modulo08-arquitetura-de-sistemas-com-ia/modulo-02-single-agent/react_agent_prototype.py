"""
Ahirton Lopes · AI Architecture Toolkit
Artefato de Demo - Módulo 2.5

Protótipo: Agente único do TrialForge (geração da seção de assentimento do ICF)
Padrão: loop ReAct (Módulo 2.2) + ferramenta com schema tipado (Módulo 2.4)
Sem fila de mensagens — isso fica para o Módulo 3 (multi-agente).

Versão em Python do mesmo exemplo de react-agent-prototype.js (a Missão Prática
#02 pede o protótipo em JavaScript, conforme a ementa — esta versão em Python é
material de referência, para quem quiser comparar ou usar noutro contexto).

Modelo: Ollama local, rodando gemma4:e2b (~7.2GB de download) — gratuito, sem chave
de API, sem cartão, roda inteiro na sua máquina. Alternativas pagas (Claude, Gemini,
GPT) estão em demos/provedores_pagos.py — mesmo loop, só a chamada ao modelo muda.
É a mesma lição do diagrama de referência do Módulo 1.2: o modelo é a única peça que
se troca; Orquestrador, ferramenta e critério de parada não mudam nadinha.

Trade-off de rodar local (detalhado no TP do Módulo 2.5): grátis, privado, sem rate
limit, mas exige espaço em disco e RAM, e a qualidade de resposta é mais limitada que
um modelo de fronteira. É decisão de prototipagem/aprendizado, não de produção — em
produção real (Módulo 5), essa escolha pesaria escala e conformidade, não custo zero.

Requer: 1) instalar o Ollama (ollama.com), deixar rodando em segundo plano, e rodar
           `ollama pull gemma4:e2b` (~7.2GB — faça esse download com calma antes)
        2) pip install ollama
Uso:    python react_agent_prototype.py
"""

import json
import time

from ollama import chat

MAX_ITERACOES = 4
# Em Mac com Apple Silicon, "gemma4:e2b-mlx" é mais rápido e mais leve (testado e funcionando).
MODELO = "gemma4:e2b"

# Ferramenta tipada (Módulo 2.4): schema explícito, nunca texto livre
BUSCAR_CLAUSULA_REGULATORIA = {
    "type": "function",
    "function": {
        "name": "buscar_clausula_regulatoria",
        "description": (
            "Busca cláusulas regulatórias de estudos clínicos por tema e jurisdição. "
            "Use quando precisar de texto normativo (ANVISA ou FDA) para compor uma seção do documento."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "tema": {"type": "string"},
                "jurisdicao": {"type": "string", "enum": ["ANVISA", "FDA"]},
            },
            "required": ["tema", "jurisdicao"],
        },
    },
}


def executar_busca_clausula(**argumentos_brutos) -> dict:
    """
    Execução real da ferramenta — sempre determinística, nunca é o modelo quem executa.
    Busca por palavra-chave, não string exata: o modelo formula o "tema" em linguagem
    natural (ex.: "Assentimento para menores de idade em estudos clínicos"), então a
    busca real por trás dessa ferramenta seria vetorial (RAG, Módulo 1.2/2.2) — aqui
    simulamos isso com um match por palavra-chave em vez de comparação exata.

    Recebe **kwargs em vez de (tema, jurisdicao) fixos de propósito: o modelo às vezes
    formula a chamada com um parâmetro faltando ou grafado errado (testado de verdade:
    já vimos "jurisdicicao" em vez de "jurisdicao") — com parâmetros fixos, Python
    lançaria TypeError na hora do unpacking, antes até de entrar na função. Validar aqui
    dentro deixa a ferramenta tratar isso como falha própria, não deixa o erro estourar
    pro chamador sem controle.
    """
    tema = argumentos_brutos.get("tema")
    jurisdicao = argumentos_brutos.get("jurisdicao")

    if not isinstance(tema, str) or not isinstance(jurisdicao, str):
        return {
            "texto": None,
            "fonte": None,
            "aviso": f"parâmetro inválido ou ausente na chamada da ferramenta: {argumentos_brutos}",
        }

    # Testado de verdade: o modelo às vezes formula o tema com "adolescente" ou
    # "pediátrico" em vez de "menor" — um match de palavra única era frágil demais
    # pra depender da sorte da frase exata que o modelo escolhe.
    tema_normalizado = tema.lower()
    menciona_menor_de_idade = any(
        palavra in tema_normalizado for palavra in ("menor", "adolescente", "pediátric")
    )

    if jurisdicao == "ANVISA" and menciona_menor_de_idade:
        return {
            "texto": (
                "Para participantes entre 12 e 17 anos, é necessário assentimento por escrito, "
                "além do consentimento do responsável legal (RDC ANVISA 466/2012, Art. 4º)."
            ),
            "fonte": "RDC ANVISA 466/2012, Art. 4º",
        }
    return {
        "texto": None,
        "fonte": None,
        "aviso": f'não encontrado: nenhuma cláusula sobre "{tema}" na jurisdição {jurisdicao}. Tente outra jurisdição ou revise o tema.',
    }


# ---------- Testes automatizados da ferramenta (determinística, sem chamar o modelo) ----------
# Mesma disciplina do Módulo 1.3 (decision_framework_tool.py) e espelhando react-agent-prototype.js:
# o que é determinístico no nosso próprio código ganha teste automatizado; a redação exata do
# modelo, e se ele decide chamar a ferramenta ou não, fica pra observação ao vivo em
# simular_interacao(), não pra assert aqui. Estes casos cobrem os dois bugs reais encontrados
# testando contra o modelo de verdade nesta sessão: a grafia "jurisdicicao" (parâmetro mal
# formado) e o tema formulado com "adolescente"/"pediátrico" em vez de "menor".
CASOS_TESTE_FERRAMENTA = [
    {"tema": "Assentimento para menores de idade em estudos clínicos", "jurisdicao": "ANVISA", "espera_achar": True},
    {"tema": "Consentimento de adolescentes em pesquisa", "jurisdicao": "ANVISA", "espera_achar": True},
    {"tema": "Cuidados pediátricos em ensaio clínico", "jurisdicao": "ANVISA", "espera_achar": True},
    {"tema": "Consentimento informado de população adulta", "jurisdicao": "ANVISA", "espera_achar": False},
    {"tema": "Assentimento para menores de idade", "jurisdicao": "FDA", "espera_achar": False},  # jurisdição errada
    {"tema": "Termo de Consentimento Livre e Esclarecido (TCLE)", "jurisdicao": "ANVISA", "espera_achar": False},
]


def rodar_testes_ferramenta() -> None:
    print("== Testes: executar_busca_clausula (determinístico, 6 casos + 1 de parâmetro inválido) ==")
    passou = 0

    for caso in CASOS_TESTE_FERRAMENTA:
        resultado = executar_busca_clausula(tema=caso["tema"], jurisdicao=caso["jurisdicao"])
        achou = resultado["texto"] is not None
        ok = achou == caso["espera_achar"]
        print(
            f"  [{'OK' if ok else 'FALHOU'}] tema=\"{caso['tema']}\", jurisdicao={caso['jurisdicao']} -> "
            f"achou={achou} (esperado={caso['espera_achar']})"
        )
        if ok:
            passou += 1

    # Reproduz o bug real já corrigido: parâmetro grafado errado ("jurisdicicao") não pode
    # estourar TypeError pro chamador, tem que virar aviso de falha própria da ferramenta.
    caso_invalido = executar_busca_clausula(tema="x", jurisdicicao="ANVISA")
    invalido_ok = caso_invalido["texto"] is None and isinstance(caso_invalido.get("aviso"), str)
    print(
        f"  [{'OK' if invalido_ok else 'FALHOU'}] parâmetro mal formado (\"jurisdicicao\") tratado como "
        f"falha própria da ferramenta -> {invalido_ok}"
    )
    if invalido_ok:
        passou += 1

    total = len(CASOS_TESTE_FERRAMENTA) + 1
    print(f"Total: {total} teste(s), {passou} passou(passaram), {total - passou} falhou(falharam).\n")
    if passou != total:
        raise AssertionError(f"Testes da ferramenta falharam: {passou}/{total} — corrija antes de rodar a simulação.")


# ---------- Retry com backoff (chamada ao modelo, não à ferramenta) ----------
# Distingue falha transitória (rede, timeout — vale tentar de novo) de falha terminal
# (ex.: modelo não existe no Ollama — retry não resolve, é erro de configuração).
# Sem isso, qualquer soneca de rede escalava pro Approval Gate sem necessidade.
def _eh_erro_transitorio(erro: Exception) -> bool:
    status_code = getattr(erro, "status_code", None)
    if status_code == 404:
        return False  # modelo não encontrado: configuração, não rede
    mensagem = str(erro).lower()
    return any(
        termo in mensagem
        for termo in ("timeout", "connection refused", "connection reset", "fetch failed")
    )


def _chamar_modelo_com_retry(tentativas_max: int = 3, **kwargs):
    ultimo_erro = None
    for tentativa in range(1, tentativas_max + 1):
        try:
            return chat(**kwargs)
        except Exception as erro:  # noqa: BLE001 — decide reter/propagar abaixo, não silencia
            ultimo_erro = erro
            if not _eh_erro_transitorio(erro) or tentativa == tentativas_max:
                raise
            espera_s = 0.5 * (2 ** (tentativa - 1))  # 0.5s, 1s, 2s...
            print(
                f"  [Retry] Falha transitória na chamada ao modelo (tentativa "
                f"{tentativa}/{tentativas_max}): {erro}. Tentando de novo em {espera_s}s."
            )
            time.sleep(espera_s)
    raise ultimo_erro


def agente_icf(protocolo: str, max_iteracoes: int = MAX_ITERACOES) -> dict:
    """
    Loop ReAct: Pensamento -> Ação -> Observação -> Resposta Final
    Critério de parada explícito no orquestrador (Módulo 2.2), nunca deixado para o modelo.

    `max_iteracoes` tem default calibrado (4). O único lugar que o sobrescreve é o cenário
    de demonstração do escalonamento em simular_interacao() — ver comentário lá.

    Retorna também "trilha": um trace de DESENVOLVIMENTO (uma entrada por volta do loop,
    com o que o modelo decidiu e quanto tempo levou), pra você inspecionar o raciocínio
    enquanto constrói. Isso não é observabilidade de produção — a trilha de auditoria
    formal, em escala, com retenção e consulta, é tema do Módulo 5.2. Aqui é só pra debugar.
    """
    historico = [
        {
            "role": "system",
            "content": (
                "Você redige seções de ICF para estudos clínicos. Sempre que precisar de uma "
                "cláusula regulatória, chame a ferramenta em vez de perguntar ao usuário ou de "
                "escrever de memória. Nunca peça esclarecimento ao usuário: decida os parâmetros "
                "da ferramenta a partir do protocolo fornecido."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Protocolo do estudo: {protocolo}\n\n"
                "Jurisdição regulatória deste estudo: ANVISA.\n\n"
                "Gere a seção de assentimento do ICF (Termo de Consentimento) para este estudo, "
                "se aplicável. Use a ferramenta disponível para buscar a cláusula regulatória "
                "correta antes de escrever o texto."
            ),
        },
    ]

    trilha = []

    for volta in range(1, max_iteracoes + 1):
        inicio_volta = time.monotonic()

        # Pensamento: o modelo decide, com base no histórico acumulado, se já sabe o suficiente
        resposta = _chamar_modelo_com_retry(
            model=MODELO, messages=historico, tools=[BUSCAR_CLAUSULA_REGULATORIA]
        )

        chamadas = resposta.message.tool_calls
        duracao_ms = round((time.monotonic() - inicio_volta) * 1000)

        if not chamadas:
            # Resposta Final: o modelo decidiu que já tem o que precisa
            trilha.append({"volta": volta, "acao": "resposta_final", "duracao_ms": duracao_ms})
            return {"rascunho": resposta.message.content, "iteracoes": volta, "trilha": trilha}

        chamada = chamadas[0]
        # Ação: executa a ferramenta fora do modelo (código determinístico)
        observacao = executar_busca_clausula(**chamada.function.arguments)
        trilha.append(
            {
                "volta": volta,
                "acao": "chamou_ferramenta",
                "ferramenta": chamada.function.name,
                "argumentos": chamada.function.arguments,
                "observacao": observacao,
                "duracao_ms": duracao_ms,
            }
        )

        # Observação: volta como novo contexto para o próximo Pensamento
        historico.append(resposta.message)
        historico.append(
            {
                "role": "tool",
                "tool_name": chamada.function.name,
                "content": json.dumps(observacao, ensure_ascii=False),
            }
        )

    # Limite de iterações atingido sem convergência: nunca falha silenciosamente
    return {
        "rascunho": None,
        "escalar_para_aprovacao_humana": True,
        "motivo": f"não convergiu em {max_iteracoes} volta(s)",
        "trilha": trilha,
    }


def imprimir_trilha(trilha: list) -> None:
    print("  [Trilha de desenvolvimento — não é a trilha de auditoria do Módulo 5.2]")
    for passo in trilha:
        if passo["acao"] == "chamou_ferramenta":
            print(
                f"    volta {passo['volta']} ({passo['duracao_ms']}ms): chamou "
                f"{passo['ferramenta']}({json.dumps(passo['argumentos'], ensure_ascii=False)}) "
                f"-> {json.dumps(passo['observacao'], ensure_ascii=False)}"
            )
        else:
            print(
                f"    volta {passo['volta']} ({passo['duracao_ms']}ms): decidiu que já tinha "
                "o suficiente, respondeu"
            )


def simular_interacao():
    """
    Simula três interações reais entre a Mariana (usuária) e o agente, cobrindo os três
    comportamentos que a Missão Prática #02 pede que o aluno demonstre no próprio protótipo:
    convergência normal, ferramenta sem resultado, e não-convergência com escalonamento.
    """
    # ---------- Cenário 1: convergência normal, a cláusula existe ----------
    print("===== Cenário 1: convergência normal (cláusula encontrada) =====")
    protocolo_1 = "Estudo fase II, público-alvo entre 12 e 17 anos, terapia oncológica experimental."
    print("[Mariana submete o protocolo ao Gateway]")
    print("  ", protocolo_1)
    print()

    resultado_1 = agente_icf(protocolo_1)
    print(
        f"[Agente ICF] Rascunho gerado após {resultado_1['iteracoes']} volta(s) de loop, "
        "rodando localmente:"
    )
    print("  ", resultado_1["rascunho"])
    imprimir_trilha(resultado_1["trilha"])
    print("[Sistema] Rascunho aguardando revisão do Approval Gate antes de virar versão oficial.")
    print()

    # ---------- Cenário 2: ferramenta não encontra cláusula ----------
    print("===== Cenário 2: ferramenta não encontra cláusula (população adulta) =====")
    protocolo_2 = (
        "Estudo fase III, população adulta (18-65 anos), diabetes tipo 2, sem envolvimento "
        "de menores de idade."
    )
    print("[Mariana submete o protocolo ao Gateway]")
    print("  ", protocolo_2)
    print()

    resultado_2 = agente_icf(protocolo_2)
    imprimir_trilha(resultado_2["trilha"])
    if resultado_2.get("escalar_para_aprovacao_humana"):
        print("[Orquestrador] Loop não convergiu —", resultado_2["motivo"])
        print("[Sistema] Encaminhando ao Approval Gate para intervenção manual.")
    else:
        print(f"[Agente ICF] Respondeu após {resultado_2['iteracoes']} volta(s), sem achar cláusula específica.")
        print(
            "[Atenção] Repare na trilha: mesmo sem achar a cláusula, o modelo escreveu um "
            "rascunho genérico em vez de escalar, desviando da instrução do system prompt. É "
            "exatamente esse tipo de desvio que a trilha existe para flagrar, e por isso o "
            "Approval Gate revisa antes de qualquer coisa virar oficial."
        )
    print()

    # ---------- Cenário 3: não convergência, escalonamento ----------
    # max_iteracoes forçado a 1 só aqui: testamos e o modelo real, mesmo sem achar a cláusula,
    # tende a responder algo em vez de insistir por várias voltas (ver o desvio do Cenário 2)
    # — comportamento de LLM não é 100% previsível. Forçar o limiar garante que este cenário
    # sempre demonstre o mecanismo de escalonamento de forma confiável. Em produção, o
    # limiar calibrado continua sendo MAX_ITERACOES = 4, não 1.
    print(
        "===== Cenário 3: não convergência, escalonamento (limiar forçado a 1 volta pra demo "
        "confiável) ====="
    )
    protocolo_3 = "Estudo fase III, população adulta, diabetes tipo 2, sem envolvimento de menores de idade."
    print("[Mariana submete o protocolo ao Gateway]")
    print("  ", protocolo_3)
    print()

    resultado_3 = agente_icf(protocolo_3, max_iteracoes=1)
    imprimir_trilha(resultado_3["trilha"])
    if resultado_3.get("escalar_para_aprovacao_humana"):
        print("[Orquestrador] Loop não convergiu —", resultado_3["motivo"])
        print("[Sistema] Encaminhando ao Approval Gate para intervenção manual — nunca falha silenciosamente.")
    else:
        print("[Atenção] O modelo convergiu na única volta permitida antes mesmo de precisar escalar.")


if __name__ == "__main__":
    try:
        rodar_testes_ferramenta()
        simular_interacao()
    except Exception as erro:  # noqa: BLE001 — ponto único de escalonamento, não silencioso
        print("[Erro não tratado]", str(erro))
        print("[Sistema] Encaminhando ao Approval Gate — falha técnica também é motivo de escalonamento.")

# Ahirton Lopes · AI Architecture Toolkit — UNIPDS: Arquitetura de Sistemas com IA
# Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager
