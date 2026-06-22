import os
import sys

# Ensure project root is in the Python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from crewai import Crew, Task, Process
from core.agents import (
    get_nexus_manager_agent,
    get_oncall_sre, 
    get_devsecops_agent, 
    get_finops_agent
)

# 1. Instanciar os Agentes Especialistas
sre = get_oncall_sre()
seguranca = get_devsecops_agent()
finops = get_finops_agent()

# 2. Instanciar o Manager (O Cérebro)
# Ele coordenará os outros agentes sem precisar de uma Task manual para cada um
nexus_manager = get_nexus_manager_agent()

# 3. Definir a Missão Integradora
missao_complexa = Task(
    description="""
    ANALISAR E REMEDIAR INCIDENTE MULTIDOMÍNIO:
    1. O checkout-api está fora do ar (Erro 500 no K8s).
    2. Foi detectado um backdoor crítico no pacote XZ (vulnerability scan).
    3. O custo da infraestrutura subiu 40% na última hora.
    
    COORDENAÇÃO:
    - Peça ao SRE para analisar os logs do Kubernetes.
    - Peça ao Analista de Segurança para validar o risco do backdoor XZ.
    - Peça ao FinOps para identificar o que causou o pico de custo.
    
    ENTREGA: Um relatório executivo consolidado com as ações tomadas e o ROI da operação.
    """,
    expected_output="Relatório Executivo de Resposta a Incidentes e Otimização de Custos.",
    agent=nexus_manager # O Manager é o dono da Task principal
)

# 4. Configurar a Crew com Processo Hierárquico
# É aqui que a mágica acontece: o manager assume o comando
nexus_crew = Crew(
    agents=[sre, seguranca, finops], # Os especialistas disponíveis
    tasks=[missao_complexa],
    process=Process.hierarchical,     # <--- O segredo do "Cérebro" está aqui
    manager_agent=nexus_manager,      # Define QUEM manda
    verbose=True,
    memory=False                      # Desativado para evitar erros de biblioteca no Mac
)

if __name__ == "__main__":
    print("\n🚀 [NEXUS-BOT] INICIANDO OPERAÇÃO HIERÁRQUICA...")
    resultado = nexus_crew.kickoff()
    
    print("\n🏆 RELATÓRIO FINAL DO PROJETO INTEGRADO:")
    print(resultado)