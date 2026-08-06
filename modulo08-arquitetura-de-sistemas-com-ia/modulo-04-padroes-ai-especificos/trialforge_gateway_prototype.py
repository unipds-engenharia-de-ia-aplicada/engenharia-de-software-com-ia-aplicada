"""
Ahirton Lopes · AI Architecture Toolkit
Artefato de Demo - Módulo 4.5

Protótipo: Gateway do TrialForge combinando os 4 grupos de padrão do Módulo 4 —
RAG completo: Multi-Index + Hybrid Search + Agentic RAG (4.1), Intent-Based Routing
+ Model Router (4.2), Semantic Cache + Response Streaming (4.3), Confidence Threshold
+ Approval Gate + Audit Trail (4.4). O RAG usa três índices reais (um por domínio de
agente do TrialForge: ICF, Protocolo, CSR), busca híbrida (BM25 léxico + embedding
denso, fundidos por posição de rank via Reciprocal Rank Fusion) e um loop agente que
amplia a estratégia de busca até 3 vezes antes de desistir e escalar pro Approval Gate.
Indexação (embeddings + estatísticas BM25 do corpus) roda uma vez, na inicialização —
nunca de novo a cada busca — a mesma separação que a anatomia do Basic RAG (Módulo 4.1)
já ensina entre a fase de indexação e a fase de retrieval.

Versão em Python do mesmo exemplo de trialforge-gateway-prototype.js (a Missão
Prática #04 pede o protótipo em JavaScript, conforme a ementa — esta versão em
Python é material de referência).

Modelos: Ollama local, gratuito, sem chave de API, sem cartão.
  - nomic-embed-text: embeddings REAIS para Semantic Cache e para o score de
    confiança da busca de cláusula — não é heurística de palavra-chave.
  - gemma4:e2b    (~7.2GB): modelo "barato" — consulta de rotina.
  - gemma4:latest  (~9.6GB): modelo "caro"   — síntese que vira documento oficial.

Requer: 1) ollama pull nomic-embed-text && ollama pull gemma4:e2b && ollama pull gemma4
        2) pip install ollama
Uso:    python trialforge_gateway_prototype.py
"""

import concurrent.futures
import json
import math
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone

from ollama import chat, embed

MODELO_BARATO = "gemma4:e2b"
MODELO_CARO = "gemma4:latest"
MODELO_EMBEDDING = "nomic-embed-text"

# Os dois limiares abaixo foram calibrados testando de verdade contra o
# nomic-embed-text em perguntas curtas em português (Módulo 4.3: "não existe
# limiar universal, se calibra por tipo de pergunta"). Nesse par modelo+idioma,
# paráfrases próximas reaproveitando termos do domínio ficaram em ~0.82 de
# similaridade, enquanto perguntas de tema totalmente diferente ficaram em
# ~0.64-0.65 — o corte abaixo fica no meio desse intervalo, não é um valor
# padrão de mercado.
LIMIAR_CACHE = 0.75  # Semantic Cache (Módulo 4.3): acima disso, é "a mesma pergunta"
LIMIAR_CONFIANCA = 0.7  # Confidence Threshold (Módulo 4.4): abaixo disso, escala pro Approval Gate
TRILHA_AUDITORIA = os.path.join(os.path.dirname(__file__), "audit-trail.jsonl")

