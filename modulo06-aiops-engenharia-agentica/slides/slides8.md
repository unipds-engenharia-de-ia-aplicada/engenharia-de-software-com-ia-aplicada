---
marp: true
theme: uncover
class: invert
paginate: true
backgroundColor: #0a0e14
color: #e6edf3

---
# Módulo 8: CI/CD Copilot
## Eficiência Extrema no Ciclo de Entrega
**Professora:** Camilla Martins

---
# Aula 8.1: Pipelines Inteligentes
- **O Problema:** Workflows rígidos que rodam tudo o tempo todo, desperdiçando tempo e dinheiro.
- **CI/CD Adaptativo:** A IA analisa quais arquivos foram alterados e decide quais jobs de teste e build são realmente necessários.
- **Vantagem:** Redução drástica no tempo de feedback para o desenvolvedor.

---
# Aula 8.2: Otimização de Build e Cache
- **Gargalos Ocultos:** Camadas de Docker não otimizadas e falta de cache em gerenciadores de pacotes (npm, pip, go).
- **Análise de Performance:** O Agente revisa o `workflow.yaml` em busca de padrões de desperdício.
- **ROI:** Menos tempo de Runner ligado = Menos custo na fatura da Cloud.

---
# Aula 8.3: Gates de Qualidade e Auto-Rollback
- **O Deploy de Sexta-feira:** Como perder o medo de subir código?
- **Inteligência Pós-Deploy:** A IA monitora métricas de erro (HTTP 5xx) nos primeiros 5 minutos.
- **Decisão Autônoma:** Se a taxa de erro sobe, a IA dispara o rollback via API do GitHub/GitLab sem intervenção humana.

---
# Prática 6: Otimizando o Runner
- **Cenário:** Pipeline do microserviço 'checkout' levando 10 minutos para rodar.
- **Fluxo do Lab:** O Agente analisa um arquivo de workflow real, identifica a falta de cache e gera uma versão otimizada que reduz o tempo em 60%.

**▶️ Comandos de Execução:**
```bash
# 1. Rodar o Copilot de CI/CD (Via venv)
./venv/bin/python3 labs/modulo8_cicd.py