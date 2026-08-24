# Research: Persistência Real de Operações

**Phase 0 output for** `specs/004-sqlite-ops-store/plan.md`

---

## Contexto

Hoje o bootstrap (`src/index.ts`), arena e bench usam `InMemoryStore` + `seedStore` acoplado a essa classe. O contrato é `IStore` (alertas + criar/resolver incidente). A constitution v2.0.0 manda SQLite via `node:sqlite` (`DatabaseSync`), sem Sequelize/MySQL. Esta fase fecha naming Mercadinho, forma do `OpsStore`, DDL/seed idempotentes, e onde in-memory continua.

---

## Decisão 1: Runtime `node:sqlite` / `DatabaseSync`

**Decisão**: Usar `DatabaseSync` de `node:sqlite` (já presente no Node 22+; API sync). Path = `process.env.OPSPILOT_DB ?? "./data/opspilot.db"`. Se path ≠ `:memory:`, `mkdirSync(dirname(path), { recursive: true })` antes de abrir. Testes passam `":memory:"` no construtor.

**Rationale**: Atende FR-001/FR-002 e a constitution sem dependência npm extra. Sync API encaixa no contrato atual síncrono do store (`getAlerts`, `createIncident`, …).

**Alternatives considered**:
- `better-sqlite3` — nativo/bindings; desnecessário com `node:sqlite`.
- Sequelize + sqlite dialect — contradiz constitution (“Sem ORM externo”).
- Manter MySQL — rejeitado pela constitution v2.0.0.

---

## Decisão 2: Rename `IStore` → `OpsStore` e superfície

**Decisão**:

```typescript
type ServiceTier = "critical" | "high" | "standard";

interface OpsStore {
  seed(data: SeedPayload): void;
  getAlerts(status?: AlertStatus): Alert[];
  getIncidents(status?: IncidentStatus): Incident[]; // omit/undefined = todos (filtro "all" na tool)
  createIncident(data: Pick<Incident, "title" | "service" | "severity">): Incident;
  resolveIncident(id: string, summary?: string | null): Incident;
  getRunbook(service: string): Runbook; // throws RunbookNotFoundError
}
```

- `InMemoryStore` e `SqliteOpsStore` implementam `OpsStore`.
- Alias deprecado: exportar `type IStore = OpsStore` **não** — renomear de uma vez (poucos call sites).
- Tool `list_incidents`: default `open` no zod; `"all"` → `getIncidents()` sem filtro.

**Rationale**: Spec pede `OpsStore`; ampliação mínima para US2; `seed` no contrato remove o `instanceof InMemoryStore` de `seed.ts`.

**Alternatives considered**:
- Métodos async — quebraria tools/bench sem ganho com `DatabaseSync`.
- Repository + Unit of Work — over-engineering (princípio 8).

---

## Decisão 3: Nomes Mercadinho (serviços + runbooks)

**Decisão**: Canonicalizar o seed para 5 serviços alinhados aos runbooks pedidos:

| name | tier | runbook |
|------|------|---------|
| `checkout` | `critical` | sim |
| `payments` | `critical` | sim |
| `auth` | `high` | sim |
| `catalog` | `standard` | não |
| `inventory` | `standard` | não |

Alertas: remapear os 6 do mock atual (mesmas severidades/status: 3 firing / 3 resolved) para esses serviços — ex. firing em `payments`, `auth`, `checkout`; resolved em `inventory`, `catalog`, `payments`.

Runbooks: texto stub curto (checklist operacional) por serviço; PK = `service`.

**Rationale**: FR-006 exige runbooks `checkout` / `payments` / `auth`. Nomes curtos batem melhor com prompts do bench (C2 já usa `checkout`, `payment`, `catalog`). Usar `payments` (plural) como canônico no seed; o bench que injeta literais do prompt continua independente do catálogo de alertas.

**Alternatives considered**:
- Manter `payment-api` / `auth-service` e mapear runbooks por alias — ambíguo para `consultar_runbook`.
- Só 3 serviços — viola “5 serviços” do Mercadinho.

**Nota bench**: C2 cria incidentes com nomes do prompt (`payment` singular). Não exige FK rígida serviço→incident; SQLite também **não** Enforce FK obrigatória nesta fatia (consistência via seed + CHECK de enums). Documentar: runbook lookup é exact match no nome.

---

## Decisão 4: DDL idempotente + CHECKs

**Decisão**: No construtor de `SqliteOpsStore`, executar `CREATE TABLE IF NOT EXISTS` para as 4 tabelas. CHECKs:

- `services.tier` ∈ (`critical`,`high`,`standard`)
- `alerts.severity` / `incidents.severity` ∈ (`critical`,`high`,`medium`,`low`)
- `alerts.status` ∈ (`firing`,`resolved`)
- `incidents.status` ∈ (`open`,`resolved`)

