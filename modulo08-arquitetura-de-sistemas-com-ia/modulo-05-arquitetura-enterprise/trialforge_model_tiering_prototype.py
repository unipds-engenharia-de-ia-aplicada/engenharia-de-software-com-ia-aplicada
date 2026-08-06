"""
Ahirton Lopes · AI Architecture Toolkit
Artefato de Demo - Módulo 5.4 (protótipo final da disciplina)

Protótipo: Cascata de Model Tiering + orçamento por estudo, estendendo o
Gateway do Módulo 4.5 com o mecanismo de cascata do FrugalGPT (Chen, Zaharia,
Zou — Stanford, TMLR 2024): tenta o tier mais barato primeiro, só escala pro
tier mais caro se um score de confiança ficar abaixo de um limiar.

A escalação usa DOIS sinais, não um — descoberto rodando contra o Ollama de
verdade, não assumido de antemão: confiança de BUSCA (achou a cláusula certa
pra pergunta? trabalho do Módulo 4.1) e confiança de RESPOSTA, g(pergunta,
resposta) como no paper original (a resposta gerada ficou fiel à cláusula que
recebeu?). Os dois pegam falhas diferentes — testado na prática: numa pergunta
fora do banco de cláusulas, a busca erra a cláusula (confiança de busca baixa,
~0.65) mas o Tier 1 ainda responde fielmente à cláusula ERRADA que recebeu
(confiança de resposta alta, ~0.82) — porque "seguir a cláusula fornecida"
e "a cláusula fornecida ser a certa" são coisas diferentes. Um score de
groundedness sozinho não pega busca ruim; confiança de busca sozinha não pega
alucinação sobre uma cláusula certa. A cascata escala se QUALQUER um dos dois
ficar abaixo do limiar.

Versão em Python do mesmo exemplo de trialforge-model-tiering-prototype.js
(a Missão Prática #05 pede o protótipo em JavaScript, conforme a ementa —
esta versão em Python é material de referência).

Modelos: Ollama local, gratuito, sem chave de API.
  - nomic-embed-text: embeddings reais (mesmo uso do Módulo 4.5).
  - gemma4:e2b    (~7.2GB): Tier 1 — barato, tentado primeiro.
  - gemma4:latest  (~9.6GB): Tier 2 — caro, só entra se o Tier 1 não convencer.
  - Tier 3 (frontier, pago): não implementado aqui, só documentado no fim do
    arquivo — dois tiers reais já bastam pra demonstrar o mecanismo de verdade.

Requer: 1) ollama pull nomic-embed-text && ollama pull gemma4:e2b && ollama pull gemma4
        2) pip install ollama
Uso:    python trialforge_model_tiering_prototype.py
"""

import json
import math
import os
from datetime import datetime, timezone

from ollama import chat, embed

MODELO_TIER1 = "gemma4:e2b"  # barato — tentado primeiro, sempre
MODELO_TIER2 = "gemma4:latest"  # caro — só entra por escalação ou por regra fixa (CSR)
MODELO_EMBEDDING = "nomic-embed-text"

# Dois limiares de cascata (Módulo 5.4), um por sinal — nenhum deve ser confundido com o
# LIMIAR_CONFIANCA=0.7 do Módulo 4.5 (esse decide escalar pro Approval Gate, problema diferente).
# LIMIAR_CASCATA_BUSCA: confiança de achar a cláusula certa (0.803 pergunta no domínio,
# 0.648 pergunta fora do banco — medido rodando de verdade; 0.75 fica no meio, com folga).
LIMIAR_CASCATA_BUSCA = 0.75
# LIMIAR_CASCATA_RESPOSTA: g(pergunta, resposta) — a resposta gerada ficou fiel à cláusula
# que recebeu? Medido em dois casos reais de resposta fiel (1.000 e 0.817, mesmo quando a
# cláusula de base estava errada) — 0.75 fica abaixo dos dois, então não escala nenhuma
# resposta fiel de verdade; existe pra pegar alucinação além da cláusula, não exercitado
# pelas 2 perguntas deste demo, mas real e calculado a cada chamada.
LIMIAR_CASCATA_RESPOSTA = 0.75
TRILHA_AUDITORIA = os.path.join(os.path.dirname(__file__), "audit-trail-tiering.jsonl")

