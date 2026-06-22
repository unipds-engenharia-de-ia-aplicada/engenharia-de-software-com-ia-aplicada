---
marp: true
theme: uncover
class: invert
paginate: true
header: 'Nexus-Bot | Módulo 13.4'
footer: 'Instrutora: Camilla Martins (@PunkDoDevops)'
---

# 🎨 Módulo 13.4: Interface do Agente
## Dashboards com Streamlit no Kubernetes

---

### 🖥️ Por que Streamlit?

- **Python-Native:** Não precisamos aprender JavaScript/React para criar uma UI.
- **Integração:** Conecta-se diretamente com o SDK do LocalStack (Boto3).
- **Real-time:** Mostra o status dos agentes e os logs de infra em tempo real.

---

### 🏗️ Arquitetura no Minikube

- O **Streamlit** roda como um novo Pod no cluster.
- Ele atua como um "Consumidor": lê os relatórios que o Nexus-Job salvou no S3.
- **Acesso:** Usamos o `minikube service nexus-ui` para abrir o túnel no Mac.

---

### 🚀 Fluxo de Operação

1. **Build:** Geramos a imagem da interface.
2. **Deploy:** Subimos o `Service` e o `Deployment`.
3. **Ponte:** O Streamlit aponta para `http://localstack:4566`.

---

# 🎬 Abrindo o Painel de Controle!

```
minikube service nexus-ui
```