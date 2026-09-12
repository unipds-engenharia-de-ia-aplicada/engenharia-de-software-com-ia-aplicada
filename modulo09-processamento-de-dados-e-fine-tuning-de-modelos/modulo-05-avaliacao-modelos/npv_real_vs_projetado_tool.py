"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 5.4 (companion, fecha o arco financeiro do Modulo 1,
referencia espelhada em Python do .js oficial)

O Modulo 1.3 rodou a projecao de NPV que aprovou Amplitude Auto
(Saude Empresarial so foi aprovada depois, no Modulo 3.2) com um custo
de treino ESTIMADO (R$2.400, o
valor de referencia desta disciplina pra "GPU alugada"). O Modulo 5.2 mediu
o custo REAL desses treinos no billing do Google Cloud: R$1,53 (Auto) e
R$0,86 (Saude Empresarial) -- centavos, nao milhares de reais.

Este arquivo NAO inventa nenhum dado de negocio novo (nenhuma receita de
producao, nenhum ROI ficticio): reabre o MESMO codigo de NPV do Modulo 1.3
(decision_framework_tool.py, calcular_npv e simular_monte_carlo, sem
duplicar nenhuma logica financeira) e troca so o custo de treino, do
estimado pro medido, mantendo toda a outra premissa (crescimento de
volume, custo por chamada) exatamente como a projecao original -- essas
continuam sendo estimativa, nao foram medidas em producao.