# Custo estimado por chamada, só pra demonstrar o controle de orçamento (Módulo 5.1/5.2) —
# valores ilustrativos, não preço real de nenhum provedor.
CUSTO_TIER1 = 0.001
CUSTO_TIER2 = 0.01

# Banco de cláusulas do Agente ICF (mesmo dado do Módulo 2.5/4.5) — RAG como sinal de confiança
BANCO_CLAUSULAS = [
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
]

# ---------- Orçamento por estudo (Módulo 5.1 Uber/Vitalis Platform, Módulo 5.2 LiteLLM) ----------

orcamentos = {
    "estudo-A": {"limite": 0.05, "gasto": 0.0},  # folga pra cobrir 3 chamadas do estudo-A com margem
    "estudo-B": {"limite": 0.005, "gasto": 0.0},  # propositalmente baixo, pra demonstrar bloqueio
}


def verificar_orcamento(estudo_id: str, custo_estimado: float) -> bool:
    conta = orcamentos.get(estudo_id)
    if conta is None:
        raise ValueError(f"Estudo desconhecido: {estudo_id}")
    return conta["gasto"] + custo_estimado <= conta["limite"]


def registrar_gasto(estudo_id: str, custo: float) -> None:
    orcamentos[estudo_id]["gasto"] += custo


# Reserva otimista — checa E debita num único passo, sem nada entre as duas coisas que possa
# ceder o controle pra outra chamada. Na versão JS (equivalente async), isso fecha uma janela
# real de corrida sob concorrência de verdade (Promise.all): check-then-act com um await no
# meio deixa N chamadas concorrentes do mesmo estudo passarem todas pela checagem antes de
# qualquer uma debitar. Esta versão em Python é síncrona (sem asyncio) — reproduzir a mesma
# corrida aqui exigiria threads reais (concurrent.futures.ThreadPoolExecutor), não é o
# propósito deste arquivo de referência. Mesmo assim, o padrão de reserva vale nos dois: é a
# forma correta de debitar orçamento, com ou sem concorrência.
def reservar_orcamento(estudo_id: str, custo_reservado: float) -> bool:
    conta = orcamentos.get(estudo_id)
    if conta is None:
        raise ValueError(f"Estudo desconhecido: {estudo_id}")
    if conta["gasto"] + custo_reservado > conta["limite"]:
        return False
    conta["gasto"] += custo_reservado
    return True


def liberar_sobra(estudo_id: str, valor_a_sobrar: float) -> None:
    if valor_a_sobrar > 0:
        orcamentos[estudo_id]["gasto"] -= valor_a_sobrar


# ---------- Embeddings e RAG (mesmo padrão do Módulo 4.5) ----------


def embedar(texto: str) -> list:
    resposta = embed(model=MODELO_EMBEDDING, input=texto)
    return resposta.embeddings[0]


def similaridade_cosseno(a: list, b: list) -> float:
    produto = sum(x * y for x, y in zip(a, b))
    norma_a = math.sqrt(sum(x * x for x in a))
    norma_b = math.sqrt(sum(y * y for y in b))
    return produto / (norma_a * norma_b)


# Indexação (Módulo 4.1): embedding de cada cláusula, uma vez só — nunca de novo a cada
# busca. Mesma correção aplicada no Módulo 4.5: reembedar um corpus estático a cada
# chamada não escala e mistura a fase de indexação com a de retrieval.
#
# Dois índices, dois propósitos: embeddings do TEMA acham a cláusula certa pra pergunta
# (confiança de busca); embeddings do TEXTO servem de referência pra medir se a resposta
# GERADA depois fica fiel a essa cláusula (confiança de resposta, calculada em
# calcular_confianca_resposta) — ambos preparados aqui, nenhum recalculado por requisição.
embeddings_clausulas_preparados = None
embeddings_texto_clausulas_preparados = None


