"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Módulo 4.1 (referência espelhada em Python do .js oficial)

Este script não inventa uma ferramenta financeira nova. Ele reabre
calcular_npv, direto do decision_framework_tool.py do Módulo 1.3, sem
duplicar nenhuma linha de lógica, pra responder uma pergunta que o
Módulo 1.3 nunca precisou responder: quando o CASO já foi aprovado
(fine-tuning vale a pena), mas o VOLUME é pequeno demais pro custo fixo
de alugar uma GPU na nuvem pra treinar, o que muda na conta se o treino
for local, via LoRA, em vez de GPU alugada?

Caso: Amplitude Auto está expandindo pra parcerias regionais (Sul,
Nordeste), cada uma gerando ~400 orçamentos de oficina por mês, mesma
tarefa da Amplitude Auto nacional (8.000/mês), volume bem menor.

Uso: python3 regional_lora_vs_cloud_npv.py
"""

import importlib.util
from pathlib import Path

_M1_2_PATH = Path(__file__).parent.parent / "modulo-01-decision-framework" / "decision_framework_tool.py"
_spec = importlib.util.spec_from_file_location("decision_framework_tool", _M1_2_PATH)
dft = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(dft)

VOLUME_REGIONAL_MENSAL = 400
CRESCIMENTO_MENSAL = 0.03
CUSTO_STATUS_QUO = 0.045
CUSTO_FINE_TUNED = 0.016
# [Estimativa de mercado, ago/2026] R$2.400 é o número ilustrativo do case Amplitude
# Seguros (herdado do Módulo 1.3), não uma cotação real de mercado -- foi calibrado
# pra sustentar a história financeira do case, usando como referência frouxa a faixa
# de GPU cloud verificada no cheatsheet do Módulo 1.3 (~US$0,40-4,00/hora). Preço de
# aluguel de GPU muda rápido; antes de usar este script pra uma decisão real, confira
# valores atuais em vast.ai/pricing ou runpod.io/pricing.
CUSTO_JOB_GERENCIADO = 2400  # custo fixo de alugar GPU na nuvem por job de treino (não é o preço da API gerenciada da Vertex AI, que fatura por token)
CUSTO_LORA_LOCAL = 0  # hardware já existe, custo marginal de treinar mais um adaptador é tempo de máquina
HORIZONTE_MESES = 24
TAXA_DESCONTO_MENSAL = 0.01
NUM_PARCERIAS_REGIONAIS = 5


def params_base(custo_treinamento):
    return {
        "volumeInicialMensal": VOLUME_REGIONAL_MENSAL,
        "crescimentoMensal": CRESCIMENTO_MENSAL,
        "custoPorChamadaStatusQuo": CUSTO_STATUS_QUO,
        "custoPorChamadaFineTuned": CUSTO_FINE_TUNED,
        "custoTreinamento": custo_treinamento,
        "horizonteMeses": HORIZONTE_MESES,
        "taxaDescontoMensal": TAXA_DESCONTO_MENSAL,
    }


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


def rodar_testes():
    print("== Testes: NPV de parceria regional, GPU alugada vs. LoRA local ==")

    npv_gerenciado = dft.calcular_npv(params_base(CUSTO_JOB_GERENCIADO))
    npv_lora = dft.calcular_npv(params_base(CUSTO_LORA_LOCAL))

    def t1():
        assert npv_gerenciado["npv"] < 0, f"npv={npv_gerenciado['npv']}, esperado < 0"

    testar("volume regional (400/mês) com custo fixo de GPU alugada dá NPV negativo em 24 meses", t1)

    def t2():
        assert npv_gerenciado["mesBreakeven"] is None

    testar("volume regional com custo fixo de GPU alugada nunca atinge breakeven no horizonte", t2)

    def t3():
        assert npv_lora["npv"] > 0, f"npv={npv_lora['npv']}, esperado > 0"

    testar("mesmo volume regional, mesmo custo por chamada, com LoRA local (custo fixo ~0) dá NPV positivo", t3)

    def t4():
        assert npv_lora["mesBreakeven"] is not None and npv_lora["mesBreakeven"] <= 3, f"mesBreakeven={npv_lora['mesBreakeven']}"

    testar("LoRA local atinge breakeven rápido (poucos meses), diferença é só o custo fixo", t4)

    def t5():
        diferenca = npv_lora["npv"] - npv_gerenciado["npv"]
        assert abs(diferenca - CUSTO_JOB_GERENCIADO) < 50, f"diferença={diferenca}, esperado próximo de {CUSTO_JOB_GERENCIADO}"

    testar("a diferença de NPV entre os dois caminhos é exatamente a diferença de custo fixo, descontada", t5)

    print()
    print(
        f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), "
        f"{_testes_com_falha} falhou(falharam)."
    )

    if _testes_com_falha > 0:
        raise AssertionError(f"{_testes_com_falha} teste(s) falharam. A implementação não bate com a especificação.")

    return {"npvGerenciado": npv_gerenciado, "npvLora": npv_lora}


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------


def rodar_demo(r):
    npv_gerenciado = r["npvGerenciado"]
    npv_lora = r["npvLora"]

    print()
    print("===== Demo: uma parceria regional, dois caminhos de fine-tuning =====\n")
    print(f"Volume: {VOLUME_REGIONAL_MENSAL}/mês (vs. 8.000/mês da Amplitude Auto nacional)")
    print(f"Mesmo custo por chamada do Módulo 1.3: status quo R$ {CUSTO_STATUS_QUO}, fine-tunado R$ {CUSTO_FINE_TUNED}\n")

    print("--- Caminho 1: GPU alugada na nuvem ---")
    print(f"  Custo fixo de treino: R$ {CUSTO_JOB_GERENCIADO:.2f}")
    print(f"  NPV em {HORIZONTE_MESES} meses: R$ {npv_gerenciado['npv']:.2f}")
    print(f"  Breakeven: {'mês ' + str(npv_gerenciado['mesBreakeven']) if npv_gerenciado['mesBreakeven'] else 'não atinge no horizonte'}")

    print("\n--- Caminho 2: LoRA local (Módulo 4, este vídeo) ---")
    print(f"  Custo fixo de treino: R$ {CUSTO_LORA_LOCAL:.2f} (hardware já existe, custo marginal é tempo de máquina)")
    print(f"  NPV em {HORIZONTE_MESES} meses: R$ {npv_lora['npv']:.2f}")
    print(f"  Breakeven: mês {npv_lora['mesBreakeven']}")

    print(f"\n--- Escalando pra {NUM_PARCERIAS_REGIONAIS} parcerias regionais ---")
    print(f"  {NUM_PARCERIAS_REGIONAIS} GPUs alugadas: custo fixo total R$ {CUSTO_JOB_GERENCIADO * NUM_PARCERIAS_REGIONAIS:.2f}, nenhuma atinge breakeven sozinha")
    print(f"  {NUM_PARCERIAS_REGIONAIS} adaptadores LoRA locais: custo fixo total ~R$ 0, cada um com NPV positivo desde o mês 1")

    print("\n-----------------------------------------------------------------------------")
    print("Mesma fórmula de NPV do Módulo 1.3, mesmo caso aprovado no gate. O que muda é")
    print("o custo fixo por unidade de treino: perto de zero pra LoRA local, fixo e alto")
    print("pra GPU alugada. Em volume pequeno, essa diferença decide o resultado.")
    print("-----------------------------------------------------------------------------")


if __name__ == "__main__":
    resultado = rodar_testes()
    rodar_demo(resultado)

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
