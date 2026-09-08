"""
Ahirton Lopes - Fine-Tuning Toolkit
Extra - Dataset real alternativo, parte 1/2 (companion do Modulo 3.2 em
diante, mas conceitualmente equivalente ao Modulo 2.2 - preparacao de
dataset, nao upload/job; referencia espelhada em Python)

Ferramenta: carrega o databricks-dolly-15k (real, CC-BY-SA-3.0), mapeia pro
schema canonico do Modulo 2.1 (instrucao/entrada/saida/metadata), e roda o
mesmo tipo de dedup MinHash+LSH e balanceamento por temperatura do
Modulo 2.2 contra dado real, nao sintetico. Fica fisicamente na pasta do
Modulo 3 (junto com a parte 2/2, dolly_vertex_pipeline.py, que sobe e
treina de verdade) so por conveniencia de nao espalhar o extra em duas
pastas - o conteudo em si e 100% Modulo 2.2: dedup e balanceamento, nada
de upload ou job.

Pre-requisito: baixar o dataset uma vez (13MB, ~15 mil linhas JSONL):
  curl -L "https://huggingface.co/datasets/databricks/databricks-dolly-15k/resolve/main/databricks-dolly-15k.jsonl" -o databricks-dolly-15k.jsonl

Nota de honestidade: das 8 categorias do Dolly-15k, so 3 tem o campo
"context" preenchido (closed_qa, information_extraction, summarization) -
sao as unicas com o mesmo formato "documento de entrada -> saida
especifica" que o schema canonico exige. As outras 5 (open_qa, general_qa,
classification, brainstorming, creative_writing) nao tem documento de
entrada real, entao nao servem pra esse pipeline: usar so as 3
compativeis nao e recorte arbitrario, e o que o proprio formato do dado
permite.

Segunda nota de honestidade: a funcao `encontrar_quase_duplicatas_minhash_lsh`
e `limpar_e_balancear`, importadas de dataset_cleaning_balancing_tool.py, sao
hardcoded pros dois casos desta disciplina ('amplitude-auto' e
'amplitude-saude-empresarial') - nao acionam em cima de um metadata["caso"]
novo. Balanceamento por temperatura (balancear_por_temperatura,
entropia_shannon, numero_efetivo_fontes, contar_por_fonte) ja e generico e
reusado direto daqui; dedup usa as mesmas primitivas exportadas (shingles,
assinatura_minhash, banding_lsh, similaridade_jaccard_exata), so
reimplementando o laco de orquestracao de forma generica, ~15 linhas, em
vez de patchear o arquivo original.
"""

import importlib.util
import json
import os
import sys

_AQUI = os.path.dirname(os.path.abspath(__file__))
_CAMINHO_M22 = os.path.join(_AQUI, "..", "modulo-02-preparacao-datasets", "dataset_cleaning_balancing_tool.py")
_spec = importlib.util.spec_from_file_location("dataset_cleaning_balancing_tool", _CAMINHO_M22)
m2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m2)

CATEGORIAS_COMPATIVEIS = ["information_extraction", "closed_qa", "summarization"]
CASO = "dolly-instruction-tuning"
N_SHINGLE = 5


# -----------------------------------------------------------------------
# 1. Carregar e mapear pro schema canonico
# -----------------------------------------------------------------------

def carregar_dolly(caminho_jsonl):
    with open(caminho_jsonl, encoding="utf-8") as f:
        return [json.loads(linha) for linha in f if linha.strip()]


def para_schema_canonico(registro_dolly, indice):
    """Mapeia um registro bruto do Dolly-15k pro schema canonico do Modulo 2.1."""
    return {
        "instrucao": registro_dolly["instruction"],
        "entrada": registro_dolly["context"],
        "saida": registro_dolly["response"],
        "metadata": {
            "caso": CASO,
            "fonte": registro_dolly["category"],
            "id": f"dolly-{registro_dolly['category']}-{indice}",
        },
    }


