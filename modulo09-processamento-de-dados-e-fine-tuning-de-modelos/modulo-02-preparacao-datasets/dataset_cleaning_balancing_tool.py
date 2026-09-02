"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 2.2 (referencia espelhada em Python)

Ferramenta: Deduplicacao via MinHash+LSH, Balanceamento por Amostragem com
Temperatura, e Metricas Formais de Diversidade

Versao profissional, nivel mestrado/MBA: as tres etapas usam metodo formal
e citavel, nao heuristica ad hoc.

1) DEDUPLICACAO - MinHash (Broder, 1997, "On the resemblance and containment
   of documents") + LSH banding pra geracao de candidatos, seguido de
   refinamento com similaridade de Jaccard exata so sobre os candidatos.
   E a mesma familia de tecnica que Lee et al. (2021/2022, Google Research,
   "Deduplicating Training Data Makes Language Models Better", arXiv
   2107.06499) usam de verdade em producao (o "NEARDUP" do paper). Reduz
   o custo de O(n^2) comparacoes exatas pra um numero muito menor de
   candidatos, sem perder recall sobre as duplicatas reais - verificado
   empiricamente neste arquivo, nao assumido.

2) BALANCEAMENTO - amostragem por temperatura (exponential smoothing), a
   mesma formulacao usada por Raffel et al. (2020, T5) pra balancear
   proporcao de tarefa no fine-tuning multi-task, adaptada por Xue et al.
   (2021, mT5) pra balancear proporcao de idioma no pre-treino multilingue:
   a probabilidade de amostrar a fonte i e proporcional a n_i^alpha, com
   alpha=1 sendo proporcional puro (sem suavizacao) e alpha->0 se
   aproximando de uniforme entre fontes. O mT5 usa alpha=0.3 na pratica -
   mesmo valor usado aqui. A conversao de peso continuo pra contagem
   inteira usa o metodo do maior resto (Hamilton/Hare-Niemeyer), o mesmo
   metodo formal de apuracao de assento proporcional usado em sistemas
   eleitorais, com restricao de capacidade: nenhuma fonte e alocada acima
   do que ela realmente tem disponivel - balancear nao e inventar dado.

3) DIVERSIDADE - entropia de Shannon da distribuicao por fonte, e o numero
   efetivo de fontes (Hill number de ordem 1, exp(H) - ver Hill, 1973;
   Jost, 2006), que traduz a entropia pra uma escala interpretavel:
   "quantas fontes igualmente representadas seriam equivalentes a esta
   distribuicao real". Isso fecha o bullet 5 da ementa (avaliar a
   importancia de qualidade e diversidade dos dados) com numero formal,
   nao so discurso.

