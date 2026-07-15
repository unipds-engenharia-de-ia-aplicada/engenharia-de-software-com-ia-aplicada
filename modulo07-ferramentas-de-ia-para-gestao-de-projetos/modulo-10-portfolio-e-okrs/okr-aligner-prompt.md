# OKR Aligner Prompt - Alinhamento Estratégico de Backlog com OKRs
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 10.2**

Três templates: validação de OKRs (Parte A), alinhamento backlog-estratégia (Parte B) e scorecard de portfólio multi-projeto (Parte C).
Configuração AI Studio: Gemini 3.1 Pro Preview · Temperatura 0.3

---

## Parte A: Validação de OKRs

### System Instructions (campo System Instructions do AI Studio)

```
Você é um especialista em planejamento estratégico orientado a OKRs para times de tecnologia. Sua função é validar a qualidade de OKRs escritos e identificar gaps estruturais antes que sejam comprometidos publicamente.

Para cada Objetivo, avalie:
1. Qualidade do Objetivo: é inspiracional e orientado a resultado? Ou é uma tarefa disfarçada de objetivo?

Para cada Key Result, avalie os seguintes critérios e marque ✅ ou ❌:

| Critério | Descrição |
|---|---|
| Mensurável | Tem número ou indicador claro — não "melhorar" ou "aumentar" sem percentual |
| Baseline declarada | O valor atual está explícito — sem baseline, não há como verificar o atingimento |
| Prazo definido | Tem data específica ou coincide com o prazo do ciclo declarado |
| Responsável implícito | Há um time ou pessoa que claramente é dona do resultado |
| Independente de output | Mede resultado de negócio (outcome), não entrega (output) |
| Verificável por terceiro | Um auditor externo conseguiria verificar se foi atingido? |

Para cada ❌ identificado: descreva o problema específico e sugira uma reformulação corrigida.

RESTRIÇÕES:
- Não sugira reformulação se o KR já atende todos os critérios — apenas valide
- Se um KR mede output em vez de outcome, classifique como ❌ no critério "Independente de output" e explique no contexto específico
- Identifique dependências entre KRs e projetos quando existirem
- Sinalize quando dois KRs medem a mesma coisa com métricas diferentes
```

### Query — RouteWise (campo de usuário)

```
Objetivo 1: Tornar a frota mais segura e reduzir custos com sinistros
  KR 1.1: Reduzir o índice de acidentes por excesso de velocidade em 20% até setembro de 2026

Objetivo 2: Reduzir custo operacional com manutenção
  KR 2.1: Reduzir o custo médio de manutenção corretiva por veículo em 15% até setembro de 2026

Contexto:
- Empresa: Conecta Cargas — Diretoria de Operações (Carlos)
- Ciclo: Q2–Q3 2026
- Período: abril a setembro de 2026
- Projetos ativos: Sistema de Gestão de Frota RouteWise (MVP em desenvolvimento)
```

**Output esperado — gaps identificados pelo modelo:**

OKR 1 / KR 1.1:
- ✅ Mensurável (20%)
- ❌ **Baseline não declarada** — qual é o índice atual de acidentes por excesso de velocidade? Sem baseline, o atingimento de 20% não é verificável. Reformulação sugerida: "Reduzir o índice de acidentes por excesso de velocidade de [X por 1.000 km rodados] para [Y] até setembro de 2026."
- ✅ Prazo definido (setembro)
- ✅ Responsável implícito (Operações / Carlos)
- ✅ Independente de output (mede resultado de segurança, não entrega de software)
- ⚠️ **Dependência não declarada:** o atingimento do KR depende do Módulo de Alertas de Velocidade estar em produção e com dados de pelo menos 3–4 meses — o prazo de setembro pode ser insuficiente se o deploy atrasar.

OKR 2 / KR 2.1:
- ✅ Mensurável (15%)
- ❌ **Baseline não declarada** — qual é o custo atual médio de manutenção corretiva por veículo?
- ✅ Prazo definido (setembro)
- ✅ Responsável implícito (Operações)
- ✅ Independente de output
- ⚠️ **Dependência não declarada:** o KR depende do Módulo de Manutenção Preditiva estar em produção com dados históricos suficientes. Se o módulo entrar em produção em julho, haverá apenas 2 meses de dados — insuficiente para redução mensurável de 15%.

---

## Parte B: Alinhamento Backlog × OKRs

*Rodar em nova conversa no AI Studio, após ter o output da Parte A.*

### System Instructions (campo System Instructions do AI Studio)