def filtrar_compativeis(registros_dolly):
    return [
        r for r in registros_dolly
        if r["category"] in CATEGORIAS_COMPATIVEIS and r.get("context", "").strip() and r.get("response", "").strip()
    ]


# -----------------------------------------------------------------------
# 2. Dedup generico via MinHash+LSH (reusa as primitivas do Modulo 2.2,
#    nao o orquestrador hardcoded pros casos Amplitude)
# -----------------------------------------------------------------------

def texto_para_dedup(exemplo):
    """Correcao 25/08 (achado de painel de avaliacao): comparar so `entrada`
    confunde pares de PERGUNTA DIFERENTE sobre o mesmo trecho de contexto
    (Jaccard=1,0 na entrada) com duplicata real. Concatenar instrucao+entrada
    corrige isso."""
    return f"{exemplo['instrucao']}\n{exemplo['entrada']}"


def dedup_generico(exemplos, n=N_SHINGLE):
    coeficientes = m2.gerar_coeficientes_hash(m2.MINHASH_K, 42)
    assinaturas = [m2.assinatura_minhash(m2.shingles(texto_para_dedup(e), n), coeficientes) for e in exemplos]
    candidatos = m2.banding_lsh(assinaturas, m2.LSH_BANDAS, m2.LSH_LINHAS)
    pares = []
    for i, j in candidatos:
        sim = m2.similaridade_jaccard_exata(texto_para_dedup(exemplos[i]), texto_para_dedup(exemplos[j]), n)
        if sim >= m2.LIMIAR_DUPLICATA:
            pares.append({"i": i, "j": j, "sim": sim})
    total_forca_bruta = len(exemplos) * (len(exemplos) - 1) // 2
    return {"total_forca_bruta": total_forca_bruta, "candidatos_lsh": len(candidatos), "pares": pares}


def preparar_dataset_completo(caminho_jsonl, alvo_total):
    """Pipeline completo de preparo (achado de painel: v1 nao exportava isso,
    entao os numeros do model card nao eram reproduziveis a partir do
    arquivo entregue). Roda dedup no dataset INTEIRO e balanceia pro alvo."""
    bruto = carregar_dolly(caminho_jsonl)
    compativeis = filtrar_compativeis(bruto)
    mapeados = [para_schema_canonico(r, i) for i, r in enumerate(compativeis)]

    dedup = dedup_generico(mapeados, N_SHINGLE)
    remover = {p["j"] for p in dedup["pares"]}
    sem_duplicatas = [e for i, e in enumerate(mapeados) if i not in remover]

    contagem = m2.contar_por_fonte(sem_duplicatas, CASO)
    alocacao = m2.alocar_com_capacidade(contagem, m2.ALPHA_TEMPERATURA, alvo_total)
    usados = {}
    balanceado = []
    for e in sem_duplicatas:
        f = e["metadata"]["fonte"]
        usados[f] = usados.get(f, 0)
        if usados[f] < alocacao[f]:
            balanceado.append(e)
            usados[f] += 1

    return {
        "bruto": bruto, "compativeis": compativeis, "mapeados": mapeados, "dedup": dedup,
        "itens_removidos": len(remover), "sem_duplicatas": sem_duplicatas,
        "contagem": contagem, "alocacao": alocacao, "balanceado": balanceado,
    }


# -----------------------------------------------------------------------
# Testes automatizados
# -----------------------------------------------------------------------

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


