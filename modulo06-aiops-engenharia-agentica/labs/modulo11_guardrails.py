import os
import sys

# Ensure project root is in the Python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from crewai import Agent, Task, Crew
from core.llm_config import nexus_llm

# Agente SRE com foco em segurança
safety_sre = Agent(
    role='Safety_SRE',
    goal='Diagnosticar falhas e propor correções seguras no Kubernetes.',
    backstory='Você é um engenheiro sênior cauteloso. Você SEMPRE usa dry-run.',
    llm=nexus_llm,
    verbose=True
)

# Task que exige aprovação humana
task_remediation = Task(
    description="""
    Detectamos que o pod 'checkout-api' está com erro de imagem. 
    1. Proponha o comando 'kubectl set image' para a versão estável 'v2.0'.
    2. Apresente o comando com a flag --dry-run=client para o engenheiro validar.
    """,
    expected_output="O comando exato para correção e o resultado do dry-run.",
    agent=safety_sre
)

if __name__ == "__main__":
    # Simulando o Human-in-the-loop no terminal
    print("\n🚀 [NEXUS-BOT] Iniciando análise de remediação...")
    nexus_crew = Crew(agents=[safety_sre], tasks=[task_remediation], verbose=True)
    resultado = nexus_crew.kickoff()
    
    print(f"\n⚠️ PROPOSTA DA IA:\n{resultado}")
    aprovacao = input("\n✅ Você aprova a execução deste comando em PRODUÇÃO? (sim/não): ")
    
    if aprovacao.strip().lower() == 'sim':
        print("\n🔥 Executando comando... (Simulado)")
        print("Status: Pod 'checkout-api' atualizado com sucesso!")
    else:
        print("\n🛑 Operação ABORTADA pelo engenheiro. Registrando no log de auditoria.")