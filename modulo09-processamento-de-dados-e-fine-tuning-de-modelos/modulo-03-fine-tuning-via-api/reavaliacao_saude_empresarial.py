"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 3.2

Callback real pros Modulos 1.2 e 1.3: no Modulo 1.2, o framework de 4
perguntas concluiu, na mao, que Amplitude Saude Empresarial reprovava so
por dado (p3 vermelha). No Modulo 1.3, rodando o codigo de verdade,
p3 = 0,35 (abaixo do limiarVerde = 0,6), e a Real Options recomendava
esperar 9 meses acumulando volume antes de treinar.

Este script nao inventa uma decisao nova. Ele reabre o MESMO modulo do
Modulo 1.3 (decision_framework_tool.py, sem duplicar nenhuma logica), com
o caso Saude Empresarial atualizado pros 9 meses que se passaram -- usando
exatamente a taxa de crescimento de score que o Modulo 1.3 ja tinha
usado (taxaCrescimentoScorePorMes = 0,03/mes, do bloco opcaoReal do
proprio caso). Se o job real do Modulo 3.2 inclui Saude Empresarial no
treino, e porque esse recalculo, rodado com o mesmo criterio, agora aprova
o caso -- nao porque o criterio mudou.

Uso: python3 reavaliacao_saude_empresarial.py
"""

import importlib.util
from pathlib import Path

_M1_2_PATH = Path(__file__).parent.parent / "modulo-01-decision-framework" / "decision_framework_tool.py"
_spec = importlib.util.spec_from_file_location("decision_framework_tool", _M1_2_PATH)
dft = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(dft)

MESES_DECORRIDOS = 9


def construir_caso_nove_meses_depois(caso_original):
    """Deriva o caso "9 meses depois" a partir do caso original do Modulo
    1.2, sem hardcodar nenhum numero novo: p3 evolui pela taxa de
    crescimento de score ja projetada em opcaoReal, e o volume evolui pela
    mesma taxa de crescimento mensal (moda) ja usada no calculo financeiro
    original."""
    taxa_crescimento_score = caso_original["financeiro"]["opcaoReal"]["taxaCrescimentoScorePorMes"]
    p3_atualizado = round(caso_original["scores"]["p3"] + taxa_crescimento_score * MESES_DECORRIDOS, 2)
    fator_crescimento_volume = (1 + caso_original["financeiro"]["crescimentoMensal"]["moda"]) ** MESES_DECORRIDOS
    volume_atualizado = round(caso_original["financeiro"]["volumeInicialMensal"] * fator_crescimento_volume)

    caso_atualizado = dict(caso_original)
    caso_atualizado["scores"] = dict(caso_original["scores"], p3=p3_atualizado)
    caso_atualizado["financeiro"] = dict(caso_original["financeiro"], volumeInicialMensal=volume_atualizado)
    return caso_atualizado


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


def rodar_testes(config):
    pesos_ahp = dft.derivar_pesos_ahp(config["ahp"]["matriz"])
    limiar_verde = config["limiarVerde"]
    casos = config["casos"]
    caso_original = next(c for c in casos if c["id"] == "amplitude-saude-empresarial")
    caso_atualizado = construir_caso_nove_meses_depois(caso_original)

    print("== Testes: reavaliação de Amplitude Saúde Empresarial, 9 meses depois ==")

    resultado_original = dft.avaliar_framework(caso_original["scores"], pesos_ahp, limiar_verde)
    resultado_atualizado = dft.avaliar_framework(caso_atualizado["scores"], pesos_ahp, limiar_verde)

    def t1():
        assert resultado_original["aprovado"] is False
        assert resultado_original["falhaSoDado"] is True

    testar("caso original (Módulo 1.3): reprova só por dado", t1)

    def t2():
        assert caso_atualizado["scores"]["p3"] >= limiar_verde

    testar("caso atualizado (9 meses depois): p3 cruza o limiarVerde", t2)

    def t3():
        assert resultado_atualizado["aprovado"] is True
        assert resultado_atualizado["perguntasFalhas"] == []

    testar("caso atualizado: aprovado no gate, nenhuma pergunta falha", t3)

    def t4():
        assert caso_atualizado["scores"]["p1"] == caso_original["scores"]["p1"]
        assert caso_atualizado["scores"]["p2"] == caso_original["scores"]["p2"]
        assert caso_atualizado["scores"]["p4"] == caso_original["scores"]["p4"]

    testar("só p3 mudou -- p1, p2 e p4 continuam com o mesmo score do Módulo 1.3", t4)

    def t5():
        assert caso_atualizado["financeiro"]["volumeInicialMensal"] > caso_original["financeiro"]["volumeInicialMensal"]

    testar("o volume atualizado é maior que o original, coerente com 9 meses de crescimento real", t5)

    print()
    print(
        f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), "
        f"{_testes_com_falha} falhou(falharam)."
    )

    if _testes_com_falha > 0:
        raise AssertionError(f"{_testes_com_falha} teste(s) falharam. A implementação não bate com a especificação.")

    return {
        "limiarVerde": limiar_verde,
        "casoOriginal": caso_original, "casoAtualizado": caso_atualizado,
        "resultadoOriginal": resultado_original, "resultadoAtualizado": resultado_atualizado,
    }


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------


def imprimir_comparacao(r):
    print()
    print("===== Reavaliação: Amplitude Saúde Empresarial, 9 meses depois do Módulo 1.3 =====\n")

    print(f"  Limiar verde: {r['limiarVerde']}\n")
    print("  --- Módulo 1.3 (o que vimos) ---")
    for i, chave in enumerate(dft.CHAVES_PERGUNTAS):
        s = r["resultadoOriginal"]["sinaisPorPergunta"][chave]
        print(f"  Pergunta {i + 1} [{s['sinal']}, score {s['score']:.2f}]: {dft.PERGUNTAS[chave]}")
    print(f"  Volume mensal: {r['casoOriginal']['financeiro']['volumeInicialMensal']}")
    print(f"  Recomendação: {r['resultadoOriginal']['recomendacao']}\n")

    print(f"  --- Módulo 3.2 ({MESES_DECORRIDOS} meses depois) ---")
    for i, chave in enumerate(dft.CHAVES_PERGUNTAS):
        s = r["resultadoAtualizado"]["sinaisPorPergunta"][chave]
        print(f"  Pergunta {i + 1} [{s['sinal']}, score {s['score']:.2f}]: {dft.PERGUNTAS[chave]}")
    print(f"  Volume mensal: {r['casoAtualizado']['financeiro']['volumeInicialMensal']}")
    print(f"  Recomendação: {r['resultadoAtualizado']['recomendacao']}")

    print("\n-----------------------------------------------------------------------------")
    print("Mesmo tool, mesmo caso, mesmo limiar. O que mudou foi o dado: 9 meses de volume")
    print("real acumulado. A pergunta 3 cruzou o limiarVerde, e nenhuma outra pergunta")
    print("regrediu. O gate aprova agora pelo mesmo critério que reprovava antes -- essa é")
    print("a diferença entre \"esperar\" (Módulo 1.3) e \"decidir de novo com dado novo\" (aqui).")
    print("-----------------------------------------------------------------------------")


if __name__ == "__main__":
    config = dft.carregar_configuracao()
    resultado = rodar_testes(config)
    imprimir_comparacao(resultado)

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
