---
marp: true
theme: uncover
class: invert
paginate: true
backgroundColor: #0a0e14
color: #e6edf3

---
# Módulo 5: AIOps
## Observabilidade Preditiva com IA
**Professora:** Camilla Martins

---
# Aula 5.1: Natural Language to Query (NL2Q)
- Chega de pesquisar sintaxes complexas de PromQL ou LogQL de madrugada.
- **O Conceito:** O Agente atua como um tradutor. O SRE escreve "taxa de erro do checkout" e a IA constrói a Query exata.
- **Vantagem:** Democratiza a observabilidade para times de desenvolvimento que não dominam Prometheus.

---
# Aula 5.2: Detecção de Anomalias

- **Alertas Estáticos:** Falham porque geram ruído (ex: CPU a 90% em Black Friday é normal).
- **AIOps (Machine Learning):**
  - **Prophet:** Previsão de séries temporais (sazonalidade).
  - **Isolation Forest:** Detecção de pontos fora da curva em tempo real.
- O alerta toca *antes* da queda.

---
# Aula 5.3: Dashboards Dinâmicos

- O tempo médio para montar um dashboard no Grafana durante um incidente é de 15 a 30 minutos (Tempo perdido de MTTR).
- **Dynamic Dashboards:** A IA lê o contexto do incidente e gera o modelo JSON com os painéis exatos (Logs, Traces e Métricas) automaticamente via API.

---
# Prática 4: O Alerta do Futuro
- **Cenário:** Disco do DB enchendo silenciosamente.
- **Fluxo do Lab:** A IA gera a query, aplica o modelo preditivo (aviso de 4h) e salva o `incident_dashboard.json`.

**▶️ Comandos de Execução:**
```bash
# 1. Rodar o Agente AIOps (Geração do Alerta e do Dashboard)
python3 modulo5_aiops.py

# 2. (Opcional) Subir um Grafana local para testar a importação do incident_dashboard.json
docker run -d -p 3000:3000 --name meu-grafana grafana/grafana

