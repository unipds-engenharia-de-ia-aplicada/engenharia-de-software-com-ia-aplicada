# Research: Status de Provedores Externos

**Phase 0 output for** `specs/005-provider-status-tool/plan.md`

---

## Contexto

O agente já tem tools locais (alertas, incidentes, runbooks) via `OpsStore`. Falta uma observação externa para triagem “é nosso ou do provedor?”. Statuspages GitHub/Cloudflare expõem `GET /api/v2/status.json` sem autenticação. Esta fase fecha layout de módulos, política de retry (incl. timeout), formato de retorno e injeção de fetch.

---

## Decisão 1: Núcleo em `src/tools/` + wrapper em `agents/tools.ts`

**Decisão**:

- `src/tools/check-provider-status.ts` exporta:
  - `PROVIDERS` / mapa `provider → URL`
  - `statusPageStatusSchema` (zod)
  - `fetchProviderStatus(provider, options?)` → `Promise<string>` (sempre string: sucesso compacto ou `Error: ...`)
  - tipo `FetchLike = typeof globalThis.fetch`
- `src/agents/tools.ts` exporta `createCheckProviderStatusTool(options?: { fetch?: FetchLike })` e inclui em `createTools(store)` (opções default = `globalThis.fetch`).

**Rationale**: Constitution — I/O na camada tools/services; agents só registra no grafo. Spec pede tool em `agents/tools.ts` (registro) e fetch injetável (núcleo testável sem LangChain).

**Alternatives considered**:
- Tudo em `agents/tools.ts` — funciona, mas mistura HTTP externo com factories de store; pior para teste unitário puro.
- Novo `src/services/` — pasta inexistente; `src/tools/` já é o ponto de re-export.

---

## Decisão 2: Política de timeout + retry

**Decisão**:

| Evento | Retry? | Notas |
|--------|--------|-------|
| Rede (TypeError / fetch failed) | Sim, 1× | |
| HTTP 5xx | Sim, 1× | Não ler/validar body na tentativa falha |
| Timeout (`AbortError` / `TimeoutError` via `AbortSignal.timeout(5000)`) | Sim, 1× | Timeout = falha transitória elegível (Assumption da spec) |
| HTTP 4xx | Não | Erro legível imediato |
| JSON inválido / falha zod | Não | Só após 2xx |
| 2xx + schema OK | — | Retorno compacto; sem mencionar retry |

Máximo 2 tentativas por invocação. Cada tentativa cria **novo** `AbortSignal.timeout(5000)`.

**Rationale**: Spec US2 + Assumptions; alinha FR-006/FR-007 com a interpretação de que timeout conta como rede. Clarifica ambiguidade do FR-007 (“timeout esgotado nas tentativas” = falha **final** após política, não “timeout sem retry”).

**Alternatives considered**:
- Timeout sem retry — contradiz Assumption e cenário de aceite US2.1.
- Retry em 4xx — inútil (cliente/URL errada).
- Backoff com delay — fora do escopo; retry imediato basta.

---

## Decisão 3: Schema zod da statuspage (permissivo)

**Decisão**:

```typescript
const statusPageStatusSchema = z.object({
  status: z.object({
    indicator: z.string(),
    description: z.string(),
  }),
}).passthrough(); // campos extras (page, etc.) ignorados
```

Não restringir `indicator` a enum interno (`none|minor|major|critical`) nesta feature — repassar o valor oficial.

**Rationale**: Spec edge case (campos extras OK; não normalizar indicador). Validação na fronteira externa (constitution §3).

**Alternatives considered**:
- Enum rígido de indicator — frágil se statuspage adicionar valores.
- Tipar `page.id` etc. — desnecessário para retorno compacto.

---

## Decisão 4: Formato de retorno compacto e erros

**Decisão**:

- Sucesso: `` `${indicator} — ${description}` `` (uma linha; em-dash `—`).
- Erro: `` `Error: ${mensagem legível}` `` (padrão das tools `resolve_incident` / `consultar_runbook`).
- Mensagens mínimas: timeout, HTTP status, rede, “invalid statuspage response”, provider desconhecido (só se chamado fora do schema LangChain).
- `fetchProviderStatus` **nunca** rejeita a Promise por falha operacional — resolve com string de erro. (Throw só seria bug interno; testes assertam que invoke não rejeita nos casos cobertos.)

**Rationale**: FR-009/FR-010; consistência com tools existentes; não inflar contexto do LLM.

**Alternatives considered**:
- JSON no resultado da tool — spec pede texto livre de uma linha.
- Throw capturado só no wrapper LangChain — duplicaria política; melhor no núcleo.

---

## Decisão 5: Mapa de provedores e default

**Decisão**:

| provider   | URL |
|------------|-----|
| `github`   | `https://www.githubstatus.com/api/v2/status.json` |
| `cloudflare` | `https://www.cloudflarestatus.com/api/v2/status.json` |

Schema da tool:

```typescript
z.object({
  provider: z.preprocess(
    (v) => v ?? "github",
    z.enum(["github", "cloudflare"]).describe(
      'Provedor externo: "github" (default) ou "cloudflare".',
    ),
  ),
})
```

Descrição da tool (6 regras): quando usar = suspeita externa / “nosso ou do provedor?” / dependência fora; quando não usar = inventário local (alertas/incidentes/runbooks).

**Rationale**: FR-002–FR-005; mesmo padrão `z.preprocess` default das tools `list_alerts` / `list_incidents`.

**Alternatives considered**:
- Mais provedores no v1 — fora de escopo (Assumption).
- Default cloudflare — spec manda github.

---

## Decisão 6: Testes com fake fetch

**Decisão**: Testes em `src/tools/check-provider-status.test.ts`:

1. Sucesso — fake devolve 200 + JSON válido → linha compacta.
2. Timeout — fake rejeita com `DOMException`/`AbortError` nas duas tentativas → `Error: ...`; assertar 2 calls.
3. Inválido — 200 + body sem `status.indicator` → `Error: ...` sem segunda tentativa por validação.
4. (Opcional recomendado) 5xx depois 200 — 1 retry e sucesso; 4xx — 1 call só.

`createTools` / `tools.test.ts`: assertar 6 tools e nome `check_provider_status`.

**Rationale**: FR-011/FR-012; SC-004.

**Alternatives considered**:
- Mock global `fetch` — frágil em paralelo; injeção explícita é o pedido da spec.
- Testes de integração contra statuspage real — flaky; fora do CI.

---

## Decisão 7: Sem mudanças em store / HTTP / domínio

**Decisão**: Não alterar `OpsStore`, seed, `/chat`, nem tipos de domínio. A tool não precisa de `store` no factory além de permanecer no array de `createTools(store)`.

**Rationale**: Escopo da spec; princípio 8.

**Alternatives considered**:
- Cache em SQLite do último status — over-engineering para v1.
- Endpoint HTTP dedicado — não pedido.

---

## Resolução de NEEDS CLARIFICATION

Nenhum item marcado NEEDS CLARIFICATION no Technical Context. Ambiguidade timeout/retry resolvida na Decisão 2 alinhada às Assumptions da spec.
