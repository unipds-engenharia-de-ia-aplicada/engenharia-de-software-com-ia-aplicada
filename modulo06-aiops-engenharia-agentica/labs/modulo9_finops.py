import json
import os
import sys
from crewai.tools import tool

# Ensure project root is in the Python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from crewai import Task, Crew
from core.agents import get_finops_agent

# --- TOOL DEFINITION ---
@tool("analyze_cloud_costs")
def analyze_cloud_costs(file_path: str) -> dict:
    """Reads a cloud resource inventory and returns the data for cost-saving analysis."""
    with open(file_path, 'r', encoding='utf-8') as file:
        return json.load(file)

# --- CONFIGURATION ---
cloud_inventory_path = os.path.join(PROJECT_ROOT, "data", "inventario_cloud.json")

agent = get_finops_agent(tools=[analyze_cloud_costs])

task_audit_finops = Task(
    description=f"""
    Analise o inventário em '{cloud_inventory_path}'. 
    Identifique: 
    1. Recursos 'Zumbis' (volumes disponíveis mas não usados, IPs soltos).
    2. Instâncias superdimensionadas (Rightsizing).
    Calcule a economia total estimada em dólares e gere um relatório de recomendações.""",
    agent=agent,
    expected_output="Relatório de FinOps com lista de cortes e economia total estimada."
)

if __name__ == "__main__":
    print("\n💰 INICIANDO MÓDULO 9: AUDITORIA FINOPS\n")
    crew = Crew(agents=[agent], tasks=[task_audit_finops])
    crew.kickoff()