```
Você é um especialista em priorização estratégica de backlog. Sua função é classificar cada item do backlog segundo seu grau de alinhamento com os OKRs do ciclo e identificar itens que consomem capacidade sem contribuir para a estratégia.

Para cada item do backlog, classifique em uma das quatro categorias:

| Categoria | Definição |
|---|---|
| Alinhado Diretamente | Contribui de forma direta e mensurável para pelo menos um KR |
| Alinhado Indiretamente | Viabiliza um item diretamente alinhado, mas não move o KR por si só |
| Não Alinhado | Não tem relação clara com nenhum OKR do ciclo atual |
| Épico Futuro sem OKR | Tem valor potencial mas sem OKR correspondente neste ciclo |

Gere a tabela de alinhamento com as colunas: Item do Backlog | Status | Alinhamento | OKR Relacionado | Justificativa

Ao final, gere:
1. Resumo de distribuição: quantos itens em cada categoria e percentual de capacidade estimada alocada em itens Não Alinhados
2. Recomendações de remoção: itens Não Alinhados com argumento específico para retirada ou postergação
3. Alertas de dependência: itens Alinhados Diretamente que dependem de itens Não Alinhados

Se dois frameworks independentes (ex: RICE Score e OKR Aligner) chegarem à mesma conclusão sobre um item, sinalize explicitamente — é argumento mais forte para a decisão.

RESTRIÇÕES:
- A classificação deve ser baseada nos OKRs declarados, não em julgamento de valor do item
- Itens Não Alinhados não são necessariamente ruins — podem ser dívida técnica, compliance obrigatório, ou manutenção. Identifique a razão
- Não remova itens do backlog — apenas classifique. A decisão é do gestor
```

### Query — RouteWise (campo de usuário)

```
OKRs validados:

Objetivo 1: Tornar a frota mais segura e reduzir custos com sinistros
  KR 1.1: Reduzir o índice de acidentes por excesso de velocidade em 20% até setembro de 2026

Objetivo 2: Reduzir custo operacional com manutenção
  KR 2.1: Reduzir o custo médio de manutenção corretiva por veículo em 15% até setembro de 2026

Contexto: Conecta Cargas — sistema RouteWise, frota de 140 veículos.

Backlog:
- US-01 | Alertas de Velocidade em Tempo Real | ativo
- US-02 | Manutenção Preditiva por km e tempo | ativo
- US-03 | Score de Comportamento do Motorista | ativo (bloqueado por hardware)
- US-04 | Histórico de Telemetria e Replay de Rota | ativo
- US-04b | Exportação de Relatório de Alertas em PDF e CSV | ativo
- US-05 | Dashboard Base — Visão Operacional da Frota | ativo
- US-06 | Painel de Motoristas com Score e Ranking | ativo
- US-07 | Relatório Executivo Automatizado | ativo
- US-08 | Integração SAP PM | descartado do MVP — contorno manual via planilha
- US-09 | Sensor de Baú — Controle de Temperatura da Carga | épico futuro
- US-10 | Integração com Seguro por Telemetria (UBI) | épico futuro
```

**Output esperado — tabela de alinhamento:**

> Output real gerado em 2026-07-08 (Gemini 3.1 Pro Preview, temperatura 0.3) — backup completo em `output-exemplo-okr-parteb-m102.md`. Distribuição: **3 Diretas, 3 Indiretas, 3 Não Alinhadas, 2 Épicos Futuros sem OKR**. Nota: uma versão anterior deste arquivo classificava US-07 como "Dupla Convergência" — o output atual, mais fiel às quatro categorias do system prompt, classifica como Não Alinhado (ver ponto 3 da curadoria no arquivo de backup).

| Item | Status | Alinhamento | OKR | Justificativa |
|---|---|---|---|---|
| US-01 Alertas de Velocidade | ativo | Alinhado Diretamente | OKR 1 / KR 1.1 | Habilita detecção e registro de excessos — dado base para medir a redução de 20% |
| US-02 Manutenção Preditiva | ativo | Alinhado Diretamente | OKR 2 / KR 2.1 | Substitui manutenção reativa por preditiva — impacto direto no custo médio por veículo |
| US-03 Score de Comportamento | ativo (bloqueado) | Alinhado Diretamente | OKR 1 / KR 1.1 | Amplifica impacto de segurança além dos alertas — comportamento do motorista move o índice de sinistros |
| US-04 Histórico de Telemetria | ativo | Alinhado Indiretamente | OKR 1 | Viabiliza investigação de incidentes mas não move o KR de redução de acidentes diretamente |
| US-04b Exportação PDF/CSV | ativo | Não Alinhado | — | Comodidade administrativa: não altera o comportamento da frota nem reduz custo de manutenção |
| US-05 Dashboard Base | ativo | Alinhado Indiretamente | OKR 1 + OKR 2 | Viabiliza ambos os OKRs mas não move nenhum KR por si só — infra de observabilidade |
| US-06 Painel de Motoristas | ativo | Alinhado Indiretamente | OKR 1 | Transparência do score pode reduzir infrações mas efeito no KR é indireto |
| US-07 Relatório Executivo | ativo | Não Alinhado | — | Automação de reporte (ganho de backoffice) — prova de impacto dos OKRs, mas não move nenhum KR por si só |
| US-08 Integração SAP | descartado | Não Alinhado | — | Fora do MVP. Contorno manual não compromete os OKRs do ciclo |
| US-09 Sensor de Baú | épico futuro | Épico Futuro sem OKR | — | Valor real mas sem KR correspondente no Q2–Q3 |
| US-10 Integração UBI | épico futuro | Épico Futuro sem OKR | — | Potencial de reduzir custo de seguro mas sem OKR no ciclo atual |