# Multi-Index (Módulo 4.1): um índice por domínio de agente — ICF, Protocolo, CSR —
# em vez de um banco único e achatado. Cada domínio tem vocabulário e fonte regulatória
# próprios (Módulo 3.1: é o mesmo motivo que justifica agentes especialistas), então
# misturar os três num índice só só adicionaria ruído de recuperação sem necessidade.
INDICES = {
    "icf": [
        {
            "tema": "Assentimento de menores de idade em estudos clínicos",
            "texto": (
                "Para participantes entre 12 e 17 anos, é necessário assentimento por escrito, "
                "além do consentimento do responsável legal (RDC ANVISA 466/2012, Art. 4º)."
            ),
            "fonte": "RDC ANVISA 466/2012, Art. 4º",
        },
        {
            "tema": "Direito de retirada do participante do estudo a qualquer momento",
            "texto": (
                "O participante pode retirar seu consentimento a qualquer momento, sem necessidade "
                "de justificativa e sem prejuízo ao seu tratamento (RDC ANVISA 466/2012, Art. 5º)."
            ),
            "fonte": "RDC ANVISA 466/2012, Art. 5º",
        },
    ],
    # "doze anos" aqui é o mesmo número da emenda ética do Módulo 3.4/3.5 (idade
    # mínima 13 → 12) — o mesmo critério de protocolo revisitado em outra camada.
    "protocolo": [
        {
            "tema": "Critério de idade mínima para inclusão no estudo",
            "texto": (
                "A idade mínima para participação no estudo é de doze anos completos na data "
                "da assinatura do assentimento, conforme a versão vigente do protocolo aprovada "
                "pelo comitê de ética."
            ),
            "fonte": "Protocolo Clínico TrialForge, critério de inclusão nº 2",
        },
        {
            "tema": "Critério de exclusão por interação medicamentosa",
            "texto": (
                "Participantes em uso concomitante de medicação com interação farmacológica "
                "documentada são excluídos do estudo, conforme a seção 4.2 do protocolo."
            ),
            "fonte": "Protocolo Clínico TrialForge, critério de exclusão nº 4",
        },
    ],
    "csr": [
        {
            "tema": "Apresentação de eventos adversos no relatório final",
            "texto": (
                "Eventos adversos devem ser apresentados por gravidade e causalidade, seguindo "
                "a estrutura de seções do guia ICH E3, sem agregação que oculte eventos "
                "individuais graves."
            ),
            "fonte": "ICH E3, seção 12",
        },
        {
            "tema": "Significância estatística do desfecho primário",
            "texto": (
                "O desfecho primário só pode ser reportado como positivo se atingir o nível de "
                "significância pré-especificado no plano de análise estatística, sem ajuste "
                "post-hoc."
            ),
            "fonte": "ICH E3, seção 11; Plano de Análise Estatística do estudo",
        },
    ],
}

# Roteamento pro índice certo (Módulo 4.1) reaproveita a mesma classificação de
# intenção que já decide o Model Router (Módulo 4.2) — a pergunta já diz o domínio.
INDICE_POR_INTENCAO = {
    "consulta_icf": "icf",
    "consulta_protocolo": "protocolo",
    "sintese_csr": "csr",
}

cache_semantico = []  # [{"pergunta": str, "embedding": list[float], "resposta": str}]


# ---------- Retry com limite + timeout real (mesmo padrão do Módulo 3.5) ----------
# Falha transitória de rede ou de modelo não deveria derrubar a requisição inteira — o
# Supervisor do Módulo 3.5 já resolveu isso com timeout real + retry com limite; aqui é a
# mesma receita aplicada às duas chamadas ao Ollama (embedding e geração), que antes não
# tinham nenhuma proteção contra travamento ou instabilidade momentânea do modelo local.
# Adaptado pra chamada síncrona (a versão JS usa Promise.race, aqui não há asyncio): roda
# a chamada numa thread separada e usa .result(timeout=...) como temporizador — mesma
# ideia, sem reescrever o arquivo inteiro em async. Limitação honesta do Python síncrono:
# se a chamada travar de verdade, não dá pra matar a thread à força, ela só termina
# sozinha quando o Ollama eventualmente responder (ou nunca) — o timeout aqui desiste de
# ESPERAR a resposta, não cancela a chamada em si.
MAX_TENTATIVAS_OLLAMA = 3
TIMEOUT_OLLAMA_S = 20


class ErroDeTimeoutOllama(Exception):
    def __init__(self, operacao, timeout_s):
        super().__init__(f"{operacao}: timeout de {timeout_s}s excedido — Ollama não respondeu a tempo.")


def com_retry(funcao, operacao):
    ultimo_erro = None
    for tentativa in range(1, MAX_TENTATIVAS_OLLAMA + 1):
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            futuro = executor.submit(funcao)
            try:
                return futuro.result(timeout=TIMEOUT_OLLAMA_S)
            except concurrent.futures.TimeoutError:
                ultimo_erro = ErroDeTimeoutOllama(operacao, TIMEOUT_OLLAMA_S)
            except Exception as erro:  # qualquer falha do Ollama entra no mesmo retry
                ultimo_erro = erro
        print(f"[Retry] {operacao} falhou na tentativa {tentativa}/{MAX_TENTATIVAS_OLLAMA}: {ultimo_erro}")
    raise RuntimeError(f"{operacao} falhou após {MAX_TENTATIVAS_OLLAMA} tentativas: {ultimo_erro}")


# ---------- Embeddings reais (base de Semantic Cache e de confiança do RAG) ----------


def embedar(texto: str) -> list:
    resposta = com_retry(lambda: embed(model=MODELO_EMBEDDING, input=texto), "Embedding")
    return resposta.embeddings[0]


def similaridade_cosseno(a: list, b: list) -> float:
    produto = sum(x * y for x, y in zip(a, b))
    norma_a = math.sqrt(sum(x * x for x in a))
    norma_b = math.sqrt(sum(y * y for y in b))
    return produto / (norma_a * norma_b)


# ---------- Semantic Cache (Módulo 4.3) ----------


