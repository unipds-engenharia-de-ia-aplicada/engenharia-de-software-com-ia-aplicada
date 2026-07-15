# Jira - Estado do Board para este Módulo
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 5.2**

> **Módulo 5.2 - AIOps de Projeto**
> Configure seu board para representar o projeto RouteWise após quatro sprints, com a Sprint 5 em andamento.

---

## Estado esperado: Sprint 5 em andamento, risco visível

Neste módulo o board representa um projeto que já saiu do planejamento e entrou em execução. O objetivo é mostrar sinais de risco antes que eles virem crise: Lead Time subindo, bugs acumulando e itens parados por dependência de hardware.

### Checklist de configuração

- [ ] Sprints 1 a 4 concluídas ou representadas no histórico do projeto
- [ ] Sprint 5 **ativa**
- [ ] Pelo menos 3 itens em andamento/parados há mais de 5 dias
- [ ] Pelo menos 5 bugs abertos ou acumulados no backlog
- [ ] US-03 Score de Comportamento marcada como bloqueada por hardware/acelerômetro
- [ ] BUG-S4-10 visível como bug crítico relacionado a hardware v1

### Dados esperados para a demo

Use o arquivo `risk-monitor-data-exemplo.csv` como fonte da análise. Ele contém quatro sprints da RouteWise e o contexto da Sprint 5:

- Lead Time sobe de 6,2 para 10,8 dias
- Cycle Time permanece relativamente estável, de 4,8 para 5,3 dias
- Bugs acumulados sobem de 0 para 9 (saldo pontual Sprint 4: 5 abertos)
- Itens parados há mais de 5 dias sobem de 0 para 3
- Hardware acelerômetro v2 chega apenas na semana 9

### Como simular no Jira

Se não for possível reproduzir todo o histórico no board, mostre apenas o estado atual da Sprint 5 e use o CSV como fonte de verdade para a demo no AI Studio.

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
