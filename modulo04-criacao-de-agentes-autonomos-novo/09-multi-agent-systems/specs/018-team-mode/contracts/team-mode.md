# Contract — Módulo `src/team/`

## Exports públicos

```ts
// src/team/supervisor.ts
export const TEAM_ROLES: readonly ["analista", "planejador", "executor"];
export const supervisorDecisionSchema: z.ZodObject<{ next /* roles | "done" */; brief }>;
export type SupervisorDecision;
export type DecideNextFn;
export function createDecideNext(modelFactory: () => OpsChatModel): DecideNextFn;

// src/team/blackboard.ts
export type BlackboardEntry; export type BlackboardKind;
export function renderBlackboard(entries: BlackboardEntry[]): string;

// src/team/roles.ts
export interface RoleRunner {
  readonly role: TeamRole;
  readonly tools: DynamicStructuredTool[];   // inspecionável em teste (contrato estrutural)
  run(input: { message: string; brief: string; blackboard: BlackboardEntry[] }):
    Promise<{ entry: BlackboardEntry; trace: TraceEvent[]; llmCalls: number }>;
}
export function createAnalistaRunner(opts: { modelFactory; tools: DynamicStructuredTool[] }): RoleRunner;
export function createPlanejadorRunner(opts: { modelFactory }): RoleRunner;   // sem tools por assinatura
export function createExecutorRunner(opts: { modelFactory; tools: DynamicStructuredTool[] }): RoleRunner;

// src/team/team-graph.ts
export const MAX_HANDOFFS = 8;
export const CAP_REACHED_PREFIX = "teto de handoffs atingido";
export const INVALID_DECISION_PREFIX = "decisão inválida do supervisor";
export function createTeamGraph(deps: TeamGraphDeps): CompiledTeamGraph;
export function runTeamGraph(deps, input: { message }): Promise<TeamTurnResult>;

// src/team/team-strategy.ts
export class TeamStrategy implements ReasoningStrategy {
  readonly name: "team";
  constructor(options: {
    modelFactory; analistaTools; executorTools;
    decideNext?; roleRunners?;                 // injeção para teste (sem rede)
  });
  run(input: StrategyRunInput): Promise<StrategyResult>;
}
```

## Invariantes

1. **Ciclo**: toda execução começa no `supervisor`; papéis sempre devolvem controle ao `supervisor`; só o nó `done` encerra.
2. **Handoff 1:1**: cada decisão do supervisor emite exatamente um evento `handoff` no trace (delegação ou encerramento).
3. **Teto**: no máximo `MAX_HANDOFFS` (8) delegações por turno; ao atingir, a próxima transição é forçada para `done` com handoff de teto (`CAP_REACHED_PREFIX`).
4. **Blackboard append-only**: papéis apenas acrescentam entradas; supervisor e done apenas leem.
5. **Partição estrutural**: `RoleRunner.tools` do analista não contém mutação de incidentes; do planejador é `[]`; do executor contém apenas tools de incidente. Assert por inspeção da lista, não por comportamento do modelo.
6. **Analista não propõe**: prompt do analista instrui fatos/diagnóstico; a entrada gerada tem `kind: "facts"` (verificação estrutural; conteúdo é responsabilidade do prompt).
7. **Sem bypass**: o executor recebe as mesmas instâncias de tools criadas pelas factories existentes (mesmo `OpsStore`/erros de domínio); o sub-grafo só é alcançável via rota `team` do grafo de produção — herdando `awaitHumanApproval` e demais salvaguardas de borda.
8. **Resultado**: `TeamStrategy.run` devolve `StrategyResult` completo (`answer` não vazio, `trace` com handoffs + eventos de papéis assinados, `metrics.llmCalls` agregado, `latencyMs`).
9. **Resposta final**: no `done` voluntário, `answer = brief` (resumo final do supervisor); encerramentos forçados/anômalos degradam para o blackboard renderizado e, vazio, para resposta determinística derivada da mensagem — sem chamada extra de LLM no fechamento.
10. **Degradação**: decisão malformada ⇒ done com handoff `INVALID_DECISION_PREFIX`; falha de papel ⇒ entrada `kind: "error"` no blackboard + retorno ao supervisor.

## Injeção para teste (sem rede)

- `TeamStrategyOptions.decideNext?: DecideNextFn` — fake determinístico substitui o LLM do supervisor (llmCalls do supervisor não contam).
- `TeamStrategyOptions.roleRunners?: Partial<Record<TeamRole, RoleRunner>>` — fakes por papel.
- `TeamGraphDeps` (nível grafo): `decideNext` e `roleRunners` obrigatórios; `supervisorLlmCalls` (0 fake / 1 real).
