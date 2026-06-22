---
marp: true
theme: uncover
class: invert
paginate: true
header: 'Nexus-Bot | Módulo 13.3'
footer: 'Instrutora: Camilla Martins (@PunkDoDevops)'
---

# ☁️ Módulo 13.3: Cloud Simulada
## LocalStack dentro do Kubernetes

---

### 🎯 Por que LocalStack no Minikube?

- **Desenvolvimento Offline:** Simulamos S3, SQS e DynamoDB sem custos de infraestrutura real.
- **Arquitetura Cloud-Native:** Ensinamos o Agente a interagir com endpoints de API em vez de caminhos locais.
- **DNS Interno:** O Nexus-Bot acessa o serviço via `http://localstack:4566` usando o Service Discovery do K8s.

---

### 🛠️ Configurando a Infra de Suporte

Para o Nexus-Bot "enxergar" a AWS local, precisamos de dois objetos:
1. **Deployment:** Onde o motor do LocalStack roda.
2. **Service:** Que expõe a porta 4566 para os outros Pods.

---

### 🚀 Comando de Deploy

```bash
# Aplicando a infra de nuvem simulada
kubectl apply -f k8s/localstack.yaml

# Validando se a "AWS" está de pé
kubectl get pods -l app=localstack
```

---

### 💻 Código do Módulo 13.3: `k8s/localstack.yaml`

Este arquivo deve ser criado na sua pasta `k8s/`. Ele define a "nuvem privada" que o seu cluster vai utilizar.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: localstack
  labels:
    app: localstack
spec:
  selector:
    app: localstack
  ports:
  - port: 4566
    targetPort: 4566
````

---

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: localstack
spec:
  replicas: 1
  selector:
    matchLabels:
      app: localstack
  template:
    metadata:
      labels:
        app: localstack
    spec:
      containers:
      - name: localstack
        image: localstack/localstack:latest
        ports:
        - containerPort: 4566
        env:
        - name: SERVICES
          value: "s3,sqs,iam" # Ativamos apenas o necessário para os agentes
        - name: DEBUG
          value: "1"
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"

```

---

### 🧪 Testando a Cloud Local

Não basta subir, tem que validar!

1. **Service Discovery:** O K8s resolve `http://localstack:4566` automaticamente.
2. **Health Check:** Validamos se os serviços S3/SQS estão prontos.
3. **Persistência:** Criamos recursos via API e validamos com `awslocal`.

---

### 🚀 Comando de Ouro para o Lab

```bash
# Verificando a saúde da AWS Simulada
kubectl exec -it deployment/localstack -- awslocal s3 ls
kubectl exec -it deployment/localstack -- awslocal s3 mb s3://nexus-logs
kubectl exec -it deployment/localstack -- sh -c "echo 'Relatorio Nexus v2' > teste.txt && awslocal s3 cp teste.txt s3://nexus-logs-2/"
kubectl exec -it deployment/localstack -- awslocal s3 ls