Uso: python3 npv_real_vs_projetado_tool.py
"""

import importlib.util
from pathlib import Path

_M1_2_PATH = Path(__file__).parent.parent / "modulo-01-decision-framework" / "decision_framework_tool.py"
_spec = importlib.util.spec_from_file_location("decision_framework_tool", _M1_2_PATH)
dft = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(dft)


# =============================================================================
# 1. Custo de treino real, medido no Modulo 5.2 (billing real do Google
#    Cloud), contra o valor de referencia estimado no Modulo 1.3
# =============================================================================

CUSTO_TREINAMENTO_REAL = {
    "amplitude-auto": 1.53,
    "amplitude-saude-empresarial": 0.86,
}


# =============================================================================
# 2. Montar os params deterministicos que calcular_npv espera (mesma forma
#    que a funcao interna _params_deterministicos do Modulo 1.3 -- adaptador
#    de interface, a logica financeira em si continua vindo de calcular_npv
#    real)
# =============================================================================

def montar_params_deterministicos(financeiro, custo_treinamento_override=None):
    # As chaves seguem o JSON de configuração compartilhado com o .js oficial
    # (amplitude-seguros-casos.json), que é camelCase -- calcular_npv espera
    # exatamente essas chaves, mesmo no lado Python.
    return {
        "volumeInicialMensal": financeiro["volumeInicialMensal"],
        "crescimentoMensal": financeiro["crescimentoMensal"]["moda"],
        "custoPorChamadaStatusQuo": financeiro["custoPorChamadaStatusQuo"]["moda"],
        "custoPorChamadaFineTuned": financeiro["custoPorChamadaFineTuned"]["moda"],
        "custoTreinamento": (
            custo_treinamento_override if custo_treinamento_override is not None
            else financeiro["custoTreinamento"]
        ),
        "horizonteMeses": financeiro["horizonteMeses"],
        "taxaDescontoMensal": financeiro["taxaDescontoMensal"],
    }


# =============================================================================
# 3. Comparar projecao original (custo estimado) contra real (custo medido)
# =============================================================================

def comparar_projetado_vs_real(caso_id, config):
    caso = next((c for c in config["casos"] if c["id"] == caso_id), None)
    if caso is None:
        raise ValueError(f"caso nao encontrado: {caso_id}")
    custo_real = CUSTO_TREINAMENTO_REAL.get(caso_id)
    if custo_real is None:
        raise ValueError(f"sem custo real medido pra: {caso_id}")

    projetado = dft.calcular_npv(montar_params_deterministicos(caso["financeiro"]))
    real = dft.calcular_npv(montar_params_deterministicos(caso["financeiro"], custo_real))

    return {
        "caso_id": caso_id,
        "custo_treinamento_projetado": caso["financeiro"]["custoTreinamento"],
        "custo_treinamento_real": custo_real,
        "npv_projetado": projetado["npv"],
        "breakeven_projetado": projetado["mesBreakeven"],
        "npv_real": real["npv"],
        "breakeven_real": real["mesBreakeven"],
    }


# -----------------------------------------------------------------------------
# Testes automatizados -- contra os numeros reais capturados rodando este
# mesmo codigo nesta maquina em 2026-09-04
# -----------------------------------------------------------------------------

_total_testes = 0
_testes_com_falha = 0


def testar(descricao, fn):
    global _total_testes, _testes_com_falha
    _total_testes += 1
    try:
        fn()
        print(f"  [OK] {descricao}")
    except Exception as erro:  # noqa: BLE001
        _testes_com_falha += 1
        print(f"  [FALHOU] {descricao}")
        print(f"           {erro}")


def rodar_testes():
    print("== Testes: recomputacao de NPV com custo de treino real ==")
    config = dft.carregar_configuracao()

    def teste_auto_projetado():
        r = comparar_projetado_vs_real("amplitude-auto", config)
        assert r["custo_treinamento_projetado"] == 2400
        assert r["npv_projetado"] == 4780.27
        assert r["breakeven_projetado"] == 10
    testar("Auto: NPV projetado bate com o numero real do Modulo 1.3 (R$4.780,27, breakeven mes 10)", teste_auto_projetado)

    def teste_auto_real():
        r = comparar_projetado_vs_real("amplitude-auto", config)
        assert r["npv_real"] == 7178.74
        assert r["breakeven_real"] == 1
        assert r["npv_real"] > r["npv_projetado"]
    testar("Auto: NPV real (custo R$1,53) sobe pra R$7.178,74, breakeven cai pro mes 1", teste_auto_real)

    def teste_saude_projetado():
        r = comparar_projetado_vs_real("amplitude-saude-empresarial", config)
        assert r["custo_treinamento_projetado"] == 2400
        assert r["npv_projetado"] == -993.23
        assert r["breakeven_projetado"] is None
    testar("Saude Empresarial: NPV projetado era negativo (R$-993,23, sem breakeven)", teste_saude_projetado)

    def teste_saude_real():
        r = comparar_projetado_vs_real("amplitude-saude-empresarial", config)
        assert r["npv_real"] == 1405.91
        assert r["breakeven_real"] == 1
    testar("Saude Empresarial: NPV real (custo R$0,86) vira positivo, R$1.405,91, breakeven mes 1", teste_saude_real)

    def teste_outros_params_intocados():
        caso = next(c for c in config["casos"] if c["id"] == "amplitude-auto")
        p_projetado = montar_params_deterministicos(caso["financeiro"])
        p_real = montar_params_deterministicos(caso["financeiro"], CUSTO_TREINAMENTO_REAL["amplitude-auto"])
        assert p_projetado["custoPorChamadaFineTuned"] == p_real["custoPorChamadaFineTuned"]
        assert p_projetado["crescimentoMensal"] == p_real["crescimentoMensal"]
        assert p_projetado["custoTreinamento"] != p_real["custoTreinamento"]
    testar("custo por chamada e crescimento de volume NAO mudam (continuam projecao, nao medidos)", teste_outros_params_intocados)

    print(f"\n{_total_testes - _testes_com_falha}/{_total_testes} testes passaram.")
    return _testes_com_falha == 0


# =============================================================================
# 4. Comparacao real, impressa
# =============================================================================

def rodar_comparacao_real():
    config = dft.carregar_configuracao()
    print("\n===== NPV: projecao original (Modulo 1.3) vs. custo real medido (Modulo 5.2) =====\n")

    resultados = []
    for caso_id in ["amplitude-auto", "amplitude-saude-empresarial"]:
        r = comparar_projetado_vs_real(caso_id, config)
        resultados.append(r)
        print(f"--- {caso_id} ---")
        print(f"  Custo de treino projetado: R${r['custo_treinamento_projetado']:.2f}  ->  real medido: R${r['custo_treinamento_real']:.2f}")
        be_p = "nunca" if r["breakeven_projetado"] is None else f"mes {r['breakeven_projetado']}"
        be_r = "nunca" if r["breakeven_real"] is None else f"mes {r['breakeven_real']}"
        print(f"  NPV projetado: R${r['npv_projetado']:.2f} (breakeven: {be_p})")
        print(f"  NPV real:      R${r['npv_real']:.2f} (breakeven: {be_r})")
        print()

    print(
        "O que mudou: so o custo de treino, de estimativa pra medicao real. Custo por "
        "chamada em producao e crescimento de volume continuam sendo a mesma projecao "
        "do Modulo 1.3 -- nao foram medidos em producao, entao nao mudam aqui."
    )

    return resultados


if __name__ == "__main__":
    ok = rodar_testes()
    rodar_comparacao_real()
    if not ok:
        raise SystemExit(1)

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
