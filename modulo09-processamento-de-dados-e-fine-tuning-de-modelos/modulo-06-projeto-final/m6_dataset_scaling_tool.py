"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 6.3 (consumido pela Missao Pratica #06 e pela
demo de escala do Modulo 6.3)

Gerador do dataset de producao real, escalado a partir do piloto de 200
exemplos do Modulo 3.2, seguindo a decisao do Modulo 5.4 (veredito: escalar
Amplitude Auto e Saude Empresarial). Reusa o MESMO pipeline formal do
Modulo 2.2 (MinHash+LSH, amostragem por temperatura, entropia de Shannon)
via import direto -- zero logica de limpeza/balanceamento duplicada, so o
gerador bruto muda.

Duas diferencas reais frente ao gerador do Modulo 3.2 (nao e so "mais
exemplos do mesmo jeito"):
  1) Mais fontes (10 oficinas, 8 clinicas, contra 6 e 5 antes) e pools de
     entidade maiores, todos coprimos entre si.
  2) Variedade de redacao por fonte: cada oficina/clinica tem uma "persona"
     de escrita (bloco formal caixa-alta, texto corrido semi-formal, ou
     exportacao abreviada por campo), um campo distrator real (apolice,
     corretor, franquia; convenio, CRM, guia) que NAO faz parte do schema
     extraido, e um subconjunto com ruido real de OCR.