def consultar_cache(pergunta_embedding: list) -> dict:
    melhor = {"similaridade": 0.0, "entrada": None}
    for entrada in cache_semantico:
        sim = similaridade_cosseno(pergunta_embedding, entrada["embedding"])
        if sim > melhor["similaridade"]:
            melhor = {"similaridade": sim, "entrada": entrada}
    return melhor


# ---------- Intent-Based Routing (Módulo 4.2) ----------
# Classificador de regra determinística — a ponta mais simples da escada descrita
# no 4.2, suficiente pra separar os únicos 2 fluxos que pedem tratamento diferente aqui.


def classificar_intencao(pergunta: str) -> str:
    p = pergunta.lower()
    if "csr" in p or "relatório final" in p or "síntese" in p or "evento adverso" in p or "desfecho" in p:
        return "sintese_csr"
    if "critério" in p or "inclusão" in p or "exclusão" in p or "idade mínima" in p or "protocolo" in p:
        return "consulta_protocolo"
    return "consulta_icf"


# ---------- RAG (Módulo 4.1): Multi-Index + Hybrid Search + Agentic RAG ----------
# Três mecanismos empilhados, cada um resolvendo um problema diferente do RAG básico:
#   1. Multi-Index: busca só dentro do índice do domínio certo, não no banco inteiro.
#   2. Hybrid Search: combina léxico (BM25) com denso (embedding), fundidos por RANK,
#      nunca somando os dois scores brutos direto — escalas incompatíveis (Módulo 4.1).
#   3. Agentic RAG: se a confiança fica baixa, tenta de novo com estratégia mais ampla,
#      até um limite de tentativas — mesma lógica do retry com limite do Módulo 3.5.
# As três funções de busca abaixo não fazem nenhuma chamada de rede: todo embedding do
# CORPUS já aconteceu antes, em preparar_indices() — buscar só compara vetores e tokens
# já prontos. A única chamada de rede por requisição é o embedding da PERGUNTA em si,
# feito uma vez em processar_requisicao().


def tokenizar(texto: str) -> list:
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFD", texto.lower()) if unicodedata.category(c) != "Mn"
    )
    return [t for t in re.split(r"\s+", re.sub(r"[^\w\s]", " ", sem_acento)) if t]


def construir_estatisticas_bm25(documentos: list) -> dict:
    tokens_por_doc = [tokenizar(doc) for doc in documentos]
    n = len(documentos)
    avgdl = sum(len(t) for t in tokens_por_doc) / n
    df = {}
    for tokens in tokens_por_doc:
        for termo in set(tokens):
            df[termo] = df.get(termo, 0) + 1
    return {"tokens_por_doc": tokens_por_doc, "n": n, "avgdl": avgdl, "df": df}


def score_bm25(query_tokens: list, doc_tokens: list, estatisticas: dict, k1: float = 1.5, b: float = 0.75) -> float:
    n = estatisticas["n"]
    avgdl = estatisticas["avgdl"]
    df = estatisticas["df"]
    score = 0.0
    for termo in query_tokens:
        freq_no_doc = doc_tokens.count(termo)
        if freq_no_doc == 0:
            continue
        doc_freq = df.get(termo, 0)
        idf = math.log((n - doc_freq + 0.5) / (doc_freq + 0.5) + 1)  # +1 evita idf negativo com poucos docs
        numerador = freq_no_doc * (k1 + 1)
        denominador = freq_no_doc + k1 * (1 - b + (b * len(doc_tokens)) / avgdl)
        score += idf * (numerador / denominador)
    return score


def ordenar_por_score(scores: list) -> list:
    return [idx for idx, _ in sorted(enumerate(scores), key=lambda par: par[1], reverse=True)]


def fusao_reciprocal_rank(ranking1: list, ranking2: list, k: int = 60) -> list:
    """Reciprocal Rank Fusion (Cormack, Clarke & Büttcher, SIGIR 2009): funde dois
    rankings pela POSIÇÃO de cada documento em cada um, não pelo valor do score — é
    assim que se combina BM25 (escala aberta) com cosseno (-1 a 1) sem normalizar nada."""
    scores = {}
    for ranking in (ranking1, ranking2):
        for posicao, idx in enumerate(ranking):
            scores[idx] = scores.get(idx, 0.0) + 1 / (k + posicao + 1)
    return sorted(scores.items(), key=lambda par: par[1], reverse=True)


# Indexação (Módulo 4.1): embeddings de CADA cláusula (tema e texto) e as estatísticas
# BM25 do corpus, um índice por domínio — tudo calculado uma vez só. buscar_clausula_hibrida
# nunca chama embedar() pro lado do corpus; só lê o que já está pronto aqui.
indices_preparados = None


