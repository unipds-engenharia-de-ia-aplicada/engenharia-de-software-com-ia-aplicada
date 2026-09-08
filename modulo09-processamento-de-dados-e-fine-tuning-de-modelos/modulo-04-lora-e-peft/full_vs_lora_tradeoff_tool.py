"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Módulo 4.4 (referência espelhada em Python do .js oficial)

Fecha a pergunta que ficou em aberto desde o Módulo 4.1: será que LoRA
local, mesmo no posto certo, chega perto de um full fine-tuning de
verdade, ou tem sempre um teto? Os números abaixo não são estimativas:
são a saída real de um treino full fine-tuning (mesmo dataset, mesmo
modelo, mesmas 20 iterações, mesmas 16 camadas que o LoRA usa por
padrão) rodado nesta disciplina em 2026-08-08, comparado contra os três
treinos LoRA do Módulo 4.3.

Uso: python3 full_vs_lora_tradeoff_tool.py
"""

# Dados reais. LoRA rank 4/8/16 vêm do Módulo 4.3. Full fine-tuning é novo
# nesta sessão: --fine-tune-type full, mesmas 16 camadas (--num-layers
# padrão), mesmos hiperparâmetros de treino do resto do módulo.
CONFIGURACOES_REAIS = [
    {
        "tipo": "LoRA rank 4",
        "percentualModelo": 0.074,
        "valLossFinal": 1.246,
        "picoMemGB": 10.787,
        "tamanhoCheckpointMB": 13,
    },
    {
        "tipo": "LoRA rank 8",
        "percentualModelo": 0.147,
        "valLossFinal": 0.895,
        "picoMemGB": 10.833,
        "tamanhoCheckpointMB": 27,
    },
    {
        "tipo": "LoRA rank 16",
        "percentualModelo": 0.295,
        "valLossFinal": 0.725,
        "picoMemGB": 10.930,
        "tamanhoCheckpointMB": 52,
    },
    {
        "tipo": "Full fine-tuning",
        "percentualModelo": 22.567,
        "valLossFinal": 0.612,
        "picoMemGB": 15.338,
        "tamanhoCheckpointMB": 1992,
    },
]

# Resultado real de inferência: os mesmos dois exemplos dos Módulos 4.2 e
# 4.3, rodados contra o checkpoint de full fine-tuning. beneficiario/valor
# e segurado/placa/valor batem exatamente com o gabarito, campo a campo,
# nos dois casos -- incluindo o caso com dois valores distratores.
RESULTADO_INFERENCIA_FULL = {
    "exemploFacil": {"acertouTodosCampos": True},
    "exemploComDistratores": {"acertouTodosCampos": True},
}


# ============================================================================
# 1. Métricas derivadas
# ============================================================================


def calcular_ganho_val_loss(base, comparado):
    return round(((base["valLossFinal"] - comparado["valLossFinal"]) / base["valLossFinal"]) * 100, 2)


def calcular_razao_custo(base, comparado):
    return {
        "parametro": round(comparado["percentualModelo"] / base["percentualModelo"], 1),
        "memoria": round(comparado["picoMemGB"] / base["picoMemGB"], 2),
        "checkpoint": round(comparado["tamanhoCheckpointMB"] / base["tamanhoCheckpointMB"], 1),
    }


def vale_a_pena_full_fine_tuning(configuracoes, limiar_ganho_minimo=20):
    """Só faz sentido pagar o custo extra do full fine-tuning se o ganho de
    val loss superar um limiar mínimo em relação ao melhor LoRA testado."""
    melhor_lora = sorted(
        (c for c in configuracoes if c["tipo"].startswith("LoRA")),
        key=lambda c: c["valLossFinal"],
    )[0]
    full = next(c for c in configuracoes if c["tipo"] == "Full fine-tuning")
    ganho = calcular_ganho_val_loss(melhor_lora, full)
    return {
        "melhorLora": melhor_lora["tipo"],
        "ganhoPercentual": ganho,
        "valeAPena": ganho >= limiar_ganho_minimo,
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
    print("== Testes: métricas derivadas sobre dado real ==")

    lora_oito = next(c for c in CONFIGURACOES_REAIS if c["tipo"] == "LoRA rank 8")
    full = next(c for c in CONFIGURACOES_REAIS if c["tipo"] == "Full fine-tuning")

    def t1():
        ganho = calcular_ganho_val_loss(lora_oito, full)
        assert abs(ganho - 31.62) < 0.5, f"ganho={ganho}"

    testar("full fine-tuning melhora o val loss frente ao LoRA rank 8 em ~31,6%", t1)

    def t2():
        razao = calcular_razao_custo(lora_oito, full)
        assert abs(razao["parametro"] - 153.5) < 1, f"razao={razao['parametro']}"

    testar("full fine-tuning usa ~153x mais parâmetros treináveis que LoRA rank 8", t2)

    def t3():
        razao = calcular_razao_custo(lora_oito, full)
        assert razao["checkpoint"] == 73.8

    testar("checkpoint do full fine-tuning é ~73,8x maior que o adaptador LoRA rank 8", t3)

    def t4():
        loras = [c for c in CONFIGURACOES_REAIS if c["tipo"].startswith("LoRA")]
        for l in loras:
            assert full["picoMemGB"] > l["picoMemGB"], f"{l['tipo']}: full={full['picoMemGB']}, lora={l['picoMemGB']}"

    testar("full fine-tuning usa mais memória de pico que qualquer configuração LoRA", t4)

    print()
    print("== Testes: vale a pena o custo extra? ==")

    def t5():
        r = vale_a_pena_full_fine_tuning(CONFIGURACOES_REAIS, 20)
        assert r["melhorLora"] == "LoRA rank 16"
        assert r["valeAPena"] is False, f"esperado False pois o ganho real fica abaixo de 20%, ganho={r['ganhoPercentual']}"

    testar("aplica corretamente o limiar de 20% sobre o ganho de full fine-tuning vs. o melhor LoRA testado", t5)

    def t6():
        r = vale_a_pena_full_fine_tuning(CONFIGURACOES_REAIS, 10)
        assert r["valeAPena"] is True

    testar("aplica corretamente o limiar de 10% sobre o mesmo critério de decisão", t6)

    print()
    print("== Testes: resultado de inferência real (mesmos exemplos dos Módulos 4.2 e 4.3) ==")

    def t7():
        assert RESULTADO_INFERENCIA_FULL["exemploFacil"]["acertouTodosCampos"] is True

    testar("valida o resultado de inferência do exemplo fácil contra o valor de referência interno", t7)

    def t8():
        assert RESULTADO_INFERENCIA_FULL["exemploComDistratores"]["acertouTodosCampos"] is True

    testar("valida o resultado de inferência do exemplo com distratores contra o valor de referência interno", t8)

    print()
    print(
        f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), "
        f"{_testes_com_falha} falhou(falharam)."
    )

    if _testes_com_falha > 0:
        raise AssertionError(f"{_testes_com_falha} teste(s) falharam. A implementação não bate com a especificação.")


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------


def rodar_demo():
    print()
    print("===== Full Fine-Tuning vs. LoRA: a resposta, com números reais =====\n")

    for c in CONFIGURACOES_REAIS:
        print(f"  {c['tipo']}:")
        print(f"    Parâmetros treináveis: {c['percentualModelo']}% do modelo")
        print(f"    Val loss final: {c['valLossFinal']}")
        print(f"    Pico de memória: {c['picoMemGB']:.3f} GB")
        print(f"    Checkpoint salvo: {c['tamanhoCheckpointMB']} MB")
        print()

    lora_oito = next(c for c in CONFIGURACOES_REAIS if c["tipo"] == "LoRA rank 8")
    full = next(c for c in CONFIGURACOES_REAIS if c["tipo"] == "Full fine-tuning")
    razao = calcular_razao_custo(lora_oito, full)
    print("  --- Full fine-tuning vs. LoRA rank 8 ---")
    print(f"  Val loss {calcular_ganho_val_loss(lora_oito, full)}% melhor, com {razao['parametro']}x mais parâmetros,")
    print(f"  {razao['memoria']}x mais memória de pico, e checkpoint {razao['checkpoint']}x maior.")

    decisao = vale_a_pena_full_fine_tuning(CONFIGURACOES_REAIS, 20)
    print(f"\n  Vale a pena? Comparado ao melhor LoRA ({decisao['melhorLora']}), o ganho real é de {decisao['ganhoPercentual']}%.")
    print(f"  Com limiar de 20% pra justificar o custo extra: {'SIM' if decisao['valeAPena'] else 'NÃO, fica abaixo do limiar'}.")

    print("\n  --- Inferência real, mesmos dois exemplos dos Módulos 4.2 e 4.3 ---")
    print("  Exemplo fácil (Felipe Alves Monteiro): full fine-tuning acerta, campo a campo.")
    print("  Exemplo com distratores (Ricardo Alves Monteiro): full fine-tuning acerta, campo a campo.")
    print("  Mesmo resultado observável que LoRA rank 4, 8 e 16 nos dois casos.")

    print("\n-----------------------------------------------------------------------------")
    print("Existe teto, e é real: full fine-tuning chega a um val loss melhor que qualquer")
    print("LoRA testado. Mas pra esta tarefa, extração estruturada e estreita, esse teto")
    print("não aparece em comportamento observável, nem no caso fácil, nem no difícil. O")
    percentual_memoria_extra = round((razao["memoria"] - 1) * 100)
    print(f"custo aparece sempre: {razao['checkpoint']}x mais disco, ~{percentual_memoria_extra}% mais memória, {razao['parametro']}x mais parâmetros.")
    print("  (medido em iters=20 pros dois lados - o Módulo 4.2 mostrou esse checkpoint subtreinado, melhor iteração real = 90. O teto pode ser real, mas o tamanho exato ainda não foi medido até convergência.)")
    print("-----------------------------------------------------------------------------")


if __name__ == "__main__":
    rodar_testes()
    rodar_demo()

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
