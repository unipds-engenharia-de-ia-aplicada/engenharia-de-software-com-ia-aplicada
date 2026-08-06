"""
Ahirton Lopes · AI Architecture Toolkit
Artefato de Demo - Módulo 5.1

Protótipo: Eval Gate de modelo — antes de promover um candidato pra processar
tráfego real, roda ele contra um golden set (perguntas com cláusula esperada
conhecida) e só promove se o score médio não regredir contra o baseline atual
além de uma tolerância. Mesmo espírito do canary do KServe (Módulo 5.1, slide
"Kubernetes: Escalar Sem Recriar") — só que o canary avisa DEPOIS que a versão
nova já está em produção recebendo tráfego real; o eval gate avisa ANTES de
promover, contra um conjunto de perguntas conhecidas.

Versão em Python do mesmo exemplo de model-eval-gate-prototype.js (material de
referência, mesma disciplina do resto do curso).

Modelos: Ollama local, gratuito, sem chave de API.
  - nomic-embed-text: embeddings reais.
  - gemma4:e2b: baseline — o Tier 1 já em uso desde o Módulo 4.5.
  - gemma4:e2b-mlx: candidato — variante MLX real e diferente do mesmo
    modelo, não fabricada; ambos já estão puxados localmente.

Requer: 1) ollama pull nomic-embed-text && ollama pull gemma4:e2b && ollama pull gemma4:e2b-mlx
        2) pip install ollama
Uso:    python model_eval_gate_prototype.py
"""

import math

from ollama import chat, embed

MODELO_EMBEDDING = "nomic-embed-text"
MODELO_BASELINE = "gemma4:e2b"
MODELO_CANDIDATO = "gemma4:e2b-mlx"

# Candidato pode ficar até essa fração abaixo do baseline sem bloquear a promoção —
# tolerância, não corte exato. O Azure AI Foundry Model Router (Módulo 5.4) declara
# publicamente um modo "Balanceado" aceitando 1-2% de diferença de qualidade; num
# contexto farmacêutico regulado, faz sentido usar a ponta mais rígida dessa faixa.
TOLERANCIA_REGRESSAO = 0.02

GOLDEN_SET = [
    {
        "pergunta": "Quais são as regras de assentimento pra menores nesse estudo?",
        "clausula": (
            "Para participantes entre 12 e 17 anos, é necessário assentimento por escrito, "
            "além do consentimento do responsável legal (RDC ANVISA 466/2012, Art. 4º)."
        ),
        "fonte": "RDC ANVISA 466/2012, Art. 4º",
    },
    {
        "pergunta": "O participante pode desistir do estudo a qualquer momento?",
        "clausula": (
            "O participante pode retirar seu consentimento a qualquer momento, sem necessidade "
            "de justificativa e sem prejuízo ao seu tratamento (RDC ANVISA 466/2012, Art. 5º)."
        ),
        "fonte": "RDC ANVISA 466/2012, Art. 5º",
    },
    {
        "pergunta": "Qual é o critério de idade mínima pra participar desse estudo?",
        "clausula": (
            "A idade mínima para participação no estudo é de doze anos completos na data "
            "da assinatura do assentimento, conforme a versão vigente do protocolo aprovada "
            "pelo comitê de ética."
        ),
        "fonte": "Protocolo Clínico TrialForge, critério de inclusão nº 2",
    },
]


def embedar(texto: str) -> list:
    resposta = embed(model=MODELO_EMBEDDING, input=texto)
    return resposta.embeddings[0]


def similaridade_cosseno(a: list, b: list) -> float:
    produto = sum(x * y for x, y in zip(a, b))
    norma_a = math.sqrt(sum(x * x for x in a))
    norma_b = math.sqrt(sum(y * y for y in b))
    return produto / (norma_a * norma_b)


def gerar_resposta(modelo: str, pergunta: str, clausula: str, fonte: str) -> str:
    resposta = chat(
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
                    f"Pergunta: {pergunta}\n\nCláusula regulatória relevante: {clausula}\nFonte: {fonte}\n\n"
                    "Responda usando essa cláusula."
                ),
            },
        ],
    )
    return resposta.message.content