def rodar_testes(caminho_jsonl):
    print("== Testes: carga e mapeamento pro schema canonico ==")
    bruto = carregar_dolly(caminho_jsonl)

    _testar("dataset bruto tem 15011 registros (tamanho real confirmado do Dolly-15k)", lambda: (
        _assert(len(bruto) == 15011)
    ))

    def _checar_categorias():
        por_categoria = {}
        for r in bruto:
            d = por_categoria.setdefault(r["category"], {"total": 0, "com_contexto": 0})
            d["total"] += 1
            if r.get("context", "").strip():
                d["com_contexto"] += 1
        for cat in CATEGORIAS_COMPATIVEIS:
            _assert(por_categoria[cat]["com_contexto"] == por_categoria[cat]["total"], f"{cat} deveria ter 100% com contexto")
        for cat in por_categoria:
            if cat not in CATEGORIAS_COMPATIVEIS:
                _assert(por_categoria[cat]["com_contexto"] == 0, f"{cat} deveria ter 0% com contexto")

    _testar("so 3 das 8 categorias tem campo context preenchido", _checar_categorias)

    compativeis = filtrar_compativeis(bruto)
    _testar("filtro produz 4467 exemplos reais compativeis com o schema canonico", lambda: (
        _assert(len(compativeis) == 4467)
    ))

    mapeados = [para_schema_canonico(r, i) for i, r in enumerate(compativeis)]

    def _checar_campos():
        for e in mapeados:
            _assert(e["instrucao"] and e["entrada"] and e["saida"], "campo vazio encontrado")
            _assert(e["metadata"]["caso"] and e["metadata"]["fonte"], "metadata incompleto")

    _testar("todo exemplo mapeado tem os quatro campos do schema canonico preenchidos", _checar_campos)

    def _checar_distribuicao():
        por_fonte = {}
        for e in mapeados:
            por_fonte[e["metadata"]["fonte"]] = por_fonte.get(e["metadata"]["fonte"], 0) + 1
        _assert(por_fonte["closed_qa"] == 1773)
        _assert(por_fonte["information_extraction"] == 1506)
        _assert(por_fonte["summarization"] == 1188)

    _testar("distribuicao por fonte bate com a contagem real do dataset", _checar_distribuicao)

    print("\n== Testes: dedup generico, comparando instrucao+entrada (correcao pos-painel) ==")

    def _checar_entrada_sozinha_seria_1():
        a = next(e for e in mapeados if e["instrucao"] == "What caused the Global Financial Crises?")
        b = next(e for e in mapeados if e["instrucao"] == "What caused the 2007-2008 financial crisis?")
        _assert(m2.similaridade_jaccard_exata(a["entrada"], b["entrada"], N_SHINGLE) == 1)

    _testar("entrada sozinha teria Jaccard 1,0 (e POR ISSO que comparar so entrada e errado aqui)", _checar_entrada_sozinha_seria_1)

    def _checar_fix_funciona():
        a = next(e for e in mapeados if e["instrucao"] == "What caused the Global Financial Crises?")
        b = next(e for e in mapeados if e["instrucao"] == "What caused the 2007-2008 financial crisis?")
        _assert(m2.similaridade_jaccard_exata(texto_para_dedup(a), texto_para_dedup(b), N_SHINGLE) < 1)

    _testar("com instrucao+entrada, esse mesmo par NAO e mais Jaccard 1,0 (fix funcionando)", _checar_fix_funciona)

    print("\n== Testes: pipeline completo (dataset inteiro, nao amostra - correcao pos-painel) ==")

    completo = preparar_dataset_completo(caminho_jsonl, 200)

    _testar("roda contra os 4.467 exemplos inteiros, nao uma amostra", lambda: (
        _assert(len(completo["mapeados"]) == 4467)
    ))
    _testar("LSH reduz a busca de forca-bruta drasticamente tambem em dado real", lambda: (
        _assert(completo["dedup"]["candidatos_lsh"] < completo["dedup"]["total_forca_bruta"] * 0.01, "LSH nao reduziu o suficiente")
    ))
    _testar("dedup real encontra pelo menos 1 par genuino (mesma instrucao E mesmo contexto)", lambda: (
        _assert(len(completo["dedup"]["pares"]) > 0, "nenhuma quase-duplicata real encontrada")
    ))

    def _checar_itens_removidos():
        _assert(completo["itens_removidos"] <= len(completo["dedup"]["pares"]))
        _assert(len(completo["sem_duplicatas"]) == len(completo["mapeados"]) - completo["itens_removidos"])

    _testar("itens removidos e a contagem de indices UNICOS, nao o total de pares", _checar_itens_removidos)

    print("\n== Testes: balanceamento por temperatura (reusado sem modificacao) ==")

    _testar("alocacao final soma exatamente o alvo pedido (200)", lambda: (
        _assert(len(completo["balanceado"]) == 200)
    ))

    def _checar_capacidade():
        for fonte, n in completo["alocacao"].items():
            _assert(n <= completo["contagem"][fonte], f"{fonte} excedeu a contagem real")

    _testar("alocacao capacitada nunca excede a contagem real disponivel por fonte", _checar_capacidade)

    dist_antes = m2.distribuicao_de(completo["contagem"])
    dist_depois = m2.distribuicao_de(completo["alocacao"])
    _testar("entropia sobe depois do balanceamento, igual no dado sintetico do Modulo 2.2", lambda: (
        _assert(m2.entropia_shannon(dist_depois) >= m2.entropia_shannon(dist_antes))
    ))

    print(f"\n{_total_testes - _testes_com_falha}/{_total_testes} testes passaram.")
    return {
        "bruto": bruto, "compativeis": compativeis, "mapeados": mapeados, "completo": completo,
        "dist_antes": dist_antes, "dist_depois": dist_depois,
    }


