import os
import sys

# Ensure project root is in the Python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from crewai import Task, Crew
from core.agents import get_aiops_agent
from tools.aiops_tools import nl_to_promql, predictive_disk_alert, generate_grafana_dashboard

# Instanciando o Agente com suas 3 ferramentas
aiops_agent = get_aiops_agent(tools=[nl_to_promql, predictive_disk_alert, generate_grafana_dashboard])

# Tarefa única que passa por todas as ferramentas da aula
task_aiops_workflow = Task(
    description="""Temos um relato de lentidão no banco de dados e suspeita de disco enchendo. Execute o fluxo de AIOps:
    1. Traduza o pedido "qual a porcentagem de disco livre?" para PromQL.
    2. Avalie o histórico de métricas: 'Uso atual 85%. Crescimento de 2GB por hora contínuo'. Gere uma previsão de quebra.
    3. Crie um Dashboard dinâmico do Grafana para a equipe acompanhar o incidente de 'Disk Saturation'.""",
    expected_output="O PromQL gerado, o alerta preditivo detalhado e o JSON do dashboard.",
    agent=aiops_agent
)

if __name__ == "__main__":
    print("\n📈 INICIANDO MÓDULO 5: AIOPS & OBSERVABILIDADE PREDITIVA\n")
    crew = Crew(agents=[aiops_agent], tasks=[task_aiops_workflow], verbose=True)
    crew.kickoff()