# Research: Chat HTTP API

**Phase 0 output for** `specs/003-chat-api/plan.md`

---

## Contexto

O núcleo de raciocínio (`ReasoningStrategy`, `StrategyResult`) e o decorator `withReflection` já existem. Express e zod já estão nas dependências; ainda não há pasta `src/http/`. O bootstrap atual (`src/index.ts`) monta store/tools/estratégias mas não sobe servidor. Esta fase fecha decisões de fronteira HTTP, timeout testável e forma do registry.

---

## Decisão 1: Forma do servidor Express

**Decisão**: Factory `createApp(deps)` que retorna `Express` (sem `listen`), mais `startServer(app, port)` / `src/index.ts` que faz `listen`.

```typescript
interface ChatAppDeps {
  registry: StrategyRegistry;
  timeoutMs?: number;                 // default 180_000
  reflectionOpts?: ReflectionOpts;    // modelFactory em prod; critic mock em testes
}

function createApp(deps: ChatAppDeps): Express;
```

**Rationale**: Permite teste de integração com `app.listen(0)` + `fetch` sem acoplar a porta fixa nem a `OPENROUTER_API_KEY`. Segue o padrão “app factory” usual em Express e a constitution (HTTP como borda).

**Alternativas rejeitadas**:
- `node:http` puro sem Express → contradiz constitution (stack Express) e o pedido “ou padrão do express”.
- Subir só via `listen` em módulo singleton → dificulta injetar registry fake e timeout curto nos testes.
- Introduzir `supertest` → dependência nova desnecessária; Node 22 + `fetch` + porta 0 bastam.

---

## Decisão 2: Timeout de 180s sem travar a CI

**Decisão**: `Promise.race` entre `strategy.run(message)` e um timer de `timeoutMs` (default `180_000`). Em testes de `504`, injetar `timeoutMs: 50` (ou similar) e uma fake strategy que atrasa além desse valor.

**Rationale**: Atende FR-008 / SC-005 sem esperar três minutos no `npm test`. O valor de produção permanece 180s.

**Alternativas rejeitadas**:
- Timeout só via `server.timeout` do Node → menos previsível com Express e não cobre a promise do agente de forma explícita.
- AbortController passado às estratégias → exigiria mudar `ReasoningStrategy.run` (fora de escopo).
- Esperar 180s de verdade no teste → inviável em CI.

---

## Decisão 3: Schema zod e defaults

**Decisão**:

```typescript
const chatRequestSchema = z.object({
  message: z.string().min(1),
  strategy: z.string().default("react"),
  reflect: z.boolean().default(false),
});
```

`strategy` permanece `string` no schema (não enum zod rígido): nomes desconhecidos passam na validação e falham no registry com `422` (FR-007), separando “body inválido” de “estratégia desconhecida”.

**Rationale**: Distingue claramente `400` (shape) de `422` (resolução). `min(1)` cobre edge case de `message` vazio. Defaults cobrem FR-003/FR-004.

**Alternativas rejeitadas**:
- `z.enum(["react", "plan-and-execute"])` → misturaria 400 e 422; novas estratégias exigiriam mudar o schema além do registry.
- Aceitar alias `plan-execute` → fora da Arena atual; aumenta superfície sem pedido explícito na revisão. Nomes canônicos: `react`, `plan-and-execute`.

---

## Decisão 4: Erros de domínio e mapeamento HTTP

**Decisão**:

| Erro | HTTP | Corpo |
|------|------|-------|
| `ZodError` (parse body) | `400` | `{ error: "validation_error", issues: ZodIssue[] }` |
| JSON inválido / body não-objeto | `400` | `{ error: "validation_error", issues: [...] }` ou mensagem equivalente |
| `UnknownStrategyError` | `422` | `{ error: "unknown_strategy", strategy: string }` |
| `ChatTimeoutError` | `504` | `{ error: "timeout", message: string }` |
| demais erros inesperados | `500` | `{ error: "internal_error", message: string }` (sem stack) |

**Rationale**: Constitution — erros tipados na borda. Issues zod cruas atendem o pedido da feature (“issues do zod”).

**Alternativas rejeitadas**:
- Usar só `400` para estratégia desconhecida → perde semântica FR-007.
- Propagar `ZodError` sem normalizar → formato inconsistente para o cliente.

---

## Decisão 5: Registry e resolução com `reflect`

**Decisão**: `src/agents/index.ts` exporta:

- `StrategyRegistry` = `ReadonlyMap<string, ReasoningStrategy>` (ou `Record` + helpers)
- `createDefaultRegistry(strategies)` a partir das instâncias do bootstrap
- `resolveStrategy(registry, name, reflect, reflectionOpts?)` → busca no map; se ausente lança `UnknownStrategyError`; se `reflect` aplica `withReflection(base, reflectionOpts)`

Produção: `reflectionOpts = { modelFactory: createModel }`.  
Testes: registry só com fake; para `reflect:true`, passar `critic` mock em `reflectionOpts`.

**Rationale**: “Estratégia nova = uma linha no registry”; reflexão na resolução (não pré-registrar `reflect:*` no map HTTP), alinhado ao flag booleano do body (diferente da Arena que usa nomes `reflect:*`).

**Alternativas rejeitadas**:
- Pré-popular `reflect:react` no registry HTTP → conflita com o body `{ reflect: boolean }` da spec.
- Duplicar `createStrategy` da Arena dentro do HTTP → duas fontes de verdade; registry único é o ponto de extensão da U6+.

---

## Decisão 6: Bootstrap de `src/index.ts`

**Decisão**: `index.ts` chama `bootstrapOpsPilot()` (ou extrai factory compartilhada), monta registry com `react` e `plan-and-execute`, `createApp({ registry, reflectionOpts: { modelFactory: createModel } })`, `listen(PORT)` com `PORT=process.env.PORT ?? 3000`. Continua exigindo `OPENROUTER_API_KEY` só no caminho de produção (estratégias reais).

**Rationale**: FR-012 — `npm run dev` sobe o servidor. Testes não passam por esse caminho.

**Alternativas rejeitadas**:
- Manter `index.ts` só como library export → viola FR-012.
- Servidor separado como único entry sem reutilizar bootstrap → duplicação de wire-up store/tools.

---

## Decisão 7: Estratégia de teste de integração

**Decisão**: `src/http/server.test.ts` — sobe app com registry `{ fake: FakeStrategy }`, timeout curto quando necessário; cobre:

1. `200` happy path (fake)
2. `400` body inválido (campo errado / message vazia)
3. `422` strategy desconhecida
4. `504` fake lenta + `timeoutMs` baixo
5. default `react` — registrar fake também como `react` **ou** assertar que omitir strategy resolve a chave `react` do registry de teste
6. `reflect:true` com critic mock aprovando (métricas / evento critique) — opcional mas cobre SC-006

**Rationale**: Sem rede; determinístico; SC-002–SC-005.

---

## Resumo das Decisões

| # | Área | Decisão |
|---|------|---------|
| 1 | Servidor | `createApp(deps)` + listen no `index` |
| 2 | Timeout | `Promise.race` + `timeoutMs` injetável |
| 3 | Zod | `message` min 1; defaults; strategy string livre |
| 4 | Erros | 400 / 422 / 504 / 500 mapeados |
| 5 | Registry | `agents/index.ts` + reflect na resolve |
| 6 | Bootstrap | `index.ts` sobe HTTP na porta 3000 |
| 7 | Testes | fake strategy + fetch porta 0 |

Nenhuma clarificação pendente.
