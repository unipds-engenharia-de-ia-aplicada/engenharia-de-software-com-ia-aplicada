---
marp: true
theme: uncover
class: invert
paginate: true
backgroundColor: #0a0e14
color: #e6edf3

---
# Módulo 10: RAG de Runbooks
## Conhecimento Vivo e Auto-Remediação
**Professora:** Camilla Martins

---
# Aula 10.1: Playbooks Vivos
- **O Problema:** Documentação estática no Wiki que ninguém lê durante o incidente.
- **RAG (Retrieval-Augmented Generation):** A IA "lê" seus READMEs e Runbooks em tempo real para sugerir a solução exata.
- **Vantagem:** O conhecimento da empresa deixa de ser um PDF esquecido e vira uma ferramenta ativa de SRE.

---
# Aula 10.2: Post-mortems Automáticos
- **Timeline de Incidente:** O terror de todo engenheiro é reconstruir o que aconteceu às 3 da manhã.
- **Automação de Histórico:** A IA analisa logs de chat, métricas e ações tomadas para gerar o rascunho do Post-mortem em segundos.
- **Foco:** Menos tempo preenchendo formulário, mais tempo aprendendo com a falha.

---
# Aula 10.3: O Circuito de Remediação
- **O Fluxo Perfeito:** 1. Alerta dispara.
  2. IA diagnostica via logs.
  3. IA consulta o Runbook (RAG).
  4. IA propõe o Fix no Slack (Módulo 6).
  5. Humano aprova e a IA executa.
- **Conceito:** O fim do trabalho operacional repetitivo.

---
# Prática Final: O SRE Incansável
- **Cenário:** O banco de dados está com conexões saturadas.
- **Fluxo do Lab:** A IA identifica o erro, consulta o `runbook_db.md`, sugere o comando de limpeza e prepara o Post-mortem.

**▶️ Comandos de Execução:**
```bash
# 1. Rodar o Ciclo Completo de Remediação
./venv/bin/python3 labs/modulo10_remediation.py