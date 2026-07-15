# Output - Scheduling RouteWise MVP (Demo M3.2)
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 3.2**

> **Artefato de Demo - Módulo 3.2**
> Output gerado no Google AI Studio (temperatura 0.3) a partir de `scheduling-routewise-input.md`.

---

## Cálculo de Capacidade Real

Capacidade nominal (35 SP) x 65% (fator de foco/imprevistos) = ~22 SP por sprint.

Nota: Os 2 dias de feriado foram descontados na Sprint 2, reduzindo sua capacidade maxima para 18 SP.

---

## 1. Cronograma por Sprint

**Sprint 1 (Semanas 1-2):**
- Historia: Setup de Ambiente Staging & CI/CD (Dependencia Implicita) — Responsavel: Dev Pleno Fullstack 1 — Effort: 3 SP
- Historia: US-01 Alertas de Velocidade em Tempo Real — Responsavel: Dev Senior Backend & Dev Pleno Frontend — Effort: 13 SP
- Historia: Pedido de Compra e Burocracia do Hardware IoT (Enabler) — Responsavel: PM/Carlos (Acompanhamento QA) — Effort: 2 SP
- Capacidade utilizada: 18/22 SP

**Sprint 2 (Semanas 3-4): (Sprint com 2 dias de feriado — Cap. Max: 18 SP)**
- Historia: US-03 Score de Comportamento (MVP parcial) — Responsavel: Dev Pleno Fullstack 2 & Dev Pleno Backend 2 — Effort: 8 SP (alocada aqui pois depende do US-01 estar em producao)
- Historia: Estabilizacao e Testes de Carga US-01 — Responsavel: Dev Junior QA — Effort: 5 SP
- Capacidade utilizada: 13/18 SP

**Sprint 3 (Semanas 5-6):**
- Historia: Preparacao e Execucao de Demo Operacional US-01 para Carlos (Marco Obrigatorio) — Responsavel: Dev Pleno Frontend & Dev Junior QA — Effort: 3 SP
- Historia: Criacao de Mocks e Contratos de API para Sensores IoT (Dependencia Implicita/Contorno) — Responsavel: Dev Senior Backend — Effort: 5 SP
- Capacidade utilizada: 8/22 SP

**Sprint 4 (Semanas 7-8):**
- Historia: Refatoracao de Base de Dados e Preparacao de Infra para Carga Refrigerada — Responsavel: Dev Pleno Fullstack 1 — Effort: 5 SP
- Historia: Setup de Push Notifications Avancadas (Enabler para US-04) — Responsavel: Dev Pleno Frontend — Effort: 5 SP
- Capacidade utilizada: 10/22 SP

**Sprint 5 (Semanas 9-10): (Chegada do Hardware IoT)**
- Historia: US-09 Sensor de Baú — Controle de Temperatura da Carga — Responsavel: Dev Senior Backend & Dev Pleno Fullstack 1 — Effort: 21 SP (alocada nesta sprint exclusivamente devido ao blocker de 60 dias do hardware)
- Capacidade utilizada: 21/22 SP

**Sprint 6 (Semanas 11-12):**
- Historia: US-04 Sensor de Abertura de Bau — Responsavel: Dev Pleno Fullstack 2 — Effort: 13 SP (alocada nesta sprint devido ao blocker de hardware)
- Historia: US-03 Score de Comportamento (Evolucao com Acelerometro) — Responsavel: Dev Senior Backend & Dev Pleno Frontend — Effort: 8 SP
- Capacidade utilizada: 21/22 SP

**FORA DO ESCOPO DO MVP:**

US-02 | Manutencao Preditiva por Telemetria (34 SP): Removida do escopo do MVP.
Motivo: Com a capacidade real de 22 SP/sprint, uma historia de 34 SP nao cabe em uma unica sprint. Alem disso, ela exige o hardware (que so chega na Semana 9) e precisa de 30 dias de dados historicos apos o US-01 entrar em producao. Iniciar o modelo preditivo e integrar o hardware na Sprint 6 estouraria a capacidade do time e nao atingiria a acuracia de 80% exigida a tempo do fim do projeto.

