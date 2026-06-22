import os
import sys

# Ensure project root is in the Python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from crewai import Task, Crew, Process
from core.agents import get_architect, get_auditor
from tools.file_writer import write_file
from tools.security_scan import run_checkov_scan, validate_opa_policies

# Instantiate Agents with tools
architect = get_architect(tools=[write_file])
auditor = get_auditor(tools=[run_checkov_scan, validate_opa_policies])

task_gerar = Task(
    description="Gere um arquivo 'main.tf' para um bucket S3 seguro chamado 'nexus-apollo-data'. Região deve ser us-east-1.",
    expected_output="Arquivo main.tf gerado com sucesso.",
    agent=architect
)

task_auditar = Task(
    description="Valide o 'main.tf' usando o run_checkov_scan e o validate_opa_policies. Se houver erro, o arquiteto deve corrigir.",
    expected_output="Relatório de conformidade final.",
    agent=auditor
)

nexus_pipeline = Crew(
    agents=[architect, auditor],
    tasks=[task_gerar, task_auditar],
    process=Process.sequential,
    verbose=True
)

if __name__ == "__main__":
    print("\n🚀 EXECUTANDO PIPELINE MODULAR (MÓDULO 2)\n")
    nexus_pipeline.kickoff()