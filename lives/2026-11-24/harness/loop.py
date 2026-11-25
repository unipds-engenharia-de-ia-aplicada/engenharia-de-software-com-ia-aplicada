"""O loop do agente: chama o modelo, executa o que ele pediu, devolve o resultado e repete.

É o centro do harness, e é pequeno. Cada passo da aula acrescenta um mecanismo em volta
dele, mas o formato do loop não muda.
"""
from . import permissions
from .codebase import gather
from .model import claude
from .prompts import build_prompt, system_prompt
from .protocol import parse
from .state import load_state, state_text, update_state
from .tools import run_bash

KEEP = 6        # entradas do histórico que o modelo ainda vê (três turnos)
SUB_STEPS = 8   # limite de passos de um subagente

BAD_FORMAT = "Resposta fora do formato: envie uma frase e exatamente um bloco cercado."
SAVE_FIRST = "Salve no estado o que você aprendeu antes de terminar."


class Agent:
    """Uma tarefa, um modelo e o histórico do que já aconteceu."""

    def __init__(self, task, cwd, emit, model=claude, approve=None, stopped=lambda: False,
                 subagent=False, strategy="grep"):
        self.task = task          # o pedido do usuário
        self.cwd = cwd            # a pasta em que os comandos rodam
        self.emit = emit          # avisa a página de cada evento: emit(tipo, **dados)
        self.model = model        # uma função: prompt entra, texto sai
        self.approve = approve    # pergunta ao usuário se o comando roda: True ou False
        self.stopped = stopped    # devolve True quando o usuário clica em Parar
        self.subagent = subagent  # True para um agente filho, criado por delegate
        self.strategy = strategy  # como o código chega ao prompt: dump, grep ou index
        self.history = []         # as respostas do modelo e o que voltou para ele
        self.steps = 0            # chamadas ao modelo até agora

        # A memória fica num arquivo, fora do contexto (state.py). Subagentes não têm.
        self.state = None if subagent else load_state(cwd)
        self.unsaved = False      # rodou comandos desde a última vez que salvou o estado
        if self.state is not None:
            emit("state", state=self.state)

        # O código entra no prompt antes da primeira chamada (codebase.py). Com "grep" não
        # entra nada: o modelo procura sozinho com bash, como nos passos anteriores.
        self.code = ""
        if strategy != "grep" and not subagent:
            self.code, note = gather(strategy, cwd, task)
            emit("context", strategy=strategy, code=self.code, note=note)

    def run(self, max_steps=15):
        """Roda o loop. Devolve a resposta final, ou None se o agente não terminar."""
        for _ in range(max_steps):
            if self.stopped():
                return self.fail("Interrompido.")

            # 1. Pergunta ao modelo o que fazer.
            reply = self.ask_model()
            if self.stopped():
                return self.fail("Interrompido.")

            # 2. Lê o pedido que ele escreveu.
            action = parse(reply)
            self.emit("parsed", block=action and action.kind, body=action and action.body)
            if action is None:
                self.feed(self.warn(BAD_FORMAT))
                continue
            if action.thought:
                self.emit("thought", text=action.thought)

            # 3. Termina, ou executa o pedido e devolve o resultado para o próximo passo.
            if action.kind == "done" and self.unsaved:
                # Pedir no prompt não basta, então o harness insiste.
                self.feed(self.warn(SAVE_FIRST))
                self.unsaved = False
                continue
            if action.kind == "done":
                self.emit("done", answer=action.body)
                return action.body
            self.feed(self.act(action.kind, action.body))

        return self.fail(f"Desistiu após {max_steps} passos.")

    def ask_model(self):
        """Monta o prompt, chama o modelo e guarda a resposta no histórico."""
        self.steps += 1
        # A tarefa e o estado vão em todo prompt. A conversa, só os últimos turnos.
        recent = self.history[-KEEP:]
        prompt, sizes = build_prompt(
            system=system_prompt(self.cwd, self.subagent, self.strategy),
            code=self.code and f"CODE:\n{self.code}",
            state="" if self.state is None else state_text(self.state),
            task=f"TASK: {self.task}",
            history="\n\n".join(recent[:-1]),
            result="\n\n".join(recent[-1:]),
        )
        self.emit("step", n=self.steps, prompt=prompt, sizes=sizes, messages=len(recent))
        reply = self.model(prompt)
        self.emit("reply", text=reply)
        self.history.append(f"YOU:\n{reply}")
        return reply

    def act(self, kind, body):
        """Executa o bloco que o modelo mandou e devolve o texto que volta para ele."""
        if kind == "state":
            return self.save_state(body)
        if self.strategy == "dump":
            return self.warn("Neste modo o modelo não tem ferramentas: responda com done.")
        if kind == "delegate":
            return self.delegate(body)
        return self.bash(body)

    def bash(self, command):
        """Passa o comando pelo portão, roda e devolve a saída para o modelo ler."""
        verdict = permissions.check(command)
        self.emit("command", command=command, verdict=verdict)
        if verdict == "ask":
            verdict = "allow" if self.approve(command) else "denied"
            self.emit("decision", verdict=verdict)
        # Uma recusa volta para o modelo no lugar da saída, para ele mudar de rumo.
        if verdict == "allow":
            output = run_bash(command, self.cwd)
        else:
            output = permissions.REFUSALS[verdict]
        self.emit("output", text=output)
        self.unsaved = self.state is not None
        return f"OUTPUT:\n{output}"

    def save_state(self, body):
        """Aplica o bloco state do modelo e salva o arquivo."""
        if self.state is None:
            return self.warn("Subagentes não têm estado, use bash ou done.")
        ok = update_state(self.state, body, self.cwd)
        self.unsaved = False
        self.emit("state", state=self.state, update=body, ok=ok)
        if ok:
            return "HARNESS: Estado salvo."
        return 'HARNESS: Estado inválido, envie um objeto JSON como {"facts": [...]}.'

    def delegate(self, task):
        """Passa uma subtarefa para um subagente e devolve só a resposta final dele."""
        if self.subagent:
            return self.warn("Subagentes não podem delegar, faça o trabalho você mesmo.")
        # O subagente é este mesmo loop, com um histórico vazio e só o texto da tarefa.
        # Os passos dele chegam à tela pelo emit, mas nunca ao nosso histórico: a única
        # coisa que volta é a resposta final.
        call = self.steps
        self.emit("delegate", id=call, task=task)
        child_emit = lambda kind, **data: self.emit(kind, sub=call, **data)
        child = Agent(task, self.cwd, child_emit, self.model, self.approve, self.stopped,
                      subagent=True)
        answer = child.run(SUB_STEPS)
        self.emit("returned", id=call, answer=answer)
        self.unsaved = True
        return f"SUBAGENT ANSWER:\n{answer or '[o subagente parou sem resposta]'}"

    def feed(self, text):
        """Põe um texto no histórico, para o modelo ler no próximo prompt.

        A página mostra o texto exatamente como ele vai para o modelo.
        """
        self.history.append(text)
        self.emit("fed", text=text)

    def warn(self, problem):
        """Uma correção do harness: aparece na tela e volta para o modelo."""
        self.emit("feedback", text=problem)
        return f"HARNESS: {problem}"

    def fail(self, message):
        self.emit("failed", message=message)
        return None
