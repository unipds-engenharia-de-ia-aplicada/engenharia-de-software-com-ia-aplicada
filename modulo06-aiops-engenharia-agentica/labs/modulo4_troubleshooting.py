import os
import sys

# Ensure project root is in the Python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from crewai import Task, Crew, Process
from core.agents import get_oncall_sre, get_architect
from tools.k8s_diag import inspect_pod_failure, suggest_fix
from tools.file_writer import write_file
from tools.obs_tools import query_prometheus_metrics, query_jaeger_traces

# 1. Instanciando agentes
# Entregamos as ferramentas de K8s E de Observabilidade para o SRE de Plantão
sre_oncall = get_oncall_sre(tools=[
    inspect_pod_failure, 
    suggest_fix, 
    query_prometheus_metrics, 
    query_jaeger_traces
])

architect = get_architect(tools=[write_file])

# 2. Tarefa 4.1, 4.2 e 4.3 - Diagnóstico ReAct Completo (Logs + Metrics + Traces)
task_diagnose = Task(
    description="""Os usuários estão reportando lentidão e erros no checkout.
    Use o framework ReAct para investigar:
    1. Consulte as métricas do Prometheus para 'error rate' e 'latency'.
    2. Verifique os traces no Jaeger para o serviço 'checkout-api' para achar o gargalo.
    3. Inspecione o pod 'checkout-api' para ver se há falhas (CrashLoopBackOff/OOMKilled).
    4. Sugira a correção baseada no que você observar.""",
    expected_output="Relatório de Incidente contendo a causa raiz (Gargalo + Status do Pod) e a sugestão de correção.",
    agent=sre_oncall
)

# 3. Tarefa 4.4 - Self-Healing (Prática 3)
task_self_healing = Task(
    description="""Com base no diagnóstico do SRE, atue como Arquiteto e gere o arquivo 'checkout-k8s-fix.yaml' com a correção sugerida.
    ATENÇÃO - REGRAS ESTRITAS DE LABORATÓRIO (NÃO DESVIE): 
    1. Gere como 'kind: Deployment'. Nunca 'kind: Pod' solto.
    2. Imagem OBRIGATÓRIA: 'nginx:latest'.
    3. Porta do container e dos probes: 80.
    4. O 'path' dos probes HTTPGet DEVE ser obrigatoriamente '/' (pois o Nginx retorna 404 para '/healthz').
    5. Na API V1, utilize 'initialDelaySeconds'.""",
    expected_output="Manifesto YAML corrigido, validado e persistido no disco.",
    agent=architect
)

# 4. Orquestração
nexus_incident_crew = Crew(
    agents=[sre_oncall, architect],
    tasks=[task_diagnose, task_self_healing],
    process=Process.sequential,
    verbose=True
)

if __name__ == "__main__":
    print("\n🚨 INICIANDO MÓDULO 4: REACT, OBSERVABILIDADE & SELF-HEALING\n")
    nexus_incident_crew.kickoff()