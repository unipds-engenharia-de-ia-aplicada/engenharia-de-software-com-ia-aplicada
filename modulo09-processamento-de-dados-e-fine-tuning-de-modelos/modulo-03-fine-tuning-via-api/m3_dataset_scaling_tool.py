"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 3.2

Gerador do dataset em escala de treino real (305 brutos -> 300 dedup ->
200 balanceados, 120 Amplitude Auto + 80 Amplitude Saude Empresarial), o
dataset que o job real da Vertex AI (tuningJobs/4180970763655839744) de
fato treinou. Reusa o pipeline formal do Modulo 2.2 (MinHash+LSH,
amostragem por temperatura, entropia de Shannon) importando as funcoes
direto do artefato ja revisado, sem duplicar nenhuma linha de logica --
este arquivo so escala o volume bruto de entrada, a limpeza/balanceamento
em si e 100% a mesma funcao que o Modulo 2.2 usa para os 34 exemplos
simulados.

Uso: python3 m3_dataset_scaling_tool.py
"""

import importlib.util
from pathlib import Path

_M2_2_PATH = Path(__file__).parent.parent / "modulo-02-preparacao-datasets" / "dataset_cleaning_balancing_tool.py"
_spec = importlib.util.spec_from_file_location("dataset_cleaning_balancing_tool", _M2_2_PATH)
m22 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m22)

NOMES = [
    "Marcos Vinicius Andrade Pereira", "Fernanda Costa Ribeiro", "Joaquim Pedro Salgado",
    "Beatriz Nogueira Lima", "Rafael Augusto Teixeira", "Camila dos Santos Farias",
    "Eduardo Henrique Barros", "Larissa Martins Cardoso", "Thiago Moreira Duarte",
    "Patricia Alves Monteiro", "Bruno Cesar Figueiredo", "Juliana Rocha Pimentel",
    "Gustavo Henrique Vasconcelos", "Renata Souza Albuquerque", "Diego Fernandes Castro",
    "Mariana Lopes Guimaraes", "Vinicius Almeida Correia", "Sabrina Ferreira Nunes",
    "Leonardo Batista Cavalcanti", "Priscila Andrade Melo", "Rodrigo Tavares Siqueira",
    "Amanda Cristina Peixoto", "Felipe Augusto Barbosa", "Carolina Machado Freitas",
    "Anderson Luiz Ramalho", "Vanessa Regina Coutinho", "Fabio Junior Aragao",
    "Debora Cristina Vieira", "Marcelo Souza Bittencourt", "Tatiane Pereira Godoy",
    "Alexandre Costa Miranda", "Cristiane Lopes Assuncao", "Fernando Braga Quintanilha",
    "Simone Rocha Vilaca", "Rogerio dos Santos Pena", "Michele Aparecida Fonseca",
    "Wagner Luiz Bessa", "Andreia Cristina Prado", "Cesar Augusto Nascimento",
    "Roberta Lima Sarmento", "Paulo Ricardo Andrade",
]

PLACAS = [
    "QJK-4F82", "RTL-9921", "MNB-3310", "PLW-7765", "ZXC-2298", "BVN-6641",
    "TYU-1183", "GHJ-5529", "FDS-8842", "LKM-3376", "OIU-9954", "CVB-1120",
    "ASD-6673", "WER-4481", "XSW-2290", "POI-7738", "HGF-3391", "MJU-6624",
    "NBV-1187", "KLO-5540", "ERT-8873", "YUI-2216", "CDE-9950", "VBN-4483",
    "AZS-6617", "QWE-1150", "DFG-7784", "RTY-3318", "FGH-8852", "TGB-2286",
    "YHN-5520", "UJM-9954", "IKM-4488", "OLP-1122", "WSX-6656", "EDC-1190",
    "RFV-5524", "TGB-9958", "YHN-3392", "UJM-7726", "ZAQ-1128", "XSW-6652", "CDE-3396",
]

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
    "consulta urologica", "exame de tomografia",
]

VALORES = [
    "3.210,50", "1.870,00", "5.640,00", "2.430,75", "890,00", "4.120,30",
    "1.250,00", "3.980,60", "2.760,00", "6.310,90", "1.540,00", "2.990,25",
    "3.450,00", "1.780,50", "4.560,00", "2.220,80", "5.120,00", "1.630,40",
    "3.870,00", "2.045,90", "4.780,60", "1.395,00", "6.020,50", "2.510,30",
    "3.660,00", "1.925,80", "4.310,00", "2.870,60", "5.480,00", "1.485,70",
    "3.120,00", "2.640,90", "4.950,00", "1.780,00", "3.390,60", "2.210,00",
    "5.870,00", "1.660,40", "4.120,00", "2.980,50", "3.780,90", "2.340,00", "4.910,60",
    "1.590,00", "3.260,40", "2.150,80", "4.430,00",
]

DATAS = [
    "12/03/2026", "02/04/2026", "18/05/2026", "25/03/2026", "09/04/2026", "30/04/2026",
    "14/03/2026", "21/05/2026", "05/04/2026", "11/05/2026", "28/03/2026", "16/04/2026",
    "03/06/2026", "19/06/2026", "07/06/2026", "24/06/2026", "01/07/2026", "15/07/2026",
    "22/07/2026", "29/07/2026", "06/02/2026", "13/02/2026", "20/02/2026", "27/02/2026",
    "04/02/2026", "10/06/2026", "17/03/2026", "26/04/2026", "02/05/2026", "08/06/2026",
    "23/06/2026",
]


def _tpl_oficina_estrela(nome, placa, data, valor):
    return (
        f"ATIVA ORCAMENTOS AUTOMOTIVOS OFICINA ESTRELA LTDA CNPJ 12.345.678/0001-90 Rua das Turbinas 450 Distrito Industrial "
        f"Segurado: {nome} Placa do veiculo: {placa} Data do sinistro: {data} "
        f"Descricao do servico: reparo de lataria e pintura no para-choque dianteiro Valor total do reparo: R$ {valor}"
    )


def _tpl_auto_center_silva(nome, placa, data, valor):
    return (
        f"AUTO CENTER SILVA - FUNILARIA E PINTURA - CNPJ 98.765.432/0001-11 Av. dos Mecanicos 220 "
        f"Cliente/Segurado: {nome} Placa: {placa} Data do atendimento: {data} "
        f"Servico executado: troca de para-lama e revisao de suspensao dianteira Valor: R$ {valor}"
    )


def _tpl_funilaria_rio_bonito(nome, placa, data, valor):
    return (
        f"FUNILARIA RIO BONITO ME CNPJ 45.111.222/0001-33 Rua Rio Bonito 88 "
        f"Nome do segurado: {nome} Placa do veiculo: {placa} Data: {data} "
        f"Orcamento: substituicao de parachoque traseiro e polimento Valor total: R$ {valor}"
    )


def _tpl_oficina_nova_alianca(nome, placa, data, valor):
    return (
        f"OFICINA NOVA ALIANCA LTDA CNPJ 22.333.444/0001-55 Estrada Velha 1200 "
        f"Segurado: {nome} Placa do carro: {placa} Data do orcamento: {data} "
        f"Descricao: reparo de amassado na porta dianteira Valor cobrado: R$ {valor}"
    )


def _tpl_mecanica_horizonte(nome, placa, data, valor):
    return (
        f"MECANICA HORIZONTE LTDA CNPJ 51.222.888/0001-19 Av. do Horizonte 640 "
        f"Segurado: {nome} Placa do veiculo: {placa} Data do servico: {data} "
        f"Descricao: alinhamento e balanceamento apos colisao lateral Valor total: R$ {valor}"
    )


def _tpl_auto_reparos_uniao(nome, placa, data, valor):
    return (
        f"AUTO REPAROS UNIAO ME CNPJ 63.444.777/0001-28 Rua da Uniao 305 "
        f"Nome do segurado: {nome} Placa: {placa} Data do atendimento: {data} "
        f"Servico: troca de para-brisa trincado Valor cobrado: R$ {valor}"
    )


TEMPLATES_AUTO = {
    "Oficina Estrela": _tpl_oficina_estrela,
    "Auto Center Silva": _tpl_auto_center_silva,
    "Funilaria Rio Bonito": _tpl_funilaria_rio_bonito,
    "Oficina Nova Aliança": _tpl_oficina_nova_alianca,
    "Mecânica Horizonte": _tpl_mecanica_horizonte,
    "Auto Reparos União": _tpl_auto_reparos_uniao,
}


def _tpl_clinica_vitalis(nome, procedimento, data, valor):
    return (
        f"CLINICA VITALIS SAUDE OCUPACIONAL CNPJ 33.222.111/0001-44 Av. Paulista 900 "
        f"Paciente/Beneficiario: {nome} Procedimento: {procedimento} Data do atendimento: {data} "
        f"Valor cobrado: R$ {valor}"
    )


def _tpl_hospital_santa_clara(nome, procedimento, data, valor):
    return (
        f"HOSPITAL SANTA CLARA CNPJ 66.555.444/0001-22 Rua das Acacias 310 "
        f"Beneficiario: {nome} Procedimento realizado: {procedimento} Data: {data} "
        f"Valor total: R$ {valor}"
    )


def _tpl_centro_medico_bem_estar(nome, procedimento, data, valor):
    return (
        f"CENTRO MEDICO BEM ESTAR CNPJ 77.888.999/0001-66 Rua da Saude 45 "
        f"Nome do beneficiario: {nome} Procedimento: {procedimento} Data da consulta: {data} "
        f"Valor cobrado: R$ {valor}"
    )


def _tpl_clinica_sao_rafael(nome, procedimento, data, valor):
    return (
        f"CLINICA SAO RAFAEL CNPJ 84.111.222/0001-37 Rua Sao Rafael 512 "
        f"Paciente/Beneficiario: {nome} Procedimento: {procedimento} Data do atendimento: {data} "
        f"Valor total: R$ {valor}"
    )


def _tpl_instituto_saude_plena(nome, procedimento, data, valor):
    return (
        f"INSTITUTO SAUDE PLENA LTDA CNPJ 91.333.555/0001-08 Av. da Saude Plena 78 "
        f"Beneficiario: {nome} Procedimento realizado: {procedimento} Data: {data} "
        f"Valor cobrado: R$ {valor}"
    )


TEMPLATES_SAUDE = {
    "Clínica Vitalis": _tpl_clinica_vitalis,
    "Hospital Santa Clara": _tpl_hospital_santa_clara,
    "Centro Médico Bem Estar": _tpl_centro_medico_bem_estar,
    "Clínica São Rafael": _tpl_clinica_sao_rafael,
    "Instituto Saúde Plena": _tpl_instituto_saude_plena,
}

PRENOMES = [n.split(" ")[0] for n in NOMES]
SOBRENOMES = [" ".join(n.split(" ")[1:]) for n in NOMES[:37]]

# Placa, valor, procedimento e data (arrays acima) NAO tem o mesmo cuidado de
# periodo que o nome: vem de pools bem menores -- 43, 47, 29 e 31 entradas,
# respectivamente -- sem escolha de tamanhos primos entre si. Diferente do
# nome, eles REPETEM string exata assim que o indice ultrapassa o tamanho do
# pool: um exemplo gerado com indice 5000 (o offset que o harness do Modulo
# 5.1 usa pro conjunto de teste retido, justamente pra garantir nome nunca
# visto no treino) tem nome genuinamente novo, mas placa e valor que ja
# apareceram no treino, so que atribuidos a outra pessoa -- confirmado na
# pratica: indice 5000 gera "Roberta Costa Ribeiro" com a mesma placa
# TGB-2286 de Gustavo Souza Albuquerque (indice baixo, treino) e o mesmo
# valor 2220,80 de Leonardo Batista Cavalcanti (treino).
#
# Isso nao invalida o teste retido desta disciplina: numa tarefa de extracao,
# a resposta certa esta escrita no proprio texto de entrada -- o modelo nao
# precisa lembrar nada do treino pra acertar, so precisa ler. Mas e uma
# limitacao real de design, e vale saber antes de reaproveitar este gerador
# pra outro problema seu: se o seu caso de uso depende de todo campo (nao so
# o nome) ser genuinamente inedito no teste retido -- por exemplo, se o
# modelo puder "colar" a resposta certa direto da memoria de treino em vez
# de precisar ler --, aumente os pools ate passar do maior indice que
# pretende usar, ou use o mesmo truque do nome, dois tamanhos de pool primos
# entre si multiplicam o periodo antes de repetir -- ou derive
# placa/valor/data por hash do indice em vez de indexar numa lista fixa
# pequena.

FONTES_AUTO = [
    ("Oficina Estrela", 60),
    ("Auto Center Silva", 40),
    ("Funilaria Rio Bonito", 30),
    ("Oficina Nova Aliança", 25),
    ("Mecânica Horizonte", 15),
    ("Auto Reparos União", 10),
]

FONTES_SAUDE = [
    ("Clínica Vitalis", 50),
    ("Hospital Santa Clara", 30),
    ("Centro Médico Bem Estar", 20),
    ("Clínica São Rafael", 12),
    ("Instituto Saúde Plena", 8),
]


def gerar_exemplo(caso, fonte, indice):
    nome = f"{PRENOMES[indice % len(PRENOMES)]} {SOBRENOMES[(indice * 7 + 3) % len(SOBRENOMES)]}"
    data = DATAS[(indice * 7 + 3) % len(DATAS)]
    valor = VALORES[(indice * 11 + 5) % len(VALORES)]

    if caso == "amplitude-auto":
        placa = PLACAS[(indice * 13 + 2) % len(PLACAS)]
        entrada = TEMPLATES_AUTO[fonte](nome, placa, data, valor)
        saida = {"segurado": nome, "placa": placa, "valor": float(valor.replace(".", "").replace(",", "."))}
        instrucao = "Extraia segurado, placa e valor do orçamento de oficina abaixo."
    else:
        procedimento = PROCEDIMENTOS[(indice * 5 + 1) % len(PROCEDIMENTOS)]
        entrada = TEMPLATES_SAUDE[fonte](nome, procedimento, data, valor)
        saida = {"beneficiario": nome, "procedimento": procedimento, "valor": float(valor.replace(".", "").replace(",", "."))}
        instrucao = "Extraia beneficiário, procedimento e valor do recibo médico abaixo."

    return {
        "instrucao": instrucao,
        "entrada": entrada,
        "saida": saida,
        "metadata": {"caso": caso, "fonte": fonte, "id": f"{caso}-{fonte}-{indice}"},
    }


def gerar_dataset_bruto():
    exemplos = []
    for fonte, n in FONTES_AUTO:
        for i in range(n):
            exemplos.append(gerar_exemplo("amplitude-auto", fonte, i))
    for fonte, n in FONTES_SAUDE:
        for i in range(n):
            exemplos.append(gerar_exemplo("amplitude-saude-empresarial", fonte, i))

    def buscar_por_id(id_):
        return next(e for e in exemplos if e["metadata"]["id"] == id_)

    dup1 = dict(buscar_por_id("amplitude-auto-Oficina Estrela-0"))
    dup1["metadata"] = {"caso": "amplitude-auto", "fonte": "Oficina Estrela", "id": "amplitude-auto-Oficina Estrela-0-reenviado"}
    exemplos.append(dup1)

    dup2 = dict(buscar_por_id("amplitude-auto-Auto Center Silva-0"))
    dup2["metadata"] = {"caso": "amplitude-auto", "fonte": "Auto Center Silva", "id": "amplitude-auto-Auto Center Silva-0-reenviado"}
    exemplos.append(dup2)

    ruido_auto = dict(buscar_por_id("amplitude-auto-Oficina Estrela-5"))
    ruido_auto["entrada"] = ruido_auto["entrada"].replace("Placa do veiculo:", "P1aca do veicu1o:")
    ruido_auto["metadata"] = {"caso": "amplitude-auto", "fonte": "Oficina Estrela", "id": "amplitude-auto-Oficina Estrela-5-ruido-ocr"}
    exemplos.append(ruido_auto)

    dup3 = dict(buscar_por_id("amplitude-saude-empresarial-Clínica Vitalis-0"))
    dup3["metadata"] = {"caso": "amplitude-saude-empresarial", "fonte": "Clínica Vitalis", "id": "amplitude-saude-empresarial-Clínica Vitalis-0-reenviado"}
    exemplos.append(dup3)

    ruido_saude = dict(buscar_por_id("amplitude-saude-empresarial-Clínica Vitalis-10"))
    ruido_saude["entrada"] = ruido_saude["entrada"].replace("Valor cobrado:", "Va1or cobrad0:")
    ruido_saude["metadata"] = {"caso": "amplitude-saude-empresarial", "fonte": "Clínica Vitalis", "id": "amplitude-saude-empresarial-Clínica Vitalis-10-ruido-ocr"}
    exemplos.append(ruido_saude)

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
    print("== Testes: geração e escala do dataset ==")

    bruto = gerar_dataset_bruto()

    def t1():
        assert len(bruto) == 305
        assert sum(1 for e in bruto if e["metadata"]["caso"] == "amplitude-auto") == 183
        assert sum(1 for e in bruto if e["metadata"]["caso"] == "amplitude-saude-empresarial") == 122

    testar("dataset bruto tem 305 exemplos (183 Auto + 122 Saúde Empresarial)", t1)

    def t2():
        ids = [e["metadata"]["id"] for e in bruto]
        assert len(set(ids)) == len(ids)

    testar("nenhum id de exemplo se repete no bruto (gerador não colide)", t2)

    resultado = m22.limpar_e_balancear(bruto, alvos={"amplitude-auto": 120, "amplitude-saude-empresarial": 80})

    def t3():
        assert resultado["original"] == 305
        assert resultado["aposDedup"] == 300
        assert resultado["final"] == 200

    testar("pipeline reduz 305 -> 300 (dedup) -> 200 (balanceado), zero falso positivo", t3)

    def t4():
        finais = resultado["exemplosFinal"]
        assert sum(1 for e in finais if e["metadata"]["caso"] == "amplitude-auto") == 120
        assert sum(1 for e in finais if e["metadata"]["caso"] == "amplitude-saude-empresarial") == 80

    testar("dataset final bate exatamente com o job real: 120 Auto + 80 Saúde Empresarial", t4)

    def t5():
        r_auto = resultado["relatorioPorCaso"]["amplitude-auto"]
        r_saude = resultado["relatorioPorCaso"]["amplitude-saude-empresarial"]
        assert r_auto["nEfetivoDepois"] > r_auto["nEfetivoAntes"]
        assert r_saude["nEfetivoDepois"] > r_saude["nEfetivoAntes"]
        assert abs(r_auto["nEfetivoAntes"] - 5.160) < 0.01
        assert abs(r_auto["nEfetivoDepois"] - 5.723) < 0.01
        assert abs(r_saude["nEfetivoAntes"] - 4.140) < 0.01
        assert abs(r_saude["nEfetivoDepois"] - 4.706) < 0.01

    testar("N efetivo de fontes sobe com o balanceamento, Auto e Saúde Empresarial", t5)

    def t6():
        r_auto = resultado["relatorioPorCaso"]["amplitude-auto"]
        for fonte in r_auto["contagensDepois"]:
            assert r_auto["contagensDepois"][fonte] <= r_auto["contagensAntes"][fonte]

    testar("nenhuma fonte perde exemplo além do necessário (alocação capacitada respeitada)", t6)

    print()
    print(
        f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), "
        f"{_testes_com_falha} falhou(falharam)."
    )

    return resultado


# ---------------------------------------------------------------------------
# Execução principal
# ---------------------------------------------------------------------------


def main():
    resultado = rodar_testes()

    print()
    print("== Pipeline: escalando o dataset simulado do Módulo 2.2 pro volume real de treino ==")
    print(f"Bruto: {resultado['original']} exemplos -> Dedup: {resultado['aposDedup']} -> Balanceado: {resultado['final']}")
    print(f"Total de pares força-bruta comparados: {resultado['totalParesForcaBruta']}, candidatos via LSH: {resultado['totalCandidatosLSH']}")

    for caso, r in resultado["relatorioPorCaso"].items():
        print(f"\n--- {caso} ---")
        print("Antes:", ", ".join(f"{f}={n}" for f, n in r["contagensAntes"].items()))
        print(f"Entropia antes: {r['entropiaAntes']:.4f} | N efetivo: {r['nEfetivoAntes']:.3f} (de {len(r['contagensAntes'])} fontes)")
        print("Depois:", ", ".join(f"{f}={n}" for f, n in r["contagensDepois"].items()))
        print(f"Entropia depois: {r['entropiaDepois']:.4f} | N efetivo: {r['nEfetivoDepois']:.3f}")

    print()
    print(f"Dataset final: {len(resultado['exemplosFinal'])} exemplos, prontos pra conversão e upload (Módulo 3.2).")


if __name__ == "__main__":
    main()

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