# Simula um candidato REGREDIDO por bug de config, não por modelo pior — ver
# comentário equivalente na versão JS.
def gerar_resposta_sem_contexto(modelo: str, pergunta: str) -> str:
    resposta = chat(
        model=modelo,
        messages=[
            {"role": "system", "content": "Você redige respostas curtas e precisas sobre regras de estudos clínicos."},
            {"role": "user", "content": f"Pergunta: {pergunta}"},
        ],
    )
    return resposta.message.content


def avaliar_candidato(modelo: str, golden_set: list) -> float:
    soma_scores = 0.0
    for item in golden_set:
        texto = gerar_resposta(modelo, item["pergunta"], item["clausula"], item["fonte"])
        emb_resposta = embedar(texto)
        emb_clausula = embedar(item["clausula"])
        score = similaridade_cosseno(emb_resposta, emb_clausula)
        soma_scores += score
        print(f'  [Eval] "{item["pergunta"][:55]}..." -> score {score:.3f}')
    return soma_scores / len(golden_set)


def avaliar_candidato_sem_contexto(modelo: str, golden_set: list) -> float:
    soma_scores = 0.0
    for item in golden_set:
        texto = gerar_resposta_sem_contexto(modelo, item["pergunta"])
        emb_resposta = embedar(texto)
        emb_clausula = embedar(item["clausula"])
        score = similaridade_cosseno(emb_resposta, emb_clausula)
        soma_scores += score
        print(f'  [Eval] "{item["pergunta"][:55]}..." -> score {score:.3f}')
    return soma_scores / len(golden_set)


def main():
    print(f"\n[Eval Gate] Avaliando BASELINE ({MODELO_BASELINE}) contra golden set de {len(GOLDEN_SET)} perguntas...")
    score_baseline = avaliar_candidato(MODELO_BASELINE, GOLDEN_SET)
    print(f"[Eval Gate] Baseline: score médio {score_baseline:.3f}")

    print("\n== Cenário 1: candidato real (variante MLX do mesmo modelo) ==")
    print(f"[Eval Gate] Avaliando CANDIDATO ({MODELO_CANDIDATO}) contra o mesmo golden set...")
    score_candidato1 = avaliar_candidato(MODELO_CANDIDATO, GOLDEN_SET)
    print(f"[Eval Gate] Candidato: score médio {score_candidato1:.3f}")
    diferenca1 = score_candidato1 - score_baseline
    promove1 = diferenca1 >= -TOLERANCIA_REGRESSAO
    print(f"[Eval Gate] Diferença: {'+' if diferenca1 >= 0 else ''}{diferenca1:.3f} | Tolerância: -{TOLERANCIA_REGRESSAO}")
    print(
        f'[Eval Gate] Decisão: {"PROMOVE" if promove1 else "BLOQUEIA"} — caso limite, dois modelos reais e '
        "parecidos; pode mudar entre execuções por variância do próprio modelo, por isso a decisão nunca "
        "deve ser no olho, sempre pelo gate."
    )

    print("\n== Cenário 2: candidato regredido por config, não por modelo pior ==")
    print(f"[Eval Gate] Avaliando {MODELO_BASELINE} SEM a cláusula no contexto (simula bug de RAG/config, mesmo modelo)...")
    score_candidato2 = avaliar_candidato_sem_contexto(MODELO_BASELINE, GOLDEN_SET)
    print(f"[Eval Gate] Candidato regredido: score médio {score_candidato2:.3f}")
    diferenca2 = score_candidato2 - score_baseline
    promove2 = diferenca2 >= -TOLERANCIA_REGRESSAO
    print(f"[Eval Gate] Diferença: {'+' if diferenca2 >= 0 else ''}{diferenca2:.3f} | Tolerância: -{TOLERANCIA_REGRESSAO}")
    print(
        f'[Eval Gate] Decisão: {"PROMOVE" if promove2 else "BLOQUEIA"} — mesmo modelo, contexto perdido; '
        "o gate pega uma regressão de config que nenhuma troca de modelo causou."
    )

    return {
        "score_baseline": score_baseline,
        "score_candidato1": score_candidato1,
        "promove1": promove1,
        "score_candidato2": score_candidato2,
        "promove2": promove2,
    }


if __name__ == "__main__":
    main()

# Ahirton Lopes · AI Architecture Toolkit — UNIPDS: Arquitetura de Sistemas com IA
# Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager
