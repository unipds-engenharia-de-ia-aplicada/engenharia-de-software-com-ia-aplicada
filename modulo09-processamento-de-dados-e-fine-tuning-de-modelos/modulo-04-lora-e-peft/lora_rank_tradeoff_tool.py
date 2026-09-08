"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Módulo 4.3 (referência espelhada em Python do .js oficial)

Analisa o trade-off real entre posto (rank) do LoRA, parâmetros treináveis,
memória, velocidade e qualidade (val loss). Os números abaixo não são
estimativa nem exemplo de documentação: são a saída real de três treinos
rodados nesta disciplina, mesmo dataset, mesmo modelo, mesmos
hiperparâmetros (iters=20, batch=1, learning-rate=1e-5), variando só o
rank -- 4, 8 (o mesmo treino do Módulo 4.2) e 16 -- via
lora_parameters.rank no arquivo de config YAML do mlx_lm.lora.

Uso: python3 lora_rank_tradeoff_tool.py
"""

# Dados reais, capturados rodando mlx_lm.lora três vezes contra o mesmo
# dataset do Módulo 3 (157 exemplos de treino), no Gemma 4 E2B, em
# 2026-08-08. Nenhum número aqui é estimado.
EXECUCOES_REAIS = [
    {
        "rank": 4,
        "parametrosTreinaveis": 3.408e6,
        "percentualModelo": 0.074,
        "valLossInicial": 4.752,
        "valLossFinal": 1.246,
        "picoMemGB": 10.787,
        "itPorSegundoFinal": 7.401,
        "tamanhoAdapterMB": 13,
    },
    {
        "rank": 8,
        "parametrosTreinaveis": 6.816e6,
        "percentualModelo": 0.147,
        "valLossInicial": 4.752,
        "valLossFinal": 0.895,
        "picoMemGB": 10.833,
        "itPorSegundoFinal": 7.295,
        "tamanhoAdapterMB": 27,
    },
    {
        "rank": 16,
        "parametrosTreinaveis": 13.631e6,
        "percentualModelo": 0.295,
        "valLossInicial": 4.752,
        "valLossFinal": 0.725,
        "picoMemGB": 10.930,
        "itPorSegundoFinal": 7.253,
        "tamanhoAdapterMB": 52,
    },
]


# Segundo par de execuções reais, mesmo rank (8), mesmo dataset, mesmos
# hiperparâmetros -- só o dtype do modelo base muda: bf16 (a execução de
# rank 8 acima) contra o mesmo modelo pré-quantizado em 4-bit (QLoRA de
# verdade, não só citado em slide). Capturado em 2026-08-16.
COMPARACAO_QUANTIZACAO = {
    "bf16": {
        "tamanhoModeloDiscoGB": 10.241,
        "picoMemTreinoGB": 10.833,
        "valLossFinal": 0.895,
        "tamanhoAdapterMB": 27,
    },
    "4bit": {
        "tamanhoModeloDiscoGB": 3.583,
        "picoMemTreinoGB": 4.193,
        "valLossFinal": 0.932,
        "tamanhoAdapterMB": 27,
        "picoMemGeracaoGB": 2.794,
    },
}


# Terceiro par de execuções reais, mesmo rank (8), mesmo dataset, mesmos
# hiperparâmetros -- só o tipo de adaptação muda: LoRA puro (a execução de
# rank 8 acima) contra DoRA (weight-decomposed LoRA), via fine_tune_type:
# dora no mesmo mlx_lm.lora (suporte nativo desde a versão instalada nesta
# disciplina, sem código extra). Capturado em 2026-08-31.
COMPARACAO_TIPO_ADAPTACAO = {
    "lora": {
        "parametrosTreinaveis": 6.816e6,
        "picoMemGB": 10.833,
        "valLossFinal": 0.895,
        "tamanhoAdapterMB": 27,
    },
    "dora": {
        "parametrosTreinaveis": 7.328e6,
        "picoMemGB": 11.099,
        "valLossFinal": 0.895,
        "tamanhoAdapterMB": 28,
    },
}


# ============================================================================
# 1. Métricas derivadas -- quanto cada dobra de rank custa e entrega
# ============================================================================


def calcular_reducao_val_loss(execucao):
    return round(((execucao["valLossInicial"] - execucao["valLossFinal"]) / execucao["valLossInicial"]) * 100, 2)


def comparar_execucoes_sucessivas(execucoes):
    """Compara cada execução contra a anterior na lista (assumida ordenada
    por rank crescente): quanto os parâmetros treináveis cresceram, quanto o
    val loss final melhorou, e o custo de memória extra."""
    comparacoes = []
    for i in range(1, len(execucoes)):
        anterior = execucoes[i - 1]
        atual = execucoes[i]
        razao_parametros = round(atual["parametrosTreinaveis"] / anterior["parametrosTreinaveis"], 2)
        melhoria_val_loss = round(anterior["valLossFinal"] - atual["valLossFinal"], 3)
        melhoria_percentual = round((melhoria_val_loss / anterior["valLossFinal"]) * 100, 2)
        custo_memoria_extra_gb = round(atual["picoMemGB"] - anterior["picoMemGB"], 3)
        comparacoes.append({
            "deRank": anterior["rank"],
            "paraRank": atual["rank"],
            "razaoParametros": razao_parametros,
            "melhoriaValLoss": melhoria_val_loss,
            "melhoriaPercentual": melhoria_percentual,
            "custoMemoriaExtraGB": custo_memoria_extra_gb,
        })
    return comparacoes


def comparar_quantizacao(comparacao=COMPARACAO_QUANTIZACAO):
    """Compara a mesma configuração de LoRA (rank 8) contra o modelo base
    em bf16 e em 4-bit (QLoRA de verdade): quanto de memória a quantização
    economiza, e quanto de val loss ela custa."""
    bf16, quatro_bit = comparacao["bf16"], comparacao["4bit"]
    reducao_disco_pct = round((1 - quatro_bit["tamanhoModeloDiscoGB"] / bf16["tamanhoModeloDiscoGB"]) * 100, 1)
    reducao_mem_treino_pct = round((1 - quatro_bit["picoMemTreinoGB"] / bf16["picoMemTreinoGB"]) * 100, 1)
    custo_val_loss = round(quatro_bit["valLossFinal"] - bf16["valLossFinal"], 3)
    custo_val_loss_pct = round((custo_val_loss / bf16["valLossFinal"]) * 100, 1)
    return {
        "reducaoDiscoPct": reducao_disco_pct,
        "reducaoMemTreinoPct": reducao_mem_treino_pct,
        "custoValLoss": custo_val_loss,
        "custoValLossPct": custo_val_loss_pct,
    }


def comparar_tipo_adaptacao(comparacao=COMPARACAO_TIPO_ADAPTACAO):
    """Compara a mesma configuração de LoRA (rank 8) contra DoRA
    (weight-decomposed LoRA): quanto DoRA custa a mais de parâmetros
    treináveis e memória, e se esse custo se traduz em val loss melhor
    neste treino pequeno e nesta tarefa de extração estruturada."""
    lora, dora = comparacao["lora"], comparacao["dora"]
    razao_parametros = round(dora["parametrosTreinaveis"] / lora["parametrosTreinaveis"], 3)
    custo_memoria_extra_gb = round(dora["picoMemGB"] - lora["picoMemGB"], 3)
    diferenca_val_loss = round(dora["valLossFinal"] - lora["valLossFinal"], 3)
    return {
        "razaoParametros": razao_parametros,
        "custoMemoriaExtraGB": custo_memoria_extra_gb,
        "diferencaValLoss": diferenca_val_loss,
    }


def recomendar_rank_minimo(execucoes, margem_aceitavel=0.10):
    """Recomenda o menor rank cujo val loss final fica dentro de uma
    margem (padrão 10%) do melhor val loss observado."""
    melhor_val_loss = min(c["valLossFinal"] for c in execucoes)
    limiar = melhor_val_loss * (1 + margem_aceitavel)
    candidatos = sorted((c for c in execucoes if c["valLossFinal"] <= limiar), key=lambda c: c["rank"])
    return candidatos[0]


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
    print("== Testes: redução de val loss por execução ==")

    def t1():
        r = calcular_reducao_val_loss(EXECUCOES_REAIS[1])
        assert abs(r - 81.17) < 0.5, f"reducao={r}"

    testar("rank 8 reduz val loss em aproximadamente 81% (4,752 -> 0,895)", t1)

    print()
    print("== Testes: comparação entre execuções sucessivas ==")

    comparacoes = comparar_execucoes_sucessivas(EXECUCOES_REAIS)

    def t2():
        assert comparacoes[0]["razaoParametros"] == 2.0

    testar("rank 4 -> 8 dobra os parâmetros treináveis (razão = 2,0)", t2)

    def t3():
        assert comparacoes[1]["razaoParametros"] == 2.0

    testar("rank 8 -> 16 também dobra os parâmetros treináveis", t3)

    def t4():
        for c in comparacoes:
            assert c["melhoriaValLoss"] > 0, f"de rank {c['deRank']} pra {c['paraRank']}, melhoria={c['melhoriaValLoss']}"

    testar("mais rank sempre melhora o val loss final, nas três execuções reais", t4)

    def t5():
        for c in comparacoes:
            assert c["custoMemoriaExtraGB"] < 0.2, f"custo={c['custoMemoriaExtraGB']}GB"

    testar("o custo de memória extra por dobra de rank é pequeno (< 0,2GB), não proporcional aos parâmetros", t5)

    print()
    print("== Testes: recomendação de rank mínimo ==")

    def t6():
        r = recomendar_rank_minimo(EXECUCOES_REAIS, 0.10)
        assert r["rank"] == 16

    testar("com margem de 10%, recomenda rank 16 (só ele fica dentro da margem do melhor val loss)", t6)

    def t7():
        r = recomendar_rank_minimo(EXECUCOES_REAIS, 0.60)
        assert r["rank"] == 8

    testar("com margem de 60%, recomenda rank 8 (o menor que já entra na margem larga)", t7)

    print()
    print("== Testes: comparação de quantização (bf16 vs. 4-bit / QLoRA de verdade) ==")

    def t8():
        r = comparar_quantizacao()
        assert abs(r["reducaoDiscoPct"] - 65.0) < 1.0, f"reducaoDiscoPct={r['reducaoDiscoPct']}"

    testar("4-bit ocupa cerca de 65% menos espaço em disco que bf16, mesmo modelo", t8)

    def t9():
        r = comparar_quantizacao()
        assert abs(r["reducaoMemTreinoPct"] - 61.3) < 1.0, f"reducaoMemTreinoPct={r['reducaoMemTreinoPct']}"

    testar("4-bit reduz o pico de memória de treino em cerca de 61%", t9)

    def t10():
        r = comparar_quantizacao()
        assert r["custoValLossPct"] < 10, f"custoValLossPct={r['custoValLossPct']} deveria ser pequeno"

    testar("o custo de val loss da quantização é pequeno (< 10%), não proporcional à economia de memória", t10)

    print()
    print("== Testes: comparação de tipo de adaptação (LoRA vs. DoRA, mesmo rank 8) ==")

    def t11():
        r = comparar_tipo_adaptacao()
        assert abs(r["razaoParametros"] - 1.075) < 0.02, f"razaoParametros={r['razaoParametros']}"

    testar("DoRA usa cerca de 7,5% mais parâmetros treináveis que LoRA no mesmo rank", t11)

    def t12():
        r = comparar_tipo_adaptacao()
        assert 0.2 < r["custoMemoriaExtraGB"] < 0.35, f"custoMemoriaExtraGB={r['custoMemoriaExtraGB']}"

    testar("DoRA custa memória extra de treino (entre 0,2 e 0,35GB a mais que LoRA no mesmo rank)", t12)

    def t13():
        r = comparar_tipo_adaptacao()
        assert r["diferencaValLoss"] == 0, f"diferencaValLoss={r['diferencaValLoss']} deveria ser 0 (empate)"

    testar("nesta tarefa pequena e neste treino curto, DoRA empata com LoRA em val loss final, sem ganho", t13)

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
    print("===== Trade-off real: rank do LoRA vs. parâmetros, memória, velocidade e qualidade =====\n")
    print("Mesmo dataset (157 exemplos), mesmo modelo (Gemma 4 E2B), mesmos hiperparâmetros,")
    print("só o rank muda. Três treinos reais, rodados nesta disciplina.\n")

    for c in EXECUCOES_REAIS:
        print(f"  Rank {c['rank']}:")
        print(f"    Parâmetros treináveis: {c['parametrosTreinaveis'] / 1e6:.3f}M ({c['percentualModelo']}% do modelo)")
        print(f"    Val loss: {c['valLossInicial']} -> {c['valLossFinal']} ({calcular_reducao_val_loss(c)}% de redução)")
        print(f"    Pico de memória: {c['picoMemGB']} GB")
        print(f"    Velocidade: {c['itPorSegundoFinal']} it/s")
        print(f"    Adaptador salvo: {c['tamanhoAdapterMB']} MB")
        print()

    comparacoes = comparar_execucoes_sucessivas(EXECUCOES_REAIS)
    print("  --- O que cada dobra de rank custa e entrega ---")
    for c in comparacoes:
        print(f"  Rank {c['deRank']} -> {c['paraRank']}: parâmetros x{c['razaoParametros']}, val loss melhora {c['melhoriaValLoss']} ({c['melhoriaPercentual']}%), memória +{c['custoMemoriaExtraGB']}GB")

    recomendacao = recomendar_rank_minimo(EXECUCOES_REAIS, 0.10)
    print(f"\n  Recomendação (margem de 10% do melhor val loss): rank {recomendacao['rank']}")
    print("  Aviso: recomendação medida em iters=20, o mesmo checkpoint que o Módulo 4.2 mostrou subtreinado (melhor iteração real = 90). Serve pra comparar a ordem entre os postos, não como valor final de produção.")

    print("\n===== QLoRA de verdade: o mesmo rank 8, contra o modelo pré-quantizado em 4-bit =====\n")
    q = comparar_quantizacao()
    bf16, quatro_bit = COMPARACAO_QUANTIZACAO["bf16"], COMPARACAO_QUANTIZACAO["4bit"]
    print(f"  bf16:  modelo em disco {bf16['tamanhoModeloDiscoGB']}GB, pico de memória no treino {bf16['picoMemTreinoGB']}GB, val loss final {bf16['valLossFinal']}")
    print(f"  4-bit: modelo em disco {quatro_bit['tamanhoModeloDiscoGB']}GB, pico de memória no treino {quatro_bit['picoMemTreinoGB']}GB, val loss final {quatro_bit['valLossFinal']}")
    print(f"\n  Quantização economiza {q['reducaoDiscoPct']}% de disco e {q['reducaoMemTreinoPct']}% de pico de memória no treino,")
    print(f"  ao custo de {q['custoValLoss']} de val loss ({q['custoValLossPct']}% pior - maior que a faixa de ruído entre execuções medida no Módulo 4.2 (~2,3%), então é custo real da quantização, não ruído).")
    print(f"  Geração com o adaptador QLoRA contra o mesmo exemplo de teste: JSON correto, campo a campo,")
    print(f"  com pico de memória de só {quatro_bit['picoMemGeracaoGB']}GB.")

    print("\n===== DoRA de verdade: o mesmo rank 8, weight-decomposed LoRA em vez de LoRA puro =====\n")
    t = comparar_tipo_adaptacao()
    lora, dora = COMPARACAO_TIPO_ADAPTACAO["lora"], COMPARACAO_TIPO_ADAPTACAO["dora"]
    print(f"  LoRA: {lora['parametrosTreinaveis'] / 1e6:.3f}M parâmetros, pico de memória {lora['picoMemGB']}GB, val loss final {lora['valLossFinal']}, adaptador {lora['tamanhoAdapterMB']}MB")
    print(f"  DoRA: {dora['parametrosTreinaveis'] / 1e6:.3f}M parâmetros, pico de memória {dora['picoMemGB']}GB, val loss final {dora['valLossFinal']}, adaptador {dora['tamanhoAdapterMB']}MB")
    print(f"\n  DoRA usa {t['razaoParametros']:.2f}x mais parâmetros treináveis e +{t['custoMemoriaExtraGB']}GB de pico de memória,")
    print("  mas o val loss final empata exatamente, dentro da faixa de ruído entre execuções medida no")
    print("  Módulo 4.2 (~2,3%). Neste treino pequeno (20 iterações) e nesta tarefa já simples pro modelo,")
    print("  o ganho que a literatura relata pra DoRA não aparece - ela descreve ganho em tarefa complexa")
    print("  e treino mais longo, não garantia universal.")


if __name__ == "__main__":
    rodar_testes()
    rodar_demo()

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
