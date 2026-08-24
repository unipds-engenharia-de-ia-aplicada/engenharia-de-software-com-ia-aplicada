# Quickstart: Persistência Real de Operações

**Phase 1 output for** `specs/004-sqlite-ops-store/plan.md`

Guia de validação end-to-end. Sem código de implementação completo.

---

## Pré-requisitos

- Node.js 22+ (com `node:sqlite`)
- `npm install` na raiz
- Para smoke HTTP com LLM: `OPENROUTER_API_KEY` em `.env`

Referências: [data-model.md](./data-model.md), [contracts/ops-store.md](./contracts/ops-store.md), [contracts/tools.md](./contracts/tools.md).

---

## 1. Validação automatizada (sem rede)

```bash
npm test
npm run typecheck
```

**Esperado**: verdes, incluindo:

| # | Caso | Esperado |
|---|------|----------|
| 1 | `SqliteOpsStore(":memory:")` + seed ×2 | 5 services, 6 alerts (3/3), 3 runbooks; sem duplicar PKs |
| 2 | create → getIncidents(`open`) → resolve → getIncidents(`resolved`) | ciclo completo; `resolved_at` preenchido |
| 3 | filtros `open` / `resolved` / all (via store ou tool) | contagens corretas |
| 4 | INSERT inválido em tier/severity/status | rejeitado por CHECK |
| 5 | tools (5) sobre `:memory:` | sem rede; `consultar_runbook` hit/miss; `list_incidents` default `open` |
| 6 | bench types ainda usam `InMemoryStore` | `npm run bench` não exige arquivo `data/` |

---

## 2. Persistência em arquivo (smoke manual)

```bash
rm -rf data/opspilot.db
OPSPILOT_DB=./data/opspilot.db npm run dev
# em outro terminal / sessão de teste de store CLI se houver:
# abrir incidente via POST /chat ou script mínimo
```

Reiniciar o processo com o **mesmo** `OPSPILOT_DB` e listar incidentes (via tool/`getIncidents`): o incidente anterior MUST permanecer (SC-001).

**Esperado**: `data/` criado; `data/` ignorado pelo git (`gitignore`).

---

## 3. Tools via agente (opcional — requer API key)

```bash
OPSPILOT_DB=./data/opspilot.db npm run dev
```

```bash
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"liste incidentes abertos e mostre o runbook de payments"}' | jq '{answer, tools: [.trace[]|select(.type=="action")|.tool]}'
```

**Esperado**: ações podem incluir `list_incidents` e/ou `consultar_runbook`; answer referencia conteúdo seedado.

---

## 4. Bench reproduzível (in-memory)

```bash
npm run bench
```

**Esperado**: usa `InMemoryStore`; não cria/depende de `./data/opspilot.db`.

---

## Done quando

- [x] `npm test` + `npm run typecheck` verdes  
- [x] SC-001: reiniciar com o mesmo `OPSPILOT_DB` (manual) — `rm -rf data && OPSPILOT_DB=./data/opspilot.db` + abrir incidente + reiniciar + `list_incidents`  
- [x] `data/` no `.gitignore`  
- [x] Descrições das 5 tools passam nas 6 regras (review em `src/agents/tools.ts`)
