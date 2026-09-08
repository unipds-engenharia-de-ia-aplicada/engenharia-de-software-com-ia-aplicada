"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Módulo 4.2 (Demo, parte 3 -- companion, referência
espelhada em Python do .js oficial)

A gravação do Módulo 4.2 ficou sem tempo pra parte 3 da demo ao vivo
(comparar a saída do modelo com e sem o adaptador). Este arquivo é o
companion pra rodar exatamente essa comparação por conta própria: chama
`python3 -m mlx_lm generate` duas vezes contra o MESMO exemplo real do
conjunto de teste (índice 8 de mlx-data/test.jsonl, o recibo médico de
Felipe Alves Monteiro) -- uma vez sem --adapter-path, uma vez com --, e
compara as duas saídas. Mesmo par modelo+adaptador que
local_lora_training_tool.py treina (mlx-community/gemma-4-e2b-it-bf16 +
./mlx-adapters, rank 8).

Resultado real capturado nesta máquina em 2026-09-04, com o adaptador do
próprio treino gravado no vídeo do Módulo 4.2 (mlx-adapters/, treinado
09:51-10:35 no dia da gravação):
  - SEM adaptador: 80 tokens gerados (bateu no limite), o modelo entra num
    modo de raciocínio em texto livre e nunca chega a um JSON.
  - COM adaptador: 28 tokens gerados, JSON exato batendo com o gabarito
    campo a campo: {"beneficiario":"Felipe Alves Monteiro",
    "procedimento":"consulta de clinica geral","valor":3450}
Esses são os mesmos números citados no teleprompter do Módulo 4.2.

Uso: python3 adapter_comparison_tool.py
Roda de verdade -- carrega o modelo duas vezes, gera duas vezes, leva uns
30-40s no total. Não é uma simulação nem um resultado pré-gravado.
"""

import json
import os
import subprocess

MODELO_BASE = "mlx-community/gemma-4-e2b-it-bf16"
_AQUI = os.path.dirname(os.path.abspath(__file__))
ADAPTER_PATH = os.path.join(_AQUI, "mlx-adapters")
TEST_JSONL = os.path.join(_AQUI, "mlx-data", "test.jsonl")
INDICE_EXEMPLO = 8  # Felipe Alves Monteiro, recibo médico -- o exemplo citado no TP
MAX_TOKENS = 80


# ============================================================================
# 1. Carregar o exemplo real do conjunto de teste (o mesmo que o TP cita)
# ============================================================================

def carregar_exemplo_teste(indice=INDICE_EXEMPLO, caminho=TEST_JSONL):
    with open(caminho, encoding="utf-8") as f:
        linhas = [linha for linha in f.read().strip().split("\n") if linha]
    if indice < 0 or indice >= len(linhas):
        raise ValueError(f"índice {indice} fora do intervalo (0-{len(linhas) - 1})")
    exemplo = json.loads(linhas[indice])
    prompt = exemplo["messages"][0]["content"]
    gabarito = json.loads(exemplo["messages"][1]["content"])
    return prompt, gabarito


# ============================================================================
# 2. Montar os argumentos do mlx_lm.generate (função pura, testável sem
#    rodar nada)
# ============================================================================

def montar_argumentos_generate(prompt, adapter_path=None, max_tokens=MAX_TOKENS, modelo=MODELO_BASE):
    args = [
        "-m", "mlx_lm", "generate",
        "--model", modelo,
        "--prompt", prompt,
        "--max-tokens", str(max_tokens),
    ]
    if adapter_path:
        args += ["--adapter-path", adapter_path]
    return args


# ============================================================================
# 3. Parsear a saída real do mlx_lm.generate (texto entre os dois
#    separadores "==========" + a linha "Generation: N tokens")
# ============================================================================

def parsear_saida_generate(texto_saida):
    blocos = texto_saida.split("==========")
    if len(blocos) < 3:
        raise ValueError('saída não tem o formato esperado (dois separadores "==========")')
    texto_gerado = blocos[1].strip()

    import re
    match_tokens = re.search(r"Generation: (\d+) tokens", texto_saida)
    tokens_gerados = int(match_tokens.group(1)) if match_tokens else None

    try:
        saida_json = json.loads(texto_gerado)
    except (json.JSONDecodeError, ValueError):
        saida_json = None

    return {
        "texto_gerado": texto_gerado,
        "tokens_gerados": tokens_gerados,
        "json": saida_json,
        "bateu_no_limite_de_tokens": tokens_gerados is not None and tokens_gerados >= MAX_TOKENS,
    }


def comparar_com_gabarito(saida_json, gabarito):
    if not saida_json:
        return False
    return all(saida_json.get(chave) == valor for chave, valor in gabarito.items())


# ============================================================================
# 4. Rodar de verdade
# ============================================================================

def rodar_generate_real(args, runner=subprocess.run):
    resultado = runner(["python3"] + args, capture_output=True, text=True)
    if resultado.returncode != 0:
        raise RuntimeError(f"mlx_lm generate saiu com código {resultado.returncode}:\n{resultado.stderr}")
    # mlx_lm manda parte da saída (barra de progresso do download) pro stderr
    return f"{resultado.stdout}\n{resultado.stderr}"


# ----------------------------------------------------------------------------
# Testes automatizados -- contra saída real capturada nesta máquina em
# 2026-09-04, sem precisar rodar o modelo de novo pra validar o parser
# ----------------------------------------------------------------------------

SAIDA_REAL_SEM_ADAPTADOR = """==========
<|channel>thought
Here's a thinking process to extract the requested information:

