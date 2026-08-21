# Output Backlog Scorer - U2.2 Backup
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 2.2**
Gerado em: 2026-07-02 (pré-gravação)
Input: backlog-routewise-input.md (6 User Stories)
Modelo: Gemini 3.1 Pro Preview

> Nota: Este output foi gerado com as 6 User Stories completas, antes do filtro MoSCoW aplicado na demo ao vivo. Na gravação, US05 (Dashboard Base — Relatório Visual de Status da Frota) é removido via Won't Have antes do scoring — por isso o ranking ao vivo terá 5 itens e números diferentes deste backup.

---

## 1. Tabela RICE

| Item | Reach | Impact | Confidence | Effort (pm) | RICE Score |
|------|-------|--------|------------|-------------|------------|
| US01 — Alertas de Velocidade | 140 | 3.0 | 100% | 1.0 | 420.0 |
| US03 — Score de Comportamento | 140 | 2.0 | 80% | 1.5 | 149.3 |
| US04 — Sensor de Baú | 140 | 1.0 | 50% | 2.0 | 35.0 |
| US02 — Manutenção Preditiva | 140 | 2.0 | 50% | 3.0 | 23.3 |
| US09 — Sensor de Baú — Carga Refrigerada | 42* | 2.0 | 50% | 2.0 | 21.0 |
| US05 — Dashboard Base (HiPPO) | 5 | 0.5 | 20% | 1.0 | 0.5 |

*Estimativa de 30% da frota com baú refrigerado (42 veículos).

## 2. Tabela WSJF

| Item | BV | TC | RR | CoD | Job Size | WSJF |
|------|----|----|----|-----|----------|------|
| US01 — Alertas de Velocidade | 10 | 9 | 5 | 24 | 3 | 8.00 |
| US03 — Score de Comportamento | 8 | 5 | 6 | 19 | 5 | 3.80 |
| US09 — Sensor de Baú — Carga Refrigerada | 6 | 7 | 5 | 18 | 6 | 3.00 |
| US02 — Manutenção Preditiva | 7 | 3 | 8 | 18 | 9 | 2.00 |
| US04 — Sensor de Baú | 4 | 3 | 4 | 11 | 6 | 1.83 |
| US05 — Dashboard Base (HiPPO) | 2 | 1 | 1 | 4 | 4 | 1.00 |

BV: Business Value | TC: Time Criticality | RR: Risk Reduction | CoD: Cost of Delay

## 3. Ranking Combinado

1. US01 — Alertas de Velocidade em Tempo Real (Prioridade Maxima: alinhamento total ao OKR e baixo esforço relativo)
2. US03 — Score de Comportamento do Motorista (Estratégico para mudança de cultura e redução de sinistros a longo prazo)
3. US09 — Sensor de Baú — Controle de Temperatura da Carga (Alto risco de perda financeira e conformidade ANVISA, apesar da dependência de hardware)
4. US02 — Manutenção Preditiva por Telemetria (Alto valor técnico, mas complexidade elevada e dependência de dados históricos)
5. US04 — Sensor de Abertura de Baú (Importante para segurança, mas secundário ao OKR principal de velocidade)
6. US05 — Dashboard Base (Item executivo sem impacto operacional comprovado — candidato a Won't Have via MoSCoW)

## 4. Justificativas do PM

**US01 (Impact 3 / Confidence 100%):** Ataca diretamente o OKR do Carlos. Confiança maxima pois alerta de velocidade é padrão de mercado para redução de sinistros. Effort baixo (1.0 pm) sem dependência de hardware novo.

**US03 (Impact 2 / Confidence 80%):** Impacto significativo por permitir gestão preventiva. Confidence 80% pois depende da adesão do RH e qualidade do treinamento subsequente para gerar resultados. MVP parcial (score por velocidade) viável antes do hardware v2.

**US09 (Impact 2 / Confidence 50%):** Impacto alto para a vertical de perecíveis — evita perda total de carga e risco de autuação ANVISA. Confidence limitada pelo lead time de 60 dias do hardware. Time Criticality alta (7) por prazo regulatório.

**US02 (Impact 2 / Confidence 50%):** Alto valor na redução de custos de manutenção corretiva, mas confidence baixa pela necessidade de 60 dias de hardware + tempo de maturação do modelo preditivo para atingir acurácia de 80%. Job Size alto (9) penaliza o WSJF.

**US04 (Impact 1 / Confidence 50%):** Importante para rastreabilidade de carga e conformidade de entrega. Impacto menor no OKR principal (velocidade) e dependência de hardware bloqueiam a posição no ranking.

**US05 (Impact 0.5 / Confidence 20%):** Impacto baixo e confiança minima — item solicitado verbalmente por Carlos sem evidência de uso operacional real. Usuária mais provavel é Priya (TI), não o Diretor de Operações. Não ha indicação de que um mapa colorido reduza sinistros no estagio de MVP.

## 5. Flags e Riscos

[US02, US04, US09]: Dependência Critica de Hardware — Lead time de 60 dias para os sensores IoT. Ação necessaria: comprar o hardware imediatamente, mas não alocar sprints de desenvolvimento para estas USs até os sensores estarem em trânsito ou disponíveis para testes de bancada.

[US02]: Risco de Inviabilidade Técnica — Meta de 80% de acuracia é agressiva para MVP sem dados históricos suficientes. Ação necessaria: iniciar coleta de dados (Data Ingestion) assim que o hardware chegar, antes de comprometer a funcionalidade preditiva.

[US03]: Bloqueio Parcial de Hardware — Score completo (frenagem, aceleração) depende dos rastreadores v2. MVP parcial por velocidade é viavel antes. Ação necessaria: separar entrega em duas fases: score por velocidade (sem hardware novo) e score completo (após hardware v2).

[US05]: Baixa Confiança — Item solicitado verbalmente sem evidência de uso operacional. Ação necessaria: sessão de Discovery com Carlos para verificar se os alertas da US01 ja resolvem a dor de visibilidade executiva, antes de alocar esforço de engenharia.

[Dependência de Sequenciamento]: US03 deve ser desenvolvida em paralelo a US01, pois ambas consomem dados de telemetria de velocidade — permite reaproveitamento de código e reduz esforço efetivo.

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
