"""O portão de permissões: antes de rodar um comando, o harness decide se ele pode rodar.

    allow   comandos só de leitura (ls, cat, grep, git status...) rodam direto
    ask     qualquer outro pausa a execução até o usuário permitir ou negar
    deny    uma lista curta de comandos perigosos é sempre recusada

A recusa do modelo não é a defesa: o controle fica no harness. Isto é um exemplo de aula,
não um sandbox, porque ele lê o comando como texto.
"""
import re
import shlex

READ_ONLY = {"ls", "cat", "head", "tail", "wc", "grep", "rg", "find", "pwd", "echo",
             "sort", "uniq", "file", "stat", "du", "tree", "which", "date"}
GIT_READ_ONLY = {"status", "log", "diff", "show", "branch"}
# Jeitos de um comando de leitura ainda escrever ou rodar outro comando.
WRITES = (">", "`", "$(", "-exec", "-delete", "-fprint")
DENY = [r"\brm\s+-\w*[rRf]",
        r"\bsudo\b",
        r"\b(curl|wget)\b.*\|\s*\w*sh\b",
        r"\bmkfs",
        r"\bdd\s+if=",
        r":\(\)\s*\{",
        r"\bchmod\s+-R\s+777\b"]
SEPARATORS = {"|", "||", "&&", ";", "&", ";;"}

# O que o modelo recebe no lugar da saída quando o comando não roda.
REFUSALS = {"deny": "[recusado: o harness nunca permite este comando, não tente de novo]",
            "denied": "[recusado: o usuário negou este comando]"}


def check(command):
    """Devolve "allow", "ask" ou "deny" para um comando."""
    if any(re.search(pattern, command) for pattern in DENY):
        return "deny"
    command = command.replace("2>/dev/null", "").replace("2>&1", "")
    if any(token in command for token in WRITES):
        return "ask"
    try:
        commands = simple_commands(command)
    except ValueError:   # aspas sem fechar
        return "ask"
    return "allow" if all(map(read_only, commands)) else "ask"


def simple_commands(command):
    """Quebra uma linha de shell nos comandos simples dela, respeitando aspas.

    "ls -la | grep py && cat x" vira [["ls", "-la"], ["grep", "py"], ["cat", "x"]].
    """
    lexer = shlex.shlex(command.replace("\n", ";"), posix=True, punctuation_chars=True)
    lexer.whitespace_split = True
    commands, words = [], []
    for token in list(lexer) + [";"]:
        if token not in SEPARATORS:
            words.append(token)
        elif words:
            commands.append(words)
            words = []
    return commands


def read_only(words):
    """Se o programa de um comando simples só lê."""
    program, args = words[0], words[1:]
    if program == "git":
        return bool(args) and args[0] in GIT_READ_ONLY
    return program in READ_ONLY
