# 🧭 Arquitetura de Sistemas com IA

Este repositório centraliza os prompts, canvases, códigos e atividades desenvolvidos durante a disciplina de **Arquitetura de Sistemas com IA**. Ao longo de 5 módulos, construímos os padrões de arquitetura de referência para sistemas de IA agentic sobre um caso único — o **TrialForge**, sistema de geração de documentos clínicos regulatórios da Vitalis Pharma — indo do diagrama de referência (Gateway → Orquestrador → Modelo+RAG → Approval Gate, com banda de Observabilidade) até um protótipo enterprise com model tiering e trilha de auditoria.

**Professor:** [Dr. José Ahirton Batista Lopes Filho](https://github.com/ahirtonlopes)

---

## 📂 Estrutura do Repositório

Cada módulo tem sua pasta com os artefatos usados nas demos dos vídeos: canvases de decisão, protótipos executáveis, dados de referência e a atividade prática (PDF).

```bash
.
├── modulo-01-fundamentos-ai-first/     # Diagrama de referência, framework de decisão agente/regra, trade-offs
├── modulo-02-single-agent/             # Anatomia do agente, loop ReAct, reflexão, ferramentas/MCP, protótipo
├── modulo-03-multi-agent/              # Por que múltiplos agentes, 6 padrões de orquestração, CAP + Saga
├── modulo-04-padroes-ai-especificos/   # RAG avançado, roteamento, cache semântico, Approval Gate formal
└── modulo-05-arquitetura-enterprise/   # Stack completo, observabilidade em escala, implantação híbrida, model tiering
```

## 🗂️ Tipos de arquivo em cada módulo

| Padrão | O que é |
|--------|---------|
| `*-canvas.md` / `*-selector*.md` / `*-checklist.md` | Canvas ou framework de decisão da demo — preencha com o seu próprio caso |
| `*-prototype.js` / `*_prototype.py` | Protótipo executável do módulo (JS e Python equivalentes) |
| `provedores-pagos.js` / `provedores_pagos.py` | Alternativas pagas (Claude, Gemini, GPT) ao Ollama local |
| `package.json` / `package-lock.json` | Dependências Node.js do protótipo daquela pasta |
| `audit-trail*.jsonl` | Log de execução de referência do protótipo — trilha de auditoria |
| `Atividade N - Módulo N.pdf` | Missão Prática do módulo |
| `Exemplo - Módulo N.pdf` | Exemplo resolvido da atividade |
| `cheat-sheet-*.pdf` / `.png` | Material de apoio visual extra (comparativo entre providers de nuvem) |
| `AI-Architecture-Decision-Canvas*.pdf` | Canvas de decisão de arquitetura, em branco e preenchido com o TrialForge |

## 🛠️ Stack Central

- **Engine padrão:** Ollama local (`gemma4:e2b`, ~7.2GB) — gratuito, sem chave de API, roda inteiro na sua máquina
- **Alternativas pagas (referência):** Claude (Anthropic), Gemini (Google), GPT (OpenAI) — mesma lição do diagrama de referência: o modelo é a peça que se troca
- **Códigos:** Node.js e Python (paridade funcional entre as duas versões em todo protótipo)
- **Case:** TrialForge (Vitalis Pharma) — geração de documentos clínicos regulatórios (ICF, Protocolo, CSR)

### Por que rodar local, e qual o trade-off

Escolhemos Ollama local como padrão do curso por um motivo de acesso: ninguém fica de fora por não ter cartão de crédito ou chave de API paga. Mas isso é uma troca real, não almoço grátis — os mesmos quatro eixos do Módulo 1.4 (latência, custo, precisão, performance) se aplicam aqui:

| | Local (Ollama) | Provedor pago (Claude/Gemini/GPT) |
|---|---|---|
| Custo | Zero | Por token |
| Dado | Nunca sai da sua máquina | Sai pra API do provedor |
| Rate limit | Nenhum | Existe, por provedor |
| Qualidade de resposta | Mais limitada (modelo pequeno) | Modelo de fronteira |
| Requisito | Disco (~7-17GB) + RAM pra inferência | Só internet + chave de API |
| Contexto de uso | Aprendizado e prototipagem | Produção real |

Essa é uma decisão de **prototipagem**, não de **produção**. Numa arquitetura enterprise de verdade (Módulo 5), rodando dezenas de estudos simultâneos com trilha de auditoria regulatória, escala e conformidade pesariam mais que custo zero — provavelmente a escolha seria um provedor gerenciado, não um modelo local no laptop de alguém.

## ▶️ Como usar

1. Assista ao vídeo do módulo.
2. Abra o canvas (`*-canvas.md`) correspondente e preencha com o seu próprio caso.
3. Para rodar um protótipo: instale o Ollama ([ollama.com](https://ollama.com)), deixe rodando em segundo plano, e rode `ollama pull gemma4:e2b` (~7.2GB — baixe com calma antes, não durante o exercício). Depois `npm install` na pasta e `node <arquivo>.js` (ou `python <arquivo>.py`). Módulos 4.5 e 5.4 também precisam de `ollama pull nomic-embed-text` e `ollama pull gemma4` (modelo maior, ~9.6GB).
4. Compare a sua execução com o `audit-trail*.jsonl` de referência, quando existir.
5. Faça a Missão Prática (`Atividade N - Módulo N.pdf`) e confira com o `Exemplo - Módulo N.pdf`.

---

*UNIPDS — Pós-graduação em Engenharia de Software com IA Aplicada*
