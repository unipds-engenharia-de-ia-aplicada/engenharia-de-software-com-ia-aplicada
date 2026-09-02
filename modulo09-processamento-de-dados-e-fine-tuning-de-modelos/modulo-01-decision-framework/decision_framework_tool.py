"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 1.2 (referencia espelhada em Python do .js oficial)

Ferramenta: Framework de 4 Perguntas (Modulo 1.1), versao de analise de
decisao financeira -- o mesmo framework conceitual do M1.1, com o ferramental
de decisao que um comite de investimento de verdade usaria:

  0. Gate de governanca/compliance (LGPD) -- roda ANTES de tudo: base legal
     definida e, se o dado for de categoria sensivel, DPA assinado com o
     provedor de fine-tuning. Binario, nao ponderavel -- reprovacao aqui
     bloqueia o caso de graca, sem gastar o resto do pipeline.
  1. AHP (Analytic Hierarchy Process, Saaty 1980) -- pesos das 4 perguntas
     derivados de uma matriz de comparacao pareada, com Razao de
     Consistencia (CR) provando que o julgamento nao e arbitrario.
  2. NPV/DCF -- custo de treinar vs. economia recorrente de rodar o modelo
     fine-tunado em vez de prompt+RAG, mes a mes, com breakeven real.
  3. Simulacao de Monte Carlo -- os parametros de negocio nao sao um numero
     fixo, sao uma distribuicao triangular; 10.000 simulacoes dao a
     probabilidade real de retorno positivo.
  4. Real Options -- pro caso que falha especificamente por dado
     insuficiente, a resposta certa nao e "nao", e "ainda nao": o valor de
     ESPERAR N meses acumulando mais dado e calculado e comparado contra
     decidir agora com risco elevado.
  5. Analise de sensibilidade -- qual parametro pesa mais na decisao,
     ranqueado (estilo tornado chart).

O gate continua soberano: nenhuma tecnica acima troca "uma pergunta abaixo
do limiar reprova o caso inteiro" por media. As tecnicas acrescentam
profundidade DEPOIS do gate.