def preparar_indices() -> dict:
    total_clausulas = sum(len(clausulas) for clausulas in INDICES.values())
    print(
        f"[Indexação] Pré-computando embeddings e estatísticas BM25 de {total_clausulas} cláusulas em "
        f"{len(INDICES)} índices — uma vez, não a cada busca..."
    )

    preparados = {}
    for nome_indice, clausulas in INDICES.items():
        estatisticas_bm25 = construir_estatisticas_bm25([c["texto"] for c in clausulas])
        embeddings_tema = [embedar(c["tema"]) for c in clausulas]
        embeddings_texto = [embedar(c["texto"]) for c in clausulas]
        preparados[nome_indice] = {
            "clausulas": clausulas,
            "estatisticas_bm25": estatisticas_bm25,
            "embeddings_tema": embeddings_tema,
            "embeddings_texto": embeddings_texto,
        }

    print("[Indexação] Concluída.\n")
    return preparados


def buscar_clausula_hibrida(pergunta: str, pergunta_embedding: list, nome_indice: str, campo_embedding: str = "tema") -> dict:
    indice = indices_preparados[nome_indice]
    clausulas = indice["clausulas"]
    estatisticas_bm25 = indice["estatisticas_bm25"]
    embeddings_corpus = indice["embeddings_tema"] if campo_embedding == "tema" else indice["embeddings_texto"]
    query_tokens = tokenizar(pergunta)

    similaridades_cosseno = [
        similaridade_cosseno(pergunta_embedding, embedding_clausula) for embedding_clausula in embeddings_corpus
    ]
    ranking_denso = ordenar_por_score(similaridades_cosseno)

    scores_bm25 = [
        score_bm25(query_tokens, estatisticas_bm25["tokens_por_doc"][idx], estatisticas_bm25)
        for idx in range(len(clausulas))
    ]
    ranking_esparso = ordenar_por_score(scores_bm25)

    fusao = fusao_reciprocal_rank(ranking_denso, ranking_esparso)
    melhor_idx, score_rrf = fusao[0]

    return {
        "indice": nome_indice,
        "clausula": clausulas[melhor_idx],
        "similaridade_cosseno": similaridades_cosseno[melhor_idx],
        "score_bm25": scores_bm25[melhor_idx],
        "score_rrf": score_rrf,
    }


def buscar_em_todos_indices(pergunta: str, pergunta_embedding: list) -> dict:
    """Último recurso do Agentic RAG: cruza TODOS os índices, não só o roteado inicialmente."""
    melhor = None
    for nome_indice in INDICES:
        resultado = buscar_clausula_hibrida(pergunta, pergunta_embedding, nome_indice, "texto")
        if melhor is None or resultado["similaridade_cosseno"] > melhor["similaridade_cosseno"]:
            melhor = resultado
    return melhor


MAX_ITERACOES_AGENTIC = 3  # mesmo limite do retry do Módulo 3.5: insistir além disso não ajuda mais


def buscar_clausula_agentica(pergunta: str, pergunta_embedding: list, nome_indice_inicial: str) -> dict:
    """Agentic RAG (Módulo 4.1): busca -> avalia confiança -> busca de novo com
    estratégia mais ampla, até MAX_ITERACOES_AGENTIC. Se nunca atingir o limiar, devolve
    o melhor achado e deixa o Confidence Threshold (Módulo 4.4) escalar pro Approval
    Gate — o RAG não decide sozinho quando desistir, só para de insistir."""
    melhor_resultado = None

    for iteracao in range(1, MAX_ITERACOES_AGENTIC + 1):
        if iteracao == 1:
            estrategia = f'índice "{nome_indice_inicial}", comparando com o tema da cláusula'
            resultado = buscar_clausula_hibrida(pergunta, pergunta_embedding, nome_indice_inicial, "tema")
        elif iteracao == 2:
            estrategia = f'índice "{nome_indice_inicial}", ampliando pro texto completo da cláusula'
            resultado = buscar_clausula_hibrida(pergunta, pergunta_embedding, nome_indice_inicial, "texto")
        else:
            estrategia = "todos os índices, cruzando domínios (último recurso)"
            resultado = buscar_em_todos_indices(pergunta, pergunta_embedding)

        print(
            f"  [Agentic RAG] Iteração {iteracao}/{MAX_ITERACOES_AGENTIC} — {estrategia} — "
            f'confiança {resultado["similaridade_cosseno"]:.3f}'
        )
        if melhor_resultado is None or resultado["similaridade_cosseno"] > melhor_resultado["similaridade_cosseno"]:
            melhor_resultado = resultado

        if resultado["similaridade_cosseno"] >= LIMIAR_CONFIANCA:
            return {**melhor_resultado, "iteracoes_usadas": iteracao, "esgotou_limite": False}

    print(
        f"  [Agentic RAG] {MAX_ITERACOES_AGENTIC} iterações esgotadas sem atingir o limiar — segue com o melhor "
        f'resultado (confiança {melhor_resultado["similaridade_cosseno"]:.3f}) e deixa o Confidence Threshold decidir.'
    )
    return {**melhor_resultado, "iteracoes_usadas": MAX_ITERACOES_AGENTIC, "esgotou_limite": True}


