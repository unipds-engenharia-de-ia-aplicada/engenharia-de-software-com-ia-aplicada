# Research — 018 Modo Equipe

Decisões técnicas da fase 0. Nenhum `NEEDS CLARIFICATION` pendente na spec; itens abaixo resolvem escolhas de design com alternativas consideradas.

> **Ajuste as-built (implement)**: o exemplo fornecido pelo usuário na fase de implementação refinou R3/R7/R8 — sentinela de encerramento é **`done`** (não `finish`) e o **`brief` do `done` carrega o resumo final** (vira o `answer`), eliminando a chamada LLM de fechamento; encerramentos forçados/anômalos degradam para o blackboard renderizado. Contratos e data-model foram sincronizados.

## R1. Integração: sub-grafo + adapter `ReasoningStrategy`

**Decision**: Implementar a equipe como **StateGraph próprio** em `src/team/team-graph.ts` e expô-la ao grafo de produção via adapter `TeamStrategy implements ReasoningStrategy` (`name: "team"`), registrado em `ProductionStrategies` como quarta entrada.

**Rationale**: O grafo de produção (`013`) já trata estratégias como nós plugáveis (`runStrategy`); um adapter reusa todo o wire (contexto, resposta, audit, métricas) sem caso especial. O ciclo interno supervisor⇄papéis precisa de estado próprio (blackboard, contador de handoffs), o que pede um StateGraph dedicado — mesmo padrão do `plan-execute` existente.

**Alternatives considered**:
- *Papéis como nós diretos do grafo de produção*: contamina o estado do grafo de produção com blackboard/contador e quebra o isolamento das demais rotas. Rejeitado.
- *Loop imperativo (while) sem StateGraph*: menos código, mas contraria o princípio 1 da constitution ("toda capacidade vira nó do grafo") e perde a visualização/consistência com o resto do produto. Rejeitado.

## R2. Preservação do `node` no branch team

**Decision**: O nó `team` do grafo de produção **não** re-carimba os eventos com `stampNode("team", ...)`. Os eventos saem do sub-grafo já assinados com os nomes canônicos: `supervisor`, `analista`, `planejador`, `executor`.

**Rationale**: `stampNode` **sobrescreve** `node` (comportamento documentado em `src/graph/stamp-node.ts`); aplicá-lo ao trace da equipe destruiria a assinatura por papel exigida pela spec (US3/FR-009). As demais rotas continuam carimbadas como hoje.

**Alternatives considered**:
- *Variante `stampNodeIfMissing`*: adiciona API nova sem necessidade — o sub-grafo já assina tudo internamente. Rejeitado.
- *Namespacing (`team/analista`)*: mais informação, porém quebra a estabilidade dos nomes usados em testes e no drawer; a spec fixa nomes simples. Rejeitado.

## R3. Supervisor: saída estruturada e injeção para teste

**Decision**: `supervisorDecisionSchema = z.object({ next: z.enum(["analista", "planejador", "executor", "finish"]), brief: z.string() })`. Produção usa `modelFactory().withStructuredOutput(schema)` + `schema.parse` (mesmo padrão do roteador `013`). O grafo recebe `decideNext?: DecideNextFn` injetável — testes usam fakes determinísticos, sem rede.

**Rationale**: Espelha o contrato validado do roteador (fronteira LLM com zod, princípio 3). `finish` como membro do enum evita um segundo canal de encerramento.

**Alternatives considered**:
- *`next` livre (string) + validação manual*: perde o enum no schema enviado ao modelo, aumentando taxa de saída inválida. Rejeitado.
- *Tool-calling para handoff (padrão "handoff tools" do LangGraph)*: mais peças móveis (tool + comando) para o mesmo efeito; `withStructuredOutput` é o contrato pedido pelo input do usuário. Rejeitado.

## R4. Blackboard no estado do sub-grafo

**Decision**: `Annotation<BlackboardEntry[]>` com reducer de concatenação (mesmo padrão do `trace` no grafo de produção). Cada entrada: `{ role, kind: "facts" | "plan" | "execution" | "error", content, brief }`. Um helper `renderBlackboard(entries)` serializa o quadro para os prompts do supervisor e dos papéis.

**Rationale**: Reducer de concat torna as contribuições append-only e auditáveis; `kind` permite ao supervisor (e ao teste) verificar que analista entrega fatos, planejador entrega plano, executor entrega execução. `error` cobre a edge case de falha de papel devolvida ao supervisor.

**Alternatives considered**:
- *Blackboard como texto único acumulado*: simples, mas impede asserts estruturais (ex.: "contribuição do analista não contém plano") e mistura falhas com conteúdo. Rejeitado.
- *Persistir blackboard no SQLite*: fora de escopo — a spec fixa blackboard efêmero por turno; persistência do turno já é coberta por `015`. Rejeitado.

## R5. Partição estrutural de ferramentas por papel

**Decision**: Duas listas montadas no bootstrap com as factories existentes de `src/agents/tools.ts`:
- **analista** (leitura): `createListAlertsTool`, `createListIncidentsTool`, `createConsultarRunbookTool`, `createCheckProviderStatusTool`;
- **executor** (incidentes): `createOpenIncidentTool`, `createResolveIncidentTool`, `createListIncidentsTool`;
- **planejador**: lista vazia — chamada de modelo pura, sem `createReactAgent`.

Analista e executor rodam via `createReactAgent` com `recursionLimit` baixo (mesmo padrão do `ReactStrategy`); o teste assert-a o conjunto exato de tools de cada papel.

