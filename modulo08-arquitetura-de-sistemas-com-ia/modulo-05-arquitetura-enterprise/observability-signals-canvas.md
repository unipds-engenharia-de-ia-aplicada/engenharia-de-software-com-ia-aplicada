# Canvas de Sinais de Observabilidade
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 5.2**

Use este canvas pra decidir quais sinais monitorar num sistema de IA em produção: os quatro clássicos de qualquer sistema distribuído, mais o sinal extra que só faz sentido quando um componente é não-determinístico.

## 1. Os quatro sinais clássicos (Google SRE)

Para o seu sistema, defina o que cada sinal significa concretamente:

| Sinal | O que mede | TrialForge / Vitalis Platform | Sua métrica concreta |
|---|---|---|---|
| Latência | Tempo até responder | Latência por estudo, por componente (Gateway/Orquestrador/Modelo+RAG) | |
| Tráfego | Volume de demanda | Requisições por estudo (Protocolo, ICF, CSR) | |
| Erros | Taxa de falha | Falhas de geração por estudo | |
| Saturação | Quão "cheio" o sistema está (fila de inferência, uso de GPU) | Fila de inferência do modelo compartilhado entre os ~30 estudos | |

## 2. O quinto sinal: qualidade semântica

Os quatro sinais acima podem estar todos verdes com a IA já tendo piorado por baixo: Chen, Zaharia e Zou (Stanford/Berkeley, 2023) mediram a acurácia do GPT-4 numa tarefa de números primos caindo de 84% em março pra 51% em junho do mesmo ano, mesma API, mesma latência; e em dezembro de 2023 usuários relataram publicamente um GPT-4 "preguiçoso", devolvendo respostas truncadas, o que a própria OpenAI confirmou não ser intencional. Defina um proxy de qualidade pro seu sistema:

- [ ] Taxa de aprovação sem edição (gerou → humano aceitou direto, sem correção)
- [ ] Taxa de rejeição no Approval Gate, ao longo do tempo
- [ ] Pontuação de confiança da própria geração (quando disponível)
- [ ] Amostragem periódica revisada por especialista
- [ ] Outro: ______________________

TrialForge / Vitalis Platform escolheu: taxa de rejeição no Approval Gate ao longo do tempo, por estudo. Um aumento ali sinaliza degradação que nenhum dos quatro sinais clássicos da seção 1 mostraria.

## 3. Metadado mínimo por requisição (convenções OpenTelemetry GenAI)

Confirme que sua trilha registra, por requisição:

- [ ] Identificador do estudo/tenant (sem isso, o orçamento por tenant da seção 4 e a consulta por estudo da seção 5 não têm como funcionar)
- [ ] Versão do modelo usado
- [ ] Versão do prompt usado (com diff disponível)
- [ ] Tokens de entrada e de saída
- [ ] Tempo até o primeiro token (não só duração total)
- [ ] Documentos recuperados, se houver RAG envolvido
- [ ] Custo da chamada

Ferramentas que já implementam esse rastreamento de versão+diff+replay na prática: PromptLayer (trata cada mudança de prompt como um commit, com diff antes de salvar e replay de requisição antiga contra uma versão diferente); Langfuse, projeto aberto adquirido pela ClickHouse em janeiro de 2026 (Série D de US$ 400 milhões, 23M+ instalações de SDK/mês, usado por 19 das 50 maiores empresas da Fortune 500); e Arize Phoenix, opção self-hosted sobre OpenInference/OpenTelemetry, preferível quando o dado é sensível, como no caso da Vitalis Platform.

## 4. Orçamento por tenant

- Nível de hierarquia usado (ex.: Organização → Time → Usuário): ______________________
  (TrialForge / Vitalis Platform, seguindo o padrão do LiteLLM: Organização → Estudo, com bloqueio automático por estudo.)
- O bloqueio por orçamento acontece ANTES ou DEPOIS da chamada ao modelo? ______________________
  (Se for depois, o controle só documenta o estouro; não impede. TrialForge / Vitalis Platform verifica ANTES.)

## 5. Retenção e consulta da trilha

O Módulo 2.5 deixou essa pergunta em aberto de propósito: a trilha de desenvolvimento daquele protótipo não respondia isso, só a trilha formal de produção responde:

- Por quanto tempo a trilha de auditoria fica retida antes de ser arquivada ou descartada? ______________________
- Como alguém consulta a trilha depois (por estudo, por período, por decisão específica)? ______________________
  (TrialForge / Vitalis Platform: retida pelo mesmo prazo regulatório do estudo clínico ao qual pertence. A trilha de um estudo não pode ser descartada antes do próprio estudo encerrar seu ciclo de auditoria; consultada por estudo E por decisão específica, já que cada registro carrega o identificador do estudo e o tier/gate usados.)

## 6. Guardrail de manipulação: pegar antes, não só depois

A taxa de rejeição no Approval Gate (seção 2) é um sinal de qualidade real, mas só aparece DEPOIS que o modelo já gerou a resposta manipulada — o caso da DPD (seção 2) só teria virado sinal na próxima vez. `manipulation-guardrail-prototype.js`, nos materiais deste módulo, testa três casos contra um classificador de entrada (o mesmo modelo barato, sem custo extra): uma pergunta legítima (sem falso positivo), o replay do ataque da DPD (bloqueado), e uma manipulação disfarçada de "auditoria de compliance" sem nenhuma palavra-gatilho óbvia — que passou direto na primeira versão do prompt do classificador, porque ele listava padrões de ataque em vez de testar o escopo real da pergunta. Corrigido testando de verdade, não assumido.

Pro seu sistema:
- Que tipo de instrução de manipulação faria sentido testar no seu domínio? ______________________
- O guardrail substitui a observabilidade, ou os dois se somam? ______________________

## Como usar na atividade prática

1. Preencha a tabela dos 4 sinais clássicos pra um sistema real do seu contexto.
2. Defina o quinto sinal (qualidade), não deixe em branco, mesmo que seja uma métrica simples.
3. Confirme o metadado mínimo da seção 3: qualquer campo ausente é um ponto cego futuro.
4. Responda a seção 5: retenção e consulta não são detalhe de implementação, são requisito de arquitetura desde o primeiro dia.
5. Opcional (vá além): rode `manipulation-guardrail-prototype.js` e responda a seção 6.

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
