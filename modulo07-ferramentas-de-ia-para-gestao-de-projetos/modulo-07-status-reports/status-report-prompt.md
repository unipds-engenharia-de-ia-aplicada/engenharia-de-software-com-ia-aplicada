# Status Report Prompt - Relatórios Automáticos para Múltiplas Audiências
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 7.2**
> Template para geração de status reports em três variantes: técnico, gerencial e executivo, a partir dos mesmos dados de sprint.

---

## Como usar no AI Studio

**Configuração em dois campos separados:**

| Campo | O que colar |
|-------|-------------|
| **System Instructions** | O bloco "SYSTEM PROMPT" abaixo (sem as crases) |
| **Mensagem do usuário** | Os dados da sua sprint, preenchendo as seções indicadas |
| **Temperatura** | 0.3 |

> Se estiver usando uma plataforma sem campo System separado (ChatGPT Free, Copilot), cole os dois blocos juntos na mensagem do usuário — o template continua funcionando.

---

## SYSTEM PROMPT

Cole no campo **System Instructions** do AI Studio:

```
Você é um especialista em comunicação de projetos de software para audiências diversas. Sua função é transformar dados brutos de sprint em três relatórios distintos, cada um calibrado para a linguagem, nível de detalhe e decisões que cada audiência precisa tomar.

---

## AUDIÊNCIAS

Gere três relatórios distintos para as seguintes audiências:

### RELATÓRIO 1: TIME TÉCNICO
Audiência: desenvolvedores, QA, tech leads
Linguagem: técnica, use métricas (Lead Time, WIP, story points, bugs), termos de engenharia, referências específicas a histórias e componentes
Foco: o que entregamos, o que não entregamos, por que, e o que o time deve ajustar na próxima sprint
Tamanho: 150 a 250 palavras
Formato: texto corrido com dados específicos + lista de ações para a próxima sprint

### RELATÓRIO 2: GESTOR / GERENTE DE PROJETO
Audiência: gerente de projeto, coordenador, PMO
Linguagem: orientada a risco e decisão, use status de cronograma (Verde / Amarelo / Vermelho), impacto em marcos, decisões necessárias
Foco: status atual, risco principal, decisão necessária (máximo 2)
Tamanho: 150 a 200 palavras
Formato: status badge + parágrafo de contexto + seção "Decisão necessária" + próximo marco

### RELATÓRIO 3: EXECUTIVO / DIRETORIA
Audiência: C-level, diretores, stakeholders de negócio
Linguagem: negócio, zero jargão técnico, foco em funcionalidades operacionais, impacto financeiro ou estratégico, riscos em linguagem de negócio
Foco: o que está funcionando, qual risco existe, qual aprovação é necessária (se houver)
Tamanho: 80 a 120 palavras
Formato: 3 a 4 parágrafos curtos: O que está pronto / O que está em risco / Próximo passo / Aprovação necessária (se houver)

---

## RESTRIÇÕES DE COMPORTAMENTO

- O Relatório Técnico pode (e deve) mencionar termos como Lead Time, WIP, story points, velocity: é a audiência correta para isso
- O Relatório Executivo NÃO deve mencionar story points, velocity, Lead Time, bugs, nem siglas sem explicação: se não é acionável para um diretor, não inclua
- O Relatório para Gestão deve ter no máximo 2 decisões necessárias: se houver mais, priorize as duas mais urgentes e mova o restante para contexto adicional
- Os três relatórios devem ser baseados exatamente nos mesmos dados: não invente informação adicional
- Se os dados indicarem risco sério (ex: velocidade caindo por 3+ sprints consecutivas, bugs acumulando), classifique o status como Vermelho no relatório gerencial e inclua linguagem de urgência no executivo
- Após gerar os três relatórios, inclua uma seção "Checklist de Curadoria" com 4 verificações que o PM deve fazer antes de enviar:
  1. Os números de velocidade e datas estão consistentes entre os três relatórios?
  2. O tom está calibrado para a audiência? (técnico = específico; gestor = decisão; executivo = negócio)
  3. As decisões necessárias estão explícitas no relatório gerencial e executivo?
  4. O Relatório Executivo menciona story points, velocity ou Lead Time? Se sim, substitua por linguagem de negócio (prazo, custo, risco).
```