def _assert(condicao, msg="assercao falhou"):
    if not condicao:
        raise AssertionError(msg)


# -----------------------------------------------------------------------
# Demo
# -----------------------------------------------------------------------

def rodar_demo(caminho_jsonl):
    print("===== Extra: dataset real alternativo (Dolly-15k) rodando contra o pipeline do Modulo 2.2 =====\n")
    r = rodar_testes(caminho_jsonl)
    c = r["completo"]

    print("\n--- Resumo ---")
    print(f"Dataset bruto: {len(r['bruto'])} exemplos reais (databricks-dolly-15k, CC-BY-SA-3.0)")
    print(f"Compativeis com o schema canonico (tem contexto real): {len(r['compativeis'])}")
    print(f"Distribuicao por fonte antes do dedup: {m2.contar_por_fonte(r['mapeados'], CASO)}")
    print(f"Dedup no dataset INTEIRO (comparando instrucao+entrada): {c['dedup']['candidatos_lsh']} candidatos LSH de {c['dedup']['total_forca_bruta']} pares forca-bruta, {len(c['dedup']['pares'])} pares confirmados, {c['itens_removidos']} itens unicos removidos -> {len(c['sem_duplicatas'])} restantes")
    print(f"Balanceado pro alvo: {c['alocacao']}, total {len(c['balanceado'])}")
    ha = m2.entropia_shannon(r["dist_antes"])
    hd = m2.entropia_shannon(r["dist_depois"])
    print(f"Entropia antes/depois do balanceamento: {ha:.4f} -> {hd:.4f} nats")
    print(
        "\nCorrecao pos-painel de avaliacao (25/08): a v1 deste arquivo comparava so `entrada` no "
        "dedup, o que confundia pares de PERGUNTA DIFERENTE sobre o MESMO trecho de contexto "
        "(Jaccard=1,0 na entrada) com duplicata real. Comparar instrucao+entrada corrige isso."
    )


if __name__ == "__main__":
    caminho = sys.argv[1] if len(sys.argv) > 1 else os.path.join(_AQUI, "databricks-dolly-15k.jsonl")
    if not os.path.exists(caminho):
        print(f"Arquivo nao encontrado: {caminho}", file=sys.stderr)
        print(
            'Baixe primeiro: curl -L "https://huggingface.co/datasets/databricks/databricks-dolly-15k/resolve/main/databricks-dolly-15k.jsonl" -o databricks-dolly-15k.jsonl',
            file=sys.stderr,
        )
        sys.exit(1)
    rodar_demo(caminho)

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