Uso: python3 dataset_cleaning_balancing_tool.py
"""

import math
import re

LIMIAR_DUPLICATA = 0.55
MINHASH_K = 32
MINHASH_SEMENTE = 42
LSH_BANDAS = 8
LSH_LINHAS = 4
ALPHA_TEMPERATURA = 0.3
PRIMO_MERSENNE = 2147483647


def normalizar_texto(texto):
    return re.sub(r"\s+", " ", texto.lower()).strip()


def shingles(texto, n):
    palavras = normalizar_texto(texto).split(" ")
    return {" ".join(palavras[i:i + n]) for i in range(len(palavras) - n + 1)}


def similaridade_jaccard_exata(a, b, n=5):
    sa, sb = shingles(a, n), shingles(b, n)
    if not sa or not sb:
        return 0
    intersecao = len(sa & sb)
    uniao = len(sa) + len(sb) - intersecao
    return 0 if uniao == 0 else intersecao / uniao


TEMPLATES_AUTO = {
    "Oficina Estrela": lambda nome, placa, data, valor: (
        f"ATIVA ORCAMENTOS AUTOMOTIVOS OFICINA ESTRELA LTDA CNPJ 12.345.678/0001-90 Rua das Turbinas 450 Distrito Industrial "
        f"Segurado: {nome} Placa do veiculo: {placa} Data do sinistro: {data} "
        f"Descricao do servico: reparo de lataria e pintura no para-choque dianteiro Valor total do reparo: R$ {valor}"
    ),
    "Auto Center Silva": lambda nome, placa, data, valor: (
        f"AUTO CENTER SILVA - FUNILARIA E PINTURA - CNPJ 98.765.432/0001-11 Av. dos Mecanicos 220 "
        f"Cliente/Segurado: {nome} Placa: {placa} Data do atendimento: {data} "
        f"Servico executado: troca de para-lama e revisao de suspensao dianteira Valor: R$ {valor}"
    ),
    "Funilaria Rio Bonito": lambda nome, placa, data, valor: (
        f"FUNILARIA RIO BONITO ME CNPJ 45.111.222/0001-33 Rua Rio Bonito 88 "
        f"Nome do segurado: {nome} Placa do veiculo: {placa} Data: {data} "
        f"Orcamento: substituicao de parachoque traseiro e polimento Valor total: R$ {valor}"
    ),
    "Oficina Nova Aliança": lambda nome, placa, data, valor: (
        f"OFICINA NOVA ALIANCA LTDA CNPJ 22.333.444/0001-55 Estrada Velha 1200 "
        f"Segurado: {nome} Placa do carro: {placa} Data do orcamento: {data} "
        f"Descricao: reparo de amassado na porta dianteira Valor cobrado: R$ {valor}"
    ),
}

TEMPLATES_SAUDE = {
    "Clínica Vitalis": lambda nome, procedimento, data, valor: (
        f"CLINICA VITALIS SAUDE OCUPACIONAL CNPJ 33.222.111/0001-44 Av. Paulista 900 "
        f"Paciente/Beneficiario: {nome} Procedimento: {procedimento} Data do atendimento: {data} "
        f"Valor cobrado: R$ {valor}"
    ),
    "Hospital Santa Clara": lambda nome, procedimento, data, valor: (
        f"HOSPITAL SANTA CLARA CNPJ 66.555.444/0001-22 Rua das Acacias 310 "
        f"Beneficiario: {nome} Procedimento realizado: {procedimento} Data: {data} "
        f"Valor total: R$ {valor}"
    ),
    "Centro Médico Bem Estar": lambda nome, procedimento, data, valor: (
        f"CENTRO MEDICO BEM ESTAR CNPJ 77.888.999/0001-66 Rua da Saude 45 "
        f"Nome do beneficiario: {nome} Procedimento: {procedimento} Data da consulta: {data} "
        f"Valor cobrado: R$ {valor}"
    ),
}

NOMES = [
    "Marcos Vinicius Andrade Pereira", "Fernanda Costa Ribeiro", "Joaquim Pedro Salgado",
    "Beatriz Nogueira Lima", "Rafael Augusto Teixeira", "Camila dos Santos Farias",
    "Eduardo Henrique Barros", "Larissa Martins Cardoso", "Thiago Moreira Duarte",
    "Patricia Alves Monteiro", "Bruno Cesar Figueiredo", "Juliana Rocha Pimentel",
    "Gustavo Henrique Vasconcelos", "Renata Souza Albuquerque", "Diego Fernandes Castro",
    "Mariana Lopes Guimaraes",
]
PLACAS = [
    "QJK-4F82", "RTL-9921", "MNB-3310", "PLW-7765", "ZXC-2298", "BVN-6641",
    "TYU-1183", "GHJ-5529", "FDS-8842", "LKM-3376", "OIU-9954", "CVB-1120",
    "ASD-6673", "WER-4481", "XSW-2290", "POI-7738",
]
PROCEDIMENTOS = [
    "consulta cardiologica", "exame de sangue completo", "fisioterapia ortopedica",
    "consulta ortopedica", "exame de imagem (ressonancia)", "consulta psiquiatrica",
    "sessao de fonoaudiologia", "exame oftalmologico", "consulta dermatologica",
    "exame de densitometria ossea", "consulta nutricional", "sessao de acupuntura",
]
VALORES = [
    "3.210,50", "1.870,00", "5.640,00", "2.430,75", "890,00", "4.120,30",
    "1.250,00", "3.980,60", "2.760,00", "6.310,90", "1.540,00", "2.990,25",
    "3.450,00", "1.780,50", "4.560,00", "2.220,80",
]
DATAS = [
    "12/03/2026", "02/04/2026", "18/05/2026", "25/03/2026", "09/04/2026", "30/04/2026",
    "14/03/2026", "21/05/2026", "05/04/2026", "11/05/2026", "28/03/2026", "16/04/2026",
]


def _valor_para_numero(valor):
    return float(valor.replace(".", "").replace(",", "."))


def gerar_exemplo(caso, fonte, indice, nome=None, placa=None, procedimento=None, data=None, valor=None):
    nome = nome or NOMES[indice % len(NOMES)]
    data = data or DATAS[indice % len(DATAS)]
    valor = valor or VALORES[indice % len(VALORES)]

    if caso == "amplitude-auto":
        placa = placa or PLACAS[indice % len(PLACAS)]
        entrada = TEMPLATES_AUTO[fonte](nome, placa, data, valor)
        saida = {"segurado": nome, "placa": placa, "valor": _valor_para_numero(valor)}
        instrucao = "Extraia segurado, placa e valor do orçamento de oficina abaixo."
    else:
        procedimento = procedimento or PROCEDIMENTOS[indice % len(PROCEDIMENTOS)]
        entrada = TEMPLATES_SAUDE[fonte](nome, procedimento, data, valor)
        saida = {"beneficiario": nome, "procedimento": procedimento, "valor": _valor_para_numero(valor)}
        instrucao = "Extraia beneficiário, procedimento e valor do recibo médico abaixo."

    return {
        "instrucao": instrucao,
        "entrada": entrada,
        "saida": saida,
        "metadata": {"caso": caso, "fonte": fonte, "id": f"{caso}-{fonte}-{indice}"},
    }


def gerar_dataset_simulado():
    exemplos = []

    for i in range(16):
        exemplos.append(gerar_exemplo("amplitude-auto", "Oficina Estrela", i))
    for i in range(5):
        exemplos.append(gerar_exemplo("amplitude-auto", "Auto Center Silva", i + 20))
    for i in range(4):
        exemplos.append(gerar_exemplo("amplitude-auto", "Funilaria Rio Bonito", i + 30))
    for i in range(3):
        exemplos.append(gerar_exemplo("amplitude-auto", "Oficina Nova Aliança", i + 40))

    duplicata_exata = gerar_exemplo("amplitude-auto", "Oficina Estrela", 0)
    duplicata_exata["metadata"]["id"] = "amplitude-auto-Oficina Estrela-0-reenviado"
    exemplos[1] = duplicata_exata

    ocr_ruido = gerar_exemplo("amplitude-auto", "Oficina Estrela", 2)
    ocr_ruido["entrada"] = ocr_ruido["entrada"].replace("Placa do veiculo:", "P1aca do veicu1o:")
    ocr_ruido["metadata"]["id"] = "amplitude-auto-Oficina Estrela-2-ruido-ocr"
    exemplos[3] = ocr_ruido

    for i in range(12):
        exemplos.append(gerar_exemplo("amplitude-saude-empresarial", "Clínica Vitalis", i))
    for i in range(4):
        exemplos.append(gerar_exemplo("amplitude-saude-empresarial", "Hospital Santa Clara", i + 20))
    for i in range(3):
        exemplos.append(gerar_exemplo("amplitude-saude-empresarial", "Centro Médico Bem Estar", i + 30))

    idx_vitalis0 = next(
        idx for idx, e in enumerate(exemplos)
        if e["metadata"]["fonte"] == "Clínica Vitalis" and e["metadata"]["id"].endswith("-0")
    )
    vitalis_dup = gerar_exemplo("amplitude-saude-empresarial", "Clínica Vitalis", 0)
    vitalis_dup["metadata"]["id"] = "amplitude-saude-empresarial-Clínica Vitalis-0-reenviado"
    exemplos[idx_vitalis0 + 1] = vitalis_dup

    return exemplos


# --- MinHash + LSH ---------------------------------------------------------

def hash_string(s):
    h = 5381
    for ch in s:
        h = ((h * 33) + ord(ch)) & 0xFFFFFFFF
    return h


def gerar_coeficientes_hash(k, semente):
    estado = semente & 0xFFFFFFFF

    def proximo():
        nonlocal estado
        estado = ((estado * 1103515245) + 12345) & 0xFFFFFFFF
        return estado

    coeficientes = []
    for _ in range(k):
        a = (proximo() % 2000000000) + 1
        b = proximo() % 2000000000
        coeficientes.append((a, b))
    return coeficientes


def hash_universal(x, a, b):
    return (a * x + b) % PRIMO_MERSENNE


def assinatura_minhash(shingle_set, coeficientes):
    base_hashes = [hash_string(s) for s in shingle_set]
    assinatura = []
    for a, b in coeficientes:
        minimo = min(hash_universal(x, a, b) for x in base_hashes)
        assinatura.append(minimo)
    return assinatura


def similaridade_minhash_estimada(assinatura_a, assinatura_b):
    iguais = sum(1 for x, y in zip(assinatura_a, assinatura_b) if x == y)
    return iguais / len(assinatura_a)


def banding_lsh(assinaturas, b, r):
    baldes = {}
    candidatos = set()
    for idx, assinatura in enumerate(assinaturas):
        for banda in range(b):
            fatia = tuple(assinatura[banda * r:banda * r + r])
            chave = (banda, fatia)
            balde = baldes.setdefault(chave, [])
            for outro_idx in balde:
                par = (outro_idx, idx) if outro_idx < idx else (idx, outro_idx)
                candidatos.add(par)
            balde.append(idx)
    return candidatos


def encontrar_quase_duplicatas_minhash_lsh(exemplos):
    coeficientes = gerar_coeficientes_hash(MINHASH_K, MINHASH_SEMENTE)
    resultados_por_caso = {}
    total_pares_forca_bruta = 0
    total_candidatos_lsh = 0
    pares_duplicata = []

    for caso in ["amplitude-auto", "amplitude-saude-empresarial"]:
        itens = [(idx, e) for idx, e in enumerate(exemplos) if e["metadata"]["caso"] == caso]
        assinaturas = [assinatura_minhash(shingles(e["entrada"], 5), coeficientes) for _, e in itens]
        candidatos_locais = banding_lsh(assinaturas, LSH_BANDAS, LSH_LINHAS)
        pares_forca_bruta = len(itens) * (len(itens) - 1) // 2

        confirmados = 0
        for li, lj in candidatos_locais:
            sim_exata = similaridade_jaccard_exata(itens[li][1]["entrada"], itens[lj][1]["entrada"])
            if sim_exata >= LIMIAR_DUPLICATA:
                confirmados += 1
                pares_duplicata.append({"i": itens[li][0], "j": itens[lj][0], "similaridade": sim_exata})

        resultados_por_caso[caso] = {
            "itensNoCaso": len(itens),
            "paresForcaBruta": pares_forca_bruta,
            "candidatosLSH": len(candidatos_locais),
            "duplicatasConfirmadas": confirmados,
            "reducaoPercentual": 0 if pares_forca_bruta == 0 else 100 * (1 - len(candidatos_locais) / pares_forca_bruta),
        }
        total_pares_forca_bruta += pares_forca_bruta
        total_candidatos_lsh += len(candidatos_locais)

    return {
        "paresDuplicata": pares_duplicata,
        "resultadosPorCaso": resultados_por_caso,
        "totalParesForcaBruta": total_pares_forca_bruta,
        "totalCandidatosLSH": total_candidatos_lsh,
    }


def remover_quase_duplicatas(exemplos):
    r = encontrar_quase_duplicatas_minhash_lsh(exemplos)
    remover = {p["j"] for p in r["paresDuplicata"]}
    mantidos = [e for idx, e in enumerate(exemplos) if idx not in remover]
    return {
        "mantidos": mantidos,
        "paresDuplicata": r["paresDuplicata"],
        "resultadosPorCaso": r["resultadosPorCaso"],
        "totalParesForcaBruta": r["totalParesForcaBruta"],
        "totalCandidatosLSH": r["totalCandidatosLSH"],
        "removidos": len(remover),
    }


# --- Balanceamento por temperatura + alocação capacitada --------------------

def contar_por_fonte(exemplos, caso):
    contagem = {}
    for e in exemplos:
        if e["metadata"]["caso"] == caso:
            fonte = e["metadata"]["fonte"]
            contagem[fonte] = contagem.get(fonte, 0) + 1
    return contagem


def pesos_amostragem_por_temperatura(contagens, alpha):
    fontes = list(contagens.keys())
    pesos_brutos = [contagens[f] ** alpha for f in fontes]
    soma = sum(pesos_brutos)
    return {f: p / soma for f, p in zip(fontes, pesos_brutos)}


def alocar_maior_resto(pesos, alvo):
    fontes = list(pesos.keys())
    quotas = [pesos[f] * alvo for f in fontes]
    base = [math.floor(q) for q in quotas]
    alocado_base = sum(base)
    restos = sorted(
        [(f, q - b) for f, q, b in zip(fontes, quotas, base)],
        key=lambda x: x[1],
        reverse=True,
    )
    faltam = alvo - alocado_base
    resultado = dict(zip(fontes, base))
    for i in range(faltam):
        resultado[restos[i][0]] += 1
    return resultado


def alocar_com_capacidade(contagens, alpha, alvo_total):
    fontes_ativas = list(contagens.keys())
    alvo_restante = alvo_total
    resultado = {}
    max_iteracoes = len(contagens) + 1

    for _ in range(max_iteracoes):
        if not fontes_ativas:
            break
        contagens_ativas = {f: contagens[f] for f in fontes_ativas}
        pesos = pesos_amostragem_por_temperatura(contagens_ativas, alpha)
        tentativa = alocar_maior_resto(pesos, alvo_restante)

        excedentes = [f for f in fontes_ativas if tentativa[f] > contagens[f]]
        if not excedentes:
            resultado.update(tentativa)
            break
        for f in excedentes:
            resultado[f] = contagens[f]
            alvo_restante -= contagens[f]
        fontes_ativas = [f for f in fontes_ativas if f not in excedentes]

    return resultado


def balancear_por_temperatura(exemplos, caso, alpha, alvo_total):
    contagens = contar_por_fonte(exemplos, caso)
    alocacao = alocar_com_capacidade(contagens, alpha, alvo_total)
    do_caso = [e for e in exemplos if e["metadata"]["caso"] == caso]
    outros = [e for e in exemplos if e["metadata"]["caso"] != caso]

    contador_usado = {}
    selecionados = []
    for e in do_caso:
        fonte = e["metadata"]["fonte"]
        contador_usado[fonte] = contador_usado.get(fonte, 0)
        if contador_usado[fonte] < alocacao[fonte]:
            selecionados.append(e)
            contador_usado[fonte] += 1

    return {"exemplos": outros + selecionados, "alocacao": alocacao, "contagens": contagens}


# --- Diversidade -------------------------------------------------------------

def distribuicao_de(contagens):
    total = sum(contagens.values())
    return {f: (0 if total == 0 else n / total) for f, n in contagens.items()}


def entropia_shannon(distribuicao):
    return -sum(p * math.log(p) for p in distribuicao.values() if p > 0)


def numero_efetivo_fontes(distribuicao):
    return math.exp(entropia_shannon(distribuicao))


# --- Pipeline completo --------------------------------------------------------

def limpar_e_balancear(exemplos, alpha=ALPHA_TEMPERATURA, alvos=None):
    dedup = remover_quase_duplicatas(exemplos)
    atual = dedup["mantidos"]
    relatorio_por_caso = {}

    for caso in ["amplitude-auto", "amplitude-saude-empresarial"]:
        contagens_antes = contar_por_fonte(atual, caso)
        dist_antes = distribuicao_de(contagens_antes)
        alvo = alvos[caso]

        resultado = balancear_por_temperatura(atual, caso, alpha, alvo)
        atual = resultado["exemplos"]

        contagens_depois = contar_por_fonte(atual, caso)
        dist_depois = distribuicao_de(contagens_depois)

        relatorio_por_caso[caso] = {
            "contagensAntes": contagens_antes,
            "distAntes": dist_antes,
            "entropiaAntes": entropia_shannon(dist_antes),
            "nEfetivoAntes": numero_efetivo_fontes(dist_antes),
            "contagensDepois": contagens_depois,
            "distDepois": dist_depois,
            "entropiaDepois": entropia_shannon(dist_depois),
            "nEfetivoDepois": numero_efetivo_fontes(dist_depois),
            "alocacao": resultado["alocacao"],
        }

    return {
        "original": len(exemplos),
        "aposDedup": len(dedup["mantidos"]),
        "duplicatasRemovidas": dedup["removidos"],
        "resultadosDedupPorCaso": dedup["resultadosPorCaso"],
        "totalParesForcaBruta": dedup["totalParesForcaBruta"],
        "totalCandidatosLSH": dedup["totalCandidatosLSH"],
        "final": len(atual),
        "relatorioPorCaso": relatorio_por_caso,
        "exemplosFinal": atual,
    }


# --- Testes --------------------------------------------------------------

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
    print("== Testes: MinHash - assinatura e estimativa de similaridade ==")

    dataset = gerar_dataset_simulado()
    coeficientes = gerar_coeficientes_hash(MINHASH_K, MINHASH_SEMENTE)
    por_id = {e["metadata"]["id"]: e for e in dataset}

    def teste_1():
        e = por_id["amplitude-auto-Oficina Estrela-0"]
        sig = assinatura_minhash(shingles(e["entrada"], 5), coeficientes)
        assert similaridade_minhash_estimada(sig, sig) == 1

    _testar("assinatura MinHash de texto idêntico produz similaridade estimada 1.0", teste_1)

    def teste_2():
        a = por_id["amplitude-auto-Oficina Estrela-0"]
        b = por_id["amplitude-auto-Oficina Estrela-0-reenviado"]
        sig_a = assinatura_minhash(shingles(a["entrada"], 5), coeficientes)
        sig_b = assinatura_minhash(shingles(b["entrada"], 5), coeficientes)
        estimado = similaridade_minhash_estimada(sig_a, sig_b)
        exato = similaridade_jaccard_exata(a["entrada"], b["entrada"])
        assert abs(estimado - exato) < 0.1, f"erro muito alto: exato={exato}, estimado={estimado}"

    _testar("MinHash aproxima Jaccard exato com erro menor que 0,1 pra duplicata exata", teste_2)

    def teste_3():
        a = por_id["amplitude-auto-Oficina Estrela-2"]
        b = por_id["amplitude-auto-Oficina Estrela-2-ruido-ocr"]
        sig_a = assinatura_minhash(shingles(a["entrada"], 5), coeficientes)
        sig_b = assinatura_minhash(shingles(b["entrada"], 5), coeficientes)
        estimado = similaridade_minhash_estimada(sig_a, sig_b)
        exato = similaridade_jaccard_exata(a["entrada"], b["entrada"])
        assert abs(estimado - exato) < 0.15, f"erro muito alto: exato={exato}, estimado={estimado}"

    _testar("MinHash aproxima Jaccard exato com erro menor que 0,15 pra duplicata com ruído de OCR", teste_3)

    print()
    print("== Testes: LSH banding - geração de candidatos ==")

    dedup_resultado = encontrar_quase_duplicatas_minhash_lsh(dataset)

    def teste_4():
        assert len(dedup_resultado["paresDuplicata"]) == 3

    _testar("LSH encontra exatamente os 3 pares de quase-duplicata plantados (recall perfeito)", teste_4)

    def teste_5():
        reducao = 1 - dedup_resultado["totalCandidatosLSH"] / dedup_resultado["totalParesForcaBruta"]
        assert reducao >= 0.8, f"redução de só {reducao*100:.1f}%"

    _testar("LSH reduz o número de comparações em pelo menos 80% frente à força bruta", teste_5)

    def teste_6():
        ids_duplicata = set()
        for p in dedup_resultado["paresDuplicata"]:
            ids_duplicata.add(dataset[p["i"]]["metadata"]["id"])
            ids_duplicata.add(dataset[p["j"]]["metadata"]["id"])
        ids_esperados = {
            "amplitude-auto-Oficina Estrela-0", "amplitude-auto-Oficina Estrela-0-reenviado",
            "amplitude-auto-Oficina Estrela-2", "amplitude-auto-Oficina Estrela-2-ruido-ocr",
            "amplitude-saude-empresarial-Clínica Vitalis-0", "amplitude-saude-empresarial-Clínica Vitalis-0-reenviado",
        }
        assert ids_duplicata == ids_esperados

    _testar("nenhum par não-duplicata (mesmo template, sinistro diferente) é confirmado como duplicata", teste_6)

    print()
    print("== Testes: deduplicação - pipeline completo ==")

    def teste_7():
        r = remover_quase_duplicatas(dataset)
        assert r["removidos"] == 3

    _testar("remoção de quase-duplicata tira exatamente 3 exemplos", teste_7)

    print()
    print("== Testes: amostragem por temperatura - pesos ==")

    def teste_8():
        pesos = pesos_amostragem_por_temperatura({"A": 8, "B": 2}, 1)
        assert abs(pesos["A"] - 0.8) < 1e-9
        assert abs(pesos["B"] - 0.2) < 1e-9

    _testar("alpha=1 (sem suavização) reproduz a distribuição proporcional original", teste_8)

    def teste_9():
        contagens = {"A": 8, "B": 2}
        pesos_baixo = pesos_amostragem_por_temperatura(contagens, 0.3)
        pesos_alto = pesos_amostragem_por_temperatura(contagens, 1)
        assert pesos_baixo["A"] < pesos_alto["A"]
        assert pesos_baixo["B"] > pesos_alto["B"]

    _testar("alpha menor suaviza a distribuição em direção à uniforme", teste_9)

    print()
    print("== Testes: alocação por maior resto - soma exata ==")

    def teste_10():
        pesos = {"A": 0.5, "B": 0.3, "C": 0.2}
        aloc = alocar_maior_resto(pesos, 17)
        assert sum(aloc.values()) == 17

    _testar("alocação sem restrição de capacidade soma exatamente ao alvo", teste_10)

    print()
    print("== Testes: alocação capacitada - nunca excede o disponível ==")

    contagens_auto = {"Oficina Estrela": 14, "Auto Center Silva": 5, "Funilaria Rio Bonito": 4, "Oficina Nova Aliança": 3}

    def teste_11():
        for alvo in [26, 22, 20, 18]:
            aloc = alocar_com_capacidade(contagens_auto, ALPHA_TEMPERATURA, alvo)
            for f in aloc:
                assert aloc[f] <= contagens_auto[f], f"{f}: alocado {aloc[f]} > capacidade {contagens_auto[f]}"

    _testar("alocação capacitada nunca aloca mais que a capacidade real de nenhuma fonte", teste_11)

    def teste_12():
        for alvo in [26, 22, 20, 18]:
            aloc = alocar_com_capacidade(contagens_auto, ALPHA_TEMPERATURA, alvo)
            assert sum(aloc.values()) == alvo

    _testar("alocação capacitada soma exatamente ao alvo em todos os casos testados", teste_12)

    print()
    print("== Testes: diversidade - entropia e número efetivo de fontes ==")

    def teste_13():
        dist = {"A": 0.25, "B": 0.25, "C": 0.25, "D": 0.25}
        assert abs(numero_efetivo_fontes(dist) - 4) < 1e-9

    _testar("distribuição uniforme entre N fontes tem número efetivo de fontes = N", teste_13)

    def teste_14():
        dist = {"A": 1.0, "B": 0, "C": 0}
        assert abs(entropia_shannon(dist)) < 1e-9
        assert abs(numero_efetivo_fontes(dist) - 1) < 1e-9

    _testar("uma única fonte concentrando tudo tem entropia zero e número efetivo 1", teste_14)

    def teste_15():
        contagens = {"A": 14, "B": 5, "C": 4, "D": 3}
        h_alto = entropia_shannon(pesos_amostragem_por_temperatura(contagens, 1.0))
        h_baixo = entropia_shannon(pesos_amostragem_por_temperatura(contagens, 0.3))
        assert h_baixo > h_alto

    _testar("suavizar com alpha menor aumenta a entropia (nunca diminui)", teste_15)

    print()
    print("== Testes: pipeline completo ponta a ponta ==")

    def teste_16():
        resultado = limpar_e_balancear(
            dataset, alvos={"amplitude-auto": 20, "amplitude-saude-empresarial": 14}
        )
        assert resultado["duplicatasRemovidas"] == 3
        assert resultado["final"] < resultado["original"]
        r_auto = resultado["relatorioPorCaso"]["amplitude-auto"]
        r_saude = resultado["relatorioPorCaso"]["amplitude-saude-empresarial"]
        assert r_auto["nEfetivoDepois"] > r_auto["nEfetivoAntes"]
        assert r_saude["nEfetivoDepois"] > r_saude["nEfetivoAntes"]
        assert any(e["metadata"]["caso"] == "amplitude-auto" for e in resultado["exemplosFinal"])
        assert any(e["metadata"]["caso"] == "amplitude-saude-empresarial" for e in resultado["exemplosFinal"])

    _testar("pipeline completo produz dataset final menor que o original, com diversidade maior", teste_16)

    print()
    print(f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), {_testes_com_falha} falhou(falharam).")

    if _testes_com_falha > 0:
        raise RuntimeError(f"{_testes_com_falha} teste(s) falharam. A implementação não bate com a especificação.")

    return dataset


def _fmt_pct(p):
    return f"{p*100:.1f}%"


def rodar_demo(dataset):
    print()
    print("===== Demo: MinHash+LSH, amostragem por temperatura, e diversidade formal =====")

    dedup = encontrar_quase_duplicatas_minhash_lsh(dataset)
    print(f"\nDataset simulado: {len(dataset)} exemplos.\n")
    print("--- Deduplicação (MinHash k=32 + LSH banding b=8,r=4) ---")
    for caso, r in dedup["resultadosPorCaso"].items():
        print(
            f"{caso}: {r['itensNoCaso']} exemplos, {r['paresForcaBruta']} pares força-bruta -> "
            f"{r['candidatosLSH']} candidatos LSH (redução de {r['reducaoPercentual']:.1f}%), "
            f"{r['duplicatasConfirmadas']} duplicata(s) confirmada(s) após refino exato."
        )
    print(f"\nTotal geral: {dedup['totalParesForcaBruta']} pares força-bruta -> {dedup['totalCandidatosLSH']} candidatos LSH.")

    resultado = limpar_e_balancear(dataset, alvos={"amplitude-auto": 20, "amplitude-saude-empresarial": 14})

    print(f"\n--- Pipeline: {resultado['original']} -> {resultado['aposDedup']} (dedup) -> {resultado['final']} (balanceado por temperatura, alpha={ALPHA_TEMPERATURA}) ---")

    for caso, r in resultado["relatorioPorCaso"].items():
        print(f"\n--- {caso} ---")
        print("  Antes:", ", ".join(f"{f}={n} ({_fmt_pct(r['distAntes'][f])})" for f, n in r["contagensAntes"].items()))
        print(f"  Entropia antes: {r['entropiaAntes']:.4f} nats | Número efetivo de fontes: {r['nEfetivoAntes']:.3f} (de {len(r['contagensAntes'])} fontes reais)")
        print("  Depois:", ", ".join(f"{f}={n} ({_fmt_pct(r['distDepois'][f])})" for f, n in r["contagensDepois"].items()))
        print(f"  Entropia depois: {r['entropiaDepois']:.4f} nats | Número efetivo de fontes: {r['nEfetivoDepois']:.3f}")

    print("\n-----------------------------------------------------------------------------")
    print("MinHash+LSH reduz a busca de quase-duplicata de O(n^2) pra um número muito menor")
    print("de candidatos, sem perder nenhuma duplicata real (recall verificado nos testes).")
    print("A amostragem por temperatura (mesmo método do T5/mT5) troca corte arbitrário por")
    print("peso formal, nunca inventando exemplo além da capacidade real de cada fonte, e o")
    print("número efetivo de fontes prova, em número, que o dataset final é mais diverso.")
    print("-----------------------------------------------------------------------------")


if __name__ == "__main__":
    _dataset = rodar_testes()
    rodar_demo(_dataset)

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
