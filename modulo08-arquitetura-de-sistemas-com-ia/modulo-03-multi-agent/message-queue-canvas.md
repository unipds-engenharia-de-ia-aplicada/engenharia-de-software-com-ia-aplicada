# Canvas de Definição de Eventos entre Agentes
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 3.5**

Antes de escrever qualquer código de comunicação entre agentes, declare o contrato de cada evento.

---

## Template

| Evento (nome) | Emitido por | Dado carregado | Quem escuta | Padrão |
|---|---|---|---|---|
| | | | | Sequential / Parallel / Supervisor / Hierarchical / Group Chat / Handoff / Saga (compensação) |

---

## Exemplo de referência: TrialForge

| Evento | Emitido por | Dado carregado | Quem escuta | Padrão |
|---|---|---|---|---|
| `protocolo:pronto` | Agente Protocolo | `{ versao, criterios }` | Agente ICF, Agente CSR | Sequential → Parallel |
| `icf:pronto` | Agente ICF | `{ documento, versaoProtocolo }` | Agente Supervisor | Parallel → Supervisor |
| `csr:pronto` | Agente CSR | `{ documento, versaoProtocolo }` | Agente Supervisor | Parallel → Supervisor |
| `icf:handoff-bioetica` | Agente ICF | `{ contextoAcumulado, motivo }` | Agente Bioética | Handoff |
| `protocolo:revisar` | Agente Supervisor (compensação) | `{ motivo }` | Agente Protocolo | Saga (compensação) |

---

## Código de referência (EventEmitter, Node.js)

```javascript
const filaDeMensagens = new EventEmitter();

async function agenteProtocolo(estudo) {
  const criterios = await gerarCriterios(estudo);
  filaDeMensagens.emit('protocolo:pronto', { versao: 1, criterios });
}

filaDeMensagens.on('protocolo:pronto', async (msg) => {
  const [icf, csr] = await Promise.all([
    agenteICF(msg.criterios),
    agenteCSR(msg.criterios),
  ]); // agora sim roda em paralelo (dois awaits em sequência rodaria em série)
  filaDeMensagens.emit('supervisor:verificar', { icf, csr });
});
```

**Nota:** o código acima implementa só a fatia `protocolo:pronto` → `supervisor:verificar`, chamando `agenteICF`/`agenteCSR` direto via `Promise.all` em vez de cada um emitir seu próprio evento de conclusão, mais simples quando só um listener (o Supervisor) depende do resultado dos dois. As outras linhas da tabela acima (`icf:pronto`, `csr:pronto`, `icf:handoff-bioetica`, `protocolo:revisar`) descrevem o contrato de eventos do sistema completo, implementadas em outros listeners do mesmo módulo, seguindo o padrão idêntico ao mostrado aqui, não neste único trecho.

---

## Evento rico vs. evento de notificação

- **Evento rico** (usado acima): carrega o dado completo que quem escuta precisa. Menos chamadas extras, mas o evento fica mais acoplado ao formato do dado.
- **Evento de notificação**: só avisa que algo aconteceu; quem escuta busca o dado em outro lugar (banco, cache). Mais desacoplado, mas custa uma chamada extra a cada notificação.

Escolha conscientemente, não por acidente.

---

## Material extra: os três agentes rodando de verdade, com CAP e Saga distintos

O código de referência acima é só a fatia `protocolo:pronto` → `supervisor:verificar`. Em `trialforge-message-queue-prototype.js` (versão em Python: `trialforge_message_queue_prototype.py`), nesta mesma pasta, os quatro agentes (Protocolo, ICF, CSR, Supervisor) rodam de verdade sobre um `EventEmitter` real, com 10 testes automatizados e cinco cenários narrados — dois mecanismos completamente diferentes, ambos implementados de ponta a ponta:

**Mecanismo 1 — CAP completo (falha técnica no meio da execução), os três de verdade:**
- **Timeout explícito**: cada agente roda sob `Promise.race` contra um temporizador real (não uma falha simulada por flag) — se o agente travar, o Supervisor descobre sozinho, de fora, sem precisar que o agente "avise" nada.
- **Retry com limite**: até 3 tentativas de verdade (loop, não uma única tentativa incondicional). Se a falha é transitória, resolve na 2ª; se é persistente, o limite esgota e o Supervisor segue em frente sem aquele resultado — Disponibilidade sobre Consistência, a escolha central do Teorema CAP.
- **Idempotência**: o mesmo cenário com `Promise.allSettled` preserva o resultado do CSR, e cada tentativa de retry reaproveita a mesma chave — nunca duplica o documento do ICF, não importa quantas tentativas rodem.
- **Isto não é Saga** — é timeout+retry+idempotência do Teorema CAP (Módulo 3.4).

**Mecanismo 2 — Saga/compensação de verdade (problema de conteúdo descoberto depois):**
- O Protocolo agora é um recurso **versionado e mutável** (`{ versao, criterios, historico }`), não um valor congelado. Um comitê de ética pode emendar um critério (ex.: idade mínima de 13 para 12 anos) enquanto ICF e CSR já estão trabalhando com a versão anterior.
- Cada agente registra a versão que **usou** e a versão que estava vigente quando **ele próprio terminou** — é essa comparação que permite o Supervisor detectar defasagem, exatamente como o Módulo 3.2 promete ("verifica se os critérios citados em cada um batem entre si").
- Na simulação, o ICF (mais rápido) termina antes da emenda chegar e continua consistente; o CSR (mais lento) termina depois, com o critério antigo — só ele é sinalizado como defasado.
- O Supervisor então dispara a **compensação Saga de verdade**: regenera só o resultado do CSR com o critério corrigido — o ICF, que nunca ficou defasado, não é retrabalhado. Isso é literalmente o que o Módulo 3.4 formaliza: "desfazer apenas o que precisa ser desfeito... preservando o que já estava certo."

Rode com `node trialforge-message-queue-prototype.js` ou `python trialforge_message_queue_prototype.py` — nenhuma dependência externa, nenhuma chave de API: os "agentes" simulam trabalho assíncrono, o objetivo é o padrão de comunicação, não a qualidade de um modelo.

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