# ---------- Testes automatizados (funções puras, sem rede — rodam antes de tocar o Ollama) ----------
# Mesma disciplina do Módulo 1.3/2.5: o que é determinístico no nosso próprio código (o
# classificador de intenção, a matemática do cosseno) ganha teste automatizado instantâneo;
# a redação exata gerada pelo modelo não entra aqui, só a verificação de trilha mais abaixo,
# que confere as DECISÕES tomadas (roteamento/cache/gate), não o texto.


def rodar_testes_puros() -> None:
    print("== Testes: classificar_intencao + similaridade_cosseno (puros, sem rede) ==")
    passou = 0
    total = 0

    casos_intencao = [
        ("Preciso da síntese do CSR final desse estudo.", "sintese_csr"),
        ("Quero o relatório final do estudo.", "sintese_csr"),
        ("Como os eventos adversos aparecem no relatório final?", "sintese_csr"),
        ("Qual é o critério de idade mínima pra participar desse estudo?", "consulta_protocolo"),
        ("Quais são os critérios de exclusão desse protocolo?", "consulta_protocolo"),
        ("Quais são as regras de assentimento pra menores?", "consulta_icf"),
        ("Qual o prazo de armazenamento das amostras biológicas?", "consulta_icf"),
    ]
    for pergunta, esperado in casos_intencao:
        total += 1
        resultado = classificar_intencao(pergunta)
        ok = resultado == esperado
        print(f'  [{"OK" if ok else "FALHOU"}] classificar_intencao("{pergunta}") -> {resultado} (esperado {esperado})')
        if ok:
            passou += 1

    vetor_a = [1.0, 0.0, 0.0]
    vetor_b = [1.0, 0.0, 0.0]
    vetor_ortogonal = [0.0, 1.0, 0.0]
    vetor_oposto = [-1.0, 0.0, 0.0]
    casos_cosseno = [
        ("vetores idênticos", vetor_a, vetor_b, 1),
        ("vetores ortogonais", vetor_a, vetor_ortogonal, 0),
        ("vetores opostos", vetor_a, vetor_oposto, -1),
    ]
    for nome, a, b, esperado in casos_cosseno:
        total += 1
        resultado = similaridade_cosseno(a, b)
        ok = abs(resultado - esperado) < 1e-9
        print(f'  [{"OK" if ok else "FALHOU"}] similaridade_cosseno({nome}) -> {resultado:.3f} (esperado {esperado})')
        if ok:
            passou += 1

    print("\n== Testes: score_bm25 + fusao_reciprocal_rank (puros, sem rede) ==")

    corpus_teste = [
        "idade mínima de doze anos para participar do estudo",
        "consentimento do responsável legal é obrigatório",
        "retirada do participante a qualquer momento sem justificativa",
    ]
    estatisticas_teste = construir_estatisticas_bm25(corpus_teste)
    query_teste = tokenizar("qual a idade mínima exigida")
    scores_teste = [
        score_bm25(query_teste, estatisticas_teste["tokens_por_doc"][idx], estatisticas_teste)
        for idx in range(len(corpus_teste))
    ]
    vencedor_bm25 = scores_teste.index(max(scores_teste))
    total += 1
    ok_bm25 = vencedor_bm25 == 0  # único doc que compartilha "idade" e "mínima" com a query
    print(f'  [{"OK" if ok_bm25 else "FALHOU"}] score_bm25: doc sobre idade mínima vence a busca lexical (venceu doc {vencedor_bm25})')
    if ok_bm25:
        passou += 1

    # ranking1 e ranking2 concordam que o doc 0 é o melhor — sem empate, resultado não depende de estabilidade de sort
    fusao_teste = fusao_reciprocal_rank([0, 1, 2], [0, 2, 1])
    total += 1
    ok_fusao = fusao_teste[0][0] == 0
    print(f'  [{"OK" if ok_fusao else "FALHOU"}] fusao_reciprocal_rank: doc no topo dos dois rankings vence a fusão (venceu doc {fusao_teste[0][0]})')
    if ok_fusao:
        passou += 1

    print(f"Total: {total} teste(s), {passou} passou(passaram), {total - passou} falhou(falharam).\n")
    if passou != total:
        raise AssertionError(f"Testes puros falharam: {passou}/{total} — corrija antes de chamar o modelo.")


