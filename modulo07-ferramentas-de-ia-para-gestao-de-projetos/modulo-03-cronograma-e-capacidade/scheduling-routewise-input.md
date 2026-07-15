# Scheduling Input - RouteWise MVP (Demo M3.2)
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 3.2**

> **Artefato de Demo - Módulo 3.2**
> Input preenchido para rodar no Google AI Studio (temperatura 0.3).

---

## Como usar no AI Studio

1. Acesse [aistudio.google.com](https://aistudio.google.com)
2. Crie um novo prompt (botão "+ Create")
3. No campo **"System instructions"**, cole o bloco da seção abaixo
4. No campo de mensagem do usuário, cole o bloco da seção **"Query do usuário"**
5. Ajuste a temperatura para **0.3** (painel lateral direito)
6. Clique em **"Run"**

---

## System Instructions

Cole este bloco no campo "System instructions" do AI Studio:

```
Você é um Gerente de Projetos Sênior especializado em planejamento ágil e alocação de times de desenvolvimento de software.

Sua tarefa é gerar um cronograma de sprints otimizado com base nas informações fornecidas pelo usuário, identificando dependências, riscos de bloqueio e sugerindo a ordem de execução que minimize o risco de atraso.

Regras de comportamento:
- Nunca alocar a mesma pessoa em duas histórias simultâneas se o Effort combinado ultrapassar a capacidade da sprint
- Sinalizar explicitamente quando uma história foi alocada em sprint posterior por causa de dependência
- Se uma história não couber com as restrições dadas, sinalize como "Fora do escopo do MVP" e explique por quê
- Não ignore dependências implícitas: se duas histórias compartilham o mesmo componente técnico, sinalize como dependência candidata
- Retorne sempre na estrutura solicitada no OUTPUT ESPERADO
```

---

## Query do usuário

Cole este bloco no campo de mensagem do usuário:

```
Gere um cronograma de sprints otimizado para o projeto abaixo.

---

## CONTEXTO DO TIME

Projeto: RouteWise — plataforma de gestão de frota da Conecta Cargas (140 veículos, operação MG/GO).
Stakeholder: Carlos, Diretor de Operações.
OKR: reduzir sinistros por excesso de velocidade de 7 para 5 até setembro de 2026 (~28% de redução).

Time de desenvolvimento (6 pessoas):
- Dev Sênior Backend: integrações IoT, telemetria, APIs — 26h/sprint disponíveis para dev
- Dev Pleno Fullstack 1: backend services, dados — 26h/sprint
- Dev Pleno Fullstack 2: APIs, integrações — 26h/sprint
- Dev Pleno Frontend: app mobile, notificações push — 26h/sprint
- Dev Pleno Backend 2: modelo preditivo, analytics — 26h/sprint
- Dev Júnior QA: testes, documentação, suporte — 26h/sprint

Sprint: 2 semanas | Total planejado: 6 sprints (12 semanas) | Capacidade estimada: ~35 SP/sprint

---

## BACKLOG DE INPUT

Os itens abaixo foram priorizados via RICE + WSJF no Módulo 2. O US-05 foi removido via MoSCoW antes do scoring.

US-01 | Alertas de Velocidade em Tempo Real | 13 SP | Sem blocker de hardware — só software, usa GPS já disponível nos rastreadores atuais
US-03 | Score de Comportamento do Motorista (MVP parcial) | 8 SP | MVP por velocidade viável usando infra do US-01; score completo (frenagem, aceleração) bloqueado por hardware acelerômetro
US-09 | Sensor de Baú — Controle de Temperatura da Carga | 21 SP | BLOCKER: sensor IoT de temperatura — lead time 60 dias a partir da semana 1
US-02 | Manutenção Preditiva por Telemetria | 34 SP | BLOCKER: sensor IoT (mesmo fornecedor de US-09); modelo preditivo exige acurácia mínima de 80% — risco técnico alto
US-04 | Sensor de Abertura de Baú | 13 SP | BLOCKER: sensor IoT (mesmo fornecedor de US-09)
[US-05 Dashboard Base (HiPPO) removido via MoSCoW — RICE 0.5 — não entra no MVP]

---

## DEPENDÊNCIAS CONHECIDAS

- US-03 Score MVP parcial depende de US-01 estar em produção (reutiliza pipeline de dados de velocidade)
- US-09, US-02 e US-04 aguardam hardware IoT — não podem iniciar antes da semana 9 (lead time 60 dias a partir da semana 1)
- US-03 score completo (acelerômetro) aguarda mesmo hardware — bloqueado até semana 9
- US-02 Manutenção Preditiva depende de dados históricos de telemetria por pelo menos 30 dias após US-01 em produção — adiciona risco de atraso além do hardware
- Ambiente de staging: deve estar configurado antes do Sprint 1
- Pedido de compra do hardware IoT: iniciar semana 1 para receber na semana 9

---

## RESTRIÇÕES

- Marco obrigatório: demo operacional de US-01 (Alertas de Velocidade) para Carlos ao final do Sprint 3 (semana 6)
- OKR prioritário: US-01 é o item de maior impacto direto no OKR de sinistros — não pode deslizar além do Sprint 2
- Hardware IoT: pedido na semana 1, entrega estimada semana 9 (60 dias corridos)
- Capacidade real: usar 65% da capacidade nominal por sprint (cerimônias, bugs, imprevistos)
- Feriados: 2 dias no período total (descontar da sprint correspondente)
- US-02 Manutenção Preditiva: alocar Dev Pleno Backend 2 como responsável principal (modelo preditivo/data science)

---

## OUTPUT ESPERADO

Retorne exatamente nesta estrutura:

### 1. Cronograma por Sprint

Para cada sprint:
**Sprint X (Semanas Y-Z):**
- História: [título] — Responsável: [papel] — Effort: [X SP]
- História: [título] — Responsável: [papel] — Effort: [X SP]
- Capacidade utilizada: X/35 SP

### 2. Dependências Mapeadas

Liste todas as dependências identificadas (incluindo as implícitas inferidas do backlog):
- [US-XX] depende de [US-YY] porque [razão técnica]
- [Componente] depende de [fator externo] com data estimada de resolução [prazo]

### 3. Caminho Crítico

Identifique a sequência de histórias cujo atraso impacta diretamente a data final do MVP.

### 4. Flags de Risco

Para cada blocker ou dependência não resolvida:
[NOME]: [descrição do risco] → [impacto no cronograma se não resolvido]

### 5. Soluções de Contorno

Para cada blocker, sugira uma abordagem paralela que permita continuar o desenvolvimento enquanto o blocker não é resolvido.
```

---

## Prompt What-If — Cenário 1: atraso de hardware

Após gerar o cronograma, rode este prompt em sequência na mesma sessão:

```
Com base no cronograma que você gerou, simule o seguinte cenário:

O fornecedor de hardware IoT comunicou atraso de 4 semanas. O lead time passa de 60 para 88 dias. A entrega do hardware sai da semana 9 para a semana 13.

Para este cenário, retorne:
1. Impacto nas datas: quais sprints e histórias são afetados e como
2. Opções de resposta: pelo menos 2 alternativas com trade-offs explícitos
3. Recomendação: qual opção você recomenda e por quê
```

---

## Prompt What-If — Cenário 2: dev sênior afastado

```
Com base no cronograma que você gerou, simule o seguinte cenário:

O Dev Sênior Backend ficará afastado por 2 semanas no início do Sprint 3 (semanas 5-6) — período que coincide com a demo operacional de US-01 para Carlos.

Para este cenário, retorne:
1. Impacto nas datas: quais sprints e histórias são afetados e como
2. Opções de resposta: pelo menos 2 alternativas com trade-offs explícitos
3. Recomendação: qual opção você recomenda e por quê
```

---

## Prompt What-If — Cenário 3: antecipação de prazo pelo cliente

```
Com base no cronograma que você gerou, simule o seguinte cenário:

O cliente pediu para antecipar a entrega em 2 semanas. O projeto agora precisa terminar no fim da Sprint 5, e a Sprint 6 deixa de existir.

Para este cenário, retorne:
1. Impacto nas datas: quais sprints e histórias são afetados e como
2. Opções de resposta: pelo menos 2 alternativas com trade-offs explícitos
3. Recomendação: qual opção você recomenda e por quê
```

---

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