US-05 | Dashboard Base: Removido via MoSCoW previamente.

---

## 2. Dependencias Mapeadas

- US-03 (MVP Parcial) depende de US-01 porque precisa reutilizar o pipeline de dados de velocidade em tempo real (GPS) ja em producao.
- US-09, US-04 e US-03 (Score Completo) dependem de Fornecedor Externo (Hardware IoT) com data estimada de resolucao para a Semana 9 (Sprint 5).
- US-01 depende de Ambiente de Staging/CI-CD (dependencia implicita tecnica) que deve ser configurado na Sprint 1.
- US-02 (Fora do escopo) dependeria de US-01 em producao por 30 dias para geracao de massa de dados de telemetria para treinar o modelo preditivo.

---

## 3. Caminho Critico

O projeto possui dois caminhos criticos paralelos:

**Caminho do OKR (Software):** Setup Staging (Sprint 1) → US-01 Alertas de Velocidade (Sprint 1) → Deploy em Prod (Sprint 2) → US-03 MVP Score (Sprint 2) → Demo para Carlos (Sprint 3). Qualquer atraso aqui impacta diretamente a meta de reducao de sinistros.

**Caminho do Hardware (IoT):** Pedido de Compra (Semana 1) → lead time de 60 dias → Recebimento (Semana 9) → US-09 Sensor de Baú — Controle de Temperatura da Carga (Sprint 5) → US-04 Sensor de Bau (Sprint 6). Qualquer atraso no fornecedor empurrara US-09 e US-04 para fora das 12 semanas.

---

## 4. Flags de Risco

FORNECEDOR IOT: Atraso na entrega dos sensores (lead time > 60 dias) → Impacto: Inviabiliza completamente as Sprints 5 e 6. US-09 e US-04 nao poderao ser entregues no MVP.

FERIADOS: 2 dias de feriado no periodo → Impacto: Reducao da capacidade produtiva. Mitigado alocando os feriados na Sprint 2 e mantendo a carga de trabalho em 13/18 SP.

GARGALO DE INTEGRACAO: US-09 (21 SP) consome quase 100% da capacidade da Sprint 5 logo apos a chegada do hardware → Impacto: Se o hardware apresentar defeito ou documentacao ruim, a sprint falhara, pois nao ha margem de manobra na Sprint 5.

---

## 5. Solucoes de Contorno

Para o Blocker do Hardware IoT (Sprints 1 a 4): Criacao de Mocks e Contratos de API (alocado na Sprint 3). O Dev Senior Backend construira simuladores de envio de dados (payloads JSON de temperatura e abertura de porta) baseados na documentacao do fabricante. Isso permite que o Frontend e o Banco de Dados sejam desenvolvidos e testados antes da Semana 9.

Para o Blocker do Acelerometro no Score (US-03): Fatiamento da historia. Lancamos um MVP Parcial na Sprint 2 usando apenas os dados de GPS (excesso de velocidade) do US-01, garantindo impacto imediato no OKR de sinistros, deixando a frenagem/aceleracao brusca para a Sprint 6.

Para a Manutencao Preditiva (US-02): Como foi retirada do escopo, a solucao de contorno para o negocio e utilizar os alertas de velocidade (US-01) como um proxy temporario para desgaste do veiculo ate que o projeto ganhe uma Fase 2 (Pos-MVP) dedicada a ciencia de dados.

---

## What-If 1: Atraso de Hardware (60 para 88 dias)

### 1. Impacto nas Datas

O projeto original tem duracao de 12 semanas (6 Sprints). Com o hardware chegando apenas na Semana 13, ele cai fora da janela do MVP.

Sprints afetadas:

Sprint 5 (Semanas 9-10): Fica ociosa. US-09 (21 SP) esta 100% bloqueada e nao pode ser iniciada.

