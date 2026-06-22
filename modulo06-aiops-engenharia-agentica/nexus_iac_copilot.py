import os
import sys
import subprocess

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def print_header():
    print("""
========================================================================
   _  _______  ___   _ ___     ___  _  _    ___   _  ___   _ ___
  | |/ /  ___|/ _ \ | | \ \   / / || || |  / _ \ | |/ _ \ | | \ \ 
  | ' /| |__ | | | || | |\ \ / /| || || | | | | || | | | || | |\ \ 
  |  < |  __|| | | || | | \ V / |__   __| | | | || | | | || | | \ \ 
  | . \| |___| |_| || | |  | |     | |    | |_| || | |_| || | |  \ \ 
  |_|\_\____/ \___/ |_|_|  |_|     |_|     \___/ |_|\___/ |_|_|   \ \ 
========================================================================
           NEXUS PLATFORM COMMAND CENTER - AGENTIC OPERATIONS
========================================================================
    """)

LABS = {
    "1": ("Módulo 1: Foundation (S3 Design & Compliance)", "labs/modulo1_foundation.py"),
    "2": ("Módulo 2: IaC Copilot (S3 Generation & Audit)", "labs/modulo2_iac_copilot.py"),
    "3": ("Módulo 3: K8s AI-Ops & GitOps Flow", "labs/modulo3_k8s_ops.py"),
    "4": ("Módulo 4: ReAct, Observabilidade & Self-Healing", "labs/modulo4_troubleshooting.py"),
    "5": ("Módulo 5: AIOps & Observabilidade Preditiva", "labs/modulo5_aiops.py"),
    "6": ("Módulo 6: ChatOps Slack Simulator (Streamlit App)", "streamlit run labs/modulo6_chatops.py"),
    "7": ("Módulo 7: Auditoria de Segurança AI (Trivy Real)", "labs/modulo7_devsecops.py"),
    "8": ("Módulo 8: Otimização de CI/CD (Pipeline Cache)", "labs/modulo8_cicd.py"),
    "9": ("Módulo 9: Auditoria FinOps (Zombie resources)", "labs/modulo9_finops.py"),
    "10": ("Módulo 10: RAG & Auto-Remediação (Runbooks)", "labs/modulo10_remediation.py"),
    "11": ("Módulo 11: Guardrails & Human-in-the-Loop", "labs/modulo11_guardrails.py"),
    "12": ("Módulo 12: Projeto Final (Orquestração Hierárquica)", "labs/modulo12_projeto_final.py")
}

def main():
    while True:
        clear_screen()
        print_header()
        
        print("Selecione um laboratório para executar:")
        for key, (name, _) in sorted(LABS.items(), key=lambda x: int(x[0])):
            print(f"  [{key}] {name}")
            
        print("\nOutras Opções:")
        print("  [D] Iniciar Dashboard Streamlit Principal (ui/app.py)")
        print("  [Q] Sair")
        print("========================================================================")
        
        choice = input("Opção > ").strip().upper()
        
        if choice == 'Q':
            print("\nAté logo! Fechando central de controle Nexus.\n")
            break
        elif choice == 'D':
            print("\n🚀 Iniciando Streamlit Dashboard em ui/app.py...\n")
            try:
                subprocess.run(["streamlit", "run", "ui/app.py"])
            except KeyboardInterrupt:
                pass
        elif choice in LABS:
            name, cmd = LABS[choice]
            print(f"\n🚀 Executando {name}...\n")
            try:
                if cmd.startswith("streamlit run"):
                    subprocess.run(cmd.split())
                else:
                    # Run standard python script
                    subprocess.run([sys.executable, cmd])
            except KeyboardInterrupt:
                print("\n⚠️ Processo interrompido pelo usuário.")
            except Exception as e:
                print(f"\n❌ Erro ao executar módulo: {str(e)}")
            input("\nPressione Enter para continuar...")
        else:
            input("\n❌ Opção inválida! Pressione Enter para tentar novamente...")

if __name__ == "__main__":
    main()