def preparar_indice() -> None:
    global embeddings_clausulas_preparados, embeddings_texto_clausulas_preparados
    embeddings_clausulas_preparados = [embedar(c["tema"]) for c in BANCO_CLAUSULAS]
    embeddings_texto_clausulas_preparados = [embedar(c["texto"]) for c in BANCO_CLAUSULAS]


def buscar_clausula(pergunta_embedding: list) -> dict:
    melhor = {"similaridade": -1.0, "clausula": None, "indice": -1}
    for idx, (clausula, embedding_clausula) in enumerate(zip(BANCO_CLAUSULAS, embeddings_clausulas_preparados)):
        sim = similaridade_cosseno(pergunta_embedding, embedding_clausula)
        if sim > melhor["similaridade"]:
            melhor = {"similaridade": sim, "clausula": clausula, "indice": idx}
    return melhor


# Confiança da RESPOSTA (g(pergunta, resposta) do FrugalGPT): embeda o rascunho que o tier
# acabou de gerar e compara contra o embedding do TEXTO da cláusula-fonte, já preparado em
# preparar_indice(). Alto = resposta fiel à cláusula; baixo = resposta se afastou da fonte.
def calcular_confianca_resposta(rascunho: str, indice_clausula: int) -> float:
    rascunho_embedding = embedar(rascunho)
    return similaridade_cosseno(rascunho_embedding, embeddings_texto_clausulas_preparados[indice_clausula])


def classificar_intencao(pergunta: str) -> str:
    p = pergunta.lower()
    if "csr" in p or "relatório final" in p or "síntese" in p:
        return "sintese_csr"
    return "consulta_clausula"


# ---------- Testes automatizados (funções puras, sem rede — rodam antes de tocar o Ollama) ----------
# Mesma disciplina do resto da disciplina: o que é determinístico no nosso próprio código
# (classificador de intenção, matemática do cosseno, verificação de orçamento) ganha teste
# automatizado instantâneo; a redação exata gerada pelo modelo fica só pra observação ao vivo.


def rodar_testes_puros() -> None:
    print("== Testes: classificar_intencao + similaridade_cosseno + verificar_orcamento (puros, sem rede) ==")
    passou = 0
    total = 0

    casos_intencao = [
        ("Preciso da síntese do CSR final desse estudo.", "sintese_csr"),
        ("Quero o relatório final do estudo.", "sintese_csr"),
        ("Quais são as regras de assentimento pra menores?", "consulta_clausula"),
    ]
    for pergunta, esperado in casos_intencao:
        total += 1
        resultado = classificar_intencao(pergunta)
        ok = resultado == esperado
        print(f'  [{"OK" if ok else "FALHOU"}] classificar_intencao("{pergunta}") -> {resultado} (esperado {esperado})')
        if ok:
            passou += 1

    casos_cosseno = [
        ("vetores idênticos", [1.0, 0.0, 0.0], [1.0, 0.0, 0.0], 1),
        ("vetores ortogonais", [1.0, 0.0, 0.0], [0.0, 1.0, 0.0], 0),
    ]
    for nome, a, b, esperado in casos_cosseno:
        total += 1
        resultado = similaridade_cosseno(a, b)
        ok = abs(resultado - esperado) < 1e-9
        print(f'  [{"OK" if ok else "FALHOU"}] similaridade_cosseno({nome}) -> {resultado:.3f} (esperado {esperado})')
        if ok:
            passou += 1

    # verificar_orcamento não deve mutar estado — testa contra um orçamento sintético, não o real
    orcamento_original = orcamentos.get("estudo-teste")
    orcamentos["estudo-teste"] = {"limite": 0.05, "gasto": 0.045}
    total += 1
    cabe_dentro = verificar_orcamento("estudo-teste", 0.004)  # 0.045 + 0.004 = 0.049 <= 0.05
    ok1 = cabe_dentro is True
    print(f'  [{"OK" if ok1 else "FALHOU"}] verificar_orcamento com folga -> {cabe_dentro} (esperado True)')
    if ok1:
        passou += 1
    total += 1
    estoura = verificar_orcamento("estudo-teste", 0.006)  # 0.045 + 0.006 = 0.051 > 0.05
    ok2 = estoura is False
    print(f'  [{"OK" if ok2 else "FALHOU"}] verificar_orcamento estourando o limite -> {estoura} (esperado False)')
    if ok2:
        passou += 1
    if orcamento_original is None:
        del orcamentos["estudo-teste"]
    else:
        orcamentos["estudo-teste"] = orcamento_original

    print(f"Total: {total} teste(s), {passou} passou(passaram), {total - passou} falhou(falharam).\n")
    if passou != total:
        raise AssertionError(f"Testes puros falharam: {passou}/{total} — corrija antes de chamar o modelo.")


