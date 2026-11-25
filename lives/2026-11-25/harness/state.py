"""O estado: a memória do agente fica num arquivo, fora do contexto.

O modelo só vê os últimos turnos da conversa. O que precisa sobreviver (os fatos, o que
já foi tentado, o que falta fazer) fica em .mini-harness/state.json, dentro da pasta de
trabalho. O harness coloca o estado em todo prompt, e ele continua lá na próxima execução.
"""
import json
from pathlib import Path

STATE_FILE = Path(".mini-harness", "state.json")   # relativo à pasta de trabalho


def load_state(cwd):
    """Lê o estado salvo nesta pasta, ou começa um vazio."""
    state = {"facts": [], "tried": [], "todo": []}
    path = Path(cwd, STATE_FILE)
    if path.exists():
        try:
            state.update(json.loads(path.read_text()))
        except ValueError:
            pass
    return state


def state_text(state):
    """O estado do jeito que entra no prompt."""
    return f"STATE:\n{json.dumps(state, indent=2, ensure_ascii=False)}"


def update_state(state, body, cwd):
    """Aplica um bloco state do modelo e salva o arquivo. Devolve False se for inválido."""
    try:
        update = json.loads(body)
        lists = {k: [str(item) for item in update[k]] for k in state if k in update}
    except (ValueError, TypeError, AttributeError):
        return False
    state.update(lists)
    path = Path(cwd, STATE_FILE)
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n")
    return True
