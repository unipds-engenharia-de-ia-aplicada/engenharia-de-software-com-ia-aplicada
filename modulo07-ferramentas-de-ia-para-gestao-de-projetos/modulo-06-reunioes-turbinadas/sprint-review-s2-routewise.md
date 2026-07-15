# Transcrição — Sprint Review do Sprint 2 - RouteWise
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 6.2**

> Transcrição fictícia de Sprint Review usada como **variação opcional** da demo do M6.2.
> Para a sequência principal da demo, use `transcricao-sprint-review-s2.md` (o input mostrado no vídeo, com output de referência em `output-digest-backup-sprint-review-m62.md`). Este arquivo serve como cenário alternativo para praticar o Meeting Digest num contexto de sprint com mais participantes.
> Observação: alguns números deste cenário são alternativos ao snapshot canônico de M5.2; não use este arquivo para validar o estado atual do Jira da gravação principal.
> **Nota de continuidade — US-01:** neste cenário, US-01 está operacional em testes piloto com dois supervisores, mas a entrega formal com todos os critérios de aceite ocorre no Sprint 4 (canônico). A fala do Marcus descreve a feature como "funcionando" — não como história formalmente encerrada no Jira.

**Data:** 23/05/2026
**Reunião:** Sprint 2 Review — Projeto RouteWise
**Participantes:** Carlos Mendonça (Diretor de Operações), Marcus (tech lead / consultor), Priya (TI/Infra), Ana Lima (Gestão de Pessoas / RH)
**Duração:** ~28 minutos
**Transcrição automática via Whisper — revisão mínima**

---

**Marcus:** Bom, vamos começar. Sprint 2 encerrou ontem. Carlos, eu vou apresentar o que foi entregue, o que ficou bloqueado, e depois a gente abre pra discussão. Pode ser?

**Carlos:** Pode. Vamos lá.

**Marcus:** Entregues no Sprint 2: US-01, Alertas de Velocidade, está rodando em ambiente de produção com dois supervisores em teste piloto desde a semana passada. Os alertas estão funcionando — supervisor recebe notificação em até 45 segundos da detecção, abaixo do nosso SLA de 60 segundos. A história ainda tem critérios de aceite pendentes de validação formal, então ela fica como "Em Progresso" no Jira até a entrega completa. US-02, o contorno manual de Manutenção Preditiva também foi entregue — o sistema agora avisa por km e tempo desde a última revisão, sem o modelo preditivo ainda, mas o alerta básico está rodando.

**Carlos:** Bom. A equipe de operações já está usando os alertas de velocidade?

**Marcus:** Está. A Priya configurou o acesso ontem de manhã. Dois supervisores estão em teste.

**Priya:** Sim. Um feedback que já veio: eles querem que o alerta também apareça no mapa, não só no app. Não é blocker, é melhoria. Anotei como feedback para o refinamento do Sprint 3.

**Carlos:** Faz sentido. Anota isso.

**Marcus:** Bloqueados: US-03, Score de Comportamento, continua bloqueado. O hardware com acelerômetro ainda não chegou. O fornecedor confirmou que o prazo é mais seis semanas a partir de hoje. US-09, Sensor de Baú — Controle de Temperatura da Carga, mesmo bloqueio — é o mesmo fornecedor. US-04, Sensor de Abertura de Baú, mesma situação.

**Carlos:** Seis semanas. Isso nos leva pra quando, Sprint 4?

**Marcus:** Sprint 4, isso. Se o hardware chegar no prazo, a gente consegue integrar no Sprint 4 e entregar no Sprint 5.

**Carlos:** Ok. Quero que fique registrado que o atraso é do fornecedor, não do time. Isso vai aparecer no status report pro diretor.

**Marcus:** Anotado. Agora quero apresentar os números do sprint. Velocidade planejada: 22 SP. Entregues: 21 SP. Um ponto de história ficou em progresso por causa de um bug de sincronização que a Priya resolveu hoje cedo.

**Priya:** Sim, resolvido. Pode dar como entregue.

**Marcus:** Então fecha como 22 de 22. Zero débito técnico acumulado. Dois bugs abertos do Sprint 1 foram fechados nesse sprint.

**Carlos:** Bom ritmo. Agora eu tenho um ponto que precisa entrar em pauta. Eu tive uma conversa com o Roberto — meu diretor — na semana passada. Ele quer ver o sistema antes do board de julho. E o que ele pediu foi um dashboard, tipo: quantos veículos ativos agora, quantos em alerta, posição no mapa. A visão executiva que a gente tinha descartado no scoring.

**Marcus:** O US-05. O Dashboard Base.

