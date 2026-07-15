# Transcrição — Sprint Review: Sprint 2 - RouteWise
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 6.2**

> Transcrição de referência para a demo do Meeting Digest Prompt.
> Esta transcrição é o input que o aluno vai colar no prompt do AI Studio na demo ao vivo.

---

```
Transcrição - Sprint Review: Sprint 2 — Sistema de Gestão de Frota (RouteWise)
Participantes: Carlos Mendonça (Diretor de Operações), Marcus (Tech Lead / Consultor), Ana Lima (Gestão de Pessoas / RH)
Data: 28/04/2026 | Duração: ~20 minutos
Transcrição automática via Whisper, revisão mínima

Marcus: Tá, então Sprint 2 encerrado. Vou resumir o que foi entregue e a gente fala sobre o que muda daqui pra frente. O item principal desta sprint foi a US-02, Manutenção Preditiva. A versão que entregamos é o contorno manual: o time de campo passou a usar uma planilha padronizada para registrar manutenções por quilômetro e por data. Não é a versão automática, mas resolve o blocker de dados e permite que a gente acumule histórico estruturado que a versão automática vai consumir mais pra frente.

Carlos: Funciona? O pessoal tá usando de verdade?

Marcus: Tá. A Priya configurou o acesso com o time de campo na semana passada. As primeiras entradas já estão lá. O formato vai melhorar com o uso, mas tá validado.

Carlos: Tudo bem. E os alertas de velocidade?

Marcus: US-01 segue estável. Tivemos um edge case: motorista em área rural perdeu sinal por doze minutos, o sistema marcou como offline. Ajustamos o threshold de timeout pra não gerar falso positivo em área de sombra de cobertura. Sem outros incidentes desde então.

Carlos: Ok. E o hardware? A cotação do acelerômetro saiu?

Marcus: Ainda não. O fornecedor pediu mais duas semanas pra fechar o orçamento. Isso mantém o US-03, Score de Comportamento do Motorista, e o US-04, Sensor de Abertura de Baú, bloqueados por dependência de hardware. A gente vai avançar em duas trilhas paralelas no Sprint 3 pra não parar o desenvolvimento enquanto espera.

Carlos: Entendi. Ó Marcus, preciso conversar uma coisa. O Roberto me chamou essa semana.

Marcus: Seu diretor?

Carlos: Isso. Ele quer apresentar o sistema pra board no próximo trimestre. E perguntou se a gente vai ter um painel com visualização da frota, mapa ao vivo, veículos em tempo real. Isso não tava no escopo, né?

Marcus: Não. O US-05, Dashboard Base de Monitoramento, foi retirado lá no início no scoring de backlog. Ficou como Won't Have por conta do RICE baixo naquele momento.

Carlos: Eu sei que foi retirado. Mas agora ele precisa voltar. Não dá apresentar pro board sem um mapa. Número e alerta de velocidade eles não entendem. Mapa eles entendem.

Marcus: Entendo. Só confirmando o escopo do US-05 pra garantir que a gente tá falando a mesma coisa: é o Dashboard Base de Monitoramento, com mapa ao vivo dos cento e quarenta veículos, KPIs de alerta em tempo real, filtros por motorista e rota, exportação de relatório em PDF. É uma feature completa, não é um relatório simples.

Carlos: Isso. Exatamente isso.

Marcus: Então preciso confirmar a estimativa de esforço, mas provável que ocupe uma sprint boa parte ou toda. Vou trazer o número antes do Sprint Planning do Sprint 3 pra gente encaixar no cronograma sem sacrificar o que já está em produção.

Carlos: Combina. O Roberto precisa disso pra apresentação. Não é negociável.

Marcus: Anoto como retorno ao backlog ativo, prioridade alta. Estimativa antes do Sprint Planning do Sprint 3.

[Breve pausa. Ana Lima entra na sala de reunião.]

Ana Lima: Oi pessoal, desculpa o atraso, tava na call com o time de campo. Posso falar o que precisava?

Carlos: Claro, vai lá.

Ana Lima: É o seguinte. Lá no RH a gente usa dados de ocorrência dos motoristas pra avaliação semestral de desempenho. Vocês comentaram que o sistema vai ter dados de comportamento de condução, né? A gente queria saber se dá pra ter um painel específico pro RH, com listagem de motoristas, o score de comportamento de cada um e o ranking por período.

Marcus: Basicamente seria uma consulta nos dados do US-03, Score de Comportamento. Se o US-03 for entregue, o painel vem em cima disso. O problema é que o US-03 tá bloqueado por hardware agora, sem prazo confirmado.

Ana Lima: Ah, entendi. E quando sai o hardware?

Marcus: A gente ainda não tem prazo do fornecedor. Mas registrar o pedido como uma nova história já faz sentido: Painel de Motoristas com Score e Ranking. Quando o US-03 desbloquear, o painel entra junto. Carlos, pode incluir?

Carlos: Pode. Mas não entra em sprint enquanto o hardware não chegar, fica como dependência explícita.

Marcus: Registrado. Ana, você consegue detalhar os requisitos antes do Sprint Planning do Sprint 3? Quais campos o RH precisa, se é filtragem por período, se precisa exportar, se é integração com o sistema de vocês ou se exportação manual resolve por enquanto.

Ana Lima: Consigo sim. Exportação manual resolve a curto prazo. No médio prazo integração seria melhor, mas não é blocker pra começar.

Marcus: Perfeito. Fica como requisito: exportação manual primeiro, integração como fase dois.

Carlos: Mais alguma coisa antes de fechar?

Marcus: Bugs. Sprint 2 teve cinco bugs reportados, quatro resolvidos. Um ficou aberto pro Sprint 3, é problema de sincronização de status de dispositivo offline, não crítico, não afeta alertas. Lead Time médio do sprint ficou em sete vírgula um dias, levemente acima da baseline de seis e meio que a gente estabeleceu no Sprint 1. Vou monitorar.

Carlos: Sete dias parece dentro do esperado. Fica de olho.

Marcus: Tem mais uma coisa: o formato das planilhas de histórico de manutenção que o time de campo tá usando no contorno do US-02. A gente precisa padronizar os campos antes que a versão automática tente consumir esses dados. Quem ficaria responsável por validar isso com o pessoal de campo?

Carlos: Eu fico. Me manda um template do que você precisa e eu alinho com o time de campo.

Marcus: Mando até sexta. Fechando então: US-05 volta ao backlog ativo, US-06 Painel de Motoristas é criado como nova história, hardware segue aguardando. Estimativas e template de planilha até amanhã e sexta, respectivamente.

Carlos: Isso. Boa.
```

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