# ---------- Approval Gate + Audit Trail (Módulo 4.4) ----------


def pedir_aprovacao_humana(rascunho: str) -> bool:
    print("\n[Approval Gate] Rascunho aguardando aprovação antes de virar oficial:")
    print("   ", rascunho)
    resposta = input("\nAprovar? (s/n) ")
    return resposta.strip().lower() == "s"


def registrar_auditoria(registro: dict) -> None:
    linha = {"timestamp": datetime.now(timezone.utc).isoformat(), **registro}
    with open(TRILHA_AUDITORIA, "a", encoding="utf-8") as arquivo:
        # append-only — nunca sobrescreve (21 CFR Part 11, Módulo 4.4)
        arquivo.write(json.dumps(linha, ensure_ascii=False) + "\n")


# ---------- Gateway: os 4 grupos de padrão encadeados numa requisição só ----------


proximo_id_requisicao = 1


def processar_requisicao(pergunta: str):
    global proximo_id_requisicao
    id_requisicao = f"req-{proximo_id_requisicao}"
    proximo_id_requisicao += 1
    print(f'\n[Gateway] Requisição recebida: "{pergunta}"')

    intencao = classificar_intencao(pergunta)
    print(f"[Intent-Based Routing] Intenção classificada: {intencao}")

    pergunta_embedding = embedar(pergunta)

    # Semantic Cache: só entra em perguntas de rotina — síntese de CSR nunca usa cache (Módulo 4.3)
    if intencao != "sintese_csr":
        resultado_cache = consultar_cache(pergunta_embedding)
        similaridade = resultado_cache["similaridade"]
        entrada = resultado_cache["entrada"]
        if entrada and similaridade >= LIMIAR_CACHE:
            print(
                f"[Semantic Cache] HIT (similaridade {similaridade:.3f}) — "
                "resposta reaproveitada, sem chamar o modelo."
            )
            registrar_auditoria(
                {
                    "id_requisicao": id_requisicao,
                    "pergunta": pergunta,
                    "intencao": intencao,
                    "cache_hit": True,
                    "similaridade_cache": similaridade,
                    "status_final": "respondido_via_cache",
                }
            )
            return entrada["resposta"]
        print(f"[Semantic Cache] MISS (melhor similaridade {similaridade:.3f}) — segue pro modelo.")

    # Model Router (Módulo 4.2): a intenção decide qual modelo processa
    modelo = MODELO_CARO if intencao == "sintese_csr" else MODELO_BARATO
    tipo_modelo = "caro/capaz" if modelo == MODELO_CARO else "barato/rápido"
    print(f"[Model Router] Modelo escolhido: {modelo} ({tipo_modelo})")

    # RAG (Módulo 4.1): Multi-Index roteia pro domínio certo, Hybrid Search busca dentro
    # dele (BM25 + embedding, fundidos por RRF), Agentic RAG insiste com estratégia mais
    # ampla se a confiança vier baixa — a similaridade final também vira sinal de confiança.
    indice_inicial = INDICE_POR_INTENCAO[intencao]
    print(f'[Multi-Index] Roteando pro índice "{indice_inicial}" (Módulo 4.1)')
    resultado_rag = buscar_clausula_agentica(pergunta, pergunta_embedding, indice_inicial)
    confianca = resultado_rag["similaridade_cosseno"]
    clausula = resultado_rag["clausula"]
    print(
        f'[RAG] Cláusula final: "{clausula["tema"]}" — índice "{resultado_rag["indice"]}", '
        f'cosseno {confianca:.3f}, BM25 {resultado_rag["score_bm25"]:.3f}, '
        f'RRF {resultado_rag["score_rrf"]:.4f}, {resultado_rag["iteracoes_usadas"]} iteração(ões).'
    )

    # Geração com streaming (Módulo 4.3) — token a token, não espera tudo pronto
    print("[Response Streaming] Gerando resposta:")
    print("    ", end="")
    rascunho = ""
    stream = com_retry(
        lambda: chat(
            model=modelo,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Você redige respostas curtas e precisas sobre regras de estudos clínicos, "
                        "citando a fonte regulatória fornecida."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Pergunta: {pergunta}\n\n"
                        f'Cláusula regulatória relevante: {clausula["texto"]}\nFonte: {clausula["fonte"]}\n\n'
                        "Responda usando essa cláusula."
                    ),
                },
            ],
            stream=True,
        ),
        "Geração de resposta",
    )
    for parte in stream:
        # Modelo de raciocínio: chunks de "thinking" vêm num campo separado, nunca em
        # .content — por isso só acumulamos/imprimimos .content, igual à versão JS.
        print(parte.message.content, end="")
        rascunho += parte.message.content
    print()

    # Confidence Threshold + Approval Gate (Módulo 4.4)
    precisa_aprovacao = intencao == "sintese_csr" or confianca < LIMIAR_CONFIANCA
    aprovado = True
    if precisa_aprovacao:
        motivo = (
            "síntese de CSR — erro caro e irreversível, gate sempre obrigatório (Módulo 1.3)"
            if intencao == "sintese_csr"
            else f"confiança abaixo do limiar ({confianca:.3f} < {LIMIAR_CONFIANCA})"
        )
        print(f"[Confidence Threshold] Escalando pro Approval Gate — motivo: {motivo}")
        # Registro gravado ANTES do prompt, não depois: o pedido pendente precisa sobreviver
        # independente de quando (ou se) alguém responde — se o processo caísse aqui, o
        # rascunho não desapareceria sem rastro, ficaria "aguardando_aprovacao" na trilha.
        registrar_auditoria(
            {
                "id_requisicao": id_requisicao,
                "pergunta": pergunta,
                "intencao": intencao,
                "status_final": "aguardando_aprovacao",
                "motivo_gate": motivo,
            }
        )
        aprovado = pedir_aprovacao_humana(rascunho)
    else:
        print(f"[Confidence Threshold] Confiança {confianca:.3f} acima do limiar — segue sem Approval Gate.")

    registrar_auditoria(
        {
            "id_requisicao": id_requisicao,
            "pergunta": pergunta,
            "intencao": intencao,
            "cache_hit": False,
            "modelo_usado": modelo,
            "indice_usado": resultado_rag["indice"],
            "iteracoes_agentic": resultado_rag["iteracoes_usadas"],
            "esgotou_agentic": resultado_rag["esgotou_limite"],
            "confianca_rag": confianca,
            "gate_acionado": precisa_aprovacao,
            "aprovado": aprovado,
            "status_final": "aprovado" if aprovado else "rejeitado",
        }
    )

    if not aprovado:
        print("[Approval Gate] Rascunho rejeitado — não vira oficial.")
        return None

    # Alimenta o Semantic Cache com essa pergunta+resposta pra próxima vez (só rotina)
    if intencao != "sintese_csr":
        cache_semantico.append({"pergunta": pergunta, "embedding": pergunta_embedding, "resposta": rascunho})

    print("[Gateway] Requisição concluída — trilha de auditoria registrada.")
    return rascunho


