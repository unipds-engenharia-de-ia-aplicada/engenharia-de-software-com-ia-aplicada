# Contract: OpsStore

**Phase 1 output for** `specs/004-sqlite-ops-store/plan.md`

Implementações: `SqliteOpsStore`, `InMemoryStore`.

---

## Constructor / config (`SqliteOpsStore`)

| Input | Behavior |
|-------|----------|
| `path?: string` | Default `process.env.OPSPILOT_DB ?? "./data/opspilot.db"` |
| `":memory:"` | DB efêmero (testes) |
| path em arquivo | `mkdirSync` no diretório pai se necessário; abre `DatabaseSync` |

No construct: DDL idempotente (4 tabelas). Prepared statements cacheados como campos privados.

---

## Methods

### `seed(data: SeedPayload): void`

- Valida shape (chamador/`seed.ts` com zod) antes.
- Insere services, alerts, runbooks com `INSERT OR IGNORE` / equivalente in-memory (skip se PK existe).
- Não remove incidentes existentes.
- Idempotente: segunda chamada não duplica PKs.

### `getAlerts(status?: AlertStatus): Alert[]`

- Sem `status`: todos.
- Com `status`: filtra.
- Retorna cópias / rows mapeadas (sem compartilhar mutação interna).

### `getIncidents(status?: IncidentStatus): Incident[]`

- Sem `status`: todos.
- Com `status`: filtra `open` ou `resolved`.
- Ordenação sugerida: `created_at ASC` (estável para listagens).

### `createIncident({ title, service, severity }): Incident`

- Gera `id`, `status="open"`, `createdAt=Date.now()`, `resolvedAt=null`, `summary=null`.
- Persistência imediata (SQLite `INSERT`).

### `resolveIncident(id, summary?): Incident`

- Se não existe → `IncidentNotFoundError`.
- Seta `resolved`, `resolvedAt=now`, `summary=summary ?? null` (se `summary` omitido, mantém null ou valor prévio — **norma**: grava `summary ?? null` explicitamente nesta feature).

### `getRunbook(service): Runbook`

- Se não existe → `RunbookNotFoundError`.
- Retorna `{ service, content }`.

---

## Invariants

- Nenhuma query com concatenação de valores de input.
- Domínios fechados rejeitados no SQL (CHECK) mesmo se a API de domínio for contornada nos testes internos.
- `InMemoryStore` espelha a mesma semântica (sem CHECK SQL; pode validar com asserts/zod no seed).