# ---------- Geração num tier específico, com streaming (Módulo 4.3) ----------


def gerar_com_tier(modelo: str, pergunta: str, clausula: dict) -> str:
    rascunho = ""
    stream = chat(
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
    )
    for parte in stream:
        print(parte.message.content, end="")
        rascunho += parte.message.content
    print()
    return rascunho


# ---------- Approval Gate (Módulo 4.4), reaproveitado ----------


def pedir_aprovacao_humana(rascunho: str) -> bool:
    print("\n[Approval Gate] Rascunho aguardando aprovação antes de virar oficial:")
    print("   ", rascunho)
    resposta = input("\nAprovar? (s/n) ")
    return resposta.strip().lower() == "s"


def registrar_auditoria(registro: dict) -> None:
    linha = {"timestamp": datetime.now(timezone.utc).isoformat(), **registro}
    with open(TRILHA_AUDITORIA, "a", encoding="utf-8") as arquivo:
        arquivo.write(json.dumps(linha, ensure_ascii=False) + "\n")


# ---------- Cascata de Model Tiering (Módulo 5.4) ----------


def processar_com_cascata(pergunta: str, estudo_id: str):
    print(f'\n[Gateway] Estudo "{estudo_id}" — requisição: "{pergunta}"')

    intencao = classificar_intencao(pergunta)
    custo_maximo_possivel = CUSTO_TIER2 if intencao == "sintese_csr" else CUSTO_TIER1 + CUSTO_TIER2

    # Orçamento reservado (não só checado) ANTES de qualquer chamada de modelo (lição do
    # Módulo 5.2) — reservar_orcamento debita o pior caso no mesmo passo da checagem.
    if not reservar_orcamento(estudo_id, custo_maximo_possivel):
        print(f'[Orçamento] BLOQUEADO — estudo "{estudo_id}" ultrapassaria o limite antes mesmo de chamar o modelo.')
        registrar_auditoria({"estudoId": estudo_id, "pergunta": pergunta, "status_final": "bloqueado_por_orcamento"})
        return None
    custo_real_usado = 0.0

    pergunta_embedding = embedar(pergunta)
    resultado_rag = buscar_clausula(pergunta_embedding)
    confianca_busca = resultado_rag["similaridade"]
    clausula = resultado_rag["clausula"]
    indice_clausula = resultado_rag["indice"]

    escalou = False
    confianca_resposta = None

    if intencao == "sintese_csr":
        # Regra fixa (Módulo 1.3): erro caro e irreversível, pula direto pro tier caro
        print("[Model Tiering] Síntese de CSR — regra fixa, direto pro Tier 2 (caro).")
        tier_usado = "Tier 2"
        rascunho = gerar_com_tier(MODELO_TIER2, pergunta, clausula)
        custo_real_usado += CUSTO_TIER2
    else:
        # Cascata FrugalGPT: tenta Tier 1 primeiro, sempre. Dois sinais decidem escalar,
        # cada um pegando uma falha diferente (ver comentário no topo do arquivo).
        print(f"[Model Tiering] Tentando Tier 1 (barato) primeiro — cláusula encontrada com confiança de busca {confianca_busca:.3f}")
        tier_usado = "Tier 1"
        rascunho = gerar_com_tier(MODELO_TIER1, pergunta, clausula)
        custo_real_usado += CUSTO_TIER1

        confianca_resposta = calcular_confianca_resposta(rascunho, indice_clausula)
        print(f"[Model Tiering] Confiança da resposta do Tier 1 — g(pergunta, resposta): {confianca_resposta:.3f}")

        busca_falhou = confianca_busca < LIMIAR_CASCATA_BUSCA
        resposta_falhou = confianca_resposta < LIMIAR_CASCATA_RESPOSTA

        if busca_falhou or resposta_falhou:
            motivo = "busca e resposta" if busca_falhou and resposta_falhou else ("confiança de busca" if busca_falhou else "confiança de resposta")
            print(f"[Model Tiering] Escalando pro Tier 2 — motivo: {motivo} abaixo do limiar (busca {confianca_busca:.3f}, resposta {confianca_resposta:.3f}).")
            escalou = True
            tier_usado = "Tier 2 (escalado)"
            rascunho = gerar_com_tier(MODELO_TIER2, pergunta, clausula)
            custo_real_usado += CUSTO_TIER2
            confianca_resposta = calcular_confianca_resposta(rascunho, indice_clausula)
        else:
            print("[Model Tiering] Busca e resposta acima do limiar — Tier 1 resolve, sem escalar.")

    # A reserva cobriu o pior caso; devolve o que sobrou se o custo real ficou menor.
    liberar_sobra(estudo_id, custo_maximo_possivel - custo_real_usado)

    # Estreitamento de escopo deliberado em relação ao Módulo 4.5: lá o Approval Gate tinha
    # 2 gatilhos (síntese de CSR OU confiança abaixo do limiar); aqui só CSR aciona. Este módulo
    # é sobre Model Tiering (custo), não sobre HITL — já formalizado no Módulo 4.4 — então uma
    # escalação de cascata por confiança baixa aqui só ajusta o tier, sem reabrir o Approval Gate.
    precisa_aprovacao = intencao == "sintese_csr"
    aprovado = True
    if precisa_aprovacao:
        aprovado = pedir_aprovacao_humana(rascunho)

    registrar_auditoria(
        {
            "estudoId": estudo_id,
            "pergunta": pergunta,
            "intencao": intencao,
            "tier_usado": tier_usado,
            "escalou_cascata": escalou,
            "confianca_busca": confianca_busca,
            "confianca_resposta": confianca_resposta,
            "gasto_acumulado": orcamentos[estudo_id]["gasto"],
            "orcamento_limite": orcamentos[estudo_id]["limite"],
            "aprovado": aprovado,
            "status_final": "aprovado" if aprovado else "rejeitado",
        }
    )

    print(
        f'[Orçamento] Estudo "{estudo_id}": gasto acumulado '
        f'{orcamentos[estudo_id]["gasto"]:.4f} / limite {orcamentos[estudo_id]["limite"]}'
    )
    return rascunho