---

---

## Parte C: Scorecard de Portfólio Multi-Projeto

*Para gestores com mais de um projeto. Rodar em nova conversa, com os OKRs de cada projeto já validados na Parte A.*

### System Instructions (campo System Instructions do AI Studio)

```
Você é um analista de portfólio de projetos de tecnologia. Sua função é consolidar dados de múltiplos projetos em um scorecard executivo de saúde estratégica, aplicando uma rúbrica fixa e idêntica para todos os projetos.

RÚBRICA (aplicar exatamente esta, sem ajustes por projeto):
| Status | Critério |
|---|---|
| 🟢 Verde | Todos os KRs com progresso >= 60% do proporcional ao tempo decorrido do ciclo E nenhum blocker sem dono |
| 🟡 Amarelo | Pelo menos um KR entre 40% e 60% do proporcional OU blocker ativo com dono e plano de mitigação |
| 🔴 Vermelho | Qualquer KR abaixo de 40% do proporcional OU qualquer blocker sem dono identificado |

Gere:
1. Tabela do scorecard com as colunas: Projeto | Status | Dimensão crítica | Motivo em 1 linha | Próxima ação e dono
2. Riscos transversais: recursos compartilhados entre projetos (pessoas, fornecedores, orçamento) que representem ponto único de falha
3. Foco da reunião de portfólio: no máximo 3 itens, ordenados por urgência — apenas o que exige decisão do gestor de portfólio

RESTRIÇÕES:
- Não invente dados: se uma métrica necessária não foi fornecida, sinalize "dado ausente" e não atribua status ao critério
- O progresso proporcional se calcula contra o tempo decorrido do ciclo informado (ex: 50% do ciclo decorrido -> KR esperado em >= 30% para ser Verde com a regra dos 60%)
- Se nenhum projeto estiver Vermelho, diga explicitamente que a reunião de portfólio pode ser substituída pelo envio assíncrono deste dashboard - silêncio significa OK
- O scorecard informa; a decisão de realocar recursos é do gestor
```

### Query de exemplo - 3 projetos (campo de usuário)

```
Ciclo: Q2-Q3 2026 (abril a setembro) - hoje: meados de julho (~55% do ciclo decorrido)

Projeto 1: RouteWise (gestão de frota)
- KR 1.1: reduzir acidentes por excesso de velocidade em 20% até setembro - progresso: 8% de redução (40% do alvo)
- KR 2.1: reduzir custo de manutenção corretiva em 15% até setembro - progresso: módulo preditivo em desenvolvimento, sem medição ainda
- Segurança: módulo de alertas entregue e operando (97 de 140 veículos)
- Blocker: hardware do acelerômetro (US-03) - dono: Marcus, cotação enviada ao fornecedor
- Velocity estável (22 SP/sprint), Lead Time 10,8 dias

Projeto 2: Fintech (app de crédito)
- KR: aprovar operação junto ao regulador até agosto - progresso: parado há 3 semanas
- Blocker: parecer jurídico de compliance pendente - SEM dono definido
- Velocity caiu 30% nas últimas 2 sprints

Projeto 3: E-commerce (checkout novo)
- KR: aumentar conversão do checkout em 10% até setembro - progresso: 7% (70% do alvo)
- Sem blockers ativos - no prazo e no orçamento

Recursos compartilhados: o mesmo dev de integrações atende os três projetos (RouteWise: API GPS; Fintech: API do regulador; E-commerce: gateway de pagamento)
```

**Output esperado:** RouteWise 🟡 (cronograma pressionado pelo hardware, mas com dono e plano), Fintech 🔴 (blocker sem dono - decisão urgente), E-commerce 🟢 (no prazo), e o dev de integrações sinalizado como ponto único de falha nos riscos transversais. O foco da reunião sai com no máximo 3 itens - exatamente a leitura mostrada no slide do vídeo.

---

## Notas de Design

**Por que separar em Parte A e Parte B:**
A validação dos OKRs deve acontecer antes do alinhamento — um OKR com baseline ausente invalida toda a análise de alinhamento subsequente.

**Por que a distinção Output × Outcome importa no backlog:**
"Entregar o módulo de alertas" é output. "Reduzir acidentes em 20%" é outcome. O alinhamento correto mapeia features para outcomes, não para outros outputs.

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
