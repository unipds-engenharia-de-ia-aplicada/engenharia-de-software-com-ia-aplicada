"""Interface web do harness: inicia uma execução e transmite os eventos dela para a página.

Não é o assunto da aula. O harness está em harness/; este arquivo só liga o loop a uma
página, com Server-Sent Events.
"""
import argparse
import json
import os
import queue
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import harness

INDEX = Path(__file__).parent / "static" / "index.html"
HOME = str(Path.home())

# Uma execução por vez. Os eventos ficam guardados para quem conectar ver a execução
# desde o começo.
events = []
changed = threading.Condition()
stop = threading.Event()
decisions = queue.Queue()        # respostas da página aos pedidos de permissão
waiting = threading.Event()      # ligado enquanto a execução espera uma resposta
backends = []                    # preenchido por um teste ao iniciar
checked = threading.Event()
runs = []                        # um resumo por execução terminada, para a comparação
worker = None
workdir = HOME
max_steps = 15


# --- A execução ----------------------------------------------------------------------

def emit(kind, **data):
    """Recebe um evento do harness e acorda quem está ouvindo."""
    with changed:
        # Serializado na hora: o harness continua mexendo nos objetos que passa.
        events.append((kind, json.dumps({"kind": kind, **data})))
        changed.notify_all()


def approve(command):
    """Pausa a execução até o usuário clicar em Permitir ou Negar na página."""
    waiting.set()
    answer = decisions.get()
    waiting.clear()
    return answer


def work(task, backend, strategy):
    emit("start", task=task, cwd=workdir, backend=backend, strategy=strategy)
    started, answer = time.time(), None
    try:
        agent = harness.Agent(task, workdir, emit, model=harness.BACKENDS[backend],
                              approve=approve, stopped=stop.is_set, strategy=strategy)
        answer = agent.run(max_steps)
    except Exception as e:
        emit("failed", message=str(e))
    summary = summarize(task, backend, strategy, time.time() - started, answer is not None)
    runs.append(summary)
    emit("summary", **summary)
    emit("end")


def summarize(task, backend, strategy, seconds, finished):
    """Quanto uma execução custou, somado nos eventos: toda chamada, do pai e dos filhos."""
    calls, sent, received, parts = 0, 0, 0, {}
    for kind, data in list(events):
        if kind == "step":
            event = json.loads(data)
            calls += 1
            sent += len(event["prompt"])
            for name, size in event["sizes"].items():
                parts[name] = parts.get(name, 0) + size
        elif kind == "reply":
            received += len(json.loads(data)["text"])
    return {"task": task, "backend": backend, "strategy": strategy, "calls": calls,
            "sent": sent, "received": received, "parts": parts,
            "seconds": round(seconds, 1), "finished": finished}


def check_backends():
    backends.extend(harness.working_backends())
    checked.set()
    print(f"backends do modelo: {', '.join(backends) or 'nenhum encontrado'}")


def running():
    return worker is not None and worker.is_alive()


def list_folders(path):
    """Subpastas de path, para o seletor de pasta. Levanta ValueError se não der.

    A mensagem do erro aparece na tela.
    """
    folder = Path(path or HOME).expanduser()
    if not folder.is_absolute() or not folder.is_dir():
        raise ValueError(f"Não é uma pasta: {path}")
    folder = folder.resolve()
    try:
        names = sorted((e.name for e in os.scandir(folder)
                        if e.is_dir() and not e.name.startswith(".")), key=str.lower)
    except PermissionError:
        raise ValueError(f"Sem permissão para ler {folder}")
    parent = str(folder.parent) if folder.parent != folder else None
    return {"path": str(folder), "parent": parent, "dirs": names}


