"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 2.1 (referencia espelhada em Python do .js oficial)

Ferramenta: Da Extracao ao Dataset -- pipeline real de OCR + parsing +
validacao de schema, transformando documento de apoio bruto (orcamento de
oficina, recibo medico) num exemplo estruturado de treino em JSONL.

Chama o binario `tesseract` de verdade (pacote de idioma portugues) contra 4
imagens sinteticas em documentos-brutos/, cada uma com layout de campo
diferente -- prova o ponto do Modulo 1: cada oficina/clinica tem o proprio
formato, entao o parser tem que aceitar variacao de rotulo, nao so posicao
fixa de texto.

Uso: python3 extraction_to_jsonl_tool.py
Requer o binario `tesseract` instalado com o pacote de idioma `por`.

Material complementar: extracao_llm_multimodal_tool.py roda o mesmo gabarito
contra Gemini multimodal (Vertex AI), sem OCR nem regex, como contraponto
real ao pipeline abaixo. Ver ocr-vs-llm-extracao-comparativo.md pro resultado
lado a lado.
"""

import json
import re
import subprocess
import unicodedata
from pathlib import Path

DIR_DOCUMENTOS = Path(__file__).parent / "documentos-brutos"
ARQUIVO_JSONL_SAIDA = Path(__file__).parent / "dataset-amplitude-seguros.jsonl"

DOCUMENTOS = [
    {
        "arquivo": "doc-auto-1.png",
        "caso": "amplitude-auto",
        "esperado": {"segurado": "Marcos Vinicius Andrade Pereira", "placa": "QJK-4F82", "valor": 3210.50},
    },
    {
        "arquivo": "doc-auto-2.png",
        "caso": "amplitude-auto",
        "esperado": {"segurado": "Beatriz Nogueira Lima", "placa": "RTA-9B15", "valor": 7940.00},
    },
    {
        "arquivo": "doc-saude-1.png",
        "caso": "amplitude-saude-empresarial",
        "esperado": {"beneficiario": "Carlos Eduardo Martins", "procedimento": "Consulta Cardiologica", "valor": 380.00},
    },
    {
        "arquivo": "doc-saude-2.png",
        "caso": "amplitude-saude-empresarial",
        "esperado": {"beneficiario": "Fernanda Alves Costa", "procedimento": "Exame de Sangue Completo", "valor": 145.90},
    },
]

INSTRUCOES = {
    "amplitude-auto": "Extraia segurado, placa e valor do orçamento de oficina abaixo.",
    "amplitude-saude-empresarial": "Extraia beneficiário, procedimento e valor do recibo médico abaixo.",
}


# ============================================================================
# 1. OCR -- chama o binario tesseract de verdade (texto + confianca por TSV)
# ============================================================================


def ocr_texto(caminho_imagem):
    resultado = subprocess.run(
        ["tesseract", str(caminho_imagem), "stdout", "-l", "por"],
        capture_output=True, text=True, check=True,
    )
    return resultado.stdout.strip()


def ocr_confianca_media(caminho_imagem):
    resultado = subprocess.run(
        ["tesseract", str(caminho_imagem), "stdout", "-l", "por", "tsv"],
        capture_output=True, text=True, check=True,
    )
    linhas = resultado.stdout.strip().split("\n")[1:]
    confiancas = []
    for linha in linhas:
        campos = linha.split("\t")
        if len(campos) >= 12 and float(campos[10]) >= 0:
            confiancas.append(float(campos[10]) / 100)
    if not confiancas:
        return 0.0
    return sum(confiancas) / len(confiancas)


# ============================================================================
# 2. Parsing -- regex tolerante a variacao de rotulo (layout heterogeneo)
# ============================================================================


def parsear_valor_brl(texto):
    limpo = re.sub(r"[^\d.,]", "", texto).replace(".", "").replace(",", ".")
    return float(limpo)


def extrair_campo(texto, padroes):
    for padrao in padroes:
        m = re.search(padrao, texto, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


def parsear_orcamento_auto(texto_ocr):
    segurado = extrair_campo(texto_ocr, [r"(?:nome do )?segurado:?\s*(.+)"])
    placa = extrair_campo(texto_ocr, [r"placa(?:\s+do\s+ve[ií]culo)?:?\s*([A-Z0-9\-]+)"])
    valor_texto = extrair_campo(texto_ocr, [r"(?:valor total do reparo|total):?\s*r\$?\s*([\d.,]+)"])
    return {
        "segurado": segurado,
        "placa": placa,
        "valor": parsear_valor_brl(valor_texto) if valor_texto else None,
    }


def parsear_recibo_saude(texto_ocr):
    beneficiario = extrair_campo(texto_ocr, [r"(?:paciente\/)?benefici[aá]rio:?\s*(.+)"])
    procedimento = extrair_campo(texto_ocr, [r"procedimento(?:\s+realizado)?:?\s*(.+)"])
    valor_texto = extrair_campo(texto_ocr, [r"valor(?:\s+cobrado)?:?\s*r\$?\s*([\d.,]+)"])
    return {
        "beneficiario": beneficiario,
        "procedimento": procedimento,
        "valor": parsear_valor_brl(valor_texto) if valor_texto else None,
    }


# ============================================================================
# 3. Schema -- validacao do exemplo antes de aceitar no dataset
# ============================================================================

CAMPOS_OBRIGATORIOS = {
    "amplitude-auto": ["segurado", "placa", "valor"],
    "amplitude-saude-empresarial": ["beneficiario", "procedimento", "valor"],
}


def validar_exemplo(caso, saida):
    erros = []
    for campo in CAMPOS_OBRIGATORIOS[caso]:
        if not saida.get(campo):
            erros.append(f"campo obrigatório ausente: {campo}")
    valor = saida.get("valor")
    if isinstance(valor, (int, float)) and (valor != valor or valor <= 0):  # valor != valor detecta NaN
        erros.append(f"valor inválido: {valor}")
    return {"valido": len(erros) == 0, "erros": erros}


# ============================================================================
# 4. Pipeline completo: imagem -> OCR -> parse -> exemplo validado
# ============================================================================


def processar_documento(doc):
    caminho = DIR_DOCUMENTOS / doc["arquivo"]
    texto_ocr = ocr_texto(caminho)
    confianca = ocr_confianca_media(caminho)
    saida = (
        parsear_orcamento_auto(texto_ocr)
        if doc["caso"] == "amplitude-auto"
        else parsear_recibo_saude(texto_ocr)
    )
    validacao = validar_exemplo(doc["caso"], saida)

    exemplo = {
        "instrucao": INSTRUCOES[doc["caso"]],
        "entrada": texto_ocr,
        "saida": saida,
        "metadata": {
            "caso": doc["caso"],
            "arquivoFonte": doc["arquivo"],
            "confiancaOcr": round(confianca, 4),
            "valido": validacao["valido"],
        },
    }

    return {"exemplo": exemplo, "validacao": validacao, "textoOcr": texto_ocr}


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


def _normalizar(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower()


def rodar_testes():
    print("== Testes: parsing de valor em formato brasileiro ==")

    def t1():
        assert parsear_valor_brl("3.210,50") == 3210.5

    testar('"3.210,50" -> 3210.5', t1)

    def t2():
        assert parsear_valor_brl("R$ 145,90") == 145.9

    testar('"R$ 145,90" -> 145.9', t2)

    print()
    print("== Testes: OCR + parsing contra os 4 documentos reais (Tesseract de verdade) ==")

    resultados = [{"doc": doc, "resultado": processar_documento(doc)} for doc in DOCUMENTOS]

    for item in resultados:
        doc, resultado = item["doc"], item["resultado"]

        def t_texto(doc=doc, resultado=resultado):
            assert len(resultado["textoOcr"]) > 20, f"texto OCR muito curto: \"{resultado['textoOcr']}\""

        testar(f"{doc['arquivo']}: OCR extrai texto não vazio", t_texto)

        def t_schema(doc=doc, resultado=resultado):
            assert resultado["validacao"]["valido"], f"erros: {', '.join(resultado['validacao']['erros'])}"

        testar(f"{doc['arquivo']}: exemplo passa na validação de schema", t_schema)

        for campo, esperado in doc["esperado"].items():
            def t_campo(doc=doc, resultado=resultado, campo=campo, esperado=esperado):
                extraido = resultado["exemplo"]["saida"][campo]
                if isinstance(esperado, (int, float)):
                    assert extraido == esperado, f"extraído={extraido}, esperado={esperado}"
                else:
                    assert _normalizar(extraido) == _normalizar(esperado), f'extraído="{extraido}", esperado="{esperado}"'

            testar(f"{doc['arquivo']}: campo \"{campo}\" extraído bate com o esperado", t_campo)

        def t_confianca(doc=doc, resultado=resultado):
            c = resultado["exemplo"]["metadata"]["confiancaOcr"]
            assert 0 <= c <= 1, f"confiança fora da faixa: {c}"

        testar(f"{doc['arquivo']}: confiança de OCR está entre 0 e 1", t_confianca)

    print()
    print("== Testes: validação de schema rejeita exemplo incompleto ==")

    def t3():
        v = validar_exemplo("amplitude-auto", {"segurado": "Fulano", "placa": None, "valor": 100})
        assert v["valido"] is False
        assert any("placa" in e for e in v["erros"])

    testar("exemplo sem campo obrigatório é marcado inválido", t3)

    def t4():
        v = validar_exemplo("amplitude-auto", {"segurado": "Fulano", "placa": "ABC-1234", "valor": 0})
        assert v["valido"] is False

    testar("exemplo com valor zero ou negativo é marcado inválido", t4)

    print()
    print(
        f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), "
        f"{_testes_com_falha} falhou(falharam)."
    )

    if _testes_com_falha > 0:
        raise AssertionError(f"{_testes_com_falha} teste(s) falharam. A implementação não bate com a especificação.")

    return resultados


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------


def rodar_demo(resultados):
    print()
    print("===== Demo: pipeline completo de extração, 4 documentos reais via Tesseract =====")

    for item in resultados:
        doc, resultado = item["doc"], item["resultado"]
        print(f"\n--- {doc['arquivo']} ({doc['caso']}) ---")
        print("Texto OCR bruto:")
        for linha in resultado["textoOcr"].split("\n"):
            print(f"  {linha}")
        print(f"Confiança média de OCR: {resultado['exemplo']['metadata']['confiancaOcr'] * 100:.1f}%")
        print("Exemplo estruturado:", json.dumps(resultado["exemplo"]["saida"], ensure_ascii=False))
        status = "OK" if resultado["validacao"]["valido"] else "FALHOU: " + ", ".join(resultado["validacao"]["erros"])
        print(f"Validação de schema: {status}")

    linhas_jsonl = [json.dumps(item["resultado"]["exemplo"], ensure_ascii=False) for item in resultados]
    with open(ARQUIVO_JSONL_SAIDA, "w", encoding="utf-8") as f:
        f.write("\n".join(linhas_jsonl) + "\n")

    print("\n-----------------------------------------------------------------------------")
    print(f"{len(linhas_jsonl)} exemplos escritos em: {ARQUIVO_JSONL_SAIDA.name}")
    print("Dois formatos de orçamento de oficina, dois formatos de recibo médico, rótulo")
    print("de campo diferente em cada um, mas o parser tolerante e a validação de schema")
    print("garantem que os 4 viram exemplo estruturado, sem exigir OCR ou layout perfeito.")
    print("-----------------------------------------------------------------------------")


if __name__ == "__main__":
    resultados = rodar_testes()
    rodar_demo(resultados)

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