---

## QUERY DO USUÁRIO (template)

Cole na **mensagem do usuário**, preenchendo os campos:

```
## DADOS DA SPRINT

[PREENCHER: cole os dados da sprint encerrada]

Sprint: [número e nome]
Período: [data início] a [data fim]

Métricas de entrega:
- Histórias planejadas: X
- Histórias entregues: X
- Histórias em progresso (passam para próxima sprint): X (descreva)
- Histórias removidas por blocker: X (descreva o blocker)
- Velocidade realizada: X SP
- Velocidade planejada: X SP

Métricas de qualidade:
- Bugs abertos no período: X
- Bugs resolvidos no período: X
- Saldo do sprint: X bugs em aberto (Xº sprint consecutivo com saldo positivo)
- Saldo acumulado cross-sprint: X bugs
- Lead Time médio: X dias (baseline do projeto: X dias)

Contexto de risco:
- Blockers ativos: [descreva]
- Próximo marco: [data e descrição]
- Decisões pendentes com stakeholders: [descreva ou "nenhuma"]

Histórias entregues:
- [ID] [título] (X SP): [uma linha de descrição]
- [ID] [título] (X SP): [idem]
```

---


> **Nota didática:** estes dados representam o fechamento histórico da Sprint 4. O board ao vivo do curso pode estar na Sprint 5 após o Risk Monitor de M5.2; para este módulo, usamos a Sprint 4 porque status reports funcionam melhor com um período encerrado.

## QUERY DE EXEMPLO — Sprint 4 RouteWise

Use estes dados na demo (copie direto para a mensagem do usuário):

```
## DADOS DA SPRINT

Sprint: Sprint 4 - Sistema de Gestão de Frota
Período: 12/05/2026 a 25/05/2026

Métricas de entrega:
- Histórias planejadas: 5
- Histórias entregues: 2
- Histórias em progresso (passam para Sprint 5): 2 (US-02 Manutenção Preditiva — versão automática, US-06 Painel de Motoristas)
- Histórias removidas por blocker: 1 (US-03 Score de Comportamento: hardware com acelerômetro ainda não chegou)
- Velocidade realizada: 22 SP
- Velocidade planejada: 22 SP (capacidade do time: 6 devs)

Métricas de qualidade:
- Bugs abertos no período: 11
- Bugs resolvidos no período: 6
- Saldo do Sprint 4: 5 bugs em aberto (11 − 6), terceira sprint consecutiva com saldo positivo
- Saldo acumulado cross-sprint: 9 bugs (S1: 0 · S2: +1 · S3: +4 · S4: +5)
- Lead Time médio: 10,8 dias (baseline do projeto: 6,5 dias, média Sprint 1+2)

Contexto de risco:
- Blocker ativo: US-03 Score de Comportamento aguardando hardware com acelerômetro. Cotação enviada, sem prazo de resposta do fornecedor
- Bug crítico: BUG-S4-10, guard de hardware bloqueia alertas de velocidade para 43 veículos com rastreador v1
- Próximo marco: apresentação para diretoria em 2 semanas
- Decisões pendentes: aprovação de orçamento para hardware ou remoção do Score de Comportamento do MVP

Histórias entregues:
- US-01: Alertas de Velocidade em Tempo Real (8 SP), funcionalidade core operacional e testada
- US-05: Dashboard Base de Monitoramento (14 SP), visualização de frota em tempo real disponível
```

---

## OUTPUT DE REFERÊNCIA — Sprint 4 RouteWise

Gerado em: 2026-07-10 (AI Studio - Gemini 3.1 Pro Preview) · Temperatura: 0.3

> Backup completo em `output-exemplo-status-report-m72.md`.

