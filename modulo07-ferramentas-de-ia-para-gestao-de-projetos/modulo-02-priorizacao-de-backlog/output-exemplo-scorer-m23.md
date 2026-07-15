# Output Backlog Scorer - U2.3 (com calibração)
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 2.3**

Gerado em: 2026-07-02 (pré-gravação)
Input: backlog-routewise-input.md + dados de calibração (benchmarks de domínio + financeiro + analogia)
Modelo: Gemini 3.1 Pro Preview — temperatura 0.2

> Nota: Este output é a segunda rodada do scorer. A primeira rodada (sem calibração) está em output-exemplo-m22.md. O ponto pedagógico da demo é mostrar como o Reach muda quando você ancora em dados reais de analogia, e como o ranking se reorganiza com os dados financeiros de Cost of Delay.

---

## 1. Tabela RICE

| Item | Reach | Impact | Confidence | Effort (pm) | RICE Score |
|------|-------|--------|------------|-------------|------------|
| US01 — Alertas de Velocidade | 1.288 | 3.0 | 80% | 1.0 | 3.091,2 |
| US02 — Manutenção Preditiva | 238 | 2.0 | 80% | 3.0 | 126,9 |
| US-09 — Sensor de Baú — Temperatura da Carga | 140 | 2.0 | 80% | 2.0 | 112,0 |
| US03 — Score de Comportamento | 140 | 1.0 | 50% | 2.0 | 35,0 |
| US04 — Sensor de Baú | 140 | 1.0 | 50% | 2.0 | 35,0 |
| US05 — Dashboard Base (HiPPO) | 10 | 0.25 | 50% | 1.5 | 0,8 |

Nota sobre Reach por analogia (frota de 200 veiculos adaptada para 140, fator 0,7):
- US01: 1.840 acessos x 0,7 = 1.288 (analogia com feature de alertas de velocidade)
- US02: 340 acessos x 0,7 = 238 (proxy de relatório de combustível)
- US-03, US-04, US-09: 140 baseline conservadora (1 evento por veículo/motorista)

## 2. Tabela WSJF

| Item | BV | TC | RR | CoD | Job Size | WSJF |
|------|----|----|----|-----|----------|------|
| US01 — Alertas de Velocidade | 10 | 9 | 7 | 26 | 2 | 13,00 |
| US-09 — Sensor de Baú — Temperatura da Carga | 7 | 8 | 9 | 24 | 4 | 6,00 |
| US04 — Sensor de Baú | 4 | 3 | 6 | 13 | 4 | 3,25 |
| US03 — Score de Comportamento | 5 | 3 | 5 | 13 | 5 | 2,60 |
| US02 — Manutenção Preditiva | 8 | 5 | 6 | 19 | 8 | 2,38 |
| US05 — Dashboard Base (HiPPO) | 2 | 2 | 1 | 5 | 3 | 1,67 |

BV: Business Value | TC: Time Criticality | RR: Risk Reduction | CoD: Cost of Delay

## 3. Ranking Combinado

1. US01 — Alertas de Velocidade em Tempo Real (Vencedor absoluto em RICE e WSJF. Ataca o OKR principal e evita multas de R$ 15.000/infração ANTT)
2. US09 — Sensor de Baú — Controle de Temperatura da Carga (Alto WSJF por risco de compliance ANVISA e perda de carga de alto valor)
3. US02 — Manutenção Preditiva por Telemetria (Forte alinhamento com OKR secundário, penalizado pelo alto Effort/Job Size)
4. US04 — Sensor de Abertura de Baú (Desempate pelo WSJF maior que US03; reduz risco de desvio de carga)
5. US03 — Score de Comportamento do Motorista (Bloqueio de hardware e entrega de valor apenas parcial no MVP)
6. US05 — Dashboard Base (HiPPO request; menor prioridade, sem impacto comprovado nos OKRs)

## 4. Justificativas

**US01 (Impact 3 / Confidence 80%):** Contribuicao direta e imediata para o OKR principal (reduzir sinistros de 7 para 5). Mitiga custo de R$ 15.000 por infração ANTT. Reach estimado por analogia com transportadora similar (1.840 acessos ajustados para 140 veiculos). Confidence 80% por ausencia de dados históricos internos.

**US02 (Impact 2 / Confidence 80%):** Ataca o OKR secundário (manutenção -15%). Ancorado no benchmark McKinsey Fleet 2022 (reducao de 18-24% com alertas preditivos). Reach por proxy de relatório de combustível (340 acessos ajustados). Confidence 80% pelo benchmark de mercado, mas dependente de atingir 80% de accuracy em producao.

**US-09 (Impact 2 / Confidence 80%):** Evita perda total de carga refrigerada e garante conformidade ANVISA (risco regulatório severo). Confidence 80% por requisitos regulatórios claros e regras de negócio binarias (temperatura dentro/fora da faixa).

**US03 (Impact 1 / Confidence 50%):** Impacto indireto no OKR de sinistros. MVP parcial por velocidade gera valor limitado sem hardware v2 (acelerômetro). Sem referência disponivel para adocao de score gamificado neste contexto.

**US04 (Impact 1 / Confidence 50%):** Nao contribui diretamente para os OKRs, mas reduz risco de desvio de carga e nao conformidade de entrega. Sem referência disponivel de mercado para engajamento com relatórios de abertura de bau.

**US05 (Impact 0.25 / Confidence 50%):** Solicitado verbalmente sem evidência de uso operacional. Nao move os OKRs de sinistro ou manutencao. Usuaria real provavelmente é Priya (TI), nao o Diretor de Operacoes.

## 5. Flags

[US-02, US-04, US-09]: Dependência critica de hardware — lead time de 60 dias para sensores IoT. Iniciar processo de compras imediatamente. Desenvolvimento de software só entra na sprint quando o hardware estiver a 2 sprints de ser entregue.

[US03]: Bloqueio de hardware + Confidence abaixo de 70% — rastreadores v2 com acelerômetro pendentes. Validar com Carlos se o MVP parcial (velocidade apenas, via US01) é suficiente para o RH iniciar o programa antes do hardware chegar.

[US05]: Confidence abaixo de 70% (HiPPO) — risco de desperdício de 1.5 pm. Conduzir entrevista de 30 min com Carlos e Priya para mapear o Job to be Done real antes de construir mapa em tempo real no MVP.

---

## Comparativo com U2.2 (sem calibração)

| Item | RICE sem calibração (U2.2) | RICE com calibração (U2.3) | O que mudou |
|------|---------------------------|---------------------------|-------------|
| US01 | 420,0 | 3.091,2 | Reach: 140 veiculos → 1.288 acessos/mês por analogia |
| US02 | 23,3 | 126,9 | Reach: 140 → 238 por proxy; Confidence: 50% → 80% por benchmark McKinsey |
| US-09 | 21,0 | 112,0 | Confidence: 50% → 80% por requisito regulatório ANVISA claro |
| US03 | 149,3 | 35,0 | Impact: 2 → 1 (bloqueio de hardware limita valor do MVP) |
| US04 | 35,0 | 35,0 | Sem alteracao significativa |
| US05 | 0,5 | 0,8 | Sem alteracao significativa |

Ponto-chave para a demo: os dados de calibração aumentaram drasticamente o RICE de US01 (420 → 3.091) ao substituir o Reach de "140 veículos" por "1.288 acessos/mês estimados por analogia". US03 (Score de Comportamento) caiu de 2º para 5º lugar porque o Impact foi revisado para baixo com o bloqueio de hardware explicitado.

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
