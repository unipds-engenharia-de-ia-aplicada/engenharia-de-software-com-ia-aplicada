---
marp: true
theme: uncover
class: invert
paginate: true
backgroundColor: #0a0e14
color: #e6edf3

---
# Módulo 9: FinOps e Otimização
## Gestão Financeira Cloud com IA
**Professora:** Camilla Martins

---
# Aula 9.1: Infracost e Visibilidade
- **O Problema:** O desenvolvedor só descobre que o recurso é caro quando a fatura chega no fim do mês.
- **Custo no Pull Request:** A IA analisa o código Terraform e comenta no PR: *"Essa mudança vai aumentar sua conta em $200/mês"*.
- **Cultura FinOps:** Trazendo a responsabilidade de custo para o momento da criação, não da tarifação.

---
# Aula 9.2: Recursos Zumbis (Zombie Resources)
- **O Desperdício Silencioso:** Volumes EBS órfãos, Elastic IPs não associados e Snapshots de 2019.
- **Varredura Automática:** O Agente identifica recursos que não estão conectados a nenhuma instância e sugere a deleção imediata.
- **Impacto:** Limpeza de "lixo" tecnológico que gera economia instantânea sem afetar a produção.

---
# Aula 9.3: Rightsizing e Instâncias Spot
- **Superdimensionamento:** Rodar um Blog em uma `m5.4xlarge` é queimar dinheiro.
- **Análise de Histórico:** A IA olha para o uso real de CPU/RAM dos últimos 30 dias e sugere o "tamanho ideal".
- **Estratégia Spot:** Identificando cargas de trabalho não críticas (Batch, Dev) que podem rodar com 70% de desconto.

---
# Prática 7: Caça aos Zumbis
- **Cenário:** Uma conta AWS com vários volumes de disco (EBS) parados e instâncias gigantes ociosas.
- **Fluxo do Lab:** O Agente FinOps lê o inventário, calcula o prejuízo mensal e gera um plano de ação para economizar $500/mês.

**▶️ Comandos de Execução:**
```bash
# 1. Rodar o Auditor de FinOps (Via venv)
./venv/bin/python3 labs/modulo9_finops.py