**Carlos:** Isso. Eu sei que a gente tirou via MoSCoW. O RICE score foi baixo. Mas o Roberto não quer ver alertas no app dele, ele quer ver um painel. É político, não é técnico. O deadline do board de julho não move.

**Marcus:** Entendo. A questão é de quando entra. O Sprint 3 já está fechado com US-02 automático e os blockers de hardware. Se o US-05 entrar no Sprint 4, junto com o que vier do hardware, pode ficar apertado dependendo do que chegar.

**Carlos:** Quanto custa o US-05 em termos de esforço?

**Marcus:** Nós estimamos 14 SP quando fizemos o backlog. É uma sprint quase inteira sozinho.

**Carlos:** Mas o hardware pode não chegar no Sprint 4. Se não chegar, o Sprint 4 fica com folga, certo?

**Marcus:** Correto. Se o hardware atrasar mais, o Sprint 4 fica subutilizado. Nesse caso o US-05 encaixa bem. E só pra deixar registrado: o US-05 não é aquele relatório de cores que a gente usou como exemplo de HiPPO no começo do projeto. O Dashboard Base tem mapa ao vivo com posição atualizada a cada 30 segundos, KPIs de veículos em alerta, filtro por região e exportação para PDF. É uma entrega operacional real. Ficou fora do MVP porque não atacava diretamente o OKR de sinistros — não porque não tem valor.

**Carlos:** Exato. O contexto mudou. No MVP não tínhamos capacidade pra isso. Agora temos hardware bloqueando três histórias e um deadline executivo real: o Roberto precisa apresentar a frota no board de julho. O US-05 resolve isso.

**Carlos:** Então a gente planeja o US-05 pro Sprint 4 com a condição de que se o hardware chegar, a gente revisa a alocação. Aceito esse risco.

**Marcus:** Registrado. US-05, Dashboard Base — mapa ao vivo, KPIs operacionais, exportação executiva — planejado pro Sprint 4 condicional ao hardware.

**Carlos:** Perfeito. Ana, você queria falar de alguma coisa também?

**Ana Lima:** Sim. Obrigada, Carlos. Eu vim porque o RH recebeu os dados de alertas do Sprint 1 — a Priya nos mandou um CSV — e foi ótimo. A gente conseguiu ver quais motoristas tiveram mais ocorrências. Mas o processo manual vai ser insustentável quando tivermos dados de quatro, cinco sprints acumulados.

**Carlos:** O que vocês precisam exatamente?

**Ana Lima:** Um painel dentro do sistema onde a gente consiga ver o ranking de comportamento dos motoristas, o score individual, o histórico por semana. Não precisar pedir CSV pra Priya toda vez.

**Priya:** Eu concordo. Já é a segunda semana que eles pedem. Gera trabalho manual desnecessário do lado da TI também.

**Marcus:** Isso seria uma nova história. Hoje a gente tem o Score de Comportamento no backlog, que é o cálculo do score — mas o painel pra o RH visualizar isso é uma entrega separada.

**Ana Lima:** Exatamente. O cálculo é uma coisa, a visualização pro RH é outra. A gente precisa da visualização.

**Marcus:** Entendido. Então a proposta é criar US-06, Painel de Motoristas com Score e Ranking, separado do US-03. Estimativa inicial: cinco SP. Pode entrar no Sprint 4 junto com o US-05 se o hardware atrasar, ou no Sprint 5 se o Sprint 4 ficar cheio.

**Carlos:** Faz sentido. Ana, você consegue me mandar os critérios de aceite? O que o RH precisa ver nesse painel?

**Ana Lima:** Sim, mando ainda hoje. Basicamente: score por motorista, ranking da frota, histórico de evolução por semana, e um filtro por período.

**Carlos:** Perfeito. Marcus, registra como US-06 com os critérios que a Ana vai mandar.

**Marcus:** Registrado. US-06, Painel de Motoristas com Score e Ranking, cinco SP estimados, Sprint 4 ou 5 dependendo da capacidade.

**Carlos:** Mais alguma coisa?

**Marcus:** Uma coisa rápida: o alerta de mapa que a Priya mencionou — vou colocar como melhoria no refinamento do Sprint 3 com dois SP. Não é nova história, é incremento do US-01.

**Carlos:** Ok. Então pra fechar: Sprint 2 entregue, 22 de 22. Hardware bloqueando três histórias, previsão de chegada no Sprint 4. Dashboard Base volta pro Sprint 4. Painel de Motoristas criado como US-06, entra no Sprint 4 ou 5. Ana manda critérios de aceite hoje.

**Marcus:** Correto. Vou atualizar o board agora.

**Carlos:** Ótimo. Obrigado Ana pela presença.

**Ana Lima:** Obrigada. Vai fazer muita diferença pro time.

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
