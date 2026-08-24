# Data Model: Persistência Real de Operações

**Phase 1 output for** `specs/004-sqlite-ops-store/plan.md`

---

## Entities

### Service

| Field | Type | Constraints |
|-------|------|-------------|
| `name` | `string` | PK; required; unique |
| `tier` | `ServiceTier` | Required; CHECK ∈ `critical` \| `high` \| `standard` |

**Seed (Mercadinho)**:

| name | tier |
|------|------|
| `checkout` | `critical` |
| `payments` | `critical` |
| `auth` | `high` |
| `catalog` | `standard` |
| `inventory` | `standard` |

---

### Alert

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `string` | PK (ex. `alert-001`) |
| `service` | `string` | Required; nome de serviço |
| `description` | `string` | Required |
| `severity` | `Severity` | CHECK ∈ `critical` \| `high` \| `medium` \| `low` |
| `status` | `AlertStatus` | CHECK ∈ `firing` \| `resolved` |

**Seed**: 6 alertas — 3 `firing`, 3 `resolved` (remap do mock atual para os serviços Mercadinho).

---

### Incident

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `string` | PK; gerado (`inc-<ts>-<hex>`) |
| `title` | `string` | Required |
| `service` | `string` | Required |
| `severity` | `Severity` | CHECK |
| `status` | `IncidentStatus` | CHECK ∈ `open` \| `resolved`; default `open` |
| `createdAt` / `created_at` | `number` | Epoch ms; NOT NULL |
| `resolvedAt` / `resolved_at` | `number \| null` | Epoch ms; NULL se aberto |
| `summary` | `string \| null` | NULL até resolução (ou se omitido) |

**State transitions**:

```text
open ──► resolved
```

`resolveIncident(id, summary?)` seta `status=resolved`, `resolved_at=now`, `summary=summary ?? null`. Lança `IncidentNotFoundError` se id ausente.

---

### Runbook

| Field | Type | Constraints |
|-------|------|-------------|
| `service` | `string` | PK |
| `content` | `string` | Required; texto operacional |

**Seed**: runbooks para `checkout`, `payments`, `auth` apenas.

`getRunbook(service)` lança `RunbookNotFoundError` se não houver linha.

---

## Closed Domains (TypeScript + SQL CHECK)

| Domain | Values |
|--------|--------|
| `ServiceTier` | `critical`, `high`, `standard` |
| `Severity` | `critical`, `high`, `medium`, `low` |
| `AlertStatus` | `firing`, `resolved` |
| `IncidentStatus` | `open`, `resolved` |

---

## Relationships

```text
Service ──< Alert      (logical; service name string)
Service ──< Incident
Service ──1 Runbook    (optional; only some services)
```

Sem FK SQL obrigatória nesta fatia (research Decisão 3).

---

## OpsStore Contract (logical)

Ver [contracts/ops-store.md](./contracts/ops-store.md).

```typescript
interface SeedPayload {
  services: Service[];
  alerts: Alert[];
  runbooks: Runbook[];
}

interface OpsStore {
  seed(data: SeedPayload): void;
  getAlerts(status?: AlertStatus): Alert[];
  getIncidents(status?: IncidentStatus): Incident[];
  createIncident(data: Pick<Incident, "title" | "service" | "severity">): Incident;
  resolveIncident(id: string, summary?: string | null): Incident;
  getRunbook(service: string): Runbook;
}
```

---

## SQLite DDL (referencia)

```sql
CREATE TABLE IF NOT EXISTS services (
  name TEXT PRIMARY KEY,
  tier TEXT NOT NULL CHECK (tier IN ('critical', 'high', 'standard'))
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL CHECK (status IN ('firing', 'resolved'))
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  service TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  summary TEXT
);

CREATE TABLE IF NOT EXISTS runbooks (
  service TEXT PRIMARY KEY,
  content TEXT NOT NULL
);
```

Mapeamento TS ↔ SQL: `createdAt` ↔ `created_at`, `resolvedAt` ↔ `resolved_at`.

---

## Domain Errors

| Class | When |
|-------|------|
| `IncidentNotFoundError` | `resolveIncident` com id desconhecido |
| `RunbookNotFoundError` | `getRunbook` sem linha para o serviço |

---

## Module Layout

```text
src/domain/types.ts           → Service, Alert, Incident, Runbook, OpsStore, tiers/enums
src/domain/errors.ts          → IncidentNotFoundError, RunbookNotFoundError
src/store/sqlite-ops-store.ts → SqliteOpsStore
src/store/in-memory-store.ts  → InMemoryStore implements OpsStore
src/store/seed.ts             → load/validate seed-data.json; seedOpsStore(store)
src/store/seed-data.json      → Mercadinho payload
```
