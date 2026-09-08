"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 4.3 (Demo, parte 2 -- companion, referencia espelhada)

Roda o exemplo dificil do TP (Boa Vista Reparos Automotivos, com dois
valores distratores antes do valor certo) sem adaptador e com os tres
postos testados no modulo -- rank 4, 8 (reaproveita o adaptador real do
Modulo 4.2) e 16. Mesmo modelo, mesmo prompt, saida real dos quatro.

Uso: python3 rank_adapter_comparison_tool.py
"""

import json
import os
import subprocess

MODELO_BASE = "mlx-community/gemma-4-e2b-it-bf16"
MAX_TOKENS = 80

_AQUI = os.path.dirname(os.path.abspath(__file__))
ADAPTERS = {
    "rank 4": os.path.join(_AQUI, "mlx-adapters-rank4"),
    "rank 8": os.path.join(_AQUI, "mlx-adapters"),
    "rank 16": os.path.join(_AQUI, "mlx-adapters-rank16"),
}

PROMPT = (
    "Extraia segurado, placa e valor do orçamento de oficina abaixo.\n\n"
    "BOA VISTA REPAROS AUTOMOTIVOS CNPJ 21.098.765/0001-32 Rua dos Mecanicos 310 "
    "Segurado: Ricardo Alves Monteiro Placa do veiculo: JBR-9021 Data do sinistro: "
    "09/06/2026 Valor das pecas: R$ 1.850,00 Valor da mao de obra: R$ 970,00 "
    "Valor total do orcamento: R$ 2.820,00"
)

GABARITO = {"segurado": "Ricardo Alves Monteiro", "placa": "JBR-9021", "valor": 2820}


def montar_argumentos(adapter_path=None):
    args = ["-m", "mlx_lm", "generate", "--model", MODELO_BASE, "--prompt", PROMPT, "--max-tokens", str(MAX_TOKENS)]
    if adapter_path:
        args += ["--adapter-path", adapter_path]
    return args


def parsear_saida(texto_saida):
    blocos = texto_saida.split("==========")
    if len(blocos) < 3:
        raise ValueError("saída fora do formato esperado")
    texto = blocos[1].strip()
    import re
    m = re.search(r"Generation: (\d+) tokens", texto_saida)
    tokens = int(m.group(1)) if m else 0
    try:
        saida_json = json.loads(texto)
    except (json.JSONDecodeError, ValueError):
        saida_json = None
    return {"texto": texto, "tokens": tokens, "json": saida_json}


def bater_com_gabarito(saida_json):
    return bool(saida_json) and all(saida_json.get(k) == v for k, v in GABARITO.items())


def rodar_real(adapter_path=None, runner=subprocess.run):
    r = runner(["python3"] + montar_argumentos(adapter_path), capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"mlx_lm generate falhou ({r.returncode}):\n{r.stderr}")
    return f"{r.stdout}\n{r.stderr}"


SAIDA_SEM_ADAPTADOR = """==========
<|channel>thought
Here's a thinking process to extract the requested information:

1.  **Analyze the Request:** The user wants to extract three specific pieces of information from the provided text (an auto repair quote/budget):
==========
Prompt: 155 tokens, 211.031 tokens-per-sec
Generation: 80 tokens, 50.460 tokens-per-sec
Peak memory: 9.447 GB"""

SAIDA_RANK4 = """==========
{"segurado":"Ricardo Alves Monteiro","placa":"JBR-9021","valor":2820}
==========
Prompt: 155 tokens, 218.733 tokens-per-sec
Generation: 27 tokens, 41.540 tokens-per-sec
Peak memory: 9.447 GB"""

_total = 0
_falhas = 0


def testar(desc, fn):
    global _total, _falhas
    _total += 1
    try:
        fn()
        print(f"  [OK] {desc}")
    except Exception as e:  # noqa: BLE001
        _falhas += 1
        print(f"  [FALHOU] {desc}\n           {e}")


def rodar_testes():
    print("== Testes ==")

    def t1():
        r = parsear_saida(SAIDA_SEM_ADAPTADOR)
        assert r["tokens"] == 80
        assert r["json"] is None
    testar("sem adaptador: bate no limite de tokens, não chega a JSON", t1)

    def t2():
        r = parsear_saida(SAIDA_RANK4)
        assert r["json"] == GABARITO
    testar("rank 4: JSON exato batendo com o gabarito", t2)

    def t3():
        assert bater_com_gabarito(GABARITO) is True
        assert bater_com_gabarito({"segurado": "outro"}) is False
    testar("bater_com_gabarito confirma e rejeita corretamente", t3)

    print(f"\n{_total - _falhas}/{_total} testes passaram.")
    return _falhas == 0


def rodar_comparacao_real():
    print("\n===== Boa Vista Reparos Automotivos: sem adaptador vs. rank 4/8/16 =====\n")

    print("--- sem adaptador ---")
    sem_adaptador = parsear_saida(rodar_real(None))
    print(f"{sem_adaptador['tokens']} tokens, bate com o gabarito? {bater_com_gabarito(sem_adaptador['json'])}")

    resultados = {"sem adaptador": sem_adaptador}
    for nome, caminho in ADAPTERS.items():
        print(f"--- {nome} ---")
        r = parsear_saida(rodar_real(caminho))
        print(f"{r['tokens']} tokens, bate com o gabarito? {bater_com_gabarito(r['json'])}")
        if r["json"]:
            print(json.dumps(r["json"]))
        resultados[nome] = r
    return resultados


if __name__ == "__main__":
    ok = rodar_testes()
    rodar_comparacao_real()
    if not ok:
        raise SystemExit(1)

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