Uso: python3 m6_dataset_scaling_tool.py
"""

import importlib.util
from datetime import date, timedelta
from pathlib import Path

_M2_2_PATH = Path(__file__).parent.parent / "modulo-02-preparacao-datasets" / "dataset_cleaning_balancing_tool.py"
_spec = importlib.util.spec_from_file_location("dataset_cleaning_balancing_tool", _M2_2_PATH)
m22 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m22)

PRENOMES = [
    "Marcos", "Fernanda", "Joaquim", "Beatriz", "Rafael", "Camila", "Eduardo", "Larissa",
    "Thiago", "Patricia", "Bruno", "Juliana", "Gustavo", "Renata", "Diego", "Mariana",
    "Vinicius", "Sabrina", "Leonardo", "Priscila", "Rodrigo", "Amanda", "Felipe", "Carolina",
    "Anderson", "Vanessa", "Fabio", "Debora", "Marcelo", "Tatiane", "Alexandre", "Cristiane",
    "Fernando", "Simone", "Rogerio", "Michele", "Wagner", "Andreia", "Cesar", "Roberta",
    "Paulo", "Natalia", "Henrique", "Aline", "Ricardo", "Viviane", "Daniel", "Luciana",
    "Otavio", "Gabriela", "Ederson", "Silvia", "Igor",
]  # 53 (primo)

SOBRENOMES = [
    "Andrade Pereira", "Costa Ribeiro", "Salgado", "Nogueira Lima", "Augusto Teixeira",
    "dos Santos Farias", "Henrique Barros", "Martins Cardoso", "Moreira Duarte",
    "Alves Monteiro", "Cesar Figueiredo", "Rocha Pimentel", "Henrique Vasconcelos",
    "Souza Albuquerque", "Fernandes Castro", "Lopes Guimaraes", "Almeida Correia",
    "Ferreira Nunes", "Batista Cavalcanti", "Andrade Melo", "Tavares Siqueira",
    "Cristina Peixoto", "Augusto Barbosa", "Machado Freitas", "Luiz Ramalho",
    "Regina Coutinho", "Junior Aragao", "Cristina Vieira", "Souza Bittencourt",
    "Pereira Godoy", "Costa Miranda", "Lopes Assuncao", "Braga Quintanilha",
    "Rocha Vilaca", "dos Santos Pena", "Aparecida Fonseca", "Luiz Bessa",
    "Cristina Prado", "Augusto Nascimento", "Lima Sarmento", "Ricardo Andrade",
    "Bezerra Xavier", "Werneck Sales",
]  # 43 (primo)

LETRAS_PLACA = [
    "QJK", "RTL", "MNB", "PLW", "ZXC", "BVN", "TYU", "GHJ", "FDS", "LKM", "OIU", "CVB",
    "ASD", "WER", "XSW", "POI", "HGF", "MJU", "NBV", "KLO", "ERT", "YUI", "CDE", "VBN",
    "AZS", "QWE", "DFG", "RTY", "FGH", "TGB", "YHN",
]  # 31 (primo)


def placa_do_indice(indice):
    letras = LETRAS_PLACA[indice % len(LETRAS_PLACA)]
    digitos = 1000 + ((indice * 7 + 3) % 9000)
    return f"{letras}-{digitos}"


def valor_do_indice(indice):
    centavos = ((indice * 37 + 11) % 700000) + 39000  # R$ 390,00 a R$ 7.389,99
    reais, cent = divmod(centavos, 100)
    return f"{reais:,}".replace(",", ".") + f",{cent:02d}"


def valor_para_numero(valor_texto):
    return float(valor_texto.replace(".", "").replace(",", "."))


_INICIO = date(2026, 1, 5)
_FIM = date(2026, 8, 13)
_TOTAL_DIAS = (_FIM - _INICIO).days


def data_do_indice(indice):
    offset = (indice * 17 + 5) % _TOTAL_DIAS
    d = _INICIO + timedelta(days=offset)
    return d.strftime("%d/%m/%Y")


SERVICOS_AUTO = [
    "reparo de lataria e pintura no para-choque dianteiro", "troca de para-lama dianteiro esquerdo",
    "substituicao de parabrisa trincado", "realinhamento e balanceamento pos-colisao lateral",
    "troca de retrovisor direito danificado", "reparo de amassado na porta traseira",
    "pintura completa do capo", "troca de farol dianteiro quebrado",
    "reparo de teto solar com vazamento", "substituicao de para-choque traseiro",
    "troca de vidro lateral trincado", "reparo de estrutura apos colisao traseira",
    "polimento e restauracao de pintura", "troca de macaneta danificada",
    "reparo de amassado no teto", "troca de lanterna traseira quebrada",
    "revisao de suspensao apos buraco na via", "reparo de para-lama traseiro amassado",
    "troca de pneu furado sem conserto", "realinhamento de direcao",
    "reparo de arranhao profundo na lateral", "troca de espelho retrovisor esquerdo",
    "substituicao de radiador danificado em colisao frontal", "reparo de porta-malas emperrado",
]  # 24

PROCEDIMENTOS = [
    "consulta cardiologica", "exame de sangue completo", "fisioterapia ortopedica",
    "consulta ortopedica", "exame de imagem (ressonancia)", "consulta psiquiatrica",
    "sessao de fonoaudiologia", "exame oftalmologico", "consulta dermatologica",
    "exame de densitometria ossea", "consulta nutricional", "sessao de acupuntura",
    "consulta ginecologica", "exame de urina completo", "sessao de terapia ocupacional",
    "consulta endocrinologica", "exame de eletrocardiograma", "consulta neurologica",
    "sessao de pilates terapeutico", "exame de audiometria", "consulta pediatrica",
    "exame de mamografia", "sessao de psicoterapia", "consulta geriatrica",
    "consulta de clinica geral", "exame de colonoscopia", "sessao de fonoterapia",
    "consulta urologica", "exame de tomografia", "consulta oncologica de acompanhamento",
    "exame de endoscopia digestiva", "sessao de terapia de casal",
]  # 31


def _bloco_formal_auto(cabecalho, nome, placa, data, valor, servico, distrator):
    return (
        f"{cabecalho} Segurado: {nome} Placa do veiculo: {placa} Data do sinistro: {data} "
        f"Descricao do servico: {servico} {distrator} Valor total do reparo: R$ {valor}"
    )


def _texto_corrido_auto(cabecalho, nome, placa, data, valor, servico, distrator):
    return (
        f"{cabecalho} Prezados, segue o orcamento referente ao veiculo placa {placa}, em nome do segurado {nome}. "
        f"O atendimento ocorreu em {data} e o servico realizado foi: {servico}. {distrator} "
        f"O valor total ficou em R$ {valor}."
    )


def _exportacao_abreviada_auto(cabecalho, nome, placa, data, valor, servico, distrator):
    return f"{cabecalho} | Segurado: {nome} | Placa: {placa} | Data: {data} | Servico: {servico} | {distrator} | Valor: R$ {valor}"


def _bloco_formal_saude(cabecalho, nome, procedimento, data, valor, distrator):
    return (
        f"{cabecalho} Paciente/Beneficiario: {nome} Procedimento: {procedimento} Data do atendimento: {data} "
        f"{distrator} Valor cobrado: R$ {valor}"
    )


def _texto_corrido_saude(cabecalho, nome, procedimento, data, valor, distrator):
    return (
        f"{cabecalho} Informamos que o beneficiario {nome} foi atendido em {data} para realizacao de {procedimento}. "
        f"{distrator} O valor cobrado pelo procedimento foi de R$ {valor}."
    )


def _exportacao_abreviada_saude(cabecalho, nome, procedimento, data, valor, distrator):
    return f"{cabecalho} | Beneficiario: {nome} | Procedimento: {procedimento} | Data: {data} | {distrator} | Valor: R$ {valor}"


PERSONAS_AUTO = [_bloco_formal_auto, _texto_corrido_auto, _exportacao_abreviada_auto]
PERSONAS_SAUDE = [_bloco_formal_saude, _texto_corrido_saude, _exportacao_abreviada_saude]

FONTES_AUTO = [
    ("Oficina Estrela", "ATIVA ORCAMENTOS AUTOMOTIVOS OFICINA ESTRELA LTDA CNPJ 12.345.678/0001-90 Rua das Turbinas 450 Distrito Industrial", 0, 620),
    ("Auto Center Silva", "AUTO CENTER SILVA - FUNILARIA E PINTURA - CNPJ 98.765.432/0001-11 Av. dos Mecanicos 220", 1, 470),
    ("Funilaria Rio Bonito", "FUNILARIA RIO BONITO ME CNPJ 45.111.222/0001-33 Rua Rio Bonito 88", 2, 360),
    ("Oficina Nova Aliança", "OFICINA NOVA ALIANCA LTDA CNPJ 22.333.444/0001-55 Estrada Velha 1200", 0, 280),
    ("Mecânica Horizonte", "MECANICA HORIZONTE LTDA CNPJ 51.222.888/0001-19 Av. do Horizonte 640", 1, 210),
    ("Auto Reparos União", "AUTO REPAROS UNIAO ME CNPJ 63.444.777/0001-28 Rua da Uniao 305", 2, 160),
    ("Funilaria Cardoso & Filhos", "FUNILARIA CARDOSO E FILHOS LTDA CNPJ 71.222.900/0001-05 Av. Industrial 812", 0, 115),
    ("Oficina Vale do Sol", "OFICINA VALE DO SOL ME CNPJ 84.556.321/0001-77 Rua do Vale 210", 1, 80),
    ("CarroCerto Funilaria", "CARROCERTO FUNILARIA E PINTURA LTDA CNPJ 19.887.001/0001-42 Av. Brasil 1450", 2, 55),
    ("Reparadora Metropolitana", "REPARADORA METROPOLITANA ME CNPJ 27.334.660/0001-19 Rua Metropolitana 99", 0, 30),
]

FONTES_SAUDE = [
    ("Clínica Vitalis", "CLINICA VITALIS SAUDE OCUPACIONAL CNPJ 33.222.111/0001-44 Av. Paulista 900", 0, 520),
    ("Hospital Santa Clara", "HOSPITAL SANTA CLARA CNPJ 66.555.444/0001-22 Rua das Acacias 310", 1, 380),
    ("Centro Médico Bem Estar", "CENTRO MEDICO BEM ESTAR CNPJ 77.888.999/0001-66 Rua da Saude 45", 2, 290),
    ("Clínica São Rafael", "CLINICA SAO RAFAEL CNPJ 84.111.222/0001-37 Rua Sao Rafael 512", 0, 200),
    ("Instituto Saúde Plena", "INSTITUTO SAUDE PLENA LTDA CNPJ 91.333.555/0001-08 Av. da Saude Plena 78", 1, 140),
    ("Clínica Vida Nova", "CLINICA VIDA NOVA LTDA CNPJ 38.221.775/0001-63 Rua Vida Nova 340", 2, 95),
    ("Policlínica Bem-Te-Vi", "POLICLINICA BEM-TE-VI ME CNPJ 55.902.114/0001-88 Av. das Palmeiras 260", 0, 60),
    ("Centro Clínico Horizonte Azul", "CENTRO CLINICO HORIZONTE AZUL LTDA CNPJ 62.447.209/0001-31 Rua Horizonte Azul 15", 1, 35),
]


def distrator_auto(indice):
    apolice = 400000 + ((indice * 53 + 7) % 590000)
    sinistro = 800000 + ((indice * 61 + 3) % 190000)
    franquia = 90000 + ((indice * 29 + 11) % 260000)
    franquia_fmt = f"{franquia // 100:,}".replace(",", ".") + f",{franquia % 100:02d}"
    opcoes = [
        f"Apolice no {apolice}, franquia aplicada de R$ {franquia_fmt}.",
        f"Numero do sinistro: SIN-{sinistro}.",
        "Corretor responsavel: corretagem interna Amplitude Seguros.",
    ]
    return opcoes[indice % len(opcoes)]


def distrator_saude(indice):
    guia = 700000 + ((indice * 43 + 5) % 290000)
    crm = 40000 + ((indice * 31 + 13) % 90000)
    opcoes = [
        "Convenio: Amplitude Saude Empresarial.",
        f"Guia no {guia}, CRM do medico responsavel: {crm}/SP.",
        "Empresa vinculada: contrato corporativo Amplitude Saude Empresarial.",
    ]
    return opcoes[indice % len(opcoes)]


def aplicar_ruido_ocr(texto, indice):
    if indice % 11 != 0:  # ~9% dos exemplos, taxa realista de scan degradado
        return texto
    return (
        texto.replace("Placa", "P1aca")
        .replace("veiculo", "ve1cu1o")
        .replace("Valor", "Va1or")
        .replace("cobrado", "cobrad0")
    )


def nome_do_indice(indice):
    return f"{PRENOMES[indice % len(PRENOMES)]} {SOBRENOMES[(indice * 7 + 3) % len(SOBRENOMES)]}"


def gerar_exemplo_auto(fonte, cabecalho, persona_idx, indice_global, indice_fonte):
    nome = nome_do_indice(indice_global)
    placa = placa_do_indice(indice_global)
    data = data_do_indice(indice_global)
    valor = valor_do_indice(indice_global)
    servico = SERVICOS_AUTO[(indice_global * 5 + 2) % len(SERVICOS_AUTO)]
    distrator = distrator_auto(indice_global)
    persona = PERSONAS_AUTO[persona_idx]

    entrada = persona(cabecalho, nome, placa, data, valor, servico, distrator)
    entrada = aplicar_ruido_ocr(entrada, indice_fonte)

    return {
        "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.",
        "entrada": entrada,
        "saida": {"segurado": nome, "placa": placa, "valor": valor_para_numero(valor)},
        "metadata": {"caso": "amplitude-auto", "fonte": fonte, "id": f"amplitude-auto-{fonte}-{indice_fonte}"},
    }


def gerar_exemplo_saude(fonte, cabecalho, persona_idx, indice_global, indice_fonte):
    nome = nome_do_indice(indice_global)
    procedimento = PROCEDIMENTOS[(indice_global * 5 + 1) % len(PROCEDIMENTOS)]
    data = data_do_indice(indice_global)
    valor = valor_do_indice(indice_global)
    distrator = distrator_saude(indice_global)
    persona = PERSONAS_SAUDE[persona_idx]

    entrada = persona(cabecalho, nome, procedimento, data, valor, distrator)
    entrada = aplicar_ruido_ocr(entrada, indice_fonte)

    return {
        "instrucao": "Extraia beneficiário, procedimento e valor do recibo médico abaixo.",
        "entrada": entrada,
        "saida": {"beneficiario": nome, "procedimento": procedimento, "valor": valor_para_numero(valor)},
        "metadata": {"caso": "amplitude-saude-empresarial", "fonte": fonte, "id": f"amplitude-saude-empresarial-{fonte}-{indice_fonte}"},
    }


def gerar_dataset_bruto():
    exemplos = []
    contador_global = 0

    for fonte, cabecalho, persona_idx, n in FONTES_AUTO:
        for i in range(n):
            exemplos.append(gerar_exemplo_auto(fonte, cabecalho, persona_idx, contador_global, i))
            contador_global += 1
    for fonte, cabecalho, persona_idx, n in FONTES_SAUDE:
        for i in range(n):
            exemplos.append(gerar_exemplo_saude(fonte, cabecalho, persona_idx, contador_global, i))
            contador_global += 1

    def buscar_por_id(id_):
        return next(e for e in exemplos if e["metadata"]["id"] == id_)

    reenvios = [
        "amplitude-auto-Oficina Estrela-0", "amplitude-auto-Auto Center Silva-0",
        "amplitude-auto-Funilaria Rio Bonito-0", "amplitude-auto-Oficina Nova Aliança-0",
        "amplitude-saude-empresarial-Clínica Vitalis-0", "amplitude-saude-empresarial-Hospital Santa Clara-0",
        "amplitude-saude-empresarial-Centro Médico Bem Estar-0",
    ]
    for id_ in reenvios:
        original = dict(buscar_por_id(id_))
        original["metadata"] = {**original["metadata"], "id": f"{id_}-reenviado"}
        exemplos.append(original)

    return exemplos


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
    print("== Testes: geração e escala do dataset (Módulo 6) ==")

    bruto = gerar_dataset_bruto()

    def t1():
        ids = [e["metadata"]["id"] for e in bruto]
        assert len(set(ids)) == len(ids)

    testar("nenhum id de exemplo se repete no bruto (gerador não colide)", t1)

    def t2():
        for e in bruto:
            if e["metadata"]["caso"] == "amplitude-auto":
                assert e["saida"]["segurado"] and e["saida"]["placa"] and isinstance(e["saida"]["valor"], float)
            else:
                assert e["saida"]["beneficiario"] and e["saida"]["procedimento"] and isinstance(e["saida"]["valor"], float)

    testar("todo exemplo tem os 3 campos do schema do seu caso preenchidos", t2)

    alvos = {"amplitude-auto": 1800, "amplitude-saude-empresarial": 1200}
    resultado = m22.limpar_e_balancear(bruto, alvos=alvos)

    def t3():
        assert resultado["duplicatasRemovidas"] == 8

    testar("detector real encontra 8 duplicatas: 7 plantadas + 1 colisão orgânica real", t3)

    def t4():
        finais = resultado["exemplosFinal"]
        assert sum(1 for e in finais if e["metadata"]["caso"] == "amplitude-auto") == 1800
        assert sum(1 for e in finais if e["metadata"]["caso"] == "amplitude-saude-empresarial") == 1200

    testar("pipeline entrega exatamente os alvos de escala (1.800 Auto + 1.200 Saúde Empresarial)", t4)

    def t5():
        for caso in ("amplitude-auto", "amplitude-saude-empresarial"):
            r = resultado["relatorioPorCaso"][caso]
            for fonte in r["contagensDepois"]:
                assert r["contagensDepois"][fonte] <= r["contagensAntes"][fonte]

    testar("nenhuma fonte perde exemplo além do necessário (alocação capacitada respeitada)", t5)

    def t6():
        r_auto = resultado["relatorioPorCaso"]["amplitude-auto"]
        r_saude = resultado["relatorioPorCaso"]["amplitude-saude-empresarial"]
        assert r_auto["nEfetivoDepois"] >= r_auto["nEfetivoAntes"]
        assert r_saude["nEfetivoDepois"] >= r_saude["nEfetivoAntes"]

    testar("diversidade (N efetivo de fontes) sobe ou mantém após o balanceamento, nos dois casos", t6)

    print()
    print(
        f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), "
        f"{_testes_com_falha} falhou(falharam)."
    )

    if _testes_com_falha > 0:
        raise AssertionError(f"{_testes_com_falha} teste(s) falharam.")

    return resultado


# ---------------------------------------------------------------------------
# Execução principal
# ---------------------------------------------------------------------------


def main():
    resultado = rodar_testes()

    print()
    print("== Pipeline: escalando o dataset real do Módulo 3.2 pro volume de produção (Módulo 6) ==")
    print(f"Bruto: {resultado['original']} exemplos -> Dedup: {resultado['aposDedup']} -> Balanceado: {resultado['final']}")
    print(f"Total de pares força-bruta comparados: {resultado['totalParesForcaBruta']}, candidatos via LSH: {resultado['totalCandidatosLSH']}")
    print(f"Duplicatas removidas: {resultado['duplicatasRemovidas']}")

    for caso, r in resultado["relatorioPorCaso"].items():
        print(f"\n--- {caso} ---")
        print(f"Fontes reais: {len(r['contagensAntes'])}")
        print("Antes:", ", ".join(f"{f}={n}" for f, n in r["contagensAntes"].items()))
        print(f"Entropia antes: {r['entropiaAntes']:.4f} | N efetivo: {r['nEfetivoAntes']:.3f}")
        print("Depois:", ", ".join(f"{f}={n}" for f, n in r["contagensDepois"].items()))
        print(f"Entropia depois: {r['entropiaDepois']:.4f} | N efetivo: {r['nEfetivoDepois']:.3f}")

    print(f"\nDataset final: {len(resultado['exemplosFinal'])} exemplos, prontos pra conversão e upload (Módulo 6).")


if __name__ == "__main__":
    main()

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