Sprint 6 (Semanas 11-12): Fica ociosa. US-04 (13 SP) e US-03 Score Completo (8 SP) estao 100% bloqueadas.

Impacto no escopo: 42 SP de esforco planejado (mais de 1/3 do projeto) tornam-se inviaveis dentro do prazo original.

Impacto no OKR: Nenhum impacto direto. O OKR de reduzir sinistros por velocidade depende da US-01 e do MVP da US-03, que ja estarao em producao na Sprint 2.

### 2. Opcoes de Resposta

**Opcao A: Reduzir escopo do MVP e encerrar mais cedo (Fast Close)**

Assumimos que o MVP termina na Sprint 4 (Semana 8). As Sprints 5 e 6 sao canceladas e o time e realocado para outros projetos ate o hardware chegar.

Pros: Economia drastica de custo (1 mes a menos de burn rate); foco absoluto no OKR de sinistros ja entregue.
Contras: Carlos nao recebe as features de carga refrigerada e sensor de bau agora; risco de desmobilizacao do time na Semana 13.

**Opcao B: Estender o cronograma para 8 Sprints (Time Extension)**

Mantemos o time alocado. Sprints 5 e 6 sao usadas para debito tecnico e cobertura de testes. Adicionamos Sprints 7 e 8 (Semanas 13-16) para receber o hardware e executar US-09, US-04 e US-03 completa.

Pros: Entrega 100% do escopo desejado; mantem o time aquecido e o contexto fresco.
Contras: Aumenta custo e tempo em 33% (4 semanas extras); risco de ociosidade nas Sprints 5 e 6.

**Opcao C: Pivotar Sprints 5 e 6 para a fundacao da Manutencao Preditiva (US-02)**

Como a US-01 entrou em producao na Sprint 2, ao chegarmos na Sprint 5 ja teremos 4-6 semanas de dados reais de telemetria. Usamos a capacidade das Sprints 5 e 6 para iniciar a Engenharia de Dados da US-02, criando os pipelines e o modelo preditivo base.

Pros: Mantem o cronograma de 12 semanas; maximiza ROI entregando valor de negocio em vez de deixar o time ocioso; nao aumenta o custo.
Contras: Features de IoT (Carga e Bau) ficam para uma Fase 2 (pos-Semana 13); risco tecnico de nao fechar incremento funcional da US-02 ate a Sprint 6.

### 3. Recomendacao

**Recomendacao: Opcao C** (Pivotar para a fundacao da US-02, combinada com formalizacao de uma Fase 2 para o IoT).

Por que: O objetivo principal de Carlos (reduzir sinistros) ja esta garantido pelas entregas das Sprints 1-4. A US-02 Manutencao Preditiva e o item de maior esforco (34 SP) e alto valor — usar as Sprints 5 e 6 para construir o pipeline de dados com a telemetria recentemente coletada transforma um problema (atraso) em uma oportunidade (adiantar a feature mais complexa do backlog). O "MVP Fase 2" (IoT) sera um novo ciclo curto agendado especificamente para quando o hardware estiver fisicamente na empresa, eliminando o risco de novos atrasos do fornecedor impactarem a metrica de sucesso do time.

---

## What-If 2: Dev Sênior Afastado na Sprint 3

### 1. Impacto nas Datas

Sprint afetada: Sprint 3 (Semanas 5-6).

Historias afetadas:

Criacao de Mocks e Contratos de API para Sensores IoT (5 SP): Diretamente bloqueada — Dev Senior Backend era o unico responsavel.

Demo Operacional US-01 para Carlos (3 SP): Sem impacto direto na execucao, pois a preparacao e conducao ja estavam alocadas para Dev Pleno Frontend e Dev Junior QA. Risco politico indireto: se Carlos fizer perguntas tecnicas profundas sobre arquitetura de backend, o lider tecnico da feature nao estara presente.

Impacto na capacidade: A capacidade total da Sprint 3 cai, mas como a sprint estava planejada com apenas 8/22 SP utilizados, o time restante ainda possui muita margem de manobra.