**Rationale**: FR-007 exige restrição por construção — o papel não recebe a ferramenta, então nem um prompt injection consegue invocá-la. Reuso das factories mantém "single source of truth" dos schemas (já compartilhados com o MCP server).

**Alternatives considered**:
- *Restringir por prompt ("você não pode...")*: viola FR-007 e o princípio 6 (guardrail por construção, não confiança no modelo). Rejeitado.
- *Wrapper que nega tools em runtime*: mais código para um efeito mais fraco que simplesmente não passar a tool. Rejeitado.

## R6. "Sem bypass" — análise das salvaguardas existentes

**Decision**: Nenhum mecanismo novo. O executor usa **as mesmas instâncias de tools** (mesmo `OpsStore`, mesmos erros de domínio) e o modo equipe roda **dentro** do grafo de produção — portanto o fluxo `awaitHumanApproval` (HTTP defere o turno inteiro antes de executar o grafo) cobre a rota `team` automaticamente, e a deny list da constitution segue valendo na camada de tools. Teste de guardrail: turno com `awaitHumanApproval: true` + `strategy: "team"` fica pendente sem executar nenhum papel.

**Rationale**: O guardrail atual é aplicado na borda (antes do grafo); qualquer caminho que executasse o sub-grafo fora do grafo de produção o contornaria — por isso o único entry point da equipe é a rota `team`.

**Alternatives considered**:
- *Aprovação humana por ação do executor (interrupt no meio do sub-grafo)*: mudança de contrato HTTP significativa (retomada de turno no meio do grafo), fora do escopo da spec ("não introduz salvaguarda nova"). Rejeitado — candidata a feature futura.

## R7. Evento `handoff` no trace

**Decision**: Novo `TraceEventType` `"handoff"` + campo opcional `to?: string` em `TraceEvent` (presente quando `type === "handoff"`). Forma canônica: `{ type: "handoff", node: "supervisor", to: "analista" | "planejador" | "executor" | "finish", content: brief }`. Encerramento forçado por teto usa `to: "finish"` com `content` iniciando por `"teto de handoffs atingido"` (texto estável para teste). Encerramento por saída malformada idem, com `"decisão inválida do supervisor"`.

**Rationale**: Segue o precedente de `route` (013): tipo novo + campos opcionais tipados em vez de serializar tudo em `content`. `content = brief` mantém o drawer legível sem parsing.

**Alternatives considered**:
- *Codificar destino no content (`"→ analista: ..."`)*: obriga parsing no front e em asserts. Rejeitado.
- *Evento por papel executado em vez de por decisão*: perde os handoffs de encerramento e a correspondência 1:1 decisão↔evento (SC-001). Rejeitado.

## R8. Resposta final e degradações

**Decision**: Nó `finish` do sub-grafo produz a resposta final com **uma chamada LLM** que recebe a mensagem original + blackboard renderizado. Degradações controladas:
- blackboard vazio → a chamada final responde a partir da mensagem original;
- falha da chamada final → resposta determinística com o conteúdo do blackboard concatenado (nunca turno vazio);
- decisão malformada / `next` inválido → tratado como `finish` (com handoff de anomalia, R7);
- falha de papel → entrada `kind: "error"` no blackboard + controle de volta ao supervisor (não consome retry infinito: a falha conta como handoff já gasto).

**Rationale**: Cobre as edge cases da spec mantendo o contrato `200` do turno; espelha o fallback do roteador (degradar, registrar, seguir).

**Alternatives considered**:
- *`brief` do finish carrega a resposta final*: sobrecarrega o campo e produz respostas piores (decidir e redigir na mesma chamada). Rejeitado.

## R9. Teto de 8 handoffs

**Decision**: Contador `handoffCount` no estado do sub-grafo, incrementado a cada **delegação** (handoff para papel). A aresta condicional do supervisor força `finish` quando `handoffCount >= 8`. Constante exportada `MAX_HANDOFFS = 8` (testável). O `recursionLimit` do LangGraph é dimensionado acima do teto para nunca disparar antes dele.

**Rationale**: Teto explícito no domínio (não no mecanismo do framework) dá mensagem/trace controlados — `GraphRecursionError` viraria erro opaco.

**Alternatives considered**:
- *Usar apenas `recursionLimit`*: erro genérico, sem encerramento forçado com resposta a partir do blackboard. Rejeitado.

## R10. Rota `team` e render no War Room

**Decision**:
- `PRODUCTION_ROUTES` ganha `"team"` — o schema HTTP (`chat-schema.ts`) aceita o override automaticamente por derivar do array; `parseOverrideStrategy` ganha o caso `team`; `router-prompt.ts` ganha a linha da tabela ("investigação + plano + execução coordenadas / pedido que pede papéis distintos" → `team`); fallback do roteador permanece `react`.
- Web: `traceEventSchema` ganha `"handoff"` no enum + `to?` opcional; `TraceDrawer` renderiza item handoff com destino em destaque (`para: {to}`) e brief como conteúdo, seguindo os tokens/escala do design system (`.cursor/rules/design.mdc`).

**Rationale**: Mínimo toque por camada, reusando os pontos de extensão deixados por `013` e `016`. Sem `"handoff"` no enum zod do front, o turno inteiro falharia a validação do fetch — por isso o front é parte obrigatória da fatia.

**Alternatives considered**:
- *Rota `team` fora do roteador (só override)*: contraria US4 (classificação automática faz parte do valor). Rejeitado.
