"""mini-harness: o mínimo em volta de um modelo para ele terminar uma tarefa.

Um arquivo por mecanismo. Comece pelo loop.py: o resto existe para servir a ele.

    loop.py         o loop: chama o modelo, executa o pedido, devolve o resultado
    protocol.py     como o harness lê o pedido que o modelo escreve
    prompts.py      o que vai no prompt a cada chamada
    tools.py        a única ferramenta do agente: bash
    model.py        o modelo: uma função que recebe texto e devolve texto
    state.py        a memória do agente, num arquivo fora do contexto
    permissions.py  o portão que decide se um comando pode rodar
    codebase.py     três formas de o código da pasta chegar ao prompt
"""
from .codebase import STRATEGIES
from .loop import Agent
from .model import BACKENDS, working_backends
from .state import STATE_FILE, load_state
