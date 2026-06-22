import os
import sys

# Ensure project root is in the Python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from crewai import Task, Crew
from core.agents import get_architect
from tools.policy_rag import check_compliance_rules

# Instantiate the Cloud Architect agent with the compliance checking tool
architect = get_architect(tools=[check_compliance_rules])

task_design_s3 = Task(
    description="Desenhe um bucket S3 para logs seguindo as normas da empresa Nexus.",
    expected_output="Plano detalhado com nome do bucket e região de compliance.",
    agent=architect
)

if __name__ == "__main__":
    print("\n🚀 INICIANDO MÓDULO 1: FOUNDATION\n")
    crew = Crew(agents=[architect], tasks=[task_design_s3])
    crew.kickoff()