"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo Complementar - Modulo 2.1 (referencia espelhada em Python do .js oficial)

Ferramenta: Extracao via LLM multimodal, em oposicao ao pipeline de OCR
classico (Tesseract + regex) de extraction_to_jsonl_tool.py.

Roda de verdade: manda cada uma das 4 imagens sinteticas de
documentos-brutos/ direto pro Gemini (Vertex AI, mesmo projeto GCP dos
jobs reais de fine-tuning do Modulo 3), pedindo o JSON estruturado sem
nenhum passo de regex intermediario, e compara contra o mesmo gabarito
(`esperado`) usado no teste automatizado do pipeline de OCR.

Nao substitui o pipeline OCR ensinado no video, e um contraponto real:
mesmo dado de entrada, abordagem diferente, metricas comparaveis
(acerto por campo, latencia, uso de token) lado a lado.

Uso: python3 extracao_llm_multimodal_tool.py
Requer: gcloud autenticado (gcloud auth application-default login) com
acesso ao projeto amplitude-seguros-demo.

Nota de validade (ago/2026): este demo foi validado com gemini-2.5-flash.
O processo -- montar o payload multimodal, comparar contra o gabarito -- e
o mesmo independente da versao exata do modelo. A Google aposenta versoes
do Gemini com aviso previo (a familia 2.5 tem retirement anunciado pra
16/out/2026); antes de rodar voce mesmo, confira em
https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes
quais modelos estao disponiveis no momento e troque a constante MODELO.
"""

import base64
import json
import subprocess
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

PROJETO = "amplitude-seguros-demo"
REGIAO = "us-central1"
MODELO = "gemini-2.5-flash"

DIR_DOCUMENTOS = Path(__file__).parent / "documentos-brutos"

DOCUMENTOS = [
    {
        "arquivo": "doc-auto-1.png",
        "caso": "amplitude-auto",
        "campos": ["segurado", "placa", "valor"],
        "esperado": {"segurado": "Marcos Vinicius Andrade Pereira", "placa": "QJK-4F82", "valor": 3210.50},
    },
    {
        "arquivo": "doc-auto-2.png",
        "caso": "amplitude-auto",
        "campos": ["segurado", "placa", "valor"],
        "esperado": {"segurado": "Beatriz Nogueira Lima", "placa": "RTA-9B15", "valor": 7940.00},
    },
    {
        "arquivo": "doc-saude-1.png",
        "caso": "amplitude-saude-empresarial",
        "campos": ["beneficiario", "procedimento", "valor"],
        "esperado": {"beneficiario": "Carlos Eduardo Martins", "procedimento": "Consulta Cardiologica", "valor": 380.00},
    },
    {
        "arquivo": "doc-saude-2.png",
        "caso": "amplitude-saude-empresarial",
        "campos": ["beneficiario", "procedimento", "valor"],
        "esperado": {"beneficiario": "Fernanda Alves Costa", "procedimento": "Exame de Sangue Completo", "valor": 145.90},
    },
]

INSTRUCOES = {
    "amplitude-auto": "Extraia segurado, placa e valor do orçamento de oficina na imagem.",
    "amplitude-saude-empresarial": "Extraia beneficiário, procedimento e valor do recibo médico na imagem.",
}


# ============================================================================
# 1. Chamada real ao Gemini multimodal via Vertex AI
# ============================================================================


def obter_token_acesso():
    try:
        resultado = subprocess.run(
            ["gcloud", "auth", "print-access-token"], capture_output=True, text=True, check=True
        )
    except (subprocess.CalledProcessError, FileNotFoundError) as erro:
        raise RuntimeError(
            "Não consegui obter um token de acesso via gcloud. Rode \"gcloud auth login\" "
            f"nesta máquina antes de rodar a demo ao vivo. ({erro})"
        ) from erro
    return resultado.stdout.strip()


def normalizar(texto):
    texto = unicodedata.normalize("NFD", str(texto))
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return texto.lower().strip()


def extrair_via_llm(doc):
    caminho = DIR_DOCUMENTOS / doc["arquivo"]
    imagem_base64 = base64.b64encode(caminho.read_bytes()).decode("ascii")
    lista_campos = ", ".join(doc["campos"])

    prompt = (
        f"{INSTRUCOES[doc['caso']]} Devolva SOMENTE um JSON válido, sem markdown "
        f"e sem texto extra, com exatamente estas chaves: {lista_campos}. O campo "
        '"valor" deve ser um número (não string, sem símbolo de moeda).'
    )

    token = obter_token_acesso()
    url = (
        f"https://{REGIAO}-aiplatform.googleapis.com/v1/projects/{PROJETO}/locations/{REGIAO}"
        f"/publishers/google/models/{MODELO}:generateContent"
    )

    corpo = {
        "contents": [{
            "role": "user",
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": "image/png", "data": imagem_base64}},
            ],
        }],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
    }

    requisicao = urllib.request.Request(
        url,
        data=json.dumps(corpo).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )

    inicio = time.time()
    try:
        with urllib.request.urlopen(requisicao) as resposta:
            corpo_resposta = json.loads(resposta.read().decode("utf-8"))
    except urllib.error.HTTPError as erro:
        raise RuntimeError(f"Vertex AI retornou {erro.code}: {erro.read().decode('utf-8')}") from erro
    latencia_ms = round((time.time() - inicio) * 1000)

    texto_resposta = corpo_resposta["candidates"][0]["content"]["parts"][0]["text"]
    extraido = json.loads(texto_resposta)

    uso = corpo_resposta.get("usageMetadata", {})
    tokens_entrada = uso.get("promptTokenCount")
    tokens_saida = uso.get("candidatesTokenCount")

    return {
        "extraido": extraido,
        "latenciaMs": latencia_ms,
        "tokensEntrada": tokens_entrada,
        "tokensSaida": tokens_saida,
    }


# ============================================================================
# 2. Comparacao campo a campo contra o gabarito
# ============================================================================


def comparar_com_esperado(extraido, esperado):
    por_campo = {}
    acertos = 0
    for campo, valor_esperado in esperado.items():
        valor_extraido = extraido.get(campo)
        if isinstance(valor_esperado, (int, float)):
            bate = valor_extraido is not None and float(valor_extraido) == float(valor_esperado)
        else:
            bate = normalizar(valor_extraido or "") == normalizar(valor_esperado)
        por_campo[campo] = {"esperado": valor_esperado, "extraido": valor_extraido, "bate": bate}
        if bate:
            acertos += 1
    return {"porCampo": por_campo, "acertos": acertos, "total": len(esperado)}


# ============================================================================
# 3. Testes
# ============================================================================


def testar(descricao, fn):
    try:
        fn()
        print(f"  [OK] {descricao}")
        return True
    except AssertionError as e:
        print(f"  [FALHOU] {descricao}: {e}")
        return False


# ============================================================================
# 4. Execucao real contra os 4 documentos + comparacao lado a lado com OCR
# ============================================================================


def main():
    print("== Extração via LLM multimodal (Gemini/Vertex AI) vs. OCR clássico ==\n")

    resultados = []
    for doc in DOCUMENTOS:
        print(f"--- {doc['arquivo']} ({doc['caso']}) ---")
        chamada = extrair_via_llm(doc)
        comparacao = comparar_com_esperado(chamada["extraido"], doc["esperado"])
        resultados.append({"doc": doc, **chamada, "comparacao": comparacao})

        print(f"  extraído: {json.dumps(chamada['extraido'], ensure_ascii=False)}")
        print(f"  acerto: {comparacao['acertos']}/{comparacao['total']} campos")
        print(f"  latência: {chamada['latenciaMs']}ms · tokens entrada/saída: {chamada['tokensEntrada']}/{chamada['tokensSaida']}")
        print("")

    print("== Testes: LLM multimodal acerta o gabarito campo a campo ==")
    passaram = 0
    total_testes = 0
    for r in resultados:
        for campo, info in r["comparacao"]["porCampo"].items():
            total_testes += 1

            def checagem(info=info):
                assert info["bate"], f"extraído={info['extraido']!r}, esperado={info['esperado']!r}"

            ok = testar(f"{r['doc']['arquivo']}: campo \"{campo}\" extraído bate com o esperado", checagem)
            if ok:
                passaram += 1
    print(f"\n{passaram}/{total_testes} testes passaram.\n")

    total_acertos = sum(r["comparacao"]["acertos"] for r in resultados)
    total_campos = sum(r["comparacao"]["total"] for r in resultados)
    latencia_media = sum(r["latenciaMs"] for r in resultados) / len(resultados)
    tokens_entrada_total = sum(r["tokensEntrada"] or 0 for r in resultados)
    tokens_saida_total = sum(r["tokensSaida"] or 0 for r in resultados)

    print("== Resumo ==")
    print(f"Acerto total (LLM multimodal): {total_acertos}/{total_campos} campos ({(total_acertos / total_campos) * 100:.1f}%)")
    print(f"Latência média por documento: {latencia_media:.0f}ms")
    print(f"Tokens totais: {tokens_entrada_total} entrada + {tokens_saida_total} saída, {len(DOCUMENTOS)} chamadas")
    print("\nCompare com extraction_to_jsonl_tool.py (OCR clássico): mesmo gabarito, mesmas 4 imagens.")

    return {
        "resultados": [
            {
                "arquivo": r["doc"]["arquivo"],
                "extraido": r["extraido"],
                "acertos": r["comparacao"]["acertos"],
                "total": r["comparacao"]["total"],
                "latenciaMs": r["latenciaMs"],
                "tokensEntrada": r["tokensEntrada"],
                "tokensSaida": r["tokensSaida"],
            }
            for r in resultados
        ],
        "resumo": {
            "totalAcertos": total_acertos,
            "totalCampos": total_campos,
            "latenciaMedia": latencia_media,
            "tokensEntradaTotal": tokens_entrada_total,
            "tokensSaidaTotal": tokens_saida_total,
        },
    }


if __name__ == "__main__":
    main()

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