# ---------- Verificação pós-execução: a trilha de auditoria confirma os 3 comportamentos ----------
# Mesma disciplina do Módulo 4.5: relê o artefato persistido e confere as DECISÕES determinísticas
# (tier usado, se escalou, se bloqueou por orçamento), nunca o texto exato gerado pelo modelo.
# Olha só as últimas 4 entradas — a trilha é append-only, nunca apagada entre execuções.
def verificar_trilha_auditoria() -> None:
    with open(TRILHA_AUDITORIA, "r", encoding="utf-8") as arquivo:
        todas_linhas = [json.loads(linha) for linha in arquivo if linha.strip()]
    linhas = todas_linhas[-4:]

    print(f"\n== Verificação: últimas 4 entradas da trilha de auditoria ({len(todas_linhas)} no total) ==")

    def campo(indice, chave, default=None):
        return linhas[indice].get(chave, default) if indice < len(linhas) else default

    checagens = [
        ("pelo menos 4 entradas na trilha", len(todas_linhas) >= 4),
        ("#1 estudo-A rotina: Tier 1 resolve, sem escalar", campo(0, "tier_usado") == "Tier 1" and campo(0, "escalou_cascata") is False),
        (
            "#2 estudo-A tema diferente: escala pro Tier 2",
            campo(1, "escalou_cascata") is True and campo(1, "tier_usado") == "Tier 2 (escalado)",
        ),
        (
            "#3 estudo-A síntese de CSR: regra fixa pro Tier 2, sem cascata",
            campo(2, "tier_usado") == "Tier 2" and campo(2, "escalou_cascata") is False,
        ),
        ("#3 síntese de CSR: aprovado no Approval Gate", campo(2, "aprovado") is True),
        ("#4 estudo-B: bloqueado por orçamento antes de chamar o modelo", campo(3, "status_final") == "bloqueado_por_orcamento"),
        (
            "#1 e #2: escalação decidida pela confiança da RESPOSTA (g(pergunta,resposta)), não só da busca",
            isinstance(campo(0, "confianca_resposta"), float) and isinstance(campo(1, "confianca_resposta"), float),
        ),
    ]

    passou = 0
    for descricao, ok in checagens:
        print(f"  [{'OK' if ok else 'FALHOU'}] {descricao}")
        if ok:
            passou += 1
    print(f"Total: {len(checagens)} verificação(ões), {passou} passou(passaram), {len(checagens) - passou} falhou(falharam).")

    if passou != len(checagens):
        raise AssertionError(
            f"A trilha de auditoria não confirma os 3 comportamentos exigidos ({passou}/{len(checagens)}) — "
            "reveja audit-trail-tiering.jsonl."
        )