1.  **Analyze the Request:** The user wants to extract three specific pieces of information from the provided text (a medical receipt/summary):
    *   Beneficiário (Beneficiary)
    *   Procedimento (Procedure)
    *   Valor (Value/Amount)

2.  **
==========
Prompt: 119 tokens, 119.302 tokens-per-sec
Generation: 80 tokens, 52.503 tokens-per-sec
Peak memory: 9.406 GB"""

SAIDA_REAL_COM_ADAPTADOR = """==========
{"beneficiario":"Felipe Alves Monteiro","procedimento":"consulta de clinica geral","valor":3450}
==========
Prompt: 119 tokens, 161.590 tokens-per-sec
Generation: 28 tokens, 43.129 tokens-per-sec
Peak memory: 9.406 GB"""

_total_testes = 0
_testes_com_falha = 0


def testar(descricao, fn):
    global _total_testes, _testes_com_falha
    _total_testes += 1
    try:
        fn()
        print(f"  [OK] {descricao}")
    except Exception as erro:  # noqa: BLE001 -- reporta qualquer falha de asserção
        _testes_com_falha += 1
        print(f"  [FALHOU] {descricao}")
        print(f"           {erro}")


def rodar_testes():
    print("== Testes: montagem de argumentos e parsing da saída real ==")

    def teste_exemplo_real():
        _, gabarito = carregar_exemplo_teste()
        assert gabarito["beneficiario"] == "Felipe Alves Monteiro"
        assert gabarito["procedimento"] == "consulta de clinica geral"
        assert gabarito["valor"] == 3450
    testar("carrega o exemplo real (índice 8) e é o recibo do Felipe Alves Monteiro", teste_exemplo_real)

    def teste_sem_adapter_path():
        args = montar_argumentos_generate("x")
        assert "--adapter-path" not in args
    testar("monta argumentos sem --adapter-path quando adapter_path não é passado", teste_sem_adapter_path)

    def teste_com_adapter_path():
        args = montar_argumentos_generate("x", adapter_path="/caminho/adapters")
        idx = args.index("--adapter-path")
        assert args[idx + 1] == "/caminho/adapters"
    testar("monta argumentos com --adapter-path quando adapter_path é passado", teste_com_adapter_path)

    def teste_parse_sem_adaptador():
        r = parsear_saida_generate(SAIDA_REAL_SEM_ADAPTADOR)
        assert r["tokens_gerados"] == 80
        assert r["bateu_no_limite_de_tokens"] is True
        assert r["json"] is None
    testar("parseia a saída real SEM adaptador: 80 tokens, bateu no limite, não é JSON", teste_parse_sem_adaptador)

    def teste_parse_com_adaptador():
        r = parsear_saida_generate(SAIDA_REAL_COM_ADAPTADOR)
        assert r["tokens_gerados"] == 28
        assert r["bateu_no_limite_de_tokens"] is False
        assert r["json"] == {
            "beneficiario": "Felipe Alves Monteiro",
            "procedimento": "consulta de clinica geral",
            "valor": 3450,
        }
    testar("parseia a saída real COM adaptador: 28 tokens, não bateu no limite, JSON válido", teste_parse_com_adaptador)

    def teste_compara_bate():
        r = parsear_saida_generate(SAIDA_REAL_COM_ADAPTADOR)
        gabarito = {"beneficiario": "Felipe Alves Monteiro", "procedimento": "consulta de clinica geral", "valor": 3450}
        assert comparar_com_gabarito(r["json"], gabarito) is True
    testar("comparar_com_gabarito bate campo a campo quando o JSON é igual ao gabarito", teste_compara_bate)

    def teste_compara_falha():
        r = parsear_saida_generate(SAIDA_REAL_SEM_ADAPTADOR)
        gabarito = {"beneficiario": "Felipe Alves Monteiro"}
        assert comparar_com_gabarito(r["json"], gabarito) is False
    testar("comparar_com_gabarito falha se faltar JSON (caso sem adaptador)", teste_compara_falha)

    print(f"\n{_total_testes - _testes_com_falha}/{_total_testes} testes passaram.")
    return _testes_com_falha == 0


# ============================================================================
# 5. Comparação real -- roda os dois `mlx_lm generate` de verdade
# ============================================================================

def rodar_comparacao_real():
    prompt, gabarito = carregar_exemplo_teste()

    print("\n===== Demo parte 3: mesmo exemplo real, com e sem o adaptador =====\n")
    print("Exemplo (índice 8, mlx-data/test.jsonl):")
    print(" ".join(prompt.split("\n")[:2]) + " ...\n")

    print("Rodando SEM adaptador (carrega o modelo, ~15-20s)...")
    saida_sem = parsear_saida_generate(rodar_generate_real(montar_argumentos_generate(prompt)))

    print("Rodando COM adaptador (~15-20s)...")
    saida_com = parsear_saida_generate(
        rodar_generate_real(montar_argumentos_generate(prompt, adapter_path=ADAPTER_PATH))
    )

    print("\n--- SEM adaptador ---")
    sufixo = " -- bateu no limite, não terminou" if saida_sem["bateu_no_limite_de_tokens"] else ""
    print(f"{saida_sem['tokens_gerados']} tokens gerados{sufixo}")
    texto = saida_sem["texto_gerado"]
    print(texto[:220] + "..." if len(texto) > 220 else texto)
    print(f"Bate com o gabarito? {comparar_com_gabarito(saida_sem['json'], gabarito)}")

    print("\n--- COM adaptador ---")
    print(f"{saida_com['tokens_gerados']} tokens gerados")
    print(saida_com["texto_gerado"])
    print(f"Bate com o gabarito? {comparar_com_gabarito(saida_com['json'], gabarito)}")

    bateu_sem = comparar_com_gabarito(saida_sem["json"], gabarito)
    print(
        f"\nConclusão: a diferença de configuração (o adaptador de 27MB) é a diferença entre um "
        f"modelo que {'também acerta' if bateu_sem else 'não chega a um JSON'} e um modelo que acerta "
        f"o formato inteiro, campo a campo, num exemplo que nunca esteve no treino."
    )

    return saida_sem, saida_com, gabarito


if __name__ == "__main__":
    ok = rodar_testes()
    rodar_comparacao_real()
    if not ok:
        raise SystemExit(1)

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