### 2. Opcoes de Resposta

**Opcao A: Realocar a criacao de Mocks para os Devs Plenos (Absorcao Interna)**

Transferimos a historia de Mocks (5 SP) para o Dev Pleno Fullstack 1 ou Fullstack 2, que estao com capacidade ociosa nesta sprint. Frontend e QA seguem com a Demo.

Pros: Cronograma original mantido 100% intacto. Sprint 4 nao sofre efeito cascata — contratos estarao prontos. Promove compartilhamento de conhecimento (silo-breaking).
Contras: Dev Pleno pode levar um pouco mais de tempo do que o Senior para desenhar os contratos, mas ha folga na sprint para absorver essa curva de aprendizado.

**Opcao B: Adiar os Mocks para a Sprint 4 e antecipar trabalho de Frontend**

Movemos a historia de Mocks (5 SP) para a Sprint 4 (quando o Senior retorna). Para nao deixar a Sprint 3 vazia, puxamos "Setup de Push Notifications Avancadas" (5 SP) da Sprint 4 para a Sprint 3.

Pros: Garante que o desenho dos contratos seja feito pelo Senior, mantendo padrao arquitetural mais alto. Otimiza tempo do Frontend.
Contras: Cria gargalo na Sprint 4 — Senior tera que fazer Mocks ao mesmo tempo em que Fullstack 1 precisara deles para a Refatoracao de Infra, gerando dependencia cruzada dentro da mesma sprint.

**Opcao C: Remarcar a Demo do US-01 para a Sprint 4**

Adiar o marco obrigatorio para que o Dev Senior possa estar presente na apresentacao para Carlos.

Pros: Seguranca tecnica total na apresentacao.
Contras: Quebra a restricao do projeto (Marco Obrigatorio). Gera frustracao no stakeholder e passa impressao de que o time nao consegue entregar sem o Senior.

### 3. Recomendacao

**Recomendacao: Opcao A** (Realocar a criacao de Mocks para os Devs Plenos).

Por que: A regra de ouro do projeto e a Demo da US-01 na Sprint 3. Frontend e QA tem total capacidade de demonstrar o software funcionando (Alertas de Velocidade) para o stakeholder. Para mitigar o risco de perguntas tecnicas, o Dev Senior deve deixar um breve FAQ arquitetural documentado antes de sair de licenca, ou o Dev Pleno Fullstack 1 pode atuar como apoio tecnico na reuniao. A Sprint 3 tem apenas 8 SP planejados — tres desenvolvedores (Fullstack 1, Fullstack 2 e Backend 2) estao praticamente livres nesta janela para absorver os Mocks. Adiar para a Sprint 4 criaria estrangulamento desnecessario: ao resolver os contratos na Sprint 3, garantimos que a pista esteja livre para a preparacao da infraestrutura de carga refrigerada na Sprint 4.

---

## What-If 3: Antecipação de Prazo pelo Cliente

Como Gerente de Projetos Senior, a compressao de um cronograma em 16% (de 12 para 10 semanas) quando ha dependencias fisicas (hardware) no caminho critico exige decisoes dificeis sobre escopo e custo.

Abaixo esta a analise do cenario e o plano de acao para a antecipacao do fim do projeto para a Sprint 5.

### 1. Impacto nas Datas

* **Sprints Afetados:** A Sprint 6 (Semanas 11-12) e cancelada.
* **Historias Afetadas:**
  * **US-04 Sensor de Abertura de Bau (13 SP)** e **US-03 Score de Comportamento Completo (8 SP)** perdem sua janela de execucao.
  * **US-09 Monitoramento de Carga Refrigerada (21 SP)** continua na Sprint 5 (Semanas 9-10), consumindo praticamente toda a capacidade da ultima sprint do projeto (21/22 SP).
