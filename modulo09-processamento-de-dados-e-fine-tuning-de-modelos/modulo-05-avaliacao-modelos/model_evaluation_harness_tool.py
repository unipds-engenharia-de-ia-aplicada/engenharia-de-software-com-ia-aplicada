"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 5.1

Nota tecnica: os 200 exemplos do Modulo 3.2 foram 100% usados no
treino -- nao existe conjunto de teste retido pro modelo da nuvem (o
split local 157/30/13 do Modulo 4.2 cobre so o modelo local). Este
arquivo constroi um de verdade: reusa gerar_exemplo do
Modulo 3.2 (mesmo gerador deterministico, sem duplicar logica), mas com
indices bem alem da faixa usada no treino (offset de 5000), garantindo
que nenhum exemplo aqui foi visto pelo modelo durante o fine-tuning.

O harness chama o modelo real, publicado no SEU endpoint do Modulo 3.2,
via REST, com o mesmo padrao de autenticacao (gcloud auth print-access-token)
ja usado em dataset_upload_and_tracking_tool.py.

Nota tecnica: avaliar_adequacao_schema remove cerca de markdown (```json ... ```)
antes de fazer parse, e normalizar_texto ignora acento e diferenca de
maiuscula/minuscula -- sem isso, respostas corretas do modelo seriam
contadas como erro de extracao. Corrigido aqui, na fonte
compartilhada, porque afeta qualquer avaliacao que reuse este harness.