Uso: python3 decision_framework_tool.py
"""

import json
import math
import random
from dataclasses import dataclass, field
from pathlib import Path


RECOMENDACAO_FINE_TUNING = "Fine-tuning vale a pena"
RECOMENDACAO_CONTINUAR_PROMPT_RAG = "Continue com prompt + RAG. Fine-tuning ainda não."
RECOMENDACAO_ESPERAR = "Espere acumular dado, depois treine."
RECOMENDACAO_BLOQUEADO_POR_GOVERNANCA = "Bloqueado: resolva a governança do dado antes de reavaliar."

PERGUNTAS = {
    "p1": "A tarefa é estreita e repetida, ou aberta e variável?",
    "p2": "Já esgotou prompt engineering + RAG + roteamento, sem chegar na qualidade/custo/latência necessários?",
    "p3": "Tem dado de exemplo suficiente, diverso e de qualidade pra treinar?",
    "p4": "A tarefa é estável o bastante pra não virar esteira de retreino constante?",
}

CHAVES_PERGUNTAS = ["p1", "p2", "p3", "p4"]

# Random Index de Saaty (n=4) -- tabela padrao do metodo AHP.
RANDOM_INDEX_N4 = 0.90


def carregar_configuracao():
    caminho = Path(__file__).parent / "amplitude-seguros-casos.json"
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


# ============================================================================
# 0. Gate de governança/compliance (LGPD) -- roda ANTES do AHP
#
#    Diferente das 4 perguntas ponderadas por AHP, governança nao e um fator
#    que um volume de dado ou retorno financeiro alto possa compensar: e
#    binario, e reprova o caso ali, sem gastar o resto do pipeline (AHP,
#    NPV, Monte Carlo, Real Options) num caso que nem pode prosseguir.
# ============================================================================


def validar_governanca_dado(caso):
    """caso precisa ter caso["governanca"] = {dadoSensivelLGPD,
    baseLegalDefinida, dpaAssinado}."""
    g = caso["governanca"]
    motivos = []

    if not g["baseLegalDefinida"]:
        motivos.append("sem base legal definida pro tratamento do dado (LGPD Art. 7º/11)")
    if g["dadoSensivelLGPD"] and not g["dpaAssinado"]:
        motivos.append("dado de categoria sensível (LGPD Art. 5º, II) sem DPA assinado com o provedor de fine-tuning")

    return {"aprovado": len(motivos) == 0, "motivos": motivos}


# ============================================================================
# 0.5 Risco operacional: continuidade do provedor
#
#    Nao e um gate (nao bloqueia nada) nem um score (nao da pra quantificar
#    "risco de descontinuacao" sem virar chute) -- e um checklist qualitativo
#    de fato verificado. Achado real desta disciplina (pesquisa feita pro
#    Modulo 3): dois dos principais provedores de fine-tuning self-serve ja
#    sairam do mercado ou estao saindo.
# ============================================================================

RISCOS_OPERACIONAIS_PROVEDOR = [
    {
        "provedor": "OpenAI self-serve (platform.openai.com)",
        "status": "Descontinuando",
        "detalhe": "Orgs novas já bloqueadas pra criar job desde 7/mai/2026; quem não usa há 60 dias perde acesso em 2/jul/2026; fecha pra todo mundo em 6/jan/2027.",
        "fonte": "developers.openai.com/api/docs/deprecations",
    },
    {
        "provedor": "Google AI Studio / Gemini API",
        "status": "Morto",
        "detalhe": "Fine-tuning descontinuado desde maio/2025. Gemini 1.5 Flash-001 foi o último modelo suportado.",
        "fonte": "ai.google.dev/gemini-api/docs/model-tuning",
    },
]


def listar_riscos_operacionais_provedor():
    return RISCOS_OPERACIONAIS_PROVEDOR


# ============================================================================
# 1. AHP -- Analytic Hierarchy Process (Saaty)
# ============================================================================


def derivar_pesos_ahp(matriz):
    """Deriva o vetor de prioridades (pesos) de uma matriz de comparação
    pareada pelo método da média geométrica das linhas."""
    n = len(matriz)
    medias_geometricas = []
    for linha in matriz:
        produto = 1.0
        for v in linha:
            produto *= v
        medias_geometricas.append(produto ** (1 / n))
    soma = sum(medias_geometricas)
    return [v / soma for v in medias_geometricas]


def calcular_consistencia_ahp(matriz, pesos):
    """Calcula a Razão de Consistência (CR). CR < 0.10 é o limiar padrão de
    Saaty pra considerar o julgamento consistente."""
    n = len(matriz)
    Aw = [sum(v * pesos[j] for j, v in enumerate(linha)) for linha in matriz]
    razoes = [Aw[i] / pesos[i] for i in range(n)]
    lambda_max = sum(razoes) / n
    ci = (lambda_max - n) / (n - 1)
    cr = ci / RANDOM_INDEX_N4
    return {"lambdaMax": lambda_max, "ci": ci, "cr": cr, "consistente": cr < 0.10}


def agregar_matrizes_comite(matrizes):
    """Agrega várias matrizes de comparação pareada (uma por avaliador) numa
    única matriz de julgamento agregado, pela média geométrica de cada célula
    -- método AIJ (Aggregation of Individual Judgments), o padrão recomendado
    por Saaty pra decisão em grupo. Ao contrário de tirar a média aritmética
    dos pesos finais de cada avaliador (AIP), a média geométrica célula a
    célula preserva a propriedade recíproca da matriz (a[j][i] == 1/a[i][j]),
    então o resultado ainda é uma matriz de comparação pareada válida, e pode
    ser passado direto pra derivar_pesos_ahp / calcular_consistencia_ahp sem
    nenhuma outra mudança no pipeline. Um comitê de 1 avaliador reduz
    exatamente ao caso original (matriz única)."""
    n_avaliadores = len(matrizes)
    n = len(matrizes[0])
    agregada = []
    for i in range(n):
        linha = []
        for j in range(n):
            produto = 1.0
            for matriz in matrizes:
                produto *= matriz[i][j]
            linha.append(produto ** (1 / n_avaliadores))
        agregada.append(linha)
    return agregada


# ============================================================================
# 2. Gate de 4 perguntas com score de confiança
# ============================================================================


def avaliar_framework(scores, pesos, limiar_verde):
    sinais_por_pergunta = {}
    perguntas_falhas = []

    for indice, chave in enumerate(CHAVES_PERGUNTAS):
        score = scores[chave]
        verde = score >= limiar_verde
        sinais_por_pergunta[chave] = {"score": score, "sinal": "VERDE" if verde else "VERMELHO"}
        if not verde:
            perguntas_falhas.append(indice + 1)

    pesos_obj = {chave: pesos[i] for i, chave in enumerate(CHAVES_PERGUNTAS)}
    score_composto = sum(scores[chave] * pesos_obj[chave] for chave in CHAVES_PERGUNTAS)

    aprovado = len(perguntas_falhas) == 0
    falha_so_dado = perguntas_falhas == [3]

    return {
        "aprovado": aprovado,
        "falhaSoDado": falha_so_dado,
        # aprovado == "sim, faca fine-tuning" -- mas isso NAO escolhe a
        # tecnica (LoRA local vs. full fine-tuning vs. API gerenciada): essa
        # e uma segunda decisao, em aberto ate os Modulos 3 e 4.
        "decisaoTecnicaEmAberto": aprovado,
        "recomendacao": RECOMENDACAO_FINE_TUNING if aprovado else RECOMENDACAO_CONTINUAR_PROMPT_RAG,
        "perguntasFalhas": perguntas_falhas,
        "scoreComposto": round(score_composto, 4),
        "sinaisPorPergunta": sinais_por_pergunta,
    }


def avaliar_caso_completo(caso, pesos, limiar_verde):
    """Orquestra o pipeline completo: governança primeiro (bloqueador,
    grátis), só entra no AHP/gate de 4 perguntas se a governança aprovar."""
    governanca = validar_governanca_dado(caso)
    if not governanca["aprovado"]:
        return {
            "bloqueadoPorGovernanca": True,
            "motivosGovernanca": governanca["motivos"],
            "aprovado": False,
            "recomendacao": RECOMENDACAO_BLOQUEADO_POR_GOVERNANCA,
        }
    resultado = avaliar_framework(caso["scores"], pesos, limiar_verde)
    return {"bloqueadoPorGovernanca": False, **resultado}


# ============================================================================
# 3. NPV / DCF -- fluxo de caixa descontado, fine-tuning vs. status quo
# ============================================================================


def params_deterministicos(financeiro):
    """Converte um bloco `financeiro` (crescimento/custos como distribuições
    triangulares) num conjunto de parâmetros determinísticos usando a
    "moda" (valor mais provável) de cada um."""
    return {
        "volumeInicialMensal": financeiro["volumeInicialMensal"],
        "crescimentoMensal": financeiro["crescimentoMensal"]["moda"],
        "custoPorChamadaStatusQuo": financeiro["custoPorChamadaStatusQuo"]["moda"],
        "custoPorChamadaFineTuned": financeiro["custoPorChamadaFineTuned"]["moda"],
        "custoTreinamento": financeiro["custoTreinamento"],
        "horizonteMeses": financeiro["horizonteMeses"],
        "taxaDescontoMensal": financeiro["taxaDescontoMensal"],
    }


def calcular_npv(params):
    """Calcula o NPV de migrar pra um modelo fine-tunado: economia mensal
    descontada mês a mês, menos o custo de treinar."""
    volume = params["volumeInicialMensal"]
    npv = -params["custoTreinamento"]
    fluxos = []
    mes_breakeven = None
    atraso_meses = params.get("atrasoMeses", 0)

    for mes in range(1, params["horizonteMeses"] + 1):
        volume *= 1 + params["crescimentoMensal"]
        economia_descontada = 0.0
        if mes > atraso_meses:
            economia_mes = volume * (params["custoPorChamadaStatusQuo"] - params["custoPorChamadaFineTuned"])
            fator_desconto = (1 + params["taxaDescontoMensal"]) ** mes
            economia_descontada = economia_mes / fator_desconto
            npv += economia_descontada
        if mes_breakeven is None and npv > 0:
            mes_breakeven = mes
        fluxos.append({"mes": mes, "volume": volume, "economiaDescontada": economia_descontada, "npvAcumulado": npv})

    return {"npv": round(npv, 2), "mesBreakeven": mes_breakeven, "fluxos": fluxos}


# ============================================================================
# 4. Simulação de Monte Carlo -- incerteza nos parâmetros de negócio
# ============================================================================


def amostrar_triangular(minimo, moda, maximo, rng):
    """Amostra de uma distribuição triangular via inversão de CDF."""
    u = rng()
    f = (moda - minimo) / (maximo - minimo)
    if u < f:
        return minimo + math.sqrt(u * (maximo - minimo) * (moda - minimo))
    return maximo - math.sqrt((1 - u) * (maximo - minimo) * (maximo - moda))


def percentil(valores_ordenados, p):
    indice = min(len(valores_ordenados) - 1, int(p * len(valores_ordenados)))
    return valores_ordenados[indice]


def simular_monte_carlo(financeiro, n, rng):
    """Roda N simulações de NPV amostrando crescimento e custo por chamada
    de distribuições triangulares."""
    resultados = []
    for _ in range(n):
        crescimento = amostrar_triangular(
            financeiro["crescimentoMensal"]["min"], financeiro["crescimentoMensal"]["moda"],
            financeiro["crescimentoMensal"]["max"], rng,
        )
        custo_status_quo = amostrar_triangular(
            financeiro["custoPorChamadaStatusQuo"]["min"], financeiro["custoPorChamadaStatusQuo"]["moda"],
            financeiro["custoPorChamadaStatusQuo"]["max"], rng,
        )
        custo_fine_tuned = amostrar_triangular(
            financeiro["custoPorChamadaFineTuned"]["min"], financeiro["custoPorChamadaFineTuned"]["moda"],
            financeiro["custoPorChamadaFineTuned"]["max"], rng,
        )
        resultado = calcular_npv({
            "volumeInicialMensal": financeiro["volumeInicialMensal"],
            "crescimentoMensal": crescimento,
            "custoPorChamadaStatusQuo": custo_status_quo,
            "custoPorChamadaFineTuned": custo_fine_tuned,
            "custoTreinamento": financeiro["custoTreinamento"],
            "horizonteMeses": financeiro["horizonteMeses"],
            "taxaDescontoMensal": financeiro["taxaDescontoMensal"],
        })
        resultados.append(resultado["npv"])

    resultados.sort()
    media = sum(resultados) / n
    probabilidade_positivo = len([v for v in resultados if v > 0]) / n

    return {
        "media": round(media, 2),
        "p5": round(percentil(resultados, 0.05), 2),
        "p50": round(percentil(resultados, 0.50), 2),
        "p95": round(percentil(resultados, 0.95), 2),
        "probabilidadePositivo": round(probabilidade_positivo, 4),
        "n": n,
    }


# ============================================================================
# 5. Real Options -- valor de esperar
# ============================================================================


def calcular_valor_presente_fluxos(params):
    """Valor presente BRUTO dos fluxos de economia, sem subtrair o custo de
    treino -- e o "S" (valor do ativo subjacente) da arvore binomial abaixo.
    calcular_npv ja subtrai custoTreinamento uma unica vez em t=0, entao
    basta somar de volta."""
    return calcular_npv(params)["npv"] + params["custoTreinamento"]


def derivar_volatilidade(financeiro, n, rng):
    """Deriva a volatilidade mensal do valor presente bruto a partir da
    MESMA simulacao de Monte Carlo usada na Parte 4 -- desvio padrao do
    log-retorno de cada simulacao em relacao a mediana. E o sigma que
    alimenta os fatores de alta/baixa (u/d) da arvore binomial: sem isso,
    nao ha opcao de verdade, so duas datas comparadas."""
    valores = []
    for _ in range(n):
        crescimento = amostrar_triangular(
            financeiro["crescimentoMensal"]["min"], financeiro["crescimentoMensal"]["moda"],
            financeiro["crescimentoMensal"]["max"], rng
        )
        custo_status_quo = amostrar_triangular(
            financeiro["custoPorChamadaStatusQuo"]["min"], financeiro["custoPorChamadaStatusQuo"]["moda"],
            financeiro["custoPorChamadaStatusQuo"]["max"], rng
        )
        custo_fine_tuned = amostrar_triangular(
            financeiro["custoPorChamadaFineTuned"]["min"], financeiro["custoPorChamadaFineTuned"]["moda"],
            financeiro["custoPorChamadaFineTuned"]["max"], rng
        )
        valores.append(calcular_valor_presente_fluxos({
            "volumeInicialMensal": financeiro["volumeInicialMensal"],
            "crescimentoMensal": crescimento,
            "custoPorChamadaStatusQuo": custo_status_quo,
            "custoPorChamadaFineTuned": custo_fine_tuned,
            "custoTreinamento": financeiro["custoTreinamento"],
            "horizonteMeses": financeiro["horizonteMeses"],
            "taxaDescontoMensal": financeiro["taxaDescontoMensal"],
        }))
    valores.sort()
    mediana = percentil(valores, 0.5)
    log_retornos = [math.log(v / mediana) for v in valores if v > 0 and mediana > 0]
    media = sum(log_retornos) / len(log_retornos)
    variancia = sum((v - media) ** 2 for v in log_retornos) / (len(log_retornos) - 1)
    return math.sqrt(variancia)


def precificar_opcao_de_esperar(financeiro, score_atual_p3, limiar_verde, n=10000, rng=None):
    """Precifica o valor de esperar como uma opcao real de verdade: arvore
    binomial (Cox-Ross-Rubinstein) sobre o valor presente bruto dos fluxos,
    com volatilidade derivada da propria simulacao de Monte Carlo da Parte
    4. A incerteza do negocio se resolve mes a mes durante a espera; no fim
    do prazo (quando o dado amadureceu o bastante pra passar no gate de
    novo), o modelo exerce so se valer a pena -- e uma opcao americana com
    uma unica janela de exercicio, o desenho padrao pra "esperar informacao
    chegar". Sem essa arvore, nao e Real Options, e so comparar dois NPVs
    de datas diferentes -- essa era a versao anterior desta funcao."""
    if rng is None:
        rng = random.random
    opcao_real = financeiro["opcaoReal"]
    meses_para_esperar = math.ceil((opcao_real["scoreAlvo"] - score_atual_p3) / opcao_real["taxaCrescimentoScorePorMes"])
    custo_treinamento = financeiro["custoTreinamento"]

    # S0: valor presente bruto no cenario mais provavel, sem a penalidade de
    # erro por dado insuficiente -- o valor do projeto se a decisao amadurecer
    s0 = calcular_valor_presente_fluxos({
        "volumeInicialMensal": financeiro["volumeInicialMensal"],
        "crescimentoMensal": financeiro["crescimentoMensal"]["moda"],
        "custoPorChamadaStatusQuo": financeiro["custoPorChamadaStatusQuo"]["moda"],
        "custoPorChamadaFineTuned": financeiro["custoPorChamadaFineTuned"]["moda"],
        "custoTreinamento": custo_treinamento,
        "horizonteMeses": financeiro["horizonteMeses"],
        "taxaDescontoMensal": financeiro["taxaDescontoMensal"],
    })

    sigma = derivar_volatilidade(financeiro, n, rng)
    delta_t = 1  # 1 passo = 1 mes, mesma unidade de meses_para_esperar
    r = financeiro["taxaDescontoMensal"]
    u = math.exp(sigma * math.sqrt(delta_t))
    d = 1 / u
    p = (math.exp(r * delta_t) - d) / (u - d)

    # valores terminais do ativo em cada no, depois de N meses de incerteza
    # resolvida passo a passo (distribuicao binomial padrao CRR)
    valores_opcao = []
    for j in range(meses_para_esperar + 1):
        s_final = s0 * (u ** (meses_para_esperar - j)) * (d ** j)
        valores_opcao.append(max(s_final - custo_treinamento, 0))

    # inducao retroativa ate o valor da opcao hoje (F0)
    for passo in range(meses_para_esperar, 0, -1):
        proximo_passo = []
        for j in range(passo):
            valor_esperado = p * valores_opcao[j] + (1 - p) * valores_opcao[j + 1]
            proximo_passo.append(valor_esperado / math.exp(r * delta_t))
        valores_opcao = proximo_passo
    valor_opcao_esperar = round(valores_opcao[0], 2)

    # decidir agora: sem esperar a incerteza se resolver, com a penalidade
    # de erro por dado insuficiente ja embutida no custo por chamada
    s_agora = calcular_valor_presente_fluxos({
        "volumeInicialMensal": financeiro["volumeInicialMensal"],
        "crescimentoMensal": financeiro["crescimentoMensal"]["moda"],
        "custoPorChamadaStatusQuo": financeiro["custoPorChamadaStatusQuo"]["moda"],
        "custoPorChamadaFineTuned": financeiro["custoPorChamadaFineTuned"]["moda"] + opcao_real["custoDeErroEsperadoPorChamada"],
        "custoTreinamento": custo_treinamento,
        "horizonteMeses": financeiro["horizonteMeses"],
        "taxaDescontoMensal": financeiro["taxaDescontoMensal"],
    })
    valor_exercer_agora = round(max(s_agora - custo_treinamento, 0), 2)

    valor_de_esperar = round(valor_opcao_esperar - valor_exercer_agora, 2)

    return {
        "mesesParaEsperar": meses_para_esperar,
        "sigma": round(sigma, 4),
        "u": round(u, 4),
        "d": round(d, 4),
        "probabilidadeRiscoNeutra": round(p, 4),
        "valorPresenteFluxosBrutos": round(s0, 2),
        "valorExercerAgora": valor_exercer_agora,
        "valorOpcaoEsperar": valor_opcao_esperar,
        "valorDeEsperar": valor_de_esperar,
        "recomendacao": RECOMENDACAO_ESPERAR if valor_de_esperar > 0 else RECOMENDACAO_FINE_TUNING,
        # "esperar" nao e o fim da historia -- e um compromisso de reavaliar
        # depois. Pra Amplitude Saude Empresarial, essa reavaliacao acontece
        # de verdade no Modulo 3.2 (reavaliacao-saude-empresarial.js/.py).
        "reavaliacaoAgendadaEm": "Módulo 3.2",
    }


# ============================================================================
# 6. Análise de sensibilidade
# ============================================================================


def analisar_sensibilidade(financeiro, percentual_variacao=0.2):
    base = params_deterministicos(financeiro)
    parametros_variaveis = ["crescimentoMensal", "custoPorChamadaStatusQuo", "custoPorChamadaFineTuned", "custoTreinamento"]
    resultado = []
    for chave in parametros_variaveis:
        valor_base = base[chave]
        baixo = dict(base, **{chave: valor_base * (1 - percentual_variacao)})
        alto = dict(base, **{chave: valor_base * (1 + percentual_variacao)})
        npv_baixo = calcular_npv(baixo)["npv"]
        npv_alto = calcular_npv(alto)["npv"]
        resultado.append({
            "parametro": chave,
            "npvBaixo": npv_baixo,
            "npvAlto": npv_alto,
            "amplitude": round(abs(npv_alto - npv_baixo), 2),
        })
    resultado.sort(key=lambda r: r["amplitude"], reverse=True)
    return resultado


# ---------------------------------------------------------------------------
# Testes automatizados
# ---------------------------------------------------------------------------

_total_testes = 0
_testes_com_falha = 0


def testar(descricao, fn):
    global _total_testes, _testes_com_falha
    _total_testes += 1
    try:
        fn()
        print(f"  [OK] {descricao}")
    except AssertionError as erro:
        _testes_com_falha += 1
        print(f"  [FALHOU] {descricao}")
        print(f"           {erro}")


def _rng_determinístico(seed_inicial=42):
    estado = {"seed": seed_inicial}

    def rng():
        estado["seed"] = (estado["seed"] * 1103515245 + 12345) % 2147483648
        return estado["seed"] / 2147483648

    return rng


def rodar_testes(config):
    pesos_ahp = derivar_pesos_ahp(config["ahp"]["matriz"])
    consistencia_ahp = calcular_consistencia_ahp(config["ahp"]["matriz"], pesos_ahp)
    limiar_verde = config["limiarVerde"]
    casos = config["casos"]

    print("== Testes: AHP (pesos derivados + consistência) ==")

    def t1():
        assert abs(sum(pesos_ahp) - 1.0) < 1e-9

    testar("os pesos AHP somam 1.0", t1)

    def t2():
        indice_p3 = CHAVES_PERGUNTAS.index("p3")
        assert pesos_ahp[indice_p3] == max(pesos_ahp)

    testar("pergunta 3 (dado suficiente) recebe o maior peso AHP", t2)

    def t3():
        assert consistencia_ahp["consistente"], f"CR = {consistencia_ahp['cr']}"

    testar("a matriz de comparação é consistente (CR < 0.10, padrão de Saaty)", t3)

    print()
    print("== Testes: governança (bloqueia antes do AHP, não é compensável por score) ==")

    def t_gov1():
        caso_hipotetico = {
            "scores": {"p1": 0.9, "p2": 0.9, "p3": 0.9, "p4": 0.9},
            "governanca": {"dadoSensivelLGPD": False, "baseLegalDefinida": False, "dpaAssinado": True},
        }
        r = avaliar_caso_completo(caso_hipotetico, pesos_ahp, limiar_verde)
        assert r["bloqueadoPorGovernanca"] is True
        assert r["aprovado"] is False
        assert "scoreComposto" not in r, "não deveria nem calcular AHP pra um caso bloqueado"

    testar("caso sem base legal é bloqueado, mesmo com scores perfeitos", t_gov1)

    def t_gov2():
        caso_hipotetico = {
            "scores": {"p1": 0.9, "p2": 0.9, "p3": 0.9, "p4": 0.9},
            "governanca": {"dadoSensivelLGPD": True, "baseLegalDefinida": True, "dpaAssinado": False},
        }
        r = avaliar_caso_completo(caso_hipotetico, pesos_ahp, limiar_verde)
        assert r["bloqueadoPorGovernanca"] is True
        assert "DPA" in r["motivosGovernanca"][0]

    testar("dado sensível sem DPA é bloqueado, mesmo com scores perfeitos", t_gov2)

    def t_gov3():
        caso_hipotetico = {
            "scores": {"p1": 0.9, "p2": 0.9, "p3": 0.9, "p4": 0.9},
            "governanca": {"dadoSensivelLGPD": True, "baseLegalDefinida": True, "dpaAssinado": True},
        }
        r = avaliar_caso_completo(caso_hipotetico, pesos_ahp, limiar_verde)
        assert r["bloqueadoPorGovernanca"] is False
        assert r["aprovado"] is True

    testar("dado sensível COM DPA passa a governança normalmente", t_gov3)

    def t_gov4():
        for caso in casos:
            g = validar_governanca_dado(caso)
            assert g["aprovado"] is True, f"{caso['nome']} deveria passar: {'; '.join(g['motivos'])}"

    testar("os 3 casos reais da Amplitude Seguros passam na governança (nenhum deveria bloquear)", t_gov4)

    def t_gov5():
        caso_saude = next(c for c in casos if c["id"] == "amplitude-saude-empresarial")
        outros_casos = [c for c in casos if c["id"] != "amplitude-saude-empresarial"]
        assert caso_saude["governanca"]["dadoSensivelLGPD"] is True
        for c in outros_casos:
            assert c["governanca"]["dadoSensivelLGPD"] is False

    testar("Amplitude Saúde Empresarial é o único caso onde o DPA realmente é exigido (dado sensível)", t_gov5)

    print()
    print("== Testes: risco operacional de provedor (checklist qualitativo, sem score fabricado) ==")

    def t_risco():
        riscos = listar_riscos_operacionais_provedor()
        assert len(riscos) == 2
        for r in riscos:
            assert r["fonte"], f"{r['provedor']} sem fonte"
            assert r["status"] in ("Descontinuando", "Morto")

    testar("lista tem os 2 provedores reais verificados nesta disciplina, com fonte cada um", t_risco)

    print()
    print("== Testes: gate reprova sozinho, não importa a média ==")

    def t4():
        r = avaliar_framework({"p1": limiar_verde, "p2": 0.9, "p3": 0.9, "p4": 0.9}, pesos_ahp, limiar_verde)
        assert r["sinaisPorPergunta"]["p1"]["sinal"] == "VERDE"
        assert r["aprovado"] is True

    testar("score exatamente no limiar conta como sinal verde", t4)

    def t5():
        r = avaliar_framework({"p1": 0.9, "p2": 0.9, "p3": 0.9, "p4": 0.9}, pesos_ahp, limiar_verde)
        assert r["aprovado"] is True
        assert r["perguntasFalhas"] == []

    testar("as 4 com score alto -> aprovado, sem pergunta falha", t5)

    def t5b():
        aprovado = avaliar_framework({"p1": 0.9, "p2": 0.9, "p3": 0.9, "p4": 0.9}, pesos_ahp, limiar_verde)
        reprovado = avaliar_framework({"p1": 0.2, "p2": 0.9, "p3": 0.9, "p4": 0.9}, pesos_ahp, limiar_verde)
        assert aprovado["decisaoTecnicaEmAberto"] is True
        assert reprovado["decisaoTecnicaEmAberto"] is False, "sem aprovação, não existe decisão de técnica a abrir"

    testar("aprovado no gate deixa a escolha de técnica (LoRA/full/API) em aberto -- não é a mesma decisão", t5b)

    def t6():
        r = avaliar_framework({"p1": 0.9, "p2": 0.9, "p3": 0.2, "p4": 0.9}, pesos_ahp, limiar_verde)
        assert r["aprovado"] is False
        assert r["perguntasFalhas"] == [3]
        assert r["falhaSoDado"] is True

    testar("pergunta 3 abaixo do limiar -> reprovado, falha = [3], falhaSoDado = true", t6)

    def t7():
        r = avaliar_framework({"p1": 0.2, "p2": 0.9, "p3": 0.9, "p4": 0.9}, pesos_ahp, limiar_verde)
        assert r["falhaSoDado"] is False

    testar("pergunta 1 abaixo do limiar -> reprovado, falhaSoDado = false (não é caso de esperar)", t7)

    print()
    print("== Testes: NPV/DCF (caso determinístico, sem crescimento) ==")

    def t8():
        params = {
            "volumeInicialMensal": 1000, "crescimentoMensal": 0,
            "custoPorChamadaStatusQuo": 0.05, "custoPorChamadaFineTuned": 0.02,
            "custoTreinamento": 1000, "horizonteMeses": 12, "taxaDescontoMensal": 0.01,
        }
        r = calcular_npv(params)
        fluxo_mensal = 1000 * (0.05 - 0.02)
        pv_anuidade = fluxo_mensal * (1 - 1.01 ** -12) / 0.01
        npv_esperado = -1000 + pv_anuidade
        assert abs(r["npv"] - npv_esperado) < 0.5, f"npv={r['npv']}, esperado ~{npv_esperado:.2f}"

    testar("NPV sem crescimento bate com fórmula fechada de anuidade (PV = C x [1-(1+r)^-T]/r)", t8)

    def t9():
        params = {
            "volumeInicialMensal": 1000, "crescimentoMensal": 0,
            "custoPorChamadaStatusQuo": 0.05, "custoPorChamadaFineTuned": 0.02,
            "custoTreinamento": 0, "horizonteMeses": 3, "taxaDescontoMensal": 0,
            "atrasoMeses": 3,
        }
        r = calcular_npv(params)
        assert r["npv"] == 0

    testar("NPV com atraso não gera economia durante os meses de espera", t9)

    print()
    print("== Testes: Monte Carlo (sanidade estatística, RNG semeado) ==")

    def t10():
        rng = _rng_determinístico(42)
        amostras = [amostrar_triangular(0.01, 0.03, 0.05, rng) for _ in range(20000)]
        media = sum(amostras) / len(amostras)
        media_teorica = (0.01 + 0.03 + 0.05) / 3
        assert abs(media - media_teorica) < 0.002, f"média={media}, teórica={media_teorica}"

    testar("amostragem triangular determinística converge pra média teórica (min+moda+max)/3", t10)

    def t11():
        caso_auto = next(c for c in casos if c["id"] == "amplitude-auto")
        rng = _rng_determinístico(7)
        mc = simular_monte_carlo(caso_auto["financeiro"], 2000, rng)
        assert mc["probabilidadePositivo"] > 0.9, f"probabilidade={mc['probabilidadePositivo']}"

    testar("Monte Carlo do caso Auto (financeiro forte) dá probabilidade alta de NPV positivo", t11)

    print()
    print("== Testes: Real Options (valor de esperar) ==")

    def t12():
        caso_saude = next(c for c in casos if c["id"] == "amplitude-saude-empresarial")
        opcao = precificar_opcao_de_esperar(caso_saude["financeiro"], caso_saude["scores"]["p3"], limiar_verde, 2000)
        assert opcao["mesesParaEsperar"] > 0
        assert opcao["recomendacao"] == RECOMENDACAO_ESPERAR
        assert opcao["valorDeEsperar"] > 0, f"valorDeEsperar={opcao['valorDeEsperar']}"

    testar("esperar tem valor positivo quando o custo de erro por dado insuficiente é alto", t12)

    def t12b():
        caso_saude = next(c for c in casos if c["id"] == "amplitude-saude-empresarial")
        opcao = precificar_opcao_de_esperar(caso_saude["financeiro"], caso_saude["scores"]["p3"], limiar_verde, 2000)
        assert opcao["reavaliacaoAgendadaEm"] == "Módulo 3.2"

    testar('"esperar" vem com o compromisso de reavaliação agendada, não é ponto final', t12b)

    def t12c():
        caso_saude = next(c for c in casos if c["id"] == "amplitude-saude-empresarial")
        opcao = precificar_opcao_de_esperar(caso_saude["financeiro"], caso_saude["scores"]["p3"], limiar_verde, 2000)
        assert opcao["sigma"] > 0, f"sigma={opcao['sigma']}, esperado > 0"
        assert abs(opcao["u"] * opcao["d"] - 1) < 1e-3, f"u*d deveria ser ~1 (CRR recombinante), deu {opcao['u'] * opcao['d']}"
        assert 0 < opcao["probabilidadeRiscoNeutra"] < 1, f"p={opcao['probabilidadeRiscoNeutra']}, esperado em (0,1)"

    testar("a volatilidade derivada do Monte Carlo é positiva e os fatores u/d são consistentes (u = 1/d)", t12c)

    print()
    print("== Testes: Sensibilidade ==")

    def t13():
        caso_auto = next(c for c in casos if c["id"] == "amplitude-auto")
        sens = analisar_sensibilidade(caso_auto["financeiro"])
        assert len(sens) == 4
        for i in range(1, len(sens)):
            assert sens[i - 1]["amplitude"] >= sens[i]["amplitude"]

    testar("análise de sensibilidade retorna os 4 parâmetros ranqueados por amplitude decrescente", t13)

    print()
    print("== Testes: aplicação aos três casos reais da Amplitude Seguros ==")

    caso_auto = next(c for c in casos if c["id"] == "amplitude-auto")
    caso_saude = next(c for c in casos if c["id"] == "amplitude-saude-empresarial")
    caso_atendimento = next(c for c in casos if c["id"] == "amplitude-atendimento-cliente")
    resultado_auto = avaliar_framework(caso_auto["scores"], pesos_ahp, limiar_verde)
    resultado_saude = avaliar_framework(caso_saude["scores"], pesos_ahp, limiar_verde)
    resultado_atendimento = avaliar_framework(caso_atendimento["scores"], pesos_ahp, limiar_verde)

    def t14():
        assert resultado_auto["aprovado"] is True

    testar("Amplitude Auto -> aprovado no gate", t14)

    def t15():
        assert resultado_saude["aprovado"] is False
        assert resultado_saude["falhaSoDado"] is True

    testar("Amplitude Saúde Empresarial -> reprovado só por dado (elegível a Real Options)", t15)

    def t16():
        assert resultado_atendimento["aprovado"] is False
        assert resultado_atendimento["perguntasFalhas"] == [1, 4]
        assert resultado_atendimento["falhaSoDado"] is False, "não pode ser falhaSoDado: reprova em 2 perguntas, e p3 está verde"
        assert resultado_atendimento["sinaisPorPergunta"]["p3"]["sinal"] == "VERDE", "dado sobrando não deveria salvar esse caso"
        assert resultado_atendimento["recomendacao"] == RECOMENDACAO_CONTINUAR_PROMPT_RAG

    testar("Amplitude Atendimento ao Cliente -> reprovado em p1 e p4, com p2 e p3 fortes (não elegível a Real Options)", t16)

    print()
    print(
        f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), "
        f"{_testes_com_falha} falhou(falharam)."
    )

    if _testes_com_falha > 0:
        raise AssertionError(f"{_testes_com_falha} teste(s) falharam. A implementação não bate com a especificação.")

    return {
        "pesosAHP": pesos_ahp, "consistenciaAHP": consistencia_ahp,
        "casoAuto": caso_auto, "casoSaude": caso_saude, "casoAtendimento": caso_atendimento,
        "resultadoAuto": resultado_auto, "resultadoSaude": resultado_saude, "resultadoAtendimento": resultado_atendimento,
    }


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------


def imprimir_governanca(caso):
    g = validar_governanca_dado(caso)
    detalhe = (
        "dado de categoria sensível (LGPD Art. 5º, II) -- DPA verificado."
        if caso["governanca"]["dadoSensivelLGPD"]
        else "dado pessoal comum, não sensível."
    )
    status = "APROVADO" if g["aprovado"] else "BLOQUEADO"
    print(f"  [Governança] {status} -- {detalhe} Base legal: {caso['governanca']['baseLegalDescricao']}")


def imprimir_caso_aprovado(caso, resultado):
    print(f"\n===== {caso['nome']} =====")
    print(f"Tarefa: {caso['tarefa']}\n")
    imprimir_governanca(caso)
    for i, chave in enumerate(CHAVES_PERGUNTAS):
        s = resultado["sinaisPorPergunta"][chave]
        print(f"  Pergunta {i + 1} [{s['sinal']}, score {s['score']:.2f}]: {PERGUNTAS[chave]}")
    print(f"\n  Score composto (AHP): {resultado['scoreComposto']:.2f}")
    print(f"  Recomendação (gate): {resultado['recomendacao']}")
    print("  Decisão de técnica (LoRA local, full fine-tuning, ou API gerenciada): EM ABERTO -- Módulos 3 e 4\n")

    npv = calcular_npv(params_deterministicos(caso["financeiro"]))
    print("  --- Análise financeira (DCF) ---")
    print(f"  Custo de treino: R$ {caso['financeiro']['custoTreinamento']:.2f}")
    print(f"  NPV em {caso['financeiro']['horizonteMeses']} meses (cenário mais provável): R$ {npv['npv']:.2f}")
    print(f"  Breakeven: {'mês ' + str(npv['mesBreakeven']) if npv['mesBreakeven'] else 'não atinge no horizonte'}")

    rng = __import__("random").random
    mc = simular_monte_carlo(caso["financeiro"], 10000, rng)
    print("\n  --- Monte Carlo (10.000 simulações, incerteza de crescimento e custo) ---")
    print(f"  NPV médio: R$ {mc['media']:.2f} | P5: R$ {mc['p5']:.2f} | P50: R$ {mc['p50']:.2f} | P95: R$ {mc['p95']:.2f}")
    print(f"  Probabilidade de NPV positivo: {mc['probabilidadePositivo'] * 100:.1f}%")

    sens = analisar_sensibilidade(caso["financeiro"])
    print("\n  --- Sensibilidade (ranking por impacto no NPV, +/-20%) ---")
    for i, s in enumerate(sens):
        print(f"  {i + 1}. {s['parametro']}: amplitude de R$ {s['amplitude']:.2f}")


def imprimir_caso_reprovado_por_dado(caso, resultado, limiar_verde):
    print(f"\n===== {caso['nome']} =====")
    print(f"Tarefa: {caso['tarefa']}\n")
    imprimir_governanca(caso)
    for i, chave in enumerate(CHAVES_PERGUNTAS):
        s = resultado["sinaisPorPergunta"][chave]
        print(f"  Pergunta {i + 1} [{s['sinal']}, score {s['score']:.2f}]: {PERGUNTAS[chave]}")
    print(f"\n  Score composto (AHP): {resultado['scoreComposto']:.2f}")
    print(f"  Pergunta que reprovou no gate: {', '.join(str(p) for p in resultado['perguntasFalhas'])} (dado suficiente)")
    print("  Isso é um \"ainda não\", não um \"não\" -- elegível a análise de Real Options.\n")

    opcao = precificar_opcao_de_esperar(caso["financeiro"], caso["scores"]["p3"], limiar_verde)
    print("  --- Real Options: árvore binomial (CRR) sobre o valor de esperar ---")
    print(f"  Meses até o score de dado cruzar o limiar: {opcao['mesesParaEsperar']}")
    print(f"  Volatilidade mensal derivada do Monte Carlo (sigma): {opcao['sigma'] * 100:.2f}%")
    print(f"  Fator de alta (u): {opcao['u']:.4f} | Fator de baixa (d): {opcao['d']:.4f} | Prob. risco-neutra (p): {opcao['probabilidadeRiscoNeutra']:.4f}")
    print(f"  Valor presente bruto dos fluxos (S0): R$ {opcao['valorPresenteFluxosBrutos']:.2f}")
    print(f"  Valor de exercer agora (com risco de retrabalho por dado insuficiente): R$ {opcao['valorExercerAgora']:.2f}")
    print(f"  Valor da opção de esperar (precificado na árvore): R$ {opcao['valorOpcaoEsperar']:.2f}")
    print(f"  Valor de esperar (opção - exercer agora): R$ {opcao['valorDeEsperar']:.2f}")
    print(f"  Recomendação: {opcao['recomendacao']}")
    print(f"  Reavaliação agendada em: {opcao['reavaliacaoAgendadaEm']} (roda este mesmo código de verdade, não é spoiler do resultado)")


def imprimir_caso_reprovado_geral(caso, resultado):
    print(f"\n===== {caso['nome']} =====")
    print(f"Tarefa: {caso['tarefa']}\n")
    imprimir_governanca(caso)
    for i, chave in enumerate(CHAVES_PERGUNTAS):
        s = resultado["sinaisPorPergunta"][chave]
        print(f"  Pergunta {i + 1} [{s['sinal']}, score {s['score']:.2f}]: {PERGUNTAS[chave]}")
    print(f"\n  Score composto (AHP): {resultado['scoreComposto']:.2f}")
    print(f"  Perguntas que reprovaram no gate: {' e '.join(str(p) for p in resultado['perguntasFalhas'])}")
    print("  Reparem: a pergunta 3 (dado suficiente) está VERDE, com folga. Não é falta de dado.")
    print("  Não é \"falha só por dado\" -- não é elegível a Real Options. Esperar não resolve nada aqui,")
    print("  porque o que falta não é tempo, é a tarefa ter formato fixo e não mudar de regra toda hora.")
    print(f"  Recomendação: {resultado['recomendacao']}")


def imprimir_caso_bloqueado_por_governanca(nome, tarefa, caso):
    print(f"\n===== {nome} (hipotético) =====")
    print(f"Tarefa: {tarefa}\n")
    g = validar_governanca_dado(caso)
    print(f"  [Governança] BLOQUEADO -- motivo(s): {'; '.join(g['motivos'])}")
    print(f"  Recomendação: {RECOMENDACAO_BLOQUEADO_POR_GOVERNANCA}")
    print("  Nenhum AHP, NPV, Monte Carlo ou Real Options foi calculado -- não há score que compense isso.")


def rodar_demo(config, resultado_testes):
    print()
    print("===== Demo: Framework de 4 Perguntas -- versão de análise de decisão financeira =====")
    pesos = resultado_testes["pesosAHP"]
    consist = resultado_testes["consistenciaAHP"]
    print(f"\nPesos derivados por AHP: p1={pesos[0]:.3f}  p2={pesos[1]:.3f}  p3={pesos[2]:.3f}  p4={pesos[3]:.3f}")
    print(
        f"Consistência do julgamento: lambda_max={consist['lambdaMax']:.4f}  ci={consist['ci']:.4f}  "
        f"cr={consist['cr']:.4f} ({'consistente, CR < 0.10' if consist['consistente'] else 'INCONSISTENTE'})"
    )

    imprimir_caso_aprovado(resultado_testes["casoAuto"], resultado_testes["resultadoAuto"])
    imprimir_caso_reprovado_por_dado(resultado_testes["casoSaude"], resultado_testes["resultadoSaude"], config["limiarVerde"])
    imprimir_caso_reprovado_geral(resultado_testes["casoAtendimento"], resultado_testes["resultadoAtendimento"])

    print("\n-----------------------------------------------------------------------------")
    print("Três casos, três respostas diferentes. Auto: sim. Saúde Empresarial: ainda não,")
    print("só falta dado, e dado é questão de tempo. Atendimento ao Cliente: não -- mesmo com")
    print("o maior volume de todos e prompt/RAG já esgotado, a tarefa em si é aberta e instável")
    print("demais. Mais dado não resolve um problema que não é de dado.")
    print("-----------------------------------------------------------------------------")


def rodar_demo_extras():
    """Conteúdo extra opcional, NÃO chamado por padrão no fluxo principal
    (ver `if __name__ == "__main__"` mais abaixo): caso hipotético de gate
    de governança bloqueado, e o panorama de risco operacional de provedor.
    Ambos ficam de fora da saída padrão do script porque, no vídeo do
    Módulo 1.3, o primeiro já está coberto pelos testes automatizados
    narrados antes, e o segundo é spoiler do cheatsheet do Slide 9.
    Continuam disponíveis pra quem quiser chamar rodar_demo_extras()
    manualmente (ex.: na missão prática, pra explorar o restante do código).
    """
    print("\n===== E se a governança não tivesse sido resolvida? (caso hipotético, pra provar o gate) =====")
    imprimir_caso_bloqueado_por_governanca(
        "Amplitude Saúde Empresarial, num mundo sem DPA",
        "Mesmo caso de Saúde Empresarial, mas sem o DPA assinado com o provedor de fine-tuning",
        {"governanca": {"dadoSensivelLGPD": True, "baseLegalDefinida": True, "dpaAssinado": False}},
    )
    print("\nRepare: os scores de p1-p4 nem importam aqui. O gate de governança roda ANTES do AHP,")
    print("e bloqueia de graça -- sem gastar o resto do pipeline num caso que nem pode prosseguir.")

    print("\n===== Risco operacional: o provedor escolhido ainda vai existir? =====")
    for r in listar_riscos_operacionais_provedor():
        print(f"  [{r['status']}] {r['provedor']}")
        print(f"    {r['detalhe']}")
        print(f"    Fonte: {r['fonte']}")
    print('\nNão é um score: "vale a pena" também depende do provedor escolhido continuar existindo.')
    print("Módulo 3 detalha o provedor real usado no resto desta disciplina (Vertex AI).")


def rodar_demo_ahp_comite():
    """Demonstra AHP de comitê: 3 avaliadores hipotéticos julgam as mesmas
    4 perguntas de forma diferente entre si, e o resultado é agregado numa
    única matriz (AIJ), em vez de usar o julgamento de uma pessoa só, como
    no restante do módulo. Não substitui a matriz real usada nos 3 casos da
    Amplitude Seguros (Auto, Saúde Empresarial, Atendimento ao Cliente),
    que segue vindo de amplitude-seguros-casos.json -- é um exemplo à parte,
    pra mostrar como o mesmo código escala de "1 julgamento" pra "comitê"."""
    print("\n===== AHP de comitê: agregando o julgamento de vários avaliadores =====")

    matriz_gestor_produto = [
        [1, 1, 1 / 3, 0.5],
        [1, 1, 1 / 3, 0.5],
        [3, 3, 1, 2],
        [2, 2, 0.5, 1],
    ]
    matriz_compliance = [
        [1, 2, 1 / 5, 1 / 3],
        [0.5, 1, 1 / 5, 1 / 3],
        [5, 5, 1, 3],
        [3, 3, 1 / 3, 1],
    ]
    matriz_engenharia = [
        [1, 1, 0.5, 1],
        [1, 1, 0.5, 1],
        [2, 2, 1, 2],
        [1, 1, 0.5, 1],
    ]

    avaliadores = {
        "Gestor de produto (mesmo julgamento usado nos 3 casos reais)": matriz_gestor_produto,
        "Compliance (prioriza p3 ainda mais, dado sensível pesa mais)": matriz_compliance,
        "Engenharia (perguntas mais equilibradas entre si)": matriz_engenharia,
    }
    for nome, matriz in avaliadores.items():
        pesos = derivar_pesos_ahp(matriz)
        print(f"\n  {nome}")
        print(f"    pesos: p1={pesos[0]:.3f}  p2={pesos[1]:.3f}  p3={pesos[2]:.3f}  p4={pesos[3]:.3f}")

    matrizes = list(avaliadores.values())
    matriz_agregada = agregar_matrizes_comite(matrizes)
    pesos_comite = derivar_pesos_ahp(matriz_agregada)
    consistencia_comite = calcular_consistencia_ahp(matriz_agregada, pesos_comite)

    print("\n  --- Agregado do comitê (média geométrica célula a célula, método AIJ) ---")
    print(f"    pesos: p1={pesos_comite[0]:.3f}  p2={pesos_comite[1]:.3f}  p3={pesos_comite[2]:.3f}  p4={pesos_comite[3]:.3f}")
    print(
        f"    consistência: cr={consistencia_comite['cr']:.4f} "
        f"({'consistente, CR < 0.10' if consistencia_comite['consistente'] else 'INCONSISTENTE'})"
    )
    print("\n  O peso de p3 no comitê fica entre o do gestor de produto e o de compliance, puxado")
    print("  pra baixo pela visão mais equilibrada da engenharia -- exatamente o que se espera de")
    print("  uma agregação: nenhum avaliador domina sozinho o resultado final.")

    print("\n  --- Reaplicando o peso do comitê aos 3 casos reais da Amplitude Seguros ---")
    config = carregar_configuracao()
    casos_por_id = {c["id"]: c for c in config["casos"]}
    caso_auto = casos_por_id["amplitude-auto"]
    caso_saude = casos_por_id["amplitude-saude-empresarial"]
    caso_atendimento = casos_por_id["amplitude-atendimento-cliente"]
    pesos_originais_real = derivar_pesos_ahp(config["ahp"]["matriz"])
    for nome, caso in [
        ("Amplitude Auto", caso_auto),
        ("Amplitude Saúde Empresarial", caso_saude),
        ("Amplitude Atendimento ao Cliente", caso_atendimento),
    ]:
        veredito_original = avaliar_framework(caso["scores"], pesos_originais_real, config["limiarVerde"])
        veredito_comite = avaliar_framework(caso["scores"], pesos_comite, config["limiarVerde"])
        mudou = veredito_original["aprovado"] != veredito_comite["aprovado"]
        status_original = "aprovado" if veredito_original["aprovado"] else "reprovado"
        status_comite = "aprovado" if veredito_comite["aprovado"] else "reprovado"
        marca = "  [VEREDITO MUDOU]" if mudou else ""
        print(
            f"    {nome}: original {status_original} (score {veredito_original['scoreComposto']:.3f}) -> "
            f"comitê {status_comite} (score {veredito_comite['scoreComposto']:.3f}){marca}"
        )
    print("\n  Os três vereditos batem com o peso de um avaliador só: a decisão é robusta a quem,")
    print("  especificamente, preencheu a matriz -- não só a diferença de peso, o veredito final.")

    def t_veredito_comite():
        for caso in (caso_auto, caso_saude, caso_atendimento):
            original = avaliar_framework(caso["scores"], pesos_originais_real, config["limiarVerde"])["aprovado"]
            comite = avaliar_framework(caso["scores"], pesos_comite, config["limiarVerde"])["aprovado"]
            assert original == comite, f"veredito de {caso['id']} mudou entre matriz única e comitê"

    testar("comitê não muda o veredito de nenhum dos 3 casos reais", t_veredito_comite)

    print("\n  --- Teste de regressão: comitê de 1 avaliador reproduz o resultado original ---")
    matriz_solo = agregar_matrizes_comite([matriz_gestor_produto])
    pesos_solo = derivar_pesos_ahp(matriz_solo)
    pesos_originais = derivar_pesos_ahp(matriz_gestor_produto)

    def t_regressao():
        for a, b in zip(pesos_solo, pesos_originais):
            assert abs(a - b) < 1e-9, f"{a} != {b}"

    testar("comitê de 1 avaliador reproduz exatamente os pesos do AHP de matriz única", t_regressao)

    def t_reciproca():
        n = len(matriz_agregada)
        for i in range(n):
            for j in range(n):
                assert abs(matriz_agregada[i][j] * matriz_agregada[j][i] - 1.0) < 1e-9

    testar("a matriz agregada do comitê ainda é reciprocamente válida (a[j][i] = 1/a[i][j])", t_reciproca)

    def t_soma():
        assert abs(sum(pesos_comite) - 1.0) < 1e-9

    testar("os pesos agregados do comitê somam 1.0", t_soma)

    return {"pesosComite": pesos_comite, "consistenciaComite": consistencia_comite}


if __name__ == "__main__":
    config = carregar_configuracao()
    resultado = rodar_testes(config)
    rodar_demo(config, resultado)
    rodar_demo_ahp_comite()
    print()
    print(
        f"Total geral: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), "
        f"{_testes_com_falha} falhou(falharam)."
    )

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
