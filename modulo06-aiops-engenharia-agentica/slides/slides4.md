---
marp: true
theme: uncover
class: invert
paginate: true
backgroundColor: #0a0e14
color: #e6edf3

---

# Módulo 4: Troubleshooting com ReAct
## Reduzindo MTTR com Inteligência Agêntica
**Professora:** Camilla Martins

---

# Aula 4.1: Framework ReAct
- **Raciocínio Computacional:** Pensar -> Agir -> Observar.
- **Diferença de Agentes Simples:** O Agente ReAct decide qual ferramenta usar baseado na resposta da ferramenta anterior.

---

# Aula 4.2: Depuração de Pods
- **CrashLoopBackOff:** Falha na aplicação ou config.
- **OOMKilled:** Estrangulamento de recursos (Memory Limits).
- **Análise Automática:** A IA lê o `describe pod` e extrai a causa raiz em segundos.

---

# Aula 4.3: Observabilidade Distribuída
- **Correlação:** Unindo métricas (Prometheus) e Traces (Jaeger).
- **Gargalos:** Identificando se a lentidão é no Banco de Dados ou na latência da rede.

---

# Prática: Self-Healing Script
- **Cenário:** Deployment `checkout-api` em estado de erro constante.
- **Fluxo do Lab:** Simular falha -> Diagnóstico da IA -> Aplicação do Fix.

---

**▶️ Comandos de Execução:**
```bash
# 0. Provocar o erro (Cenário Inicial)
kubectl apply -f checkout-broken.yaml

# 1. Rodar o Agente SRE para diagnóstico e auto-cura
python3 labs/modulo4_troubleshooting.py

# 2. Aplicar a correção sugerida pela IA
kubectl apply -f checkout-k8s-fix.yaml

# 3. Validar a recuperação
kubectl get pods