# --- HTTP ----------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def reply(self, code, data=None, ctype="application/json"):
        body = data if isinstance(data, bytes) else json.dumps(data or {}).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/":
            self.reply(200, INDEX.read_bytes(), "text/html; charset=utf-8")
        elif url.path == "/events":
            self.stream()
        elif url.path == "/config":
            self.reply(200, {"cwd": workdir, "home": HOME, "running": running(),
                             "events": len(events)})
        elif url.path == "/folders":
            try:
                self.reply(200, list_folders(parse_qs(url.query).get("path", [""])[0]))
            except ValueError as e:
                self.reply(400, {"error": str(e)})
        elif url.path == "/runs":
            self.reply(200, runs)
        elif url.path == "/state":
            self.reply(200, harness.load_state(workdir))
        elif url.path == "/backends":
            checked.wait()
            self.reply(200, backends)
        else:
            self.reply(404)

    def do_POST(self):
        global worker, workdir
        # Um navegador não manda JSON para outro site sem um preflight, que nunca
        # respondemos. Isso impede outras páginas de iniciar execuções nesta máquina.
        if self.headers.get("Content-Type") != "application/json":
            return self.reply(415)
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")

        if self.path == "/run":
            if running():
                return self.reply(409, {"error": "Já existe uma execução em andamento."})
            task = str(body.get("task", "")).strip()
            if not task:
                return self.reply(400, {"error": "A tarefa está vazia."})
            backend = body.get("backend")
            if backend not in backends:
                return self.reply(400, {"error": f"Backend indisponível: {backend}"})
            strategy = body.get("strategy", "grep")
            if strategy not in harness.STRATEGIES:
                return self.reply(400, {"error": f"Estratégia desconhecida: {strategy}"})
            with changed:
                events.clear()
            stop.clear()
            worker = threading.Thread(target=work, args=(task, backend, strategy), daemon=True)
            worker.start()
            self.reply(202)
        elif self.path == "/stop":
            stop.set()
            if waiting.is_set():
                decisions.put(False)
            self.reply(202)
        elif self.path == "/decision":
            if not waiting.is_set():
                return self.reply(409, {"error": "Nada está aguardando uma decisão."})
            decisions.put(body.get("approve") is True)
            self.reply(202)
        elif self.path == "/folder":
            if running():
                return self.reply(409, {"error": "Espere a execução terminar."})
            try:
                folder = list_folders(body.get("path"))["path"]
            except ValueError as e:
                return self.reply(400, {"error": str(e)})
            # Uma pasta nova começa uma conversa nova. O portão de permissões não muda.
            workdir = folder
            with changed:
                events.clear()
            self.reply(200, {"cwd": workdir})
        elif self.path == "/reset":
            if running():
                return self.reply(409, {"error": "Espere a execução terminar."})
            Path(workdir, harness.STATE_FILE).unlink(missing_ok=True)
            self.reply(200)
        else:
            self.reply(404)

    def stream(self):
        """Manda os eventos da execução para a página, do primeiro até o "end"."""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        i = 0
        try:
            while True:
                with changed:
                    while i >= len(events):
                        changed.wait()
                    kind, data = events[i]
                i += 1
                self.wfile.write(f"data: {data}\n\n".encode())
                self.wfile.flush()
                if kind == "end":
                    return
        except (BrokenPipeError, ConnectionResetError):
            pass


def main():
    global workdir, max_steps
    p = argparse.ArgumentParser(description="Harness de agente mínimo, com interface web.")
    p.add_argument("--port", type=int, default=8000)
    p.add_argument("--host", default="127.0.0.1",
                   help="mantenha o padrão, a não ser que você confie em todos na rede")
    p.add_argument("--cwd", default=".", help="pasta em que o agente começa")
    p.add_argument("--max-steps", type=int, default=15)
    args = p.parse_args()
    workdir = str(Path(args.cwd).resolve())
    max_steps = args.max_steps
    threading.Thread(target=check_backends, daemon=True).start()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.daemon_threads = True
    print(f"pasta do agente: {workdir}")
    print(f"abra http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