* **Impacto Tecnico:** E matematicamente impossivel alocar a US-09, US-04 e US-03 Completa na Sprint 5. O esforco somado seria de 42 SP, o que ultrapassa em quase 100% a capacidade real do time (22 SP).
* **Impacto no OKR:** **Nenhum.** O OKR de reducao de sinistros ja foi garantido nas Sprints 1 e 2 com a US-01 e o MVP da US-03.

---

### 2. Opcoes de Resposta

#### Opcao A: Reducao de Escopo (Corte da US-04 e US-03 Completa)

Aceitamos a nova data limite (Sprint 5) e removemos formalmente a US-04 (Sensor de Bau) e a evolucao da US-03 (Acelerometro) do escopo do MVP. A Sprint 5 foca exclusivamente em entregar a US-09 (Carga Refrigerada) assim que o hardware chegar.

* **Pros:** Risco zero de sobrecarga do time. Garante a qualidade da US-09. O OKR principal do projeto (sinistros) permanece protegido e entregue.
* **Contras:** O stakeholder (Carlos) nao recebera o monitoramento de abertura de bau nem a precisao extra no score de motoristas neste ciclo.

#### Opcao B: Negociar Frete/Producao Expressa do Hardware (Antecipacao Externa)

Como as Sprints 3 e 4 possuem bastante capacidade ociosa (14 SP e 12 SP livres, respectivamente), o unico motivo de nao fazermos o IoT antes e o lead time de 60 dias. A opcao e aprovar um orcamento extra com Carlos para pagar uma taxa de urgencia ao fornecedor, antecipando a chegada do hardware para a Semana 5 (Sprint 3).

* **Pros:** Permite entregar **100% do escopo original** dentro das 5 sprints, distribuindo a US-09, US-04 e US-03 Completa ao longo das Sprints 3, 4 e 5, aproveitando a capacidade que estava sobrando.
* **Contras:** Depende de um fator externo incontrolavel (capacidade de producao/importacao do fornecedor). Exige aumento de custo (budget extra).

#### Opcao C: Troca de Escopo na Sprint 5 (Trade-off de Valor)

Se o hardware chegar na Semana 9, usamos a capacidade da Sprint 5 (22 SP) para entregar a **US-04 (13 SP)** + **US-03 Completa (8 SP)**, totalizando 21 SP. A **US-09 (21 SP)** e removida do projeto.

* **Pros:** Entregamos duas funcionalidades em vez de uma. Finalizamos o Score de Comportamento, que tem ligacao direta com o OKR de sinistros.
* **Contras:** A funcionalidade de Carga Refrigerada (US-09), que costuma ter alto valor agregado para a operacao, fica de fora do MVP.

---

### 3. Recomendacao

**Recomendo a Opcao A (Reducao de Escopo), com a Opcao B como plano de contingencia se houver orcamento.**

**Por que?**

1. **Foco no OKR e Realismo Agil:** O projeto ja atingiu seu objetivo principal (reduzir sinistros) nas primeiras sprints. Tentar espremer 42 SP de trabalho de IoT em uma unica sprint (Sprint 5) causaria burnout no time, falhas de qualidade e risco de nao entregar nada funcionando. A Opcao A e a unica que respeita a capacidade sustentavel do time (22 SP/sprint).
2. **Gestao de Restricoes (Triangulo de Ferro):** Em gestao de projetos, se o cliente reduz o **Tempo** (de 6 para 5 sprints) e o **Custo/Time** e fixo (6 pessoas), o **Escopo** deve obrigatoriamente ser reduzido para manter a Qualidade.
3. **Abordagem com o Stakeholder:** Apresentarei a situacao a Carlos da seguinte forma: "Carlos, podemos antecipar o fim do projeto para a Semana 10 com sucesso, garantindo o OKR de sinistros e a Carga Refrigerada. Para isso, o Sensor de Bau e o Acelerometro ficarao para um proximo ciclo. Caso o Bau seja inegociavel para agora, precisaremos de orcamento extra para tentar antecipar o hardware com o fornecedor (Opcao B)."

---

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
