---
marp: true
theme: uncover
class: invert
paginate: true
backgroundColor: #0a0e14
color: #e6edf3

---
# Módulo 3: K8s AI-Ops
## Orquestração e SRE Assistida por IA
**Professora:** Camilla Martins

---

## 3.1 Manifestos e Inteligência de Escala
- **YAML Generativo:** A IA não apenas escreve código, ela entende a infraestrutura necessária (Containers, Ports, Probes).
- **Readiness Probes:** Essencial para evitar que o tráfego chegue a pods não inicializados.

---

## 3.2 O "Go/No-Go" do Rollout
- **Canary Analysis:** Como a IA interpreta logs de erro para decidir o futuro do deploy.
- **Remediação em Tempo Real:** Se o Canary falha, o Agente SRE executa o rollback preventivo.

---

## 3.3 GitOps: O Elo entre IA e Cluster
- **Reconciliação:** A IA atua como o engenheiro que submete o desejo ao Git.
- **Argo CD / Flux:** A peça de software que garante que o desejo da IA se torne realidade no Kubernetes.

---

# Prática: GitOps Flow
- **Cenário:** Deploy do microserviço 'nexus-api' com 2 réplicas.
- **Fluxo do Lab:** Arquiteto desenha o YAML blindado -> SRE aplica no cluster real -> SRE analisa a latência para aprovar o rollout.

**▶️ Comandos de Execução:**
```bash
# 1. Rodar o pipeline de orquestração do K8s
python3 labs/modulo3_k8s_ops.py

# 2. Verificar se o deployment e os pods subiram corretamente
kubectl apply -f nexus-api-k8s.yaml
kubectl get deployments
kubectl get pods