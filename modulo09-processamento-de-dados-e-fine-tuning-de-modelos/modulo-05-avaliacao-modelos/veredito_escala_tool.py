"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 5.4

Fecha o arco do Modulo 5: reabre o MESMO gate de 4 perguntas do Modulo 1.3
(decision_framework_tool.py) e a MESMA reavaliacao de Saude Empresarial do
Modulo 3.2 (reavaliacao_saude_empresarial.py), sem duplicar nenhuma logica --
e soma um checklist de graduacao com os numeros REAIS ja medidos nos Modulos
5.1, 5.2 e 5.3. Nenhum numero novo e inventado aqui: os cinco criterios
abaixo so repetem o que ja foi rodado nos Modulos 5.1, 5.2 e 5.3.

Nota de robustez -- dois dos cinco criterios (bate-generico e
junto-bate-separado) envolvem uma chamada de LLM nao 100% deterministica. Os
valores abaixo nao vem de uma execucao unica: foram remedidos com N=20
chamadas reais repetidas contra os mesmos endpoints do Modulo 5.2, e o
criterio usa o valor mais conservador da faixa observada (o pior caso pro
lado que precisa vencer a comparacao), nao uma media nem um instantaneo de
sorte.

Uso: python3 veredito_escala_tool.py
"""

import importlib.util
import json
import os
import sys
from datetime import datetime
from pathlib import Path

_M1_2_PATH = Path(__file__).parent.parent / "modulo-01-decision-framework" / "decision_framework_tool.py"
_spec = importlib.util.spec_from_file_location("decision_framework_tool", _M1_2_PATH)
dft = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(dft)

_M3_2_PATH = Path(__file__).parent.parent / "modulo-03-fine-tuning-via-api" / "reavaliacao_saude_empresarial.py"
_spec2 = importlib.util.spec_from_file_location("reavaliacao_saude_empresarial", _M3_2_PATH)
reav = importlib.util.module_from_spec(_spec2)
_spec2.loader.exec_module(reav)


# -----------------------------------------------------------------------------
# Checklist de graduacao -- definido ANTES de checar, pra nao virar
# racionalizacao a posteriori. Os cinco criterios vem, sem alteracao, dos
# Modulos 5.1-5.3 -- mas o RESULTADO medido nao e mais copiado a mao pra um
# literal aqui. Cada harness de origem grava seu proprio ledger
# (resultado-medido.json, ao lado dele) quando roda de verdade;
# carregar_criterios_graduacao() le esses ledgers como fonte unica de
# verdade, e so cai pro valor fixado abaixo (evidencia historica, a mesma
# publicada no TP/slide) se o ledger ainda nao existir -- com aviso.
#
# Nesta pasta (achatada), os quatro harnesses de origem e este arquivo moram
# juntos -- entao o ledger e o MESMO resultado-medido.json pros cinco
# criterios, cada harness so grava a propria chave nele.
# -----------------------------------------------------------------------------

_LEDGER = Path(__file__).parent / "resultado-medido.json"

METADATA_CRITERIOS = [
    {
        "id": "baseline",
        "descricao": "Precisão em dado nunca visto, mesmo formato do treino",
        "limiar": ">= 95%",
        "limiarPct": 95,
        "ledger": _LEDGER,
        "fonte": Path(__file__).parent / "model_evaluation_harness_tool.py",
        "fallback": {
            "medido": "100% (11/11 schema válido, precisão média por campo)",
            "medidoPct": 100,
            "origem": "Módulo 5.1",
        },
    },
    {
        "id": "bate-generico",
        "descricao": "Bate o modelo genérico no mesmo teste retido (schema + precisão)",
        "limiar": "schema e precisão maiores que o genérico, mesmo no melhor caso observado do genérico",
        "ledger": _LEDGER,
        "fonte": Path(__file__).parent / "ab_and_domain_tradeoff_tool.py",
        "fallback": {
            "comparacao": {"finetunado": 100, "generico": 72.7},
            "medido": "11/11 vs. 0/11 schema sem hint; 100% vs. 72,7% precisão com hint no melhor caso observado "
            "(N=20 execuções reais: média 61,8%, mínimo 54,5%, máximo 72,7%)",
            "origem": "Módulo 5.2 (reconfirmado com N=20 repetições reais)",
        },
    },
    {
        "id": "junto-bate-separado",
        "descricao": "Treinar os domínios juntos generaliza tão bem ou melhor que separado",
        "limiar": "conjunto >= separado, nos dois domínios",
        "ledger": _LEDGER,
        "fonte": Path(__file__).parent / "ab_and_domain_tradeoff_tool.py",
        "fallback": {
            "comparacao": {"conjuntoAuto": 100, "separadoAuto": 100, "conjuntoSaude": 100, "separadoSaude": 0},
            "medido": "Auto 100% vs. 100% (empate, estável em N=20 chamadas reais repetidas); "
            "Saúde Empresarial 100% vs. 0%",
            "origem": "Módulo 5.2 (Auto reconfirmado com N=20 repetições reais)",
        },
    },
    {
        "id": "robusto-formato",
        "descricao": "Robusto a variação de formato realista, fora do gerador determinístico",
        "limiar": ">= 95%",
        "limiarPct": 95,
        "ledger": _LEDGER,
        "fonte": Path(__file__).parent / "overfitting_stress_test_tool.py",
        "fallback": {
            "medido": "100% (depois do fix do harness, zero queda contra o baseline)",
            "medidoPct": 100,
            "origem": "Módulo 5.3 (round 1)",
        },
    },
    {
        "id": "robusto-estrutura",
        "descricao": "Robusto a variação estrutural, genuinamente fora da distribuição de treino",
        "limiar": ">= 90% (limiar mais baixo que os outros -- variação estrutural é teste mais difícil por desenho)",
        "limiarPct": 90,
        "ledger": _LEDGER,
        "fonte": Path(__file__).parent / "overfitting_stress_test_tool.py",
        "fallback": {
            "medido": "100% (N=58 execuções, zero erros; uma checagem inicial com N=3 sugeriu um erro "
            "de fraseado que não se confirmou em amostra maior)",
            "medidoPct": 100,
            "origem": "Módulo 5.3 (round 2, N=58)",
        },
    },
]


def carregar_criterios_graduacao():
    """Le o ledger de cada criterio (gravado pelo harness de origem quando
    roda de verdade); cai pro valor historico fixado (fallback) se o ledger
    ainda nao existir. Nos dois casos, avisa -- ledger ausente e esperado
    antes da primeira remedicao, harness mais novo que o ledger e sinal de
    possivel desatualizacao."""
    criterios = []
    for meta in METADATA_CRITERIOS:
        dados = None
        if meta["ledger"].exists():
            conteudo = json.loads(meta["ledger"].read_text(encoding="utf-8"))
            dados = conteudo.get(meta["id"])

        if not dados:
            print(f"[AVISO] \"{meta['id']}\": ledger não encontrado ({meta['ledger'].name}), usando evidência histórica fixada. Rode {meta['fonte'].name} pra medir de verdade e gerar o ledger.")
            dados = meta["fallback"]
        elif dados.get("medidoEm") and meta["fonte"].exists():
            mtime_fonte = datetime.fromtimestamp(meta["fonte"].stat().st_mtime)
            data_ledger = datetime.fromisoformat(f"{dados['medidoEm']}T23:59:59")
            if mtime_fonte > data_ledger:
                print(f"[AVISO] \"{meta['id']}\": {meta['fonte'].name} foi modificado depois da última medição registrada ({dados['medidoEm']}) -- considere remedir antes de confiar neste número.")

        criterios.append({
            "id": meta["id"],
            "descricao": meta["descricao"],
            "limiar": meta["limiar"],
            "limiarPct": meta.get("limiarPct"),
            "medido": dados.get("medido"),
            "medidoPct": dados.get("medidoPct"),
            "comparacao": dados.get("comparacao"),
            "origem": dados.get("origem"),
        })
    return criterios


def avaliar_criterio(criterio):
    """Computa passou/falhou a partir dos números medidos abaixo. Critérios com
    limiarPct comparam número contra número; os dois critérios comparativos
    (bate-generico, junto-bate-separado) comparam par a par os valores em
    `comparacao` -- valores que, nesses dois casos, vêm de N=20 remedições
    reais, não de uma execução única (ver nota de robustez no cabeçalho)."""
    if criterio.get("limiarPct") is not None:
        return criterio["medidoPct"] >= criterio["limiarPct"]
    if criterio["id"] == "bate-generico":
        c = criterio["comparacao"]
        return c["finetunado"] > c["generico"]
    if criterio["id"] == "junto-bate-separado":
        c = criterio["comparacao"]
        return c["conjuntoAuto"] >= c["separadoAuto"] and c["conjuntoSaude"] >= c["separadoSaude"]
    raise ValueError(f"critério \"{criterio['id']}\" não tem regra de avaliação definida")


def avaliar_graduacao():
    criterios_computados = [{**c, "passou": avaliar_criterio(c)} for c in carregar_criterios_graduacao()]
    passaram = [c for c in criterios_computados if c["passou"]]
    return {
        "graduado": len(passaram) == len(criterios_computados),
        "criterios": criterios_computados,
        "passou": len(passaram),
        "total": len(criterios_computados),
    }


# -----------------------------------------------------------------------------
# Veredito por caso: AHP + governanca (Modulo 1.3/3.2) combinado com o
# checklist de graduacao (Modulo 5.1-5.3) -- so os dois juntos aprovam
# escalar. Casos fora do escopo medido pelo Modulo 5 (tarefa estruturalmente
# diferente da extracao testada) nao herdam a evidencia.
# -----------------------------------------------------------------------------


def avaliar_veredito_caso(nome, gate, graduacao, coberto_pela_evidencia):
    if not gate["aprovado"]:
        if gate.get("bloqueadoPorGovernanca"):
            motivo = f"bloqueado por governança: {'; '.join(gate['motivosGovernanca'])}"
        else:
            perguntas = ", ".join(str(p) for p in gate["perguntasFalhas"])
            motivo = f"gate reprovado, pergunta(s) {perguntas} vermelha(s)"
        return {"nome": nome, "gateAprovado": False, "escalar": False, "motivo": motivo}

    if not coberto_pela_evidencia:
        return {
            "nome": nome,
            "gateAprovado": True,
            "escalar": None,
            "motivo": "gate aprovado, mas fora do escopo medido: os Módulos 5.1-5.3 testaram extração estruturada, não esta tarefa",
        }

    if graduacao["graduado"]:
        motivo = f"graduado: {graduacao['passou']}/{graduacao['total']} critérios medidos passaram"
    else:
        motivo = f"gate aprovado, mas só {graduacao['passou']}/{graduacao['total']} critérios de graduação passaram"

    return {"nome": nome, "gateAprovado": True, "escalar": graduacao["graduado"], "motivo": motivo}


def avaliar_veredito(config):
    pesos_ahp = dft.derivar_pesos_ahp(config["ahp"]["matriz"])
    limiar_verde = config["limiarVerde"]
    casos = config["casos"]

    auto = next(c for c in casos if c["id"] == "amplitude-auto")
    saude_original = next(c for c in casos if c["id"] == "amplitude-saude-empresarial")
    saude_atualizada = reav.construir_caso_nove_meses_depois(saude_original)
    atendimento = next(c for c in casos if c["id"] == "amplitude-atendimento-cliente")

    gate_auto = dft.avaliar_caso_completo(auto, pesos_ahp, limiar_verde)
    gate_saude = dft.avaliar_caso_completo(saude_atualizada, pesos_ahp, limiar_verde)
    gate_atendimento = dft.avaliar_caso_completo(atendimento, pesos_ahp, limiar_verde)

    graduacao = avaliar_graduacao()

    return {
        "graduacao": graduacao,
        "casos": {
            "auto": {"gate": gate_auto, "veredito": avaliar_veredito_caso("Amplitude Auto", gate_auto, graduacao, True)},
            "saude": {"gate": gate_saude, "veredito": avaliar_veredito_caso("Amplitude Saúde Empresarial", gate_saude, graduacao, True)},
            "atendimento": {"gate": gate_atendimento, "veredito": avaliar_veredito_caso("Amplitude Atendimento ao Cliente", gate_atendimento, graduacao, False)},
        },
    }


# -----------------------------------------------------------------------------
# Testes automatizados
# -----------------------------------------------------------------------------

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
    print("== Testes: veredito de escala, Módulo 5.4 ==")
    resultado = avaliar_veredito(config)

    def t1():
        assert resultado["graduacao"]["passou"] == 5
        assert resultado["graduacao"]["total"] == 5
        assert resultado["graduacao"]["graduado"] is True
    testar("checklist de graduação: 5 de 5 critérios medidos passam", t1)

    def t2():
        assert resultado["casos"]["auto"]["veredito"]["gateAprovado"] is True
        assert resultado["casos"]["auto"]["veredito"]["escalar"] is True
    testar("Amplitude Auto: gate aprovado e graduado, escalar = true", t2)

    def t3():
        assert resultado["casos"]["saude"]["veredito"]["gateAprovado"] is True
        assert resultado["casos"]["saude"]["veredito"]["escalar"] is True
    testar("Amplitude Saúde Empresarial (caso atualizado): gate aprovado e graduado, escalar = true", t3)

    def t4():
        assert resultado["casos"]["atendimento"]["veredito"]["gateAprovado"] is False
        assert resultado["casos"]["atendimento"]["veredito"]["escalar"] is False
        assert resultado["casos"]["atendimento"]["gate"]["perguntasFalhas"] == [1, 4]
    testar("Amplitude Atendimento ao Cliente: gate ainda reprovado (p1 e p4 vermelhas)", t4)

    print()
    print(f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), "
          f"{_testes_com_falha} falhou(falharam).")

    if _testes_com_falha > 0:
        raise SystemExit(f"{_testes_com_falha} teste(s) falharam. A implementação não bate com a especificação.")

    return resultado


# -----------------------------------------------------------------------------
# Demo
# -----------------------------------------------------------------------------


def imprimir_veredito(resultado):
    print()
    print("===== Veredito de Escala: Módulo 5.4 =====\n")

    print("--- Checklist de graduação (Módulos 5.1-5.3) ---")
    for i, c in enumerate(resultado["graduacao"]["criterios"]):
        status = "PASSOU" if c["passou"] else "FALHOU"
        print(f"  {i + 1}. [{status}] {c['descricao']} ({c['origem']})")
        print(f"     limiar: {c['limiar']} · medido: {c['medido']}")
    g = resultado["graduacao"]
    print(f"\n  Graduação: {g['passou']}/{g['total']}, {'GRADUADO' if g['graduado'] else 'NÃO GRADUADO'}\n")

    for chave in ("auto", "saude", "atendimento"):
        item = resultado["casos"][chave]
        gate = item["gate"]
        veredito = item["veredito"]
        print(f"--- {veredito['nome']} ---")
        if gate.get("bloqueadoPorGovernanca"):
            print("  Bloqueado por governança.")
        else:
            for i, chave_pergunta in enumerate(dft.CHAVES_PERGUNTAS):
                s = gate["sinaisPorPergunta"][chave_pergunta]
                score_fmt = f"{s['score']:.2f}".replace(".", ",")
                print(f"  Pergunta {i + 1} [{s['sinal']}, score {score_fmt}]")
        escalar = veredito["escalar"]
        escalar_texto = "FORA DE ESCOPO" if escalar is None else ("SIM" if escalar else "NÃO")
        print(f"  Escalar: {escalar_texto}")
        print(f"  Motivo: {veredito['motivo']}\n")

    print("-----------------------------------------------------------------------------")
    print("Amplitude Auto e Saúde Empresarial: gate aprovado desde o Módulo 1.3/3.2, e agora")
    print("também graduados pela evidência medida do Módulo 5. Escalar pro Módulo 6 significa")
    print("transformar ESTE piloto já aprovado, com esta evidência medida, num fluxo de uso")
    print("prático de verdade, não supor que o resultado se transfere de graça. Atendimento ao Cliente continua bloqueado pelo")
    print("mesmo motivo estrutural do Módulo 1.3: a evidência do Módulo 5 nunca testou essa")
    print("tarefa, e não pode ser usada pra reverter esse veredito.")
    print("-----------------------------------------------------------------------------")


if __name__ == "__main__":
    try:
        _config = dft.carregar_configuracao()
        _resultado = rodar_testes(_config)
        imprimir_veredito(_resultado)
    except Exception as erro:
        print(f"\nErro: {erro}")
        print("Verifique se amplitude-seguros-casos.json e resultado-medido.json existem e estão bem formados, e tente de novo.")
        if os.environ.get("DEBUG"):
            raise
        sys.exit(1)

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
