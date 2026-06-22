# 🚀 Nexus AI-Ops: Trilha de Engenharia Agêntica

Este repositório contém os laboratórios práticos da Pós-Graduação em AI-Ops e Engenharia de Plataforma. O projeto evolui desde conceitos fundamentais de IA consultiva, passando por pipelines declarativos de IaC, até a criação de um ecossistema com 11 agentes autônomos que operam infraestrutura real, diagnosticam falhas e aplicam remediações automáticas sob governança.

---

## 🛠️ 1. Preparação do Terreno

### Pré-requisitos

- **Python 3.10 a 3.13** (Evite a versão 3.14 experimental para garantir total compatibilidade com o CrewAI e Pydantic).
- **Docker e `kubectl`** instalados (necessários para as simulações e operações dos módulos de Kubernetes).
- **Uma chave de API da Groq** (o motor central do projeto é o Llama-3.3-70B/3.1-8B).

### Instalação

```bash
# Clone o repositório do curso e acesse a pasta deste módulo
git clone https://github.com/unipds-engenharia-de-ia-aplicada/engenharia-de-software-com-ia-aplicada.git
cd engenharia-de-software-com-ia-aplicada/modulo06-aiops-engenharia-agentica

# Crie e ative o ambiente virtual (Venv)
python3 -m venv venv
source venv/bin/activate  # No Windows: .\venv\Scripts\activate

# Instale as dependências requeridas
pip install -r requirements.txt
pip install streamlit
```

### Instalação no Windows (PowerShell / CMD)

#### PowerShell
```powershell
# Crie e ative o ambiente virtual
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1

# Atualize o gerenciador de pacotes e instale as dependências
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install streamlit
```
Se o PowerShell bloquear a execução de scripts do venv, execute:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

---

## 🎮 2. Central de Controle e Interface Visual

Para facilitar a navegação e a experiência didática, criamos dois painéis centrais interativos:

### 📟 Central de Comando CLI
Inicie um menu interativo no terminal para disparar qualquer um dos 12 laboratórios ou interfaces com apenas uma tecla:
```bash
python3 nexus_iac_copilot.py
```

### 🖥️ Painel Visual AI-Ops (Dashboard)
Inicie o console visual premium em dark-mode com S3 Bucket Explorer conectado ao LocalStack e um OPA Compliance Sandbox para validação em tempo real de HCL:
```bash
streamlit run ui/app.py
```

---

## 🎓 3. Guia de Execução de Todos os Laboratórios (1 a 12)

Os laboratórios estão organizados em scripts individuais na pasta `labs/` e cobrem do início ao fim a esteira de operações inteligentes.

### 🟢 Módulo 1 & 2: IA Consultiva e IaC Copilot
**Cenário**: Validar normas de segurança internas e automatizar a geração de arquivos Terraform HCL aderentes a conformidades.
```bash
# Executa a geração assistida do main.tf e sua auditoria pelo DevSecOps Auditor
python3 labs/modulo2_iac_copilot.py
```

### 🟡 Módulo 3: Kubernetes GitOps & Canary
**Cenário**: Gerar manifestos Kubernetes V1 blindados, simular a reconciliação declarativa (Sync) e analisar métricas de deploy Canary.
```bash
# Gera o arquivo YAML e define a decisão de Rollout baseado em baseline de tráfego
python3 labs/modulo3_k8s_ops.py
```

### 🔴 Módulo 4: Troubleshooting & Self-Healing
**Cenário**: Investigação ReAct de incidentes (CrashLoop/OOMKilled) consumindo Prometheus e Jaeger, seguida de autocorreção gerada pela IA.
```bash
# 1. Simule a quebra aplicando um Pod com imagem errada
kubectl apply -f k8s/deploy.yml

# 2. Rode o SRE de plantão para diagnosticar a causa raiz e salvar o hotfix
python3 labs/modulo4_troubleshooting.py
```

### 🟣 Módulo 5: AIOps Preditivo
**Cenário**: Tradução de linguagem natural para PromQL, seguida de análise de regressão linear para prever saturação de disco 4 horas antes do incidente ocorrer.
```bash
# Gera o alerta preditivo e o JSON estruturado de um Dashboard do Grafana
python3 labs/modulo5_aiops.py
```

### 💬 Módulo 6: ChatOps Slack Simulator
**Cenário**: Simulação real de interação operacional via chat com políticas estritas de segurança (Human-in-the-loop) exigindo senha para ações destrutivas.
```bash
# Dispara a interface do Slack no seu navegador
streamlit run labs/modulo6_chatops.py
```
*Tente digitar:* `@nexus-bot destrua o banco de dados`. O robô pedirá a senha do gestor: `GESTOR-APROVA`.

### 🛡️ Módulo 7: Auditoria de Segurança Real (Trivy Scan)
**Cenário**: Ler relatórios de scans estáticos de imagens em JSON e criar relatórios priorizados contra brechas graves (como a backdoor CVE-2024-3094 no pacote XZ).
```bash
# Processa o scan real data/trivy.json e gera o parecer do DevSecOps Auditor
python3 labs/modulo7_devsecops.py
```

### ⚡ Módulo 8: Otimização Inteligente de CI/CD
**Cenário**: Ler arquivos de workflows do GitHub Actions lentos e reescrevê-los aplicando otimizações com cache no nível das dependências.
```bash
# Lê data/workflow_lento.yaml e sugere a versão acelerada
python3 labs/modulo8_cicd.py
```

### 💰 Módulo 9: FinOps & Rightsizing Cloud
**Cenário**: Auditar inventários de nuvem, identificando recursos "zumbis" (IPs e volumes EBS não associados) e propor cortes com cálculo de ROI.
```bash
# Analisa data/inventario_cloud.json e calcula a economia de custos em dólares
python3 labs/modulo9_finops.py
```

### 📚 Módulo 10: RAG & Auto-Remediação com Runbooks
**Cenário**: Utilizar inteligência baseada em documentos (RAG) para buscar em runbooks corporativos os comandos exatos de resolução de saturação de conexões em BD.
```bash
# Consulta data/runbook_db.md e monta o plano de ação
python3 labs/modulo10_remediation.py
```

### 🚦 Módulo 11: Guardrails & Human-in-the-Loop
**Cenário**: Simular um pipeline autônomo de Kubernetes que detecta erros, sugere o comando de correção usando dry-run e solicita aprovação em linha.
```bash
# Executa a tomada de decisão assistida no terminal
python3 labs/modulo11_guardrails.py
```

### 🧠 Módulo 12: Projeto Final (Orquestração Hierárquica)
**Cenário**: Um incidente multidomínio crítico ocorre em produção (checkout com erro 500, pico de custo de 40% e backdoor detectada). O **Nexus Manager** assume como cérebro da operação e coordena em formato hierárquico os agentes SRE, Segurança e FinOps.
```bash
# Executa a orquestração multiagente hierárquica e consolida o relatório
python3 labs/modulo12_projeto_final.py
```

---

## 🛠️ Solução de Problemas Comuns

### `ModuleNotFoundError: crewai`
Certifique-se de que ativou o ambiente virtual (`source venv/bin/activate`) antes de executar os comandos.

### `ImportError: cannot import name ...`
Todas as ferramentas e funções foram padronizadas em **inglês** no nível de backend. Certifique-se de estar usando a versão atualizada da branch `main` e limpe quaisquer arquivos cache `.pyc` locais:
```bash
find . -type d -name "__pycache__" -exec rm -r {} +
```