# ---------- Verificação pós-execução: a trilha de auditoria confirma os 4 caminhos ----------
# Não confia só no humano assistindo notar os 4 comportamentos — relê o artefato persistido
# (o mesmo audit-trail.jsonl que o Módulo 4.4 formaliza) e confere que cada requisição tomou
# a decisão certa. Compara DECISÕES determinísticas (cache hit/miss, modelo escolhido, gate
# acionado ou não), nunca o texto exato gerado pelo modelo, que varia entre execuções.
# Olha só as ÚLTIMAS 4 entradas, nunca apaga nem trunca o arquivo: a trilha é append-only
# de propósito (21 CFR Part 11, Módulo 4.4), inclusive entre execuções repetidas do demo.
def verificar_trilha_auditoria() -> None:
    with open(TRILHA_AUDITORIA, "r", encoding="utf-8") as arquivo:
        todas_linhas = [json.loads(linha) for linha in arquivo if linha.strip()]
    # "aguardando_aprovacao" é um registro de pendência, não uma decisão concluída — filtra
    # antes do [-5:], senão as 2 pendências (perguntas #3 e #4) empurram entradas concluídas
    # de verdade pra fora da janela das "últimas 5".
    linhas_concluidas = [l for l in todas_linhas if l.get("status_final") != "aguardando_aprovacao"]
    linhas = linhas_concluidas[-5:]

    print(
        f"\n== Verificação: últimas 5 requisições concluídas ({len(linhas_concluidas)} concluídas, "
        f"{len(todas_linhas)} entradas no total incluindo pendências) =="
    )

    def campo(indice, chave, default=None):
        return linhas[indice].get(chave, default) if indice < len(linhas) else default

    checagens = [
        ("pelo menos 5 requisições concluídas na trilha", len(linhas_concluidas) >= 5),
        (
            'ao menos 1 registro "aguardando_aprovacao" gravado antes de qualquer decisão',
            any(l.get("status_final") == "aguardando_aprovacao" for l in todas_linhas),
        ),
        ("#1 rotina: sem cache hit", campo(0, "cache_hit") is False),
        ("#1 rotina: confiança alta, sem Approval Gate", campo(0, "gate_acionado") is False),
        ("#2 paráfrase: cache HIT", campo(1, "cache_hit") is True and campo(1, "status_final") == "respondido_via_cache"),
        ("#3 síntese de CSR: modelo caro", campo(2, "modelo_usado") == MODELO_CARO),
        ("#3 síntese de CSR: Approval Gate sempre acionado", campo(2, "gate_acionado") is True),
        ("#3 síntese de CSR: Multi-Index roteou pro índice csr", campo(2, "indice_usado") == "csr"),
        ("#4 tema diferente: cache miss", campo(3, "cache_hit") is False),
        (
            "#4 tema diferente: Agentic RAG esgotou as 3 iterações",
            campo(3, "iteracoes_agentic") == MAX_ITERACOES_AGENTIC and campo(3, "esgotou_agentic") is True,
        ),
        (
            "#4 tema diferente: Approval Gate por confiança baixa",
            campo(3, "gate_acionado") is True
            and campo(3, "confianca_rag") is not None
            and campo(3, "confianca_rag") < LIMIAR_CONFIANCA,
        ),
        ("#5 critério de protocolo: Multi-Index roteou pro índice protocolo", campo(4, "indice_usado") == "protocolo"),
        ("#5 critério de protocolo: Agentic RAG confiante já na 1ª iteração", campo(4, "iteracoes_agentic") == 1),
        ("#5 critério de protocolo: sem Approval Gate", campo(4, "gate_acionado") is False),
    ]

    passou = 0
    for descricao, ok in checagens:
        print(f"  [{'OK' if ok else 'FALHOU'}] {descricao}")
        if ok:
            passou += 1
    print(f"Total: {len(checagens)} verificação(ões), {passou} passou(passaram), {len(checagens) - passou} falhou(falharam).")

    if passou != len(checagens):
        raise AssertionError(
            f"A trilha de auditoria não confirma os 4 caminhos esperados ({passou}/{len(checagens)}) — "
            "reveja audit-trail.jsonl."
        )


