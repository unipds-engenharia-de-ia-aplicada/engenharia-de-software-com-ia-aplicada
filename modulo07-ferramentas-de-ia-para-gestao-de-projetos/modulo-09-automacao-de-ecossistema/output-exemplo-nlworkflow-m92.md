# Output NL to Workflow - U9.2 Backup
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 9.2**

Output de referência gerado em pré-gravação. Use como backup caso o modelo produza resultado inesperado na demo ao vivo.

Gerado em: 2026-07-10 (AI Studio - Gemini 3.1 Pro Preview)
Input: as 3 mensagens de teste do nl-to-workflow-prompt.md, enviadas em sequência
Temperatura: 0.3

---

## Mensagem 1 - simples (bug, campos inferidos)

> "Preciso investigar por que os alertas de velocidade não estão chegando para os motoristas na região de Uberlândia."

```json
{
  "type": "bug",
  "title": "Falha no recebimento de alertas de velocidade em Uberlândia",
  "priority": "High",
  "assignee": null,
  "dueDate": null,
  "component": "Alertas de Velocidade",
  "requestedBy": null,
  "reason": "Motoristas da região de Uberlândia não estão recebendo notificações de infração de velocidade, comprometendo a segurança e o monitoramento da frota.",
  "description": "Investigar a falha na entrega de alertas de velocidade para os motoristas localizados na região de Uberlândia.\n\nPontos de investigação:\n- Verificar se os rastreadores Teltonika FMB920 da frota local estão enviando os pacotes MQTT corretamente para o AWS IoT Core.\n- Analisar os logs das funções Lambda (Node.js) responsáveis por processar os eventos de excesso de velocidade para a região.\n- Checar a integração com o Firebase FCM para confirmar se os push notifications estão sendo disparados e entregues aos aplicativos dos motoristas.\n- Validar configurações de geofence ou parâmetros regionais de Uberlândia que possam estar bloqueando o gatilho dos alertas.\n\nImpacto operacional:\nA falta de alertas em tempo real impede a correção imediata de comportamento dos motoristas, afetando o módulo de Score de Comportamento e aumentando o risco de multas e acidentes na região.",
  "tags": ["bug", "alertas", "telemetria", "uberlandia", "fcm"],
  "actionRequired": "Atribuir o card ao autor da mensagem, visto que a frase inicia com 'Preciso investigar'.",
  "confidence": "high",
  "rawMessage": "Preciso investigar por que os alertas de velocidade não estão chegando para os motoristas na região de Uberlândia."
}
```

**Ponto de curadoria:** o modelo percebeu a primeira pessoa ("Preciso investigar") e, em vez de inventar assignee — restrição respeitada —, sugeriu no `actionRequired` atribuir ao autor. Sugerir é inferência; atribuir é compromisso.

---

## Mensagem 2 - complexa (voluntário implícito, prazo relativo, contexto de negócio)

> "O Carlos pediu ontem que a gente antecipe o módulo de manutenção preditiva para antes do fim do mês porque a frota vai fazer revisão anual em junho. Alguém pode pegar isso?"

```json
{
  "type": "feature",
  "title": "Antecipar entrega do módulo de Manutenção Preditiva",
  "priority": "High",
  "assignee": "[A DEFINIR]",
  "dueDate": "[fim do mês corrente]",
  "component": "Manutenção Preditiva",
  "requestedBy": "Carlos Mendonça",
  "reason": "A frota passará por revisão anual em junho, exigindo que o módulo esteja operante antes do fim do mês.",
  "description": "Antecipar o desenvolvimento e a implantação do módulo de Manutenção Preditiva.\n\nPontos de ação técnicos:\n- Acelerar a ingestão e processamento de dados de telemetria (Teltonika FMB920 via MQTT/AWS IoT Core) para os cálculos de desgaste e predição.\n- Finalizar a interface no Dashboard Gerencial (React) para visualização dos alertas de manutenção pelos gestores.\n- Validar a integração dos dados preditivos com o módulo de Gestão de Ativos.\n\nImpacto operacional:\nTer o módulo operando antes da revisão anual permitirá que a equipe de operações tome decisões baseadas em dados sobre quais dos 140 veículos precisam de intervenção prioritária, otimizando o orçamento de manutenção e reduzindo o tempo de inatividade da frota.",
  "tags": ["manutenção preditiva", "antecipação", "revisão anual", "planejamento"],
  "actionRequired": "Confirmar assignee antes de criar o card",
  "confidence": "high",
  "rawMessage": "O Carlos pediu ontem que a gente antecipe o módulo de manutenção preditiva para antes do fim do mês porque a frota vai fazer revisão anual em junho. Alguém pode pegar isso?"
}
```

**Pontos de curadoria:** `requestedBy` expandido para "Carlos Mendonça" via contexto do projeto. O `type` pode variar entre "feature" e "task" entre execuções — ambos defensáveis; se sair "task" na demo ao vivo, use como ponto de curadoria (o confidence deveria ser "medium" nesse caso).

---

## Mensagem 3 - blocker crítico (decisão binária, prazo imediato)

> "Atenção time: o deploy de sexta está bloqueado porque o módulo de Score de Comportamento ainda depende do hardware que não chegou. Precisamos decidir até amanhã se postergamos o deploy ou removemos o Score do escopo da release."

```json
{
  "type": "task",
  "title": "Decidir escopo do deploy de sexta (Score de Comportamento)",
  "priority": "Highest",
  "assignee": null,
  "dueDate": "[amanhã]",
  "component": "Score de Comportamento",
  "requestedBy": null,
  "reason": "O módulo de Score de Comportamento depende de um hardware que não chegou, bloqueando o deploy de sexta-feira.",
  "description": "O deploy programado para esta sexta-feira encontra-se bloqueado. O módulo de Score de Comportamento possui dependência de um hardware (possivelmente rastreadores Teltonika FMB920 ou periféricos associados) que ainda não foi entregue.\n\nAção necessária:\n- Realizar alinhamento com a equipe para tomada de decisão imediata.\n- Opção A: Postergar o deploy completo até a chegada do hardware.\n- Opção B: Remover o módulo de Score de Comportamento do escopo da release atual e seguir com o deploy dos demais módulos.\n\nImpacto operacional:\nO bloqueio impede a atualização do sistema em produção. A decisão afetará o cronograma de entregas e a disponibilidade de novas funcionalidades para a gestão dos 140 veículos da frota.",
  "tags": ["deploy", "bloqueador", "score de comportamento", "hardware", "release"],
  "actionRequired": null,
  "confidence": "high",
  "rawMessage": "Atenção time: o deploy de sexta está bloqueado porque o módulo de Score de Comportamento ainda depende do hardware que não chegou. Precisamos decidir até amanhã se postergamos o deploy ou removemos o Score do escopo da release."
}
```

**Ponto de curadoria central da demo:** priority Highest ✓, dueDate [amanhã] ✓, type "task" (não inventou "blocker" fora do schema) ✓ — mas o `actionRequired` veio **null**, com a decisão binária dentro da `description`. Para um humano lendo o card, tanto faz; para o bot, não — é o `actionRequired` que funciona como freio de criação automática. Ajuste de prompt a demonstrar: "mensagens que exigem decisão de gestão devem sempre preencher actionRequired". É o ciclo de prompt engineering iterativo do módulo acontecendo ao vivo.

---

*Artefato de referência para gravação — usar este arquivo em tela durante a demo.*

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
