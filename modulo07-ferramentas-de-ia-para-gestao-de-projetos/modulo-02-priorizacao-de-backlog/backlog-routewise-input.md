# Backlog RouteWise - Input para Backlog Scorer (U2.2 e U2.3)
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 2.2**

> **Artefato de Demo - Módulo 2.2**
**Contexto para colar ANTES do backlog no AI Studio:**

```
Empresa: Conecta Cargas — empresa de logística com 140 veículos. Projeto/sistema: RouteWise (plataforma de gestão de frota), fase de MVP.
Stakeholder: Carlos (Diretor de Operações).
OKR do Carlos: reduzir sinistros por excesso de velocidade de 7 para 5 até setembro de 2026 (~28% de redução).
Restrição conhecida: lead time de 60 dias para sensores IoT (hardware externo).
Time: 6 devs, sprint de 2 semanas, capacidade ~35 SP por sprint.
```

---

## 6 User Stories (US01, US02, US03, US04, US05, US09 — IDs conforme Jira RouteWise)

**US01 — Alertas de Velocidade em Tempo Real**
Como Carlos, quero receber alertas automáticos quando um motorista ultrapassar o limite de velocidade configurado, para reduzir risco de sinistros e multas.
Critérios de aceitação:
- Alerta gerado em até 60s após detecção de excesso (P95)
- Notificação via app e SMS para o gestor
- Log de eventos com motorista, hora, localização e velocidade registrada
- Configuração de limite por tipo de veículo (urbano/rodovia)

**US02 — Manutenção Preditiva por Telemetria**
Como Carlos, quero que o sistema avise automaticamente quando um veículo atingir o limite de km ou tempo desde a última revisão, e sinalize veículos com probabilidade alta de falha nos próximos 30 dias, para eliminar manutenções reativas e reduzir custos.
Critérios de aceitação:
- Alerta gerado com antecedência mínima de 15 dias (km ou tempo)
- Modelo preditivo com dados de hodômetro, temperatura do motor e histórico de manutenção
- Alerta de falha iminente com antecedência mínima de 7 dias
- Integração com agenda da oficina parceira
- Accuracy mínima de 80% (medida em produção após 60 dias)
Nota: depende de sensor IoT — lead time de 60 dias para hardware.

**US03 — Score de Comportamento do Motorista**
Como Carlos, quero uma pontuação de comportamento por motorista baseada em eventos de telemetria (velocidade, frenagem brusca, aceleração), para criar uma cultura de direção segura e identificar quem precisa de treinamento preventivo.
Critérios de aceitação:
- Score de 0–100 calculado automaticamente a partir de dados do sensor
- Relatório semanal por motorista e ranking da frota
- Histórico de evolução do score (últimas 8 semanas)
- Integração com sistema de RH para registro de ocorrências
Nota: score completo bloqueado por hardware (rastreadores v2 com acelerômetro). MVP parcial por velocidade disponível antes.

**US04 — Sensor de Abertura de Baú**
Como Carlos, quero monitorar abertura e fechamento do baú de cada veículo com timestamp e geolocalização, para detectar desvios de carga e não conformidades de entrega.
Critérios de aceitação:
- Registro de cada evento de abertura/fechamento com GPS e hora
- Alerta quando abertura ocorre fora da zona de entrega autorizada
- Relatório diário de conformidade por rota
Nota: depende de sensor IoT — lead time de 60 dias para hardware.

**US05 — Dashboard Base — Visão Operacional da Frota (HiPPO)**
Como Carlos, quero um painel com mapa ao vivo mostrando posição e status de todos os veículos, para ter visibilidade executiva da operação sem consultar múltiplos sistemas.
Critérios de aceitação:
- Mapa com posição de todos os veículos atualizado a cada 30s
- KPIs no topo: veículos ativos, em alerta, e parados
- Filtro por região, motorista e tipo de carga
- Export para PDF para reuniões executivas
Nota: solicitado verbalmente por Carlos em reunião; sem evidência de uso operacional real. Priya (TI) é a usuária mais provável, não Carlos.

**US09 — Sensor de Baú — Controle de Temperatura da Carga**
Como Carlos, quero monitorar a temperatura interna dos baús refrigerados em tempo real, para garantir conformidade com requisitos da ANVISA e evitar perda de carga.
Critérios de aceitação:
- Leitura de temperatura a cada 5 minutos com sensor IoT no baú
- Alerta imediato quando temperatura sair da faixa configurada (ex: 2°C–8°C)
- Log completo para auditoria e comprovação de conformidade
- Relatório de ocorrências por viagem
Nota: depende de sensor IoT — lead time de 60 dias para hardware.
```

---

## Como usar no AI Studio

1. Cole o **Contexto** acima primeiro
2. Cole as **6 User Stories** na sequência
3. Execute o Backlog Scorer (temperatura 0.3)
4. Salve o output em `output-exemplo-m22.md`

Para U2.3: execute novamente com os dados de calibração do [Guia 2.3](Guia-de-Producao-Módulo-2.3.md) adicionados ao contexto.
---

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
