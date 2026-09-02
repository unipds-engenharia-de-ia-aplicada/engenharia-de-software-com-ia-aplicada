"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 2.1 (referencia espelhada em Python)

Ferramenta: Identificando Dado Relevante -- antes de coletar e extrair
qualquer documento, aplica um gate de 4 perguntas pra decidir se aquele
candidato a fonte de dado vale a pena entrar no pipeline de extracao.

Fundamento de mercado (nao e metodo inventado): o principio de Data-Centric
AI de Andrew Ng -- definir criterio sistematico de qualidade, relevancia e
representatividade dos dados, em vez de coletar tudo que existir -- e o
paper LIMA (Zhou et al. 2023, Meta/CMU/USC/Tel Aviv, arXiv 2305.11206):
1.000 exemplos cuidadosamente curados superaram uma reproducao do Alpaca
com 52.000 exemplos, e bateram o DaVinci003 da OpenAI treinado com RLHF em
preferencia humana. A licao pratica: curadoria de fonte bate volume bruto.

Uso: python3 data_relevance_scoring_tool.py
Aplica o gate contra 7 candidatos reais de documento pra Amplitude
Seguros (4 pro caso Auto, 3 pro caso Saude Empresarial), incluindo
candidatos plausiveis que sao REJEITADOS, nao so os que ja escolhemos.
"""

CRITERIOS = {
    "contemGroundTruth": "Contém o ground truth da tarefa (entrada real + resposta correta observável)?",
    "producaoReal": "Vem do fluxo real de produção, não é exemplo sintético ou hipotético?",
    "cobreVariacao": "Cobre a variação real de formato e situação que a tarefa tem, não só o caso fácil?",
    "passaCompliance": "Passa no crivo de sensibilidade e compliance pra ser usado em treino?",
}

CHAVES_CRITERIOS = list(CRITERIOS.keys())


def avaliar_candidato(candidato):
    """Gate estrito: os 4 critérios precisam ser verdadeiros pro candidato ser aceito."""
    falhas = [chave for chave in CHAVES_CRITERIOS if not candidato["criterios"][chave]]
    return {"aceito": len(falhas) == 0, "criteriosFalhos": falhas}


CANDIDATOS = [
    {
        "id": "orcamento-oficina",
        "caso": "amplitude-auto",
        "nome": "Orçamento de oficina",
        "criterios": {"contemGroundTruth": True, "producaoReal": True, "cobreVariacao": True, "passaCompliance": True},
        "justificativa": "Contém segurado, placa e valor em texto real, vem de sinistros já processados, varia de formato entre oficinas, sem dado sensível.",
    },
    {
        "id": "boletim-ocorrencia",
        "caso": "amplitude-auto",
        "nome": "Boletim de ocorrência policial",
        "criterios": {"contemGroundTruth": False, "producaoReal": True, "cobreVariacao": True, "passaCompliance": True},
        "justificativa": "É narrativa de ocorrência, não traz segurado/placa/valor em formato consistente o bastante pra servir de resposta correta da tarefa.",
    },
    {
        "id": "foto-veiculo-danificado",
        "caso": "amplitude-auto",
        "nome": "Foto do veículo danificado",
        "criterios": {"contemGroundTruth": False, "producaoReal": True, "cobreVariacao": False, "passaCompliance": True},
        "justificativa": "É imagem do dano, não do documento com os campos-alvo; não serve de par texto-entrada/texto-saída pra esta tarefa de extração.",
    },
    {
        "id": "transcricao-ligacao",
        "caso": "amplitude-auto",
        "nome": "Transcrição da ligação de abertura de sinistro",
        "criterios": {"contemGroundTruth": True, "producaoReal": True, "cobreVariacao": False, "passaCompliance": True},
        "justificativa": "Tem os dados, mas a estrutura da ligação varia demais de atendente pra atendente pra servir de exemplo confiável de formato.",
    },
    {
        "id": "recibo-medico",
        "caso": "amplitude-saude-empresarial",
        "nome": "Recibo médico",
        "criterios": {"contemGroundTruth": True, "producaoReal": True, "cobreVariacao": True, "passaCompliance": True},
        "justificativa": "Contém beneficiário, procedimento e valor, vem de reembolsos já processados, varia entre clínicas, e o dado sensível é tratável com o rastro de auditoria já desenhado no schema.",
    },
    {
        "id": "prontuario-medico-completo",
        "caso": "amplitude-saude-empresarial",
        "nome": "Prontuário médico completo",
        "criterios": {"contemGroundTruth": True, "producaoReal": True, "cobreVariacao": True, "passaCompliance": False},
        "justificativa": "Traz dado clínico muito além do necessário pra extrair beneficiário/procedimento/valor; viola minimização de dado exigida pela LGPD pra essa tarefa específica.",
    },
    {
        "id": "cadastro-beneficiarios",
        "caso": "amplitude-saude-empresarial",
        "nome": "Cadastro de beneficiários",
        "criterios": {"contemGroundTruth": False, "producaoReal": True, "cobreVariacao": True, "passaCompliance": True},
        "justificativa": "É tabela de referência (titular/dependente), não um par entrada-saída de extração; útil pra cruzamento, não pra treinar o extrator em si.",
    },
]


_total_testes = 0
_testes_com_falha = 0


def _testar(descricao, fn):
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
    print("== Testes: gate de 4 critérios ==")

    def teste_1():
        r = avaliar_candidato({"criterios": {"contemGroundTruth": True, "producaoReal": True, "cobreVariacao": True, "passaCompliance": True}})
        assert r["aceito"] is True
        assert r["criteriosFalhos"] == []

    _testar("candidato com os 4 critérios verdadeiros é aceito", teste_1)

    def teste_2():
        r = avaliar_candidato({"criterios": {"contemGroundTruth": False, "producaoReal": True, "cobreVariacao": True, "passaCompliance": True}})
        assert r["aceito"] is False
        assert r["criteriosFalhos"] == ["contemGroundTruth"]

    _testar("candidato sem ground truth é rejeitado", teste_2)

    def teste_3():
        r = avaliar_candidato({"criterios": {"contemGroundTruth": True, "producaoReal": True, "cobreVariacao": True, "passaCompliance": False}})
        assert r["aceito"] is False
        assert r["criteriosFalhos"] == ["passaCompliance"]

    _testar("candidato que falha compliance é rejeitado mesmo com os outros 3 verdadeiros", teste_3)

    print()
    print("== Testes: aplicação aos 7 candidatos reais da Amplitude Seguros ==")

    resultados = [{"candidato": c, "resultado": avaliar_candidato(c)} for c in CANDIDATOS]

    esperado_aceito = {
        "orcamento-oficina": True,
        "boletim-ocorrencia": False,
        "foto-veiculo-danificado": False,
        "transcricao-ligacao": False,
        "recibo-medico": True,
        "prontuario-medico-completo": False,
        "cadastro-beneficiarios": False,
    }

    for item in resultados:
        candidato_id = item["candidato"]["id"]
        esperado = esperado_aceito[candidato_id]

        def teste_candidato(item=item, esperado=esperado):
            assert item["resultado"]["aceito"] == esperado

        _testar(f"{candidato_id}: aceito={esperado}", teste_candidato)

    def teste_final():
        aceitos = [r for r in resultados if r["resultado"]["aceito"]]
        assert len(aceitos) == 2
        assert sorted(r["candidato"]["id"] for r in aceitos) == ["orcamento-oficina", "recibo-medico"]

    _testar("exatamente 2 dos 7 candidatos são aceitos (os que já usamos no pipeline)", teste_final)

    print()
    print(f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), {_testes_com_falha} falhou(falharam).")

    if _testes_com_falha > 0:
        raise RuntimeError(f"{_testes_com_falha} teste(s) falharam. A implementação não bate com a especificação.")

    return resultados


def rodar_demo(resultados):
    print()
    print("===== Demo: gate de relevância aplicado a 7 candidatos reais de documento =====")

    for caso in ["amplitude-auto", "amplitude-saude-empresarial"]:
        print(f"\n--- {caso} ---")
        for item in resultados:
            if item["candidato"]["caso"] != caso:
                continue
            candidato = item["candidato"]
            resultado = item["resultado"]
            status = "ACEITO" if resultado["aceito"] else "REJEITADO"
            print(f"\n  [{status}] {candidato['nome']}")
            for chave in CHAVES_CRITERIOS:
                passou = candidato["criterios"][chave]
                marca = "v" if passou else "x"
                print(f"    {marca} {CRITERIOS[chave]}")
            print(f"    -> {candidato['justificativa']}")

    print("\n-----------------------------------------------------------------------------")
    print("De 7 candidatos plausíveis, só 2 passam: orçamento de oficina e recibo médico --")
    print("exatamente os que o pipeline de extração deste vídeo usa. Identificar dado")
    print("relevante é filtrar antes de coletar, não aceitar tudo que existir no arquivo.")
    print("-----------------------------------------------------------------------------")


if __name__ == "__main__":
    resultados = rodar_testes()
    rodar_demo(resultados)

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
