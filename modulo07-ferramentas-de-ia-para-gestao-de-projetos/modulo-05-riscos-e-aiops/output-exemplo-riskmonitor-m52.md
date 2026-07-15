# Risk Monitor - Output Demo M5.2
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 5.2**
> Output de referência gerado em pré-gravação. Use como backup caso o modelo produza resultado inesperado na demo ao vivo.
> Gerado em: 2026-07-07 (AI Studio - Gemini 3.1 Pro Preview) | Temperatura: 0.3

---

Aqui está a análise de AIOps baseada nos dados de telemetria do seu fluxo de trabalho.

---

### 1. Cockpit de Riscos

*   **Fluxo e Eficiência:** **VERMELHO**
    *   *Sintoma:* Lead Time disparou de 6.2 para 10.8 dias (limite era 6.5). WIP parado há mais de 5 dias subiu para 3 itens.
*   **Qualidade:** **VERMELHO**
    *   *Sintoma:* Saldo de bugs acumulados chegou a 9. A taxa de criação de bugs (11 na Sprint 4) é quase o dobro da capacidade de resolução (6).
*   **Dependências Externas:** **VERMELHO**
    *   *Sintoma:* Blocker de hardware (acelerômetro v2) ativo desde a Sprint 3, causando efeito cascata no backlog.
*   **Escopo e Entregas:** **AMARELO**
    *   *Sintoma:* A velocidade estabilizou em 22 SP, mas a previsibilidade despencou (de 4/4 entregas na S1 para 2/5 na S4). O time está planejando trabalho que não pode terminar.
*   **Prontidão para Marco:** **VERMELHO**
    *   *Sintoma:* Faltam 2 semanas para a apresentação à diretoria. O hardware chega na mesma sprint da apresentação, deixando zero margem (buffer) para testes de integração, enquanto a frota atual (v1) sofre com bugs críticos.

---

### 2. Diagnóstico de Anomalias

**Anomalia A: Degradação Severa de Fluxo (Fila de Espera)**
*   **Métrica em desvio:** Lead Time (10.8 dias) e WIP Parado (3 itens).
*   **Duração:** 3 sprints consecutivas (S2, S3, S4).
*   **Diagnóstico (Causa Raiz):** O Cycle Time (tempo de mão na massa) está estável (4.8 a 5.3 dias). Isso prova que os desenvolvedores não estão codificando mais devagar. O Lead Time explodiu porque os itens estão "apodrecendo" na coluna *Blocked* ou *In Progress* aguardando o hardware v2. O time está sofrendo de gargalo por dependência externa não resolvida.

**Anomalia B: Colapso de Qualidade e Compatibilidade**
*   **Métrica em desvio:** Saldo de bugs (9 acumulados) e Bug Crítico S4-10.
*   **Duração:** 3 sprints consecutivas (tendência de piora aguda na S4).
*   **Diagnóstico (Causa Raiz):** O sistema não foi arquitetado para retrocompatibilidade. Ao preparar o terreno para o hardware v2, o time quebrou o funcionamento do hardware v1 (BUG-S4-10). O time agora está dividindo a atenção entre tentar avançar novas features e apagar incêndios na frota legada, gerando *context switching* (troca de contexto) que destrói a produtividade.

**Anomalia C: Falha de Planejamento (Falsa Capacidade)**
*   **Métrica em desvio:** Taxa de entrega vs. planejamento (40% na S4).
*   **Duração:** 2 sprints (S3 e S4).
*   **Diagnóstico (Causa Raiz):** O time está puxando histórias bloqueadas (US-03) para dentro da sprint na "esperança" de que o hardware chegue. Esperança não é estratégia de gestão. Isso infla o escopo planejado e garante o fracasso da sprint.

---

### 3. Plano de Mitigação

**Para Anomalia A (Fluxo e Dependência Externa)**
*   **Ação Imediata (Sprint 5):** Remover US-03 e US-06 do compromisso da Sprint 5. Se o hardware chegar, ele deve ser tratado como um *Spike* técnico de integração (time-boxed), não como uma feature a ser entregue.
*   **Ação de Processo (Sprint 6+):** Implementar *Definition of Ready (DoR)* estrito. **Regra:** Nenhuma história entra em Sprint Planning se depender de hardware/API de terceiros que não esteja fisicamente disponível e testado.
*   **Critério de Sucesso:** Lead Time cai para menos de 8 dias; zero itens em WIP > 5 dias por motivos externos.

**Para Anomalia B (Qualidade e Bugs)**
*   **Ação Imediata (Sprint 5):** Alocar 40% da capacidade do time (aprox. 9 SP dos 22 SP disponíveis) exclusivamente para zerar o débito técnico. O BUG-S4-10 (guard de hardware v1) é a prioridade número 1 da sprint, acima de qualquer nova feature.
*   **Ação de Processo (Sprint 6+):** Instituir limite de WIP para Bugs (Andon Cord). **Regra:** Se o saldo de bugs abertos ultrapassar 5, o desenvolvimento de novas features é paralisado até que a fila de bugs seja reduzida.
*   **Critério de Sucesso:** BUG-S4-10 resolvido e em produção; saldo acumulado de bugs cai de 9 para menos de 4 ao fim da Sprint 5.

---

### 4. Projeção de Risco

**Risco de falha no Marco (Apresentação Diretoria): ALTO (> 80% de probabilidade de crise)**

**Raciocínio:**
A matemática do fluxo não fecha. O hardware v2 chega na Semana 9 (Sprint 5). A apresentação é em 2 semanas. Historicamente, o Cycle Time do time é de ~5 dias. Isso significa que, mesmo que o hardware chegue no dia 1 da Sprint 5 e funcione perfeitamente de primeira (o que é raríssimo em IoT), o time levará a sprint inteira apenas para codificar a US-03, sem tempo hábil para QA, integração com a US-06 e estabilização. Além disso, se a apresentação for feita hoje, os 43 veículos com rastreador v1 falharão ao vivo devido ao BUG-S4-10.

---

### 5. Recomendação Final (Ação Executiva)

**Pivote a pauta da apresentação para a Diretoria imediatamente.**

Não prometa demonstrar o "Score de Comportamento" (US-03) ou o "Painel de Motoristas" (US-06) rodando no hardware novo. O risco de falha ao vivo é crítico.

**O que o Gestor deve fazer hoje:**
1. Alinhe com os stakeholders que a apresentação focará no **Dashboard Base (US-05)** e nos **Alertas de Velocidade (US-01)** operando de forma estável e escalável com a frota atual (v1).
2. Ordene ao time que pare qualquer desenvolvimento novo e resolva o **BUG-S4-10** nas próximas 48 horas para garantir que a demonstração da frota v1 seja impecável.
3. Comunique a chegada do hardware v2 na apresentação como o *próximo passo* (Roadmap), mostrando o hardware físico na mesa, mas sem rodar software não testado nele.

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
