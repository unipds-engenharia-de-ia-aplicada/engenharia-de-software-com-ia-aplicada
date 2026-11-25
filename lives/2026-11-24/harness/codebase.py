"""Como o código da pasta chega ao prompt. Três estratégias:

    dump    cola todos os arquivos de texto no prompt e tira as ferramentas do modelo
    grep    não cola nada: o modelo procura sozinho com bash
    index   indexa a pasta em trechos e cola só os que mais combinam com a tarefa (RAG)

As três respondem à mesma pergunta, e cada uma paga um preço diferente em tokens.
"""
import math
import os
import re
import unicodedata
from collections import Counter
from pathlib import Path

STRATEGIES = ("dump", "grep", "index")
SKIP_DIRS = {".git", "node_modules", ".mini-harness", "__pycache__", ".venv", "venv",
             "dist", "build"}
MAX_FILE = 100_000   # bytes; arquivos maiores ficam fora do dump e do índice
MAX_DUMP = 60_000    # caracteres de código que o dump cola no prompt
TOP_K = 8            # trechos que o índice coloca no prompt


def gather(strategy, cwd, task):
    """O código que vai no prompt antes da primeira chamada, e uma nota para a tela."""
    if strategy == "dump":
        return dump_folder(cwd)
    return retrieve(cwd, task)


def text_files(cwd):
    """(caminho relativo, texto) de cada arquivo de texto, pulando as pastas de ruído."""
    for root, dirs, files in os.walk(cwd):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith("."))
        for name in sorted(files):
            path = Path(root, name)
            try:
                if path.stat().st_size > MAX_FILE:
                    continue
                data = path.read_bytes()
                if b"\0" in data[:1024]:   # binário
                    continue
                yield str(path.relative_to(cwd)), data.decode()
            except (OSError, UnicodeDecodeError):
                continue


# --- dump: tudo no prompt ------------------------------------------------------------

def dump_folder(cwd):
    """Todos os arquivos de texto, um depois do outro, até o limite de tamanho."""
    files = list(text_files(cwd))
    blocks, size = [], 0
    for rel, text in files:
        block = f"=== {rel} ===\n{text}"
        if size + len(block) > MAX_DUMP:
            left = len(files) - len(blocks)
            note = (f"{len(blocks)} arquivos, {size} chars, "
                    f"truncado: {left} arquivos ficaram de fora")
            return "\n\n".join(blocks) + f"\n\n[truncated, {left} more files]", note
        blocks.append(block)
        size += len(block)
    return "\n\n".join(blocks), f"{len(blocks)} arquivos, {size} chars"


# --- index: índice + busca (RAG) -----------------------------------------------------

def retrieve(cwd, task, k=TOP_K):
    """Indexa a pasta e devolve os k trechos que mais combinam com a tarefa.

    Os produtos de verdade usam embeddings ou um índice de trigramas aqui. O formato do
    pipeline é o mesmo: quebrar os arquivos em trechos, pontuar contra a tarefa e colar
    os melhores no prompt.
    """
    # 1. Indexar: quebrar os arquivos em trechos.
    docs = [c for rel, text in text_files(cwd) for c in chunks(rel, text)]
    # 2. Recuperar: dar uma nota a cada trecho e ficar com os melhores.
    scores = bm25([body for _, _, body in docs], task)
    ranked = sorted(zip(docs, scores), key=lambda pair: -pair[1])
    best = [doc for doc, score in ranked[:k] if score > 0]
    # 3. Gerar é com o modelo: os trechos entram no prompt como texto.
    code = "\n\n".join(f"=== {rel}:{line} ===\n{body}" for rel, line, body in best)
    files = len({rel for rel, _, _ in best})
    return code, f"{len(best)} trechos de {files} arquivos, de {len(docs)} indexados"


def chunks(rel, text, size=40):
    """Quebra um arquivo nas linhas em branco, em pedaços de no máximo `size` linhas."""
    lines, start = text.splitlines(), 0
    for i, line in enumerate(lines + [""]):
        if i == len(lines) or (not line.strip() and i - start >= 8) or i - start >= size:
            body = "\n".join(lines[start:i])
            if body.strip():
                yield rel, start + 1, body
            start = i + 1 if not line.strip() else i


def words(text):
    """Palavras em minúsculas e sem acento, com snake_case e camelCase separados."""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    found = re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+", text)
    return [w.lower() for w in found if len(w) > 2]


def bm25(texts, query):
    """A nota de cada texto para a consulta, pela fórmula BM25.

    Uma palavra da consulta vale mais quando é rara entre os textos (idf) e quando
    aparece muito no texto, com retorno decrescente e descontando textos longos.
    """
    terms = [words(t) for t in texts]
    n = len(terms)
    avg = sum(map(len, terms)) / max(n, 1)
    df = Counter(w for t in terms for w in set(t))   # em quantos textos a palavra aparece
    query = set(words(query))

    def score(t):
        tf = Counter(t)
        return sum(math.log(1 + (n - df[w] + .5) / (df[w] + .5))
                   * tf[w] * 2.2 / (tf[w] + 1.2 * (.25 + .75 * len(t) / avg))
                   for w in query if w in tf)

    return [score(t) for t in terms]