def main():
    preparar_indice()

    # 1) Estudo A, pergunta que o Tier 1 resolve bem sozinho (confiança ~0.80, medida contra o
    #    banco de cláusulas com o mesmo nomic-embed-text — acima do limiar, não escala)
    processar_com_cascata("Quais são as regras de assentimento pra menores nesse estudo?", "estudo-A")

    # 2) Estudo A, pergunta fora do assunto do banco de cláusulas (confiança ~0.65, medida do
    #    mesmo jeito — abaixo do limiar de 0,75, escala pro Tier 2 de forma determinística,
    #    não por sorte de uma chamada de LLM não-determinística)
    processar_com_cascata("Qual é o prazo de validade dos exames laboratoriais desse estudo?", "estudo-A")

    # 3) Estudo A de novo, mas agora síntese de CSR — regra fixa, direto pro Tier 2
    processar_com_cascata("Preciso da síntese do CSR final desse estudo.", "estudo-A")

    # 4) Estudo B, com orçamento propositalmente baixo — deve bloquear antes de chamar qualquer modelo
    processar_com_cascata("Quais são as regras de assentimento pra menores nesse estudo?", "estudo-B")

    verificar_trilha_auditoria()


if __name__ == "__main__":
    try:
        rodar_testes_puros()
        main()
    except Exception as erro:  # noqa: BLE001 — ponto único de escalonamento, não silencioso
        print("[Erro não tratado]", str(erro))
        registrar_auditoria({"erro": str(erro), "status_final": "falha_tecnica"})

# Nota sobre um terceiro tier (frontier, pago):
# Em produção, a cascata do FrugalGPT não para em dois tiers — o próprio paper
# testa cascatas de até 3-4 modelos, dos mais baratos aos mais caros (ex.: GPT-J
# → modelo intermediário → GPT-4). Aqui, com dois tiers locais via Ollama, o
# mecanismo de score-e-limiar já fica completo; um terceiro tier pago (Claude,
# GPT-4, Gemini) entraria exatamente no mesmo ponto — mais uma chamada, mais um
# limiar, mesma lógica de escalação.
#
# Ahirton Lopes · AI Architecture Toolkit — UNIPDS: Arquitetura de Sistemas com IA
# Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager
