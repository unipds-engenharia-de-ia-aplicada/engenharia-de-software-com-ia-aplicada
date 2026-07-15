# 🧭 Ferramentas de IA para Gestão de Projetos

Este repositório centraliza os prompts, códigos, dados de exemplo e atividades desenvolvidos durante a disciplina de **Ferramentas de IA para Gestão de Projetos**. Ao longo de 10 módulos, construímos um pipeline completo de gestão assistida por IA sobre um caso único — o **RouteWise**, sistema de gestão de frota com 140 veículos — indo da transcrição de uma reunião de discovery de 35 minutos até um portfólio com OKRs validados.

**Professor:** [Dr. José Ahirton Batista Lopes Filho](https://github.com/ahirtonlopes)

---

## 📂 Estrutura do Repositório

Cada módulo tem sua pasta com os artefatos usados nas demos dos vídeos: system prompts, queries de exemplo, dados de entrada, outputs de referência e a atividade prática (PDF).

```bash
.
├── modulo-01-planejamento-e-escopo/    # Requirements Copilot: transcrição → backlog estruturado
├── modulo-02-priorizacao-de-backlog/   # Backlog Scorer: RICE, WSJF e calibração com IA
├── modulo-03-cronograma-e-capacidade/  # Scheduling Prompt: dependências, capacidade e what-if
├── modulo-04-estimativas-e-previsoes/  # Probability Forecast: PERT + Monte Carlo (P50/P85/P95)
├── modulo-05-riscos-e-aiops/           # Risk Monitor: anomalias de fluxo antes de virarem crise
├── modulo-06-reunioes-turbinadas/      # Meeting Digest: ata, ações e cards Jira da transcrição
├── modulo-07-status-reports/           # Status Report: 3 audiências a partir dos mesmos dados
├── modulo-08-governanca-e-compliance/  # Compliance Checklist + Danger.js (JS e Python)
├── modulo-09-automacao-de-ecossistema/ # NL to Workflow: Slack → Jira com parser de linguagem natural
└── modulo-10-portfolio-e-okrs/         # OKR Aligner: validação de OKRs e scorecard de portfólio
```

## 🗂️ Tipos de arquivo em cada módulo

| Padrão | O que é |
|--------|---------|
| `*-prompt.md` | System prompt da ferramenta do módulo — cole no campo System Instructions do AI Studio (Temperatura recomendada indicada em cada arquivo) |
| `*-input.md` / `transcricao-*.md` / `*.csv` | Dados de entrada usados na demo (caso RouteWise) |
| `output-exemplo-*.md` / `output-digest-*.md` | Output de referência — compare com a sua execução |
| `jira-estado-board.md` | Snapshot do board do Jira no momento do módulo |
| `*.js` / `*.py` / `*.json` | Códigos e mocks executáveis (Monte Carlo, Danger config, bot de ecossistema) |
| `Atividade - Módulo N.pdf` | Missão Prática do módulo |
| `Exemplo - Módulo N.pdf` | Exemplo resolvido da atividade |

## 🛠️ Stack Central

- **Engine:** Google Gemini (AI Studio)
- **Boards:** Jira (Automation Rules nativas — plano gratuito)
- **Códigos:** Node.js e Python (alternativas equivalentes onde aplicável)
- **Integrações:** Slack, GitHub Actions, Danger.js

## ▶️ Como usar

1. Assista ao vídeo do módulo.
2. Abra o `*-prompt.md` da pasta correspondente e cole o bloco de System Prompt no AI Studio.
3. Use os dados de entrada da pasta (ou os do seu próprio projeto) como mensagem do usuário.
4. Compare seu output com o `output-exemplo-*` — as diferenças são o ponto de partida da curadoria ensinada no módulo.
5. Faça a Missão Prática (`Atividade - Módulo N.pdf`).

---

*UNIPDS — Pós-graduação em Engenharia de Software com IA Aplicada*
