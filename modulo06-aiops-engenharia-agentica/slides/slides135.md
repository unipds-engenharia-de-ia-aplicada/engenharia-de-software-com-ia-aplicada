---
marp: true
theme: uncover
class: invert
paginate: true
header: 'Nexus-Bot | Módulo 13.5'
footer: 'Instrutora: Camilla Martins (@PunkDoDevops)'
---

# 🤖 Módulo 13.5: Soberania Digital
## IA Offline com Ollama no Kubernetes

---

### 🚫 O Fim dos Rate Limits

- **Problema:** APIs externas têm limites de tokens (TPM/RPM).
- **Solução:** Rodar Modelos de Linguagem Grandes (LLMs) localmente.
- **Privacidade:** Os dados do Nexus-Bot nunca saem do seu cluster.

---

### 🏗️ Ollama no Cluster

Usaremos o Ollama como um serviço interno:
1. **Service Discovery:** Os agentes acessam `http://ollama:11434`.
2. **Modelo:** Usaremos o `llama3.1:8b` (balanceado para o Mac).
3. **CrewAI Integration:** Mudamos apenas o `base_url` no código.

---

### 🚀 Deploy Final

```bash
# Subindo o motor de IA local
kubectl apply -f k8s/ollama.yaml

# Baixando o modelo para dentro do Pod
kubectl exec -it deployment/ollama -- ollama run llama3.1

```

---

### 💻 Código do Módulo 13.5: `k8s/ollama.yaml`

Este manifesto sobe o Ollama como um serviço no seu cluster.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ollama
spec:
  selector:
    app: ollama
  ports:
  - port: 11434
    targetPort: 11434
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ollama
  template:
    metadata:
      labels:
        app: ollama
    spec:
      containers:
      - name: ollama
        image: ollama/ollama:latest
        ports:
        - containerPort: 11434
        resources:
          limits:
            memory: "4Gi" # LLMs precisam de mais RAM
            cpu: "2"
```
---

### 💻  O que rodar para testar?

```
kubectl exec -it deployment/nexus-ui -- curl http://ollama:11434/api/tags
kubectl exec -it deployment/ollama -- ollama run llama3.1 "Olá! Você está rodando no cluster da Camilla?"
```