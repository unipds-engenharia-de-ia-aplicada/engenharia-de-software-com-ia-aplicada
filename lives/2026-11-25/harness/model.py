"""O modelo: uma função que recebe o prompt e devolve texto. Nada mais.

Aqui o modelo é uma CLI de agente de código em que você já fez login, usada como modelo
puro: entra texto, sai texto, nada fica salvo e as ferramentas dela ficam desligadas onde
a CLI deixa. Trocar de modelo é trocar de função; o resto do harness não muda.
"""
import re
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor

from .protocol import parse

TIMEOUT = 300   # segundos por chamada
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")   # códigos de cor do terminal


def call_cli(argv, prompt):
    """Manda o prompt pela entrada padrão de uma CLI e devolve a resposta."""
    # Roda na pasta temporária: a única visão que o modelo tem da pasta de trabalho é o
    # nosso bash.
    r = subprocess.run(argv, input=prompt, capture_output=True, text=True,
                       cwd=tempfile.gettempdir(), timeout=TIMEOUT)
    if r.returncode != 0:
        raise RuntimeError(f"{argv[0]} falhou: {(r.stderr or r.stdout).strip()[-500:]}")
    return ANSI.sub("", r.stdout).strip()


def claude(prompt):
    return call_cli(["claude", "-p", "--tools", "", "--disable-slash-commands",
                     "--no-session-persistence", "--strict-mcp-config"], prompt)


def codex(prompt):
    # O codex não deixa desligar o shell dele, então roda num sandbox só de leitura.
    return call_cli(["codex", "exec", "--skip-git-repo-check", "--ephemeral",
                     "--sandbox", "read-only", "--color", "never", "-"], prompt)


def kiro(prompt):
    return call_cli(["kiro-cli", "chat", "--no-interactive", "--trust-tools=",
                     "--wrap", "never"], prompt)


BACKENDS = {"claude": claude, "codex": codex, "kiro": kiro}


def working_backends():
    """Os backends instalados, com login feito e que seguem o protocolo."""
    def works(name):
        try:
            return parse(BACKENDS[name]("Reply with exactly this:\n```done\nok\n```")) is not None
        except Exception:
            return False
    with ThreadPoolExecutor() as pool:
        ok = list(pool.map(works, BACKENDS))
    return [name for name, good in zip(BACKENDS, ok) if good]
