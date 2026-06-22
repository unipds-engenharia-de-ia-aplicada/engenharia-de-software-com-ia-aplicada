---
marp: true
theme: uncover
class: invert
paginate: true
header: 'Nexus-Bot | Módulo 13.2'
footer: 'Instrutora: Camilla Martins (@PunkDoDevops)'
---

# ☸️ Módulo 13.2: Kubernetes Local
## Do Docker ao Cluster com Minikube

---

### 🏗️ Por que Minikube no Lab?

- **Padrão de Mercado:** A ferramenta mais utilizada para aprendizado e testes locais de K8s.
- **Driver Docker:** Roda levemente dentro do seu Docker Desktop no Mac.
- **Dashboard:** Interface gráfica nativa para visualizar seus Pods e Agentes.
- **Escalabilidade:** Permite testar HPA e limites de recursos para a nossa IA.

---

### 🛠️ O Workflow de SRE no Minikube

Para o Nexus-Bot funcionar, seguiremos o fluxo:
1. **Start:** Iniciar o cluster com driver docker.
2. **Env:** Apontar o shell para o daemon do Minikube.
3. **Build:** Construir a imagem "dentro" do cluster.
4. **Deploy:** Aplicar os manifestos YAML.

---

### 🚀 Comandos Essenciais

```bash
# Iniciar o cluster
minikube start --driver=docker

# Configurar o shell para o Docker do Minikube
eval $(minikube docker-env)

# Build da imagem (agora direto no cluster!)
docker build -t nexus-bot:v1 .
```

---

### 💻 Código do Módulo 13.2: Manifestos K8s

Os manifestos que criamos para o Kind funcionam perfeitamente aqui, mas vamos adicionar um detalhe de **SRE real**: limites de memória (Resource Quotas), já que LLMs podem ser gulosas.

#### 1. `k8s/secrets.yaml`
Gere o base64 da sua chave no terminal: `echo -n "SUA_CHAVE" | base64`.

----

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: nexus-secrets
type: Opaque
data:
  GROQ_API_KEY: <SUA_CHAVE_EM_BASE64>
```