def main():
    global indices_preparados
    rodar_testes_puros()

    indices_preparados = preparar_indices()

    # 1) Pergunta de rotina — gera de verdade, depois popula o Semantic Cache
    processar_requisicao("Quais são as regras de assentimento pra menores nesse estudo?")

    # 2) Paráfrase da pergunta 1, reaproveitando os termos do domínio — deve bater no Semantic Cache
    processar_requisicao("O assentimento dos menores de idade é obrigatório nesse estudo?")

    # 3) Síntese de CSR — sempre modelo caro + sempre Approval Gate, nunca cache
    processar_requisicao("Preciso da síntese do CSR final desse estudo.")

    # 4) Pergunta de tema bem diferente de qualquer índice — nenhuma das 3 iterações do
    # Agentic RAG encontra confiança suficiente (nem ampliando o índice, nem cruzando os
    # 3 domínios), então esgota o limite e o Confidence Threshold escala pro Approval Gate
    processar_requisicao("Qual o prazo de armazenamento das amostras biológicas coletadas nesse estudo?")

    # 5) Pergunta sobre critério de protocolo — Multi-Index roteia pro índice "protocolo"
    # (não "icf"), e Hybrid Search acha a cláusula com confiança já na 1ª iteração: BM25
    # casa "idade mínima" literalmente, cosseno concorda — RRF fecha os dois sem empate
    processar_requisicao("Qual é o critério de idade mínima pra participar desse estudo?")

    verificar_trilha_auditoria()


if __name__ == "__main__":
    try:
        main()
    except Exception as erro:  # noqa: BLE001 — ponto único de escalonamento, não silencioso
        print("[Erro não tratado]", str(erro))
        registrar_auditoria({"erro": str(erro), "status_final": "falha_tecnica"})
        sys.exit(1)

# Nota sobre Prompt Cache (Módulo 4.3) e provedores pagos:
# Prompt Cache (Anthropic/OpenAI) é um recurso do lado do PROVEDOR — você marca o
# prefixo repetido (system prompt, documento longo) e a própria API cacheia isso
# entre chamadas. Rodando local via Ollama não existe cobrança por token pra
# caching, então esse padrão específico não se demonstra aqui — ele é real e
# documentado (Módulo 4.3), só não se aplica da mesma forma a inferência local.
# Model Router, Semantic Cache, Confidence Threshold e Audit Trail continuam
# idênticos trocando chat()/embed() pela chamada equivalente da Claude API,
# Gemini API ou OpenAI API — é a mesma lição do Módulo 1.2: o modelo é a única
# peça que se troca.
#
# Ahirton Lopes · AI Architecture Toolkit — UNIPDS: Arquitetura de Sistemas com IA
# Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager
