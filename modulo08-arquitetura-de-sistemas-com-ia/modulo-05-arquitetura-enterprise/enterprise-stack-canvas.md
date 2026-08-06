# Canvas do Stack Enterprise
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 5.1**

Use este canvas pra mapear sua própria plataforma de IA (real ou hipotética) contra os 4 componentes do stack e os 3 princípios que tornam o compartilhamento seguro entre múltiplos times/estudos/tenants. Os 4 componentes são o mesmo diagrama de referência do Módulo 1.2 (Gateway, Orquestrador, Modelo+RAG, Approval Gate), agora multiplicado pra atender dezenas de estudos ao mesmo tempo em vez de um só.

## 1. Os 4 componentes do stack

Para cada componente, descreva o que ele é NA SUA plataforma (o exemplo do TrialForge está preenchido de referência, não copie os valores):

| Componente | O que resolve | TrialForge / Vitalis Platform | Sua plataforma |
|---|---|---|---|
| API Gateway | Entrada única pra todos os consumidores | Entrada única pra todos os estudos | |
| Orquestração | Escala workload por demanda | Kubernetes (KServe), canary entre versão de modelo | |
| Serviços Compartilhados | O que existe uma vez só, não uma cópia por time | Embedding, modelo, cache: um serviço só pros agentes ICF, Protocolo e CSR de cada estudo | |
| Observabilidade | Uma trilha, todos os times | Uma trilha, todos os estudos, com orçamento por estudo (Módulo 5.2) | |

Referência de mercado pro API Gateway: LiteLLM (projeto aberto, uso interno até na Netflix, unifica 100+ provedores de modelo atrás de uma única API), Cloudflare AI Gateway e Kong AI Gateway - mesma categoria de produto, com cache, limite de taxa e failover entre modelos embutidos.

## 2. Checklist dos 3 princípios

- [ ] **Loose Coupling**: um consumidor pode trocar de versão (de modelo, de índice, de serviço) sem quebrar os outros?
- [ ] **Clear Interfaces**: cada serviço compartilhado expõe um contrato fixo, documentado, sem vazar detalhe de implementação?
- [ ] **Policy-Driven Control**: limites de acesso e custo estão numa política central avaliada em runtime, ou espalhados no código de cada consumidor?

Formalização acadêmica: Loose Coupling e Clear Interfaces remontam a Stevens, Myers e Constantine, "Structured Design" (1974), e são centrais à literatura de arquitetura de microsserviços (Newman; Erl); Policy-Driven Control segue o modelo de policy engine centralizado do Open Policy Agent, projeto da CNCF.

Se qualquer resposta for "não", esse é o ponto mais frágil da sua arquitetura em escala, não o próximo recurso a adicionar.

## 3. Mapa compartilhado vs. específico (padrão Uber GenAI Gateway)

| O que é | Compartilhado (uma vez só) | Específico (por time/estudo) |
|---|---|---|
| _ex.: autenticação_ | ✅ | |
| _ex.: prompt de domínio_ | | ✅ |
| _ex.: serviço de embedding (TrialForge: nomic-embed-text)_ | ✅ | |
| _ex.: banco de cláusulas regulatórias de um estudo específico (TrialForge)_ | | ✅ |
| _ex.: Semantic Cache (TrialForge: por estudo, nunca compartilhado entre estudos)_ | | ✅ |
| | | |
| | | |

## 4. Portão de entrada pra novo consumidor

Descreva o processo que decide se um time/estudo NOVO pode herdar a infraestrutura compartilhada:

- Quem aprova: ______________________
  (TrialForge / Vitalis Platform: o mesmo especialista regulatório que já opera o Approval Gate do estudo, não um administrador de infraestrutura.)
- O que é revisado antes da aprovação: ______________________
  (TrialForge / Vitalis Platform: se o novo estudo usa o mesmo idioma e o mesmo protocolo regulatório do embedding e do banco de cláusulas compartilhados; um estudo em outro idioma exigiria recalibrar o limiar do Módulo 4.2 antes de herdar o serviço.)
- O que acontece se a revisão for pulada: ______________________
  (TrialForge / Vitalis Platform: o novo estudo herda um limiar calibrado pro contexto errado, e o Approval Gate passa a aprovar com uma confiança que não significa o que deveria significar.)

## 5. Eval Gate: promover não é só rodar sem erro

O canary (seção 2, Kubernetes) resolve COMO trocar de versão sem desligar o sistema — não resolve SE a versão nova deveria ter sido promovida. `model-eval-gate-prototype.js`, nos materiais deste módulo, testa isso de verdade contra o Ollama: dois modelos reais (gemma4:e2b vs. gemma4:e2b-mlx) ficam num caso limite, dentro da tolerância; o mesmo modelo baseline sem a cláusula no contexto (simulando um bug de config, não uma troca de modelo) tem o score despencando bem além da tolerância — o gate bloqueia.

Pro seu sistema:
- Golden set (perguntas com resposta esperada conhecida): ______________________
- Tolerância de regressão aceitável: ______________________
- O que aconteceria hoje se um candidato regredido fosse promovido sem esse gate? ______________________

**Limite conhecido, testado, não corrigido:** o score de groundedness (embedding da resposta vs. embedding da cláusula) não distingue "citou bem, com contexto" de "só ecoou a cláusula sem processar" — testado contra os dois modelos reais deste canvas, os dois reproduzem 61-100% da cláusula em sequência idêntica mesmo em respostas corretas. Cogitamos um segundo classificador penalizando eco literal (mesmo padrão do guardrail do Módulo 5.2) e descartamos com dado real: nesse domínio regulatório, citar quase literal é o comportamento correto e esperado, não um sinal de falha — um classificador assim penalizaria exatamente as respostas boas. Fica registrado como limite da métrica, não como bug.

## Como usar na atividade prática

1. Preencha as 4 seções pra um sistema real do seu contexto (ou hipotético).
2. Marque explicitamente qual dos 3 princípios está mais frágil hoje.
3. Descreva, em 2-3 frases, o que quebraria primeiro se um décimo consumidor novo fosse adicionado amanhã sem nenhuma mudança de arquitetura.
4. Opcional (vá além): rode `model-eval-gate-prototype.js` e responda a seção 5.

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
