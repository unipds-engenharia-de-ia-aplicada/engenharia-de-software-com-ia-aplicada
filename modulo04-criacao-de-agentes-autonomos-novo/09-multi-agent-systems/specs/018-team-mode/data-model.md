# Data Model — 018 Modo Equipe

Entidades e contratos de dados da feature. Tipos TypeScript indicativos; nomes canônicos estáveis para testes.

## SupervisorDecision

Saída estruturada do supervisor a cada rodada (fronteira LLM, validada com zod).

```ts
const TEAM_ROLES = ["analista", "planejador", "executor"] as const;
type TeamRole = (typeof TEAM_ROLES)[number];

const supervisorDecisionSchema = z.object({
  next: z.enum([...TEAM_ROLES, "done"]),
  // instrução de trabalho para o próximo papel (nó) ou resumo final se done
  brief: z.string(),
});
type SupervisorDecision = z.infer<typeof supervisorDecisionSchema>;

type DecideNextFn = (input: {
  message: string;
  blackboard: BlackboardEntry[];
  handoffCount: number;
}) => Promise<SupervisorDecision>;
```

Regras:
- `next` fora do enum ou saída malformada ⇒ tratado como `done` (degradação controlada, com handoff de anomalia).
- No `done` voluntário, `brief` é o **resumo final** ao plantonista (vira o `answer`); encerramentos forçados chegam com `brief` vazio e caem no fallback determinístico do blackboard.
- Produção: `withStructuredOutput(supervisorDecisionSchema)` + `parse`; testes injetam `DecideNextFn` fake.

## BlackboardEntry

Contribuição de um papel no quadro compartilhado (append-only via reducer de concat).

```ts
type BlackboardKind = "facts" | "plan" | "execution" | "error";

interface BlackboardEntry {
  role: TeamRole;
  kind: BlackboardKind;   // analista→facts, planejador→plan, executor→execution; error em falha
  brief: string;          // brief que originou a contribuição
  content: string;        // texto produzido pelo papel
}
```

Regras:
- Blackboard é efêmero: vive no estado do sub-grafo durante o turno; não persiste entre turnos.
- `renderBlackboard(entries): string` serializa o quadro para prompts (supervisor, papéis) e para o fallback do `done`.

## TeamState (estado do sub-grafo)

```ts
const TeamState = Annotation.Root({
  message: Annotation<string>(),                      // mensagem enriquecida do turno (+ histórico composto)
  blackboard: Annotation<BlackboardEntry[]>({ reducer: concat, default: () => [] }),
  handoffCount: Annotation<number>(),                 // delegações consumidas (teto MAX_HANDOFFS = 8)
  brief: Annotation<string>(),                        // brief da decisão corrente (no done, resumo final)
  next: Annotation<TeamRole | "done" | null>(),
  answer: Annotation<string>(),
  trace: Annotation<TraceEvent[]>({ reducer: concat, default: () => [] }),
  llmCalls: Annotation<number>({ reducer: sum }),     // agregado supervisor + papéis
});
```

Transições:

```text
START → supervisor
supervisor → analista | planejador | executor   (delegação; handoffCount++)
supervisor → done                               (voluntário, malformado, ou handoffCount >= 8 forçado)
analista | planejador | executor → supervisor   (contribuição no blackboard)
done → END                                      (answer = brief; fallback: blackboard → mensagem)
```

## Papéis (capacidades estruturais)

| Papel | Tools (instâncias existentes de `src/agents/tools.ts`) | Produz no blackboard |
|---|---|---|
| `analista` | `list_alerts`, `list_incidents`, `consultar_runbook`, `check_provider_status` | `facts` (sem plano/ação) |
| `planejador` | — (chamada de modelo pura) | `plan` |
| `executor` | `open_incident`, `resolve_incident`, `list_incidents` | `execution` |

## TraceEvent (extensão de domínio)

```ts
type TraceEventType = /* existentes */ | "handoff";

interface TraceEvent {
  // ... campos existentes (type, content, node, tool, toolArgs, round, approved,
  //     timestampMs, route, override, reason) ...
  /** Present when type === "handoff": papel de destino ou "done". */
  to?: string;
}
```

Forma canônica do handoff:

```ts
{ type: "handoff", node: "supervisor", to: "analista", content: "<brief>" }
```

Encerramentos especiais (texto estável, prefixo testável — constantes exportadas em `team-graph.ts`):
- teto (`CAP_REACHED_PREFIX`): `{ type: "handoff", node: "supervisor", to: "done", content: "teto de handoffs atingido: ..." }`
- anomalia (`INVALID_DECISION_PREFIX`): `{ ..., to: "done", content: "decisão inválida do supervisor: ..." }`

Nomes canônicos de `node` no modo equipe: `supervisor`, `analista`, `planejador`, `executor` (eventos internos dos papéis — thought/action/observation — assinados pelo papel).

## Rota de produção (extensão)

```ts
const PRODUCTION_ROUTES = ["react", "planExecute", "reflect", "team"] as const;
```

- `parseOverrideStrategy("team") → "team"`.
- Schema HTTP (`chat-schema.ts`) aceita `strategy: "team"` por derivação de `PRODUCTION_ROUTES` (sem edição manual do enum).
- `ProductionStrategies` ganha `team: ReasoningStrategy` (adapter `TeamStrategy`).
- Branch `team` do grafo de produção **não** aplica `stampNode` (preserva assinatura dos papéis).

## Web (espelho do contrato)

```ts
// web/src/api/types.ts
traceEventSchema: type enum + "handoff"; campo to: z.string().optional()
```

`TraceDrawer` renderiza item `handoff` com `to` em destaque e `content` (brief) como corpo.
