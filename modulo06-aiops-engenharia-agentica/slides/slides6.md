---
marp: true
theme: uncover
class: invert
paginate: true
backgroundColor: #0a0e14
color: #e6edf3

---
# Módulo 6: ChatOps e Governança
## O Poder da IA com Segurança no Slack/Teams
**Professora:** Camilla Martins

---
# Aula 6.1: Bots Conversacionais
- **O Fim do Terminal Obscuro:** Trazendo a operação de infraestrutura para o chat da empresa.
- **Democratização:** Desenvolvedores interagem com a IA no Slack para criar recursos, sem precisar entender de AWS ou Terraform.

---
# Aula 6.2: RBAC e Guardrails
- **Autonomia não é Anarquia!** - Se a IA pode escalar o cluster (`/scale`), como garantimos que o estagiário não escale 1.000 instâncias de GPU?
- **Integração com IAM:** O Bot cruza a identidade de quem pediu no chat (Slack ID) com as permissões da cloud (RBAC) antes de agir.

---
# Aula 6.3: Workflows de Aprovação

- **Human-in-the-loop (Humano no circuito):** O conceito mais importante para IA corporativa.
- A IA diagnostica, gera o código e prepara o comando. Mas a execução na produção **pausa** e exige o clique de um engenheiro sênior.

---
# Prática 5: Operando o Nexus-Bot
## Governança via ChatOps (Streamlit)

1. **Acesso:** O comando `streamlit run` abrirá o simulador em `http://localhost:8501`.
2. **Interação:** Use o campo de chat para enviar comandos de infraestrutura ao Agente.
3. **Desafio de Segurança:** Tente realizar ações "pacíficas" vs "destrutivas".

**▶️ Comandos para rodar o Simulador:**
```bash
# 1. Garanta que está na raiz do projeto
# 2. Force a execução pelo Python do seu ambiente virtual
python3 -m streamlit run labs/modulo6_chatops.py