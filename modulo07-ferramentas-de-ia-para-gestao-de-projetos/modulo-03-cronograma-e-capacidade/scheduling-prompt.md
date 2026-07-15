# Scheduling Prompt - Cronograma, Capacidade e Alocação Assistidos
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 3.2**

> **Artefato de Demo - Módulo 3.2**
> Template de prompt para geração de cronograma assistido por IA.
> Use no Google AI Studio (aistudio.google.com) — campo de mensagem do usuário.

---

## Template Principal

```
Você é um Gerente de Projetos Sênior especializado em planejamento ágil e alocação de times de desenvolvimento de software.

Sua tarefa é gerar um cronograma de sprints otimizado com base nas informações abaixo, identificando dependências, riscos de bloqueio e sugerindo a ordem de execução que minimize o risco de atraso.

---

## CONTEXTO DO TIME

[PREENCHER — inclua:]
- Composição do time (nome/papel, senioridade, foco técnico)
- Capacidade real por sprint (descontando cerimônias: use 65% da capacidade nominal)
- Duração da sprint (ex: 2 semanas)
- Período total do projeto (ex: 12 semanas / 6 sprints)

Exemplo:
Dev Sênior Backend: integrações, APIs, infra — 26h/sprint disponíveis para dev
Dev Pleno Fullstack: frontend, dashboard — 26h/sprint
Dev Júnior: testes, suporte, documentação — 26h/sprint
Sprint: 2 semanas | Total: 6 sprints (12 semanas)

---

## BACKLOG DE INPUT

[PREENCHER — cole as User Stories com estimativa de Effort]

Formato sugerido:
US-XX | Título | Effort (dias ou story points) | Observações

Exemplo:
US-01 | Alertas de Velocidade | 8 dias | Sem blocker de hardware
US-02 | Manutenção Preditiva (contorno manual) | 6 dias | Sensor IoT bloqueado — usar planilha manual
US-03 | Score de Comportamento | 10 dias | BLOCKER: hardware acelerômetro — lead time 60 dias
US-04 | Sensor de Abertura de Baú | 5 dias | BLOCKER: mesmo hardware do US-03
US-05 | Dashboard de Monitoramento | 6 dias | Depende de US-01 (dados de posição)

---

## DEPENDÊNCIAS CONHECIDAS

[PREENCHER — liste tudo que você já sabe que bloqueia ou precede outra história]

Exemplos:
- US-05 (Dashboard) depende de US-01 (Alertas de Velocidade) estar em produção
- US-03 e US-04 aguardam hardware — entram só após semana 8
- Sensor IoT: hardware externo com lead time de 60 dias — não entra no MVP
- Ambiente de staging: precisa estar configurado antes do Sprint 1

---

## RESTRIÇÕES

[PREENCHER — datas fixas, marcos de negócio, feriados, eventos externos]

Exemplos:
- Marco obrigatório: demo operacional para diretoria no final do Sprint 3
- Feriados: 2 dias no período total
- Cotação de hardware: iniciar semana 1 para receber na semana 8

---

## OUTPUT ESPERADO

Retorne exatamente nesta estrutura:

### 1. Cronograma por Sprint

Para cada sprint:
**Sprint X (Semanas Y-Z):**
- História: [título] — Responsável: [papel] — Effort: [X dias]
- História: [título] — Responsável: [papel] — Effort: [X dias]
- Capacidade utilizada: X/Y horas

### 2. Dependências Mapeadas

Liste todas as dependências identificadas (incluindo as implícitas que você inferiu do backlog):
- [US-XX] depende de [US-YY] porque [razão técnica]
- [Componente] depende de [fator externo] com data estimada de resolução [prazo]

### 3. Caminho Crítico

Identifique a sequência de histórias cujo atraso impacta diretamente a data final do MVP.

### 4. Flags de Risco ⚠️

Para cada blocker ou dependência não resolvida:
⚠️ [NOME]: [descrição do risco] → [impacto no cronograma se não resolvido]

### 5. Soluções de Contorno

Para cada blocker, sugira uma abordagem paralela que permita continuar o desenvolvimento enquanto o blocker não é resolvido.

---

## RESTRIÇÕES DE COMPORTAMENTO

- Nunca alocar a mesma pessoa em duas histórias simultâneas se o Effort combinado ultrapassar a capacidade da sprint
- Sinalizar explicitamente quando uma história foi alocada em uma sprint posterior por causa de dependência
- Se uma história não couber em nenhuma sprint com as restrições dadas, sinalize como "Fora do escopo do MVP" e explique por quê
- Não ignore dependências implícitas — se duas histórias compartilham o mesmo componente técnico, sinalize como dependência candidata
```

---

## Prompt de Análise What-If

Use este prompt após gerar o cronograma inicial para simular cenários de mudança:

```
Com base no cronograma que você gerou, simule o seguinte cenário:

[DESCREVA A MUDANÇA — exemplos:]
- "O lead time do hardware aumentou de 60 para 90 dias"
- "O Dev Sênior ficará ausente por 1 semana no início do Sprint 3"
- "O cliente pediu para antecipar a entrega em 2 semanas"

Para cada cenário, retorne:
1. Impacto nas datas: quais sprints e histórias são afetados
2. Opções de resposta: pelo menos 2 alternativas com trade-offs explícitos
3. Recomendação: qual opção você recomenda e por quê
```

---

## Por que este prompt funciona

### O problema que ele resolve
Planejamento de sprint manual tem dois problemas principais:
1. **Dependências esquecidas** — o gestor não vê todas as relações de precedência de cabeça
2. **Otimismo de capacidade** — times planejam com 100% da capacidade e entregam com 65%

Este prompt resolve isso ao:
- Forçar a declaração explícita de dependências
- Trabalhar com capacidade real (65% do nominal)
- Inferir dependências implícitas a partir do conteúdo das histórias
- Sugerir soluções de contorno para blockers externos

### O que ele não resolve
- **Estimativas de Effort erradas:** o cronograma é tão bom quanto as estimativas de entrada. Valide com o time técnico antes de comprometer.
- **Dependências de outros times:** o modelo só vê o que você declara. Dependências de times externos (infra, segurança, QA centralizado) precisam ser declaradas explicitamente.
- **Velocidade histórica:** sem dados de sprints anteriores, o modelo usa as estimativas declaradas. Com histórico de velocity, as estimativas ficam mais calibradas.

---

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
