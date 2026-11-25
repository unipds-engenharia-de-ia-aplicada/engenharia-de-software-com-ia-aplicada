"""A ferramenta do agente: um shell. Com bash o modelo lê, procura, mede e escreve.

O harness devolve a saída como texto, cortada no tamanho que cabe no prompt.
"""
import subprocess

MAX_OUTPUT = 4000   # caracteres da saída que voltam para o modelo
TIMEOUT = 30        # segundos por comando


def run_bash(command, cwd):
    """Roda o comando na pasta de trabalho e devolve a saída com o código de saída."""
    try:
        r = subprocess.run(command, shell=True, cwd=cwd, capture_output=True,
                           text=True, timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        return f"[tempo esgotado após {TIMEOUT}s]"
    out = (r.stdout + r.stderr).strip("\n")
    if len(out) > MAX_OUTPUT:
        out = out[:MAX_OUTPUT] + f"\n[truncado, mais {len(out) - MAX_OUTPUT} caracteres]"
    return f"{out}\n[código de saída {r.returncode}]".lstrip("\n")