Uso: python3 model_evaluation_harness_tool.py
Requer: ENDPOINT_MODULO32 definida com o endpoint do SEU modelo publicado
no Modulo 3.2 (veja README.md, secao "Antes de rodar").
"""

import importlib.util
import os
import re
import sys
import time
import unicodedata
import json
import subprocess
import urllib.request
from datetime import date
from pathlib import Path

_M3_2_PATH = Path(__file__).parent.parent / "modulo-03-fine-tuning-via-api" / "m3_dataset_scaling_tool.py"
_spec = importlib.util.spec_from_file_location("m3_dataset_scaling_tool", _M3_2_PATH)
m32 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m32)

REGIAO = "us-central1"
# CONFIGURACAO: defina ENDPOINT_MODULO32 com o endpoint do modelo que VOCE
# publicou no Modulo 3.2 (projects/.../endpoints/...) -- nao ha valor
# padrao, cada aluno usa o proprio modelo. A checagem eh lazy (dentro de
# obter_endpoint(), nao aqui no escopo do modulo) pra nao travar quem
# importa este arquivo soh pelas funcoes utilitarias (avaliar_adequacao_schema,
# avaliar_precisao_por_campo, gerar_conjunto_teste_retido), sem tocar rede.
ENDPOINT = os.environ.get("ENDPOINT_MODULO32")


def obter_endpoint():
    if not ENDPOINT:
        raise RuntimeError(
            "Defina a variavel de ambiente ENDPOINT_MODULO32 com o endpoint do "
            "seu modelo publicado no Modulo 3.2 antes de rodar este script."
        )
    return ENDPOINT


OFFSET_RETIDO = 5000

CAMPOS_ESPERADOS = {
    "amplitude-auto": ["segurado", "placa", "valor"],
    "amplitude-saude-empresarial": ["beneficiario", "procedimento", "valor"],
}


# ---------------------------------------------------------------------------
# 1. Conjunto de teste retido (genuinamente novo, nunca treinado)
# ---------------------------------------------------------------------------


def gerar_conjunto_teste_retido():
    exemplos = []
    for fonte, _ in m32.FONTES_AUTO:
        i = len(exemplos)
        exemplos.append(m32.gerar_exemplo("amplitude-auto", fonte, OFFSET_RETIDO + i))
    inicio_saude = len(exemplos)
    for fonte, _ in m32.FONTES_SAUDE:
        i = len(exemplos) - inicio_saude
        exemplos.append(m32.gerar_exemplo("amplitude-saude-empresarial", fonte, OFFSET_RETIDO + i))
    return exemplos


# ---------------------------------------------------------------------------
# 2. Chamada real ao modelo fine-tunado (REST, endpoint do Modulo 3.2)
# ---------------------------------------------------------------------------


def obter_token_acesso():
    return subprocess.check_output(
        ["gcloud", "auth", "print-access-token"], text=True
    ).strip()


def chamar_modelo_real(exemplo):
    token = obter_token_acesso()
    url = f"https://{REGIAO}-aiplatform.googleapis.com/v1/{obter_endpoint()}:generateContent"
    texto_usuario = f"{exemplo['instrucao']}\n\n{exemplo['entrada']}"
    corpo = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": texto_usuario}]}],
        "generationConfig": {"temperature": 0},
    }).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=corpo,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resposta:
        dados = json.loads(resposta.read())
    return dados["candidates"][0]["content"]["parts"][0]["text"]


# ---------------------------------------------------------------------------
# 3. Adequacao de schema
# ---------------------------------------------------------------------------


def remover_cerca_markdown(texto):
    m = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", texto.strip())
    return m.group(1) if m else texto


def avaliar_adequacao_schema(caso, texto_resposta):
    try:
        obj = json.loads(remover_cerca_markdown(texto_resposta))
    except (json.JSONDecodeError, TypeError, AttributeError):
        return {"valido": False, "motivo": "resposta não é JSON válido", "campos": None}
    if not isinstance(obj, dict):
        return {"valido": False, "motivo": "resposta não é um objeto JSON", "campos": None}
    esperados = CAMPOS_ESPERADOS[caso]
    chaves = list(obj.keys())
    faltando = [c for c in esperados if c not in chaves]
    extras = [c for c in chaves if c not in esperados]
    return {
        "valido": len(faltando) == 0 and len(extras) == 0,
        "faltando": faltando,
        "extras": extras,
        "campos": obj,
    }


# ---------------------------------------------------------------------------
# 4. Precisao por campo
# ---------------------------------------------------------------------------


def normalizar_texto(texto):
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFD", str(texto)) if unicodedata.category(c) != "Mn"
    )
    return " ".join(sem_acento.lower().split())


def avaliar_precisao_por_campo(esperado, obtido):
    campos = list(esperado.keys())
    por_campo = {}
    acertos = 0
    for campo in campos:
        valor_esperado = esperado[campo]
        valor_obtido = obtido.get(campo) if obtido else None
        if isinstance(valor_esperado, (int, float)):
            try:
                acertou = valor_obtido is not None and abs(float(valor_esperado) - float(valor_obtido)) < 0.01
            except (TypeError, ValueError):
                acertou = False
        else:
            # Mesma ideia do normalizarTexto do Modulo 2.2: diferenca so de
            # maiuscula/minuscula ou espaco nao e erro de extracao de dados.
            acertou = normalizar_texto(valor_esperado) == normalizar_texto(valor_obtido or "")
        por_campo[campo] = acertou
        if acertou:
            acertos += 1
    return {"porCampo": por_campo, "acertos": acertos, "total": len(campos), "precisao": acertos / len(campos)}


# ---------------------------------------------------------------------------
# 5. Consistencia
# ---------------------------------------------------------------------------


def avaliar_consistencia(exemplo, repeticoes=3):
    respostas = [chamar_modelo_real(exemplo) for _ in range(repeticoes)]
    unicas = set(respostas)
    return {"respostas": respostas, "numeroRespostasUnicas": len(unicas), "estavel": len(unicas) == 1}


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


def testar_com_rede(descricao, fn):
    # Par de testarAsync() do .js: este teste chama a rede de verdade
    # (chamar_modelo_real), então captura qualquer falha de rede/autenticação
    # (subprocess.CalledProcessError, urllib.error.*, KeyError na resposta),
    # não só AssertionError, pra reportar [FALHOU] em vez de derrubar o script.
    global _total_testes, _testes_com_falha
    _total_testes += 1
    try:
        fn()
        print(f"  [OK] {descricao}")
    except Exception as erro:
        _testes_com_falha += 1
        print(f"  [FALHOU] {descricao}")
        print(f"           {erro}")


def rodar_testes():
    print("== Testes: conjunto de teste retido ==")

    def t1():
        conjunto = gerar_conjunto_teste_retido()
        assert len(conjunto) == 11
        assert sum(1 for e in conjunto if e["metadata"]["caso"] == "amplitude-auto") == 6
        assert sum(1 for e in conjunto if e["metadata"]["caso"] == "amplitude-saude-empresarial") == 5
        for e in conjunto:
            indice = int(e["metadata"]["id"].split("-")[-1])
            assert indice >= OFFSET_RETIDO, f"id {e['metadata']['id']} não usa offset retido"

    testar("gera 11 exemplos (6 Auto + 5 Saúde, uma por fonte real do Módulo 3.2), todos com índice >= 5000 (fora da faixa de treino)", t1)

    print()
    print("== Testes: adequação de schema ==")

    def t2():
        r = avaliar_adequacao_schema("amplitude-auto", '{"segurado":"X","placa":"Y","valor":10}')
        assert r["valido"] is True

    testar("JSON com exatamente os campos esperados é válido", t2)

    def t3():
        r = avaliar_adequacao_schema("amplitude-auto", '{"segurado":"X","placa":"Y"}')
        assert r["valido"] is False
        assert r["faltando"] == ["valor"]

    testar("JSON com campo faltando é inválido", t3)

    def t4():
        r = avaliar_adequacao_schema("amplitude-auto", '{"segurado":"X","placa":"Y","valor":10,"extra":1}')
        assert r["valido"] is False
        assert r["extras"] == ["extra"]

    testar("JSON com campo extra é inválido", t4)

    def t5():
        r = avaliar_adequacao_schema("amplitude-auto", "não é json")
        assert r["valido"] is False
        assert r["motivo"] == "resposta não é JSON válido"

    testar("resposta que não é JSON é sinalizada, não derruba o harness", t5)

    def t5b():
        r = avaliar_adequacao_schema("amplitude-auto", '```json\n{"segurado":"X","placa":"Y","valor":10}\n```')
        assert r["valido"] is True

    testar("JSON envolvido em cerca de markdown (```json ... ```) ainda é reconhecido como válido", t5b)

    print()
    print("== Testes: precisão por campo ==")

    def t6():
        r = avaliar_precisao_por_campo(
            {"segurado": "Ana", "placa": "ABC-1234", "valor": 100.5},
            {"segurado": "Ana", "placa": "ABC-1234", "valor": 100.5},
        )
        assert r["precisao"] == 1

    testar("todos os campos corretos dá precisão 1.0", t6)

    def t7():
        r = avaliar_precisao_por_campo(
            {"segurado": "Ana", "placa": "ABC-1234", "valor": 100.5},
            {"segurado": "Ana", "placa": "ZZZ-0000", "valor": 100.5},
        )
        assert r["acertos"] == 2
        assert r["total"] == 3
        assert abs(r["precisao"] - 2 / 3) < 1e-9

    testar("um campo errado reduz a precisão proporcionalmente", t7)

    def t8():
        r = avaliar_precisao_por_campo({"valor": 100.5}, {"valor": 100.5000001})
        assert r["porCampo"]["valor"] is True

    testar("valor numérico com diferença de arredondamento sob a tolerância ainda acerta", t8)

    def t8b():
        r = avaliar_precisao_por_campo({"beneficiario": "Marcos Lopes Guimarães"}, {"beneficiario": "Marcos Lopes Guimaraes"})
        assert r["porCampo"]["beneficiario"] is True

    testar("diferença só de acento não é erro de extração", t8b)

    def t9():
        exemplo = m32.gerar_exemplo("amplitude-auto", "Oficina Estrela", OFFSET_RETIDO + 999)
        texto_resposta = chamar_modelo_real(exemplo)
        schema = avaliar_adequacao_schema("amplitude-auto", texto_resposta)
        assert schema["valido"] is True, f"schema inválido: {schema}"
        precisao = avaliar_precisao_por_campo(exemplo["saida"], schema["campos"])
        assert precisao["precisao"] >= 2 / 3, f"precisão baixa: {precisao}"

    testar_com_rede("chamada real ao modelo do Módulo 3.2 devolve schema válido e alta precisão num exemplo novo", t9)

    print()
    print(
        f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), "
        f"{_testes_com_falha} falhou(falharam)."
    )


# ---------------------------------------------------------------------------
# Ledger de resultado medido -- consumido pelo veredito_escala_tool.py do
# Modulo 5.4, pra nao repetir numero por copia manual. Gravado so quando
# este arquivo roda de verdade (chamada real ao modelo), nunca a partir dos
# testes automatizados.
# ---------------------------------------------------------------------------


def gravar_resultado_medido(caminho_json, chave, dados):
    # Lock exclusivo (O_CREAT|O_EXCL, falha se ja existe) protege o read-modify-write:
    # sem isso, duas execucoes sobrepostas (ex.: dois harnesses rodando em paralelo
    # contra o mesmo ledger, cenario real quando multiplas ferramentas deste diretorio
    # compartilham um resultado-medido.json so) podem perder uma atualizacao
    # silenciosamente. Escrita em arquivo temporario + replace (atomico em POSIX)
    # evita tambem um arquivo corrompido/truncado se o processo morrer no meio da escrita.
    caminho_lock = caminho_json.parent / (caminho_json.name + ".lock")
    inicio_espera = time.monotonic()
    while True:
        try:
            fd = os.open(str(caminho_lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.close(fd)
            break
        except FileExistsError:
            if time.monotonic() - inicio_espera > 30:
                raise RuntimeError(
                    f"Nao consegui obter o lock de {caminho_lock} em 30s -- outro "
                    "processo pode ter travado com o lock aberto (remova o arquivo "
                    ".lock manualmente se tiver certeza que nao ha outra execucao deste script rodando)."
                )
            time.sleep(0.1)
    try:
        atual = {}
        if caminho_json.exists():
            atual = json.loads(caminho_json.read_text(encoding="utf-8"))
        atual[chave] = dados
        caminho_tmp = caminho_json.parent / (caminho_json.name + f".{os.getpid()}.tmp")
        caminho_tmp.write_text(json.dumps(atual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        caminho_tmp.replace(caminho_json)
    finally:
        caminho_lock.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Execução principal
# ---------------------------------------------------------------------------


def main():
    rodar_testes()

    print()
    print("== Avaliação real contra o conjunto de teste retido ==")

    conjunto_teste = gerar_conjunto_teste_retido()
    print(f"Endpoint: {obter_endpoint()}")
    print(f"{len(conjunto_teste)} exemplos, nunca vistos no treino do Módulo 3.2.\n")

    soma_precisao = 0
    schemas_validos = 0
    sucessos = 0
    falhas = []

    for exemplo in conjunto_teste:
        try:
            texto_resposta = chamar_modelo_real(exemplo)
        except Exception as erro:
            print(f"{exemplo['metadata']['id']}: [FALHOU] {erro}")
            falhas.append({"id": exemplo["metadata"]["id"], "erro": str(erro)})
            continue

        schema = avaliar_adequacao_schema(exemplo["metadata"]["caso"], texto_resposta)
        if schema["valido"]:
            precisao = avaliar_precisao_por_campo(exemplo["saida"], schema["campos"])
        else:
            precisao = {"precisao": 0, "acertos": 0, "total": len(exemplo["saida"])}

        if schema["valido"]:
            schemas_validos += 1
        soma_precisao += precisao["precisao"]
        sucessos += 1

        print(
            f"{exemplo['metadata']['id']}: schema {'válido' if schema['valido'] else 'INVÁLIDO'}, "
            f"precisão {precisao['precisao'] * 100:.0f}% ({precisao['acertos']}/{precisao['total']})"
        )

    if falhas:
        print(f"\n{len(falhas)}/{len(conjunto_teste)} exemplo(s) falharam na chamada real -- verifique projeto/endpoint/billing.")
    if sucessos == 0:
        raise RuntimeError(
            "Nenhum exemplo processado com sucesso -- verifique GCP_PROJECT_ID, ENDPOINT_MODULO32, "
            "e a autenticacao (gcloud auth login)."
        )

    print(f"\nAdequação de schema: {schemas_validos}/{sucessos}")
    print(f"Precisão média por campo: {soma_precisao / sucessos * 100:.1f}%")

    precisao_media = soma_precisao / sucessos
    medido_pct = round(min(schemas_validos / sucessos, precisao_media) * 100)
    gravar_resultado_medido(
        Path(__file__).parent / "resultado-medido.json",
        "baseline",
        {
            "medido": f"{medido_pct}% ({schemas_validos}/{sucessos} schema válido, precisão média por campo)",
            "medidoPct": medido_pct,
            "n": sucessos,
            "medidoEm": date.today().isoformat(),
            "origem": "Módulo 5.1",
            "script": "model_evaluation_harness_tool.py",
        },
    )

    print()
    print("== Consistência: mesmo exemplo, três chamadas separadas ==")
    exemplo_consistencia = conjunto_teste[0]
    try:
        consistencia = avaliar_consistencia(exemplo_consistencia, 3)
    except Exception as erro:
        print(f"[FALHOU] {erro}")
    else:
        print(f"Exemplo: {exemplo_consistencia['metadata']['id']}")
        for i, r in enumerate(consistencia["respostas"], 1):
            print(f"  Chamada {i}: {r}")
        estabilidade = "estável" if consistencia["estavel"] else "instável"
        print(f"Respostas únicas: {consistencia['numeroRespostasUnicas']} de {len(consistencia['respostas'])} ({estabilidade})")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as erro:
        print(f"Erro: {erro}")
        sys.exit(1)

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
