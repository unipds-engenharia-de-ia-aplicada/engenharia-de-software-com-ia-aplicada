# Canvas de Decisão de Implantação
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 5.3**

Use esta árvore por COMPONENTE do seu sistema, não pro sistema inteiro de uma vez: o mesmo sistema pode (e normalmente deve) misturar os três modelos, seguindo o exemplo real da Kingfisher plc.

## A árvore de decisão

1. **Esse componente processa tráfego constante e alto o dia inteiro?**
   Sim → **Kubernetes** (sempre ligado). Utilização acima de ~22-48% (dependendo da tolerância de latência) já paga a infraestrutura dedicada, pela regra prática documentada pela DigitalOcean.
   Não → siga para a pergunta 2.

2. **O uso é esporádico ou imprevisível, sem problema em tolerar alguns segundos de cold start?**
   Sim → **Serverless**. Mitigue cold start com modelo quantizado (4 bits reduz peso a mover; o Google Cloud documenta isso como mitigação padrão pra IA no Cloud Run) e, se o volume justificar, capacidade mínima reservada; a Modal leva essa mitigação além com snapshot de memória de GPU, reduzindo um boot de ~2000s pra ~50s (40x mais rápido, sem trocar hardware).
   Não → siga para a pergunta 3.

3. **A distância física até um servidor central é o problema, por latência ou por dado sensível que não devia sair do dispositivo?**
   Sim → **Edge**. Rede de borda (tipo Cloudflare Workers AI) se o problema é latência de muitos usuários espalhados; on-device (modelo local, tipo Apple/Gemini Nano) se o problema é privacidade ou operação offline.
   Não → provavelmente é um componente interativo de baixo volume. Considere capacidade reservada mínima em vez de forçar em qualquer um dos três extremos.

**Ressalva pra contexto regulado:** Edge/on-device resolve privacidade de processamento, mas não substitui a trilha de auditoria centralizada exigida pelos Módulos 4.4 e 5.2. Se algum componente do seu sistema for pra Edge, garanta que a trilha (não o dado bruto, só o registro da decisão) ainda sincroniza pro repositório central de auditoria — processar local não pode virar desculpa pra não auditar.

## Aplicado ao TrialForge

| Componente | Perfil de tráfego | Modelo escolhido | Por quê |
|---|---|---|---|
| Gateway / Orquestrador | Constante, alto, o dia inteiro | Kubernetes | Mesmo perfil que a Kingfisher mantém em GKE |
| Agente CSR | Raro, imprevisível | Serverless | Mesmo raciocínio dos pipelines elásticos da Kingfisher em Kubeflow |
| Revisão do Approval Gate | Interativo, baixo volume, sensível a latência | Capacidade reservada mínima | Nem cold start (serverless) nem custo de sempre-ligado em escala (K8s) fazem sentido |

## Seu caso: aplique a árvore aos seus componentes

| Componente | Perfil de tráfego | Modelo escolhido | Por quê |
|---|---|---|---|
| | | | |
| | | | |
| | | | |

## Como usar na atividade prática

1. Liste os componentes principais do seu sistema (ou hipotético).
2. Rode a árvore acima pra cada um, separadamente: não assuma que a resposta do componente 1 vale pros outros.
3. Para qualquer componente que for pra Serverless, anote explicitamente qual mitigação de cold start você usaria.

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
