"""O prompt: o único canal entre o harness e o modelo.

O prompt de sistema é montado em pedaços, um por bloco que o modelo pode usar. Ele vai em
inglês, para o modelo; o que aparece na tela o modelo escreve em português.
"""

INTRO = """You are an agent working in a shell. Your working directory is {cwd}.
Solve the task one step at a time.

Each reply is one short sentence saying what you do next and why, followed by exactly
one fenced block. Never put ``` inside a block. Write the sentence and the final answer
in Brazilian Portuguese. The blocks are:"""

BASH = """```bash
<one shell command>
```
runs a command in the working directory and shows you its output."""

STATE = """```state
{"facts": ["..."], "tried": ["..."], "todo": ["..."]}
```
replaces the lists you include in the state shown below."""

DELEGATE = """```delegate
<a self-contained task>
```
hands a subtask to a subagent. It starts with an empty context, works in the same
directory and returns only its final answer. Delegate when a subtask stands on its own
and you need its result but not the steps that found it, for example searching or
measuring many files. Write the task so it makes sense without this conversation."""

DONE = """```done
<final answer>
```
ends the task with your answer to the user."""

DUMPED = """Below, under CODE, is every text file of the working directory. You have no
tools in this mode: answer from that code with a done block."""

INDEXED = """Below, under CODE, are the parts of the working directory that a search index
found most relevant to the task, each headed by file:line. Use them first and run
commands only for what is missing."""

MEMORY = """You only see the last few turns of this conversation. Older turns are dropped and
the state is the only thing that survives, also between runs. Save facts as soon as a
command output teaches you something, note what you tried and keep the todo list
current. Write the state entries in Brazilian Portuguese. If the state already answers
the task, do not redo the work."""


def system_prompt(cwd, subagent=False, strategy="grep"):
    """Quem o modelo é e que blocos ele pode usar."""
    if subagent:
        # O subagente só tem bash e done: sem arquivo de estado e sem delegar de novo.
        return "\n\n".join([INTRO.format(cwd=cwd), BASH, DONE])
    if strategy == "dump":
        # Com o código todo no prompt, o modelo não tem ferramentas.
        return "\n\n".join([INTRO.format(cwd=cwd), DONE, DUMPED])
    parts = [INTRO.format(cwd=cwd), BASH, STATE, DELEGATE, DONE, MEMORY]
    if strategy == "index":
        parts.append(INDEXED)
    return "\n\n".join(parts)


def build_prompt(**parts):
    """Junta as partes do prompt, na ordem dada, e mede cada uma para a visão de custo."""
    prompt = "\n\n".join(text for text in parts.values() if text)
    return prompt, {name: len(text) for name, text in parts.items()}