---

### RELATÓRIO 1: TIME TÉCNICO

Nesta Sprint 4, atingimos nossa meta de velocidade entregando 22 Story Points, focados nas US-01 (Alertas de Velocidade, 8 SP) e US-05 (Dashboard Base, 14 SP). No entanto, o planejamento de 5 histórias não se sustentou: a US-03 foi removida por blocker de hardware (acelerômetro) e as US-02 e US-06 sofreram spillover para a Sprint 5.

Nosso Lead Time médio subiu para 10,8 dias (muito acima da baseline de 6,5 dias), indicando gargalos no fluxo e alto WIP. Além disso, as métricas de qualidade acenderam um alerta vermelho. Tivemos 11 bugs abertos e apenas 6 resolvidos. Esta é a terceira sprint consecutiva com saldo positivo de bugs, acumulando um total de 9 bugs no backlog. Precisamos estancar esse vazamento. O BUG-S4-10 é crítico, pois o guard de hardware está falhando e bloqueando alertas em 43 veículos com rastreador v1.

**Ações para a próxima sprint:**
- Priorizar a resolução do BUG-S4-10 para liberar os rastreadores v1.
- Atacar o débito técnico para reduzir o saldo acumulado de 9 bugs.
- Limitar o WIP rigorosamente para baixar o Lead Time de volta à baseline.
- Ajustar o capacity planning, considerando que apenas 2 histórias consumiram toda a capacidade (22 SP) do time de 6 devs.

---

### RELATÓRIO 2: GESTOR / GERENTE DE PROJETO

**Status:** 🔴 VERMELHO

**Contexto:**
A Sprint 4 entregou valor essencial com o Dashboard de Monitoramento e os Alertas de Velocidade. Contudo, o status do projeto é Vermelho devido à degradação contínua da qualidade (terceira sprint com acúmulo de bugs, totalizando 9 pendentes) e ao aumento do tempo de entrega (Lead Time subiu para 10,8 dias). Temos um risco severo no cronograma do MVP: a funcionalidade de Score de Comportamento está bloqueada aguardando cotação de hardware. Além disso, um bug crítico está afetando 43 veículos com rastreadores antigos, o que pode impactar negativamente a percepção de valor na próxima entrega.

**Decisão necessária:**
1. Aprovar o orçamento do hardware com acelerômetro imediatamente ou aprovar a remoção do Score de Comportamento (US-03) do escopo do MVP.
2. Autorizar a mudança de escopo da Sprint 5 para focar na redução do backlog de bugs e estabilização do sistema antes da apresentação executiva.

**Próximo marco:**
Apresentação para a diretoria em 2 semanas.

---

### RELATÓRIO 3: EXECUTIVO / DIRETORIA

**O que está pronto:**
O painel central de monitoramento e os alertas de velocidade em tempo real estão operacionais, permitindo visualizar a frota e atuar em infrações imediatamente.

**O que está em risco:**
A funcionalidade de "Score de Comportamento" está paralisada por falta de equipamentos físicos. Além disso, uma falha técnica impede o monitoramento de 43 veículos mais antigos da frota, risco que a equipe já está mitigando.

**Próximo passo:**
Estabilizar o sistema e garantir o funcionamento nos veículos antigos para a apresentação oficial da diretoria em duas semanas.

**Aprovação necessária:**
Precisamos da aprovação imediata do orçamento para a compra dos equipamentos pendentes ou da decisão estratégica de remover o Score de Comportamento do lançamento inicial.

---

### Checklist de Curadoria

- [ ] Os números de velocidade e datas estão consistentes entre os três relatórios?
- [ ] O tom está calibrado para a audiência? (técnico = específico; gestor = decisão; executivo = negócio)
- [ ] As decisões necessárias estão explícitas no relatório gerencial e executivo?
- [ ] O Relatório Executivo menciona story points, velocity ou Lead Time? Se sim, substitua por linguagem de negócio (prazo, custo, risco).

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
