# Jira - Estado do Board para este Módulo
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 6.2**

> **Módulo 6.2 - Meeting Digest com IA**
> Configure seu board no estado abaixo antes de acompanhar a demo.

---

## Estado opcional: Sprint 2 encerrado / Sprint 3 recém-iniciado

A demo principal do teleprompter processa a **Sprint Review do Sprint 2 da RouteWise** para mostrar como as decisões que originaram o US-05 e o US-06 viram ata, ações e JSON para Jira. O estado abaixo é opcional caso você queira também demonstrar a variação com a transcrição de discovery.

Se você está vindo diretamente do Módulo 5.2, pode manter o board no snapshot de Sprint 4 que foi usado no Risk Monitor. Para a demo principal de M6.2, o Jira funciona como destino conceitual do JSON, não como fonte de verdade da análise. O objetivo é mostrar a origem das decisões e ações que depois aparecem no board e nos relatórios.

---

## Checklist de configuração

- [ ] Sprint 2 **encerrado** (ou Sprint 3 recém **ativo**)
- [ ] **US-01** com status **"Em Progresso"** — testes piloto ativos; entrega formal no Sprint 4
- [ ] **US-02** com status **"Feito"** — contorno manual entregue
- [ ] **US-03** com status **"A fazer"** — hardware não chegou
- [ ] Pelo menos **2 bugs do Sprint 1** com status **"Feito"**
- [ ] Pelo menos **1 bug** ainda **"A fazer"** (realismo)

---

## Estado detalhado sugerido

| Issue | Descrição | Status | Obs |
|-------|-----------|--------|-----|
| US-01 | Alertas de Velocidade em Tempo Real | 🟡 Em Progresso | Testes piloto com 2 supervisores; entrega formal com todos os ACs no Sprint 4 |
| US-02 | Manutenção Preditiva — contorno manual | ✅ Feito | Alerta por km/tempo |
| US-03 | Score de Comportamento (MVP parcial) | 🔴 A fazer | Bloqueado: hardware |
| BUG-S1-01 | Rastreadores MQTT em rede 3G | ✅ Feito | Resolvido no S2 |
| BUG-S1-02 | Duplicação de registros | ✅ Feito | Resolvido no S2 |
| BUG-S2-01 | Mapa não renderiza no Firefox | 🟡 A fazer | Aberto no S2 |

---

## Como chegar a esse estado opcional

Use apenas se quiser demonstrar a variação de Sprint Review do Sprint 2:

1. Altere **US-01** e **US-02** para **"Feito"**
2. Mantenha **US-03** como **"A fazer"** (bloqueado por hardware)
3. Feche os bugs do Sprint 1 que ainda estiverem abertos
4. Encerre o Sprint 2 ou inicie o Sprint 3 — qualquer um funciona para a demo

---

## Contexto narrativo para a demo

Na Sprint Review alternativa (`sprint-review-s2-routewise.md`), o time entregou **22/22 SP** no Sprint 2. Duas novas decisões foram tomadas na review:

- **US-05 volta** ao planejamento — demanda do diretor (board de julho)
- **US-06 é criada** — demanda do RH (Ana Lima, Gestão de Pessoas)

O Meeting Digest gerado na demo captura exatamente essas decisões e produz o JSON de importação de US-06 como novo card no Jira. O aluno vê a história nascer na reunião e ir direto para o board.

Input principal da demo: `transcricao-sprint-review-s2.md` (Sprint Review do Sprint 2)
Backup principal do output: `output-digest-backup-sprint-review-m62.md`
Input alternativo (discovery): transcrição de discovery em `meeting-digest-prompt.md` do M6.1
Backup alternativo: `output-digest-backup-sprint-review-m62.md`

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
