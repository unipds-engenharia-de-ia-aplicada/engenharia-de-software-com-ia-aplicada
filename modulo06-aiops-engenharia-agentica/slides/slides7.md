---
marp: true
theme: uncover
class: invert
paginate: true
backgroundColor: #0a0e14
color: #e6edf3

---
# Módulo 7: DevSecOps + AI
## Priorização Inteligente de Vulnerabilidades
**Professora:** Camilla Martins

---
# Aula 7.1: Scans Inteligentes e Falsos Positivos
- Ferramentas tradicionais (Trivy, Snyk) geram centenas de alertas "Critical" e "High".
- **O Problema:** A maioria são vulnerabilidades teóricas em bibliotecas que o seu código nem executa (Fadiga de Alertas).
- **A Solução AI:** O Agente atua como um Especialista de Segurança sênior, filtrando o que é ruído do que é um risco real de exploração.

---
# Aula 7.2: Estudo de Caso Real: CVE-2024-3094
- **O Backdoor do XZ Utils:** Inserido propositalmente em uma biblioteca de compressão amplamente usada em Linux.
- **O Desafio:** Como detectar isso em meio a 500 alertas de segurança de uma imagem Debian estável?
- **A IA em Ação:** O Agente cruza o ID da CVE com bases de inteligência externa e identifica que não é apenas um "bug", mas uma tentativa de invasão ativa.

---
# Aula 7.3: Compliance as Code
- Geração de evidências para auditorias (SOC2, ISO 27001) é um processo lento e manual.
- **Auditoria Contínua:** A IA atua como um pré-auditor, garantindo que as evidências estejam prontas e organizadas antes da certificação.
- **Vantagem:** Reduz o tempo de preparação para auditorias de semanas para minutos.

---
# Prática 5: Triagem do Backdoor
- **Cenário:** Scan da imagem real `python:3.11-slim` reportando 50 CVEs.
- **Fluxo do Lab:** A IA carrega o JSON do Trivy, ignora os falsos positivos e foca 100% no Backdoor do XZUtils (CVE-2024-3094), gerando um plano de ação imediato.

**▶️ Comandos de Execução:**
```bash
# 1. Rodar o Auditor DevSecOps com a Imagem Real (Via venv)
./venv/bin/python3 labs/modulo7_devsecops.py