Colunas `incidents.resolved_at` e `incidents.summary` NULL. Timestamps como `INTEGER` (epoch ms), alinhados ao domínio atual.

**Rationale**: FR-003–FR-005; `IF NOT EXISTS` não apaga dados (edge case reinício).

**Alternatives considered**:
- Migrações versionadas (knex/flyway) — fora de escopo (assumptions da spec).
- ENUM nativo SQLite — não existe; CHECK é o padrão.

---

## Decisão 5: Seed idempotente

**Decisão**: `seed(data)` usa `INSERT OR IGNORE` (ou `INSERT … ON CONFLICT DO NOTHING`) nas PKs (`services.name`, `alerts.id`, `runbooks.service`). Não apaga incidentes criados pelo usuário. Payload em `seed-data.json` validado com zod (incl. runbooks + tier).

**Rationale**: FR-006 / SC-002 — re-seed seguro; reinício do processo reaplica baseline sem duplicar.

**Alternatives considered**:
- Delete-all + insert — destrutivo; viola edge case de dados existentes.
- Seed só se tabela vazia — falharia em DB parcial.

---

## Decisão 6: Prepared statements only

**Decisão**: Toda leitura/escrita via `db.prepare(sql).all/get/run(...)`. Filtros de status: statements separados ou `status = ?` com valor bound — nunca interpolar strings de input no SQL. Para `all`, statement sem cláusula de status.

**Rationale**: FR-007 / segurança por padrão.

---

## Decisão 7: Composição — quem usa SQLite vs in-memory

**Decisão**:

| Entrypoint | Store |
|------------|--------|
| `src/index.ts` (HTTP prod/dev) | `SqliteOpsStore` + seed |
| `src/bench.ts` | `InMemoryStore` + seed (FR-011 / SC-006) |
| `src/arena.ts` | `InMemoryStore` + seed (CLI efêmero, cenários reproduzíveis sem arquivo) |
| Testes `sqlite-ops-store` / tools | `SqliteOpsStore(":memory:")` + seed |

**Rationale**: Spec manda SQLite na composição de produção e in-memory no bench; arena beneficia do mesmo isolamento do bench.

**Alternatives considered**:
- Arena em SQLite arquivo — polui `data/` e acopla demos a I/O; desnecessário.

---

## Decisão 8: Tools e 6 regras

**Decisão**: Implementar/ajustar em `src/agents/tools.ts`:

1. Revisar `list_alerts`, `open_incident`, `resolve_incident` (dívida: quando usar / não usar; `.describe()` em todo campo; enums).
2. Adicionar `list_incidents` e `consultar_runbook` com as mesmas 6 regras.
3. `createTools` retorna as 5 tools.
4. `consultar_runbook`: catch `RunbookNotFoundError` → string de erro (padrão de `resolve_incident`).
5. `resolve_incident`: schema pode aceitar `summary` opcional alinhado a `resolveIncident(id, summary?)`.

**Rationale**: FR-008–FR-010; princípio agente no centro.

---

## Decisão 9: Remoção mysql2 / sequelize

**Decisão**: Remover de `package.json` / lockfile nesta feature (cleanup de constitution). Nenhum código os importa hoje de forma ativa no `src/`.

**Rationale**: Stack obrigatória; evita falsa dependência.

**Alternatives considered**: Deixar para depois — atrito desnecessário; spec assumptions permitem nesta feature.

---

## Decisão 10: Testes CHECK

**Decisão**: Em `sqlite-ops-store.test.ts`, além da API pública, obter handle interno **ou** abrir segundo `DatabaseSync` no mesmo `:memory:` não funciona (DBs memory isolados). Preferir: método de teste package-private / exportar `db` só em test hook, **ou** tentar `createIncident`/`seed` com dados que passariam zod mas — CHECK de tier inválido exige bypass. Mais simples: teste que chama `store['db'].prepare("INSERT INTO services ...").run("x", "invalid-tier")` via acesso tipado mínimo (`readonly db` package-visible) **ou** função `assertCheckRejects` no próprio arquivo de store testada com subclass.

**Escolha prática**: `SqliteOpsStore` expõe `/** @internal */ readonly database: DatabaseSync` usado só nos testes de CHECK — sem endpoint público de “raw SQL” nas tools.

**Rationale**: FR-013 / SC-004 verificáveis sem enfraquecer a API de domínio.

---

## Resolução de NEEDS CLARIFICATION

Nenhum item do Technical Context ficou em aberto após as decisões acima (`tier` valores, nomes Mercadinho, composição arena/bench, forma do CHECK test).
