# Contract: RequestStore

**Phase 1 output for** `specs/015-persistent-trace-logs/plan.md`

Interface de persistência de auditoria de turnos `/chat`.

---

## Interface

```ts
interface RequestStore {
  save(input: SaveRequestInput): void;
  getById(id: string): { request: RequestRecord; trace: TraceEvent[] } | null;
}
```

Ver shapes em [data-model.md](../data-model.md).

---

## Implementação: `SqliteRequestStore`

| Item | Contrato |
|------|----------|
| Path | ctor / `OPSPILOT_DB` / default `./data/opspilot.db` |
| Testes | `:memory:` |
| Engine | `node:sqlite` `DatabaseSync` |
| DDL | `CREATE TABLE IF NOT EXISTS` requests + trace_events (idempotente) |
| SQL | prepared statements only |
| `save` | grava request + eventos com `seq = 0..n-1`; idealmente em transação |
| `getById` | `null` se ausente; senão request + trace `ORDER BY seq ASC` |
| Coexistência | mesmo arquivo que ops/conversations/memories; sem dropar outras tabelas |

---

## Mapeamento TraceEvent ↔ row

| Domínio | Coluna |
|---------|--------|
| `type` | `type` |
| `node` | `node` |
| `content` | `content` |
| opcionais | `payload_json` |

---

## Testes mínimos do store

| # | Caso | Esperado |
|---|------|----------|
| 1 | save + getById | metrics e N eventos na ordem |
| 2 | getById missing | `null` |
| 3 | DDL 2× no mesmo db | sem erro; dados intactos |
| 4 | arquivo temp + reopen | SC-005 smoke |
| 5 | trace vazio | request ok; `trace: []` |
