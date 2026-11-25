"""O protocolo: como o modelo pede uma ação e como o harness lê esse pedido.

Cada resposta do modelo é uma frase curta seguida de exatamente um bloco cercado:

    Vou listar os arquivos para ver o que tem aqui.
    ```bash
    ls -la
    ```

O tipo do bloco diz o que fazer e o corpo diz com o quê. Isso é tool calling. Nas APIs
nativas (tool_use da Anthropic, function calling da OpenAI) o pedido vem em JSON em vez
de texto, e o loop em volta é o mesmo.
"""
import re
from typing import NamedTuple

BLOCK = re.compile(r"```(bash|state|delegate|done)[ \t]*\n(.*?)```", re.S)


class Action(NamedTuple):
    thought: str   # a frase antes do bloco
    kind: str      # o tipo do bloco: bash, state, delegate ou done
    body: str      # o conteúdo do bloco


def parse(reply):
    """Devolve a Action de uma resposta bem formada, ou None."""
    blocks = BLOCK.findall(reply)
    if len(blocks) != 1 or reply.count("```") != 2:
        return None
    kind, body = blocks[0]
    return Action(reply[:reply.index("```")].strip(), kind, body.strip())
