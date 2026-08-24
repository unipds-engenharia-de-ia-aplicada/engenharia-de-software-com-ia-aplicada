# Quickstart: Refletor de Aprendizado — Validação

**Phase 1 output for** `specs/009-learning-reflector/plan.md`

Guia de validação end-to-end. Sem código de implementação completo.

---

## Pré-requisitos

- Node.js 22 LTS
- `npm install`
- Feature `008` (MemoryStore) disponível
- Smoke LLM opcional: `OPENROUTER_API_KEY`

---

## 1. Validação automatizada (sem rede LLM)

```bash
npm test
npm run typecheck
```

**Esperado**:

- `src/memory/learning-reflector.test.ts` — schedule + fail-safe + fake
- `src/agents/tools.test.ts` — `forget_preference` + contagem de tools
- `src/http/server.test.ts` / `run-chat` — não bloqueia 200; remember agendado
- zero erros de tipo

### Cenários mínimos

| # | Caso | Esperado |
|---|------|----------|
| 1 | Fake `hasLearning: true` após `runChat` | `remember` 1× |
| 2 | Fake `false` / pontual / segredo (fake) | `remember` 0× |
| 3 | Remember deferred | `runChat` completa com promise ainda pending |
| 4 | `forget_preference` | fato some do recall |
| 5 | Tool sem ALS | Error string |
| 6 | MCP catalog | ainda só 3 tools (sem forget) |

Referências: [contracts/learning-reflector.md](./contracts/learning-reflector.md), [contracts/forget-preference.md](./contracts/forget-preference.md).

---

## 2. Smoke manual (opcional — API key)

```bash
npm run dev
```

```bash
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"sempre priorize o serviço checkout no plantão","userId":"demo"}' \
  | jq '{answer, recalledMemories: .metrics.recalledMemories}'

# Aguardar 1–2s (remember async + embedding), depois:
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"o que você lembra das minhas prioridades?","userId":"demo"}' \
  | jq '{recalledMemories: .metrics.recalledMemories, answer}'
```

**Esperado**: segundo turno com `recalledMemories >= 1` ou answer alinhada à preferência (best-effort LLM).

Esquecer via diálogo (agente deve chamar `forget_preference`):

```bash
curl -s localhost:3000/chat -X POST \
  -H 'content-type: application/json' \
  -d '{"message":"pode esquecer a preferência de priorizar checkout","userId":"demo"}' | jq .answer
```

---

## 3. Critérios de aceite rápido

- [ ] SC-001 — remember 1× com fake positivo
- [ ] SC-002 — pontual/segredo (fake) sem remember
- [ ] SC-003 — 200 sem await remember
- [ ] SC-004 — forget_preference remove fato
- [ ] SC-005 — `npm test` + `typecheck` verdes

---

## Nota

Aprendizado é best-effort e assíncrono; smoke manual pode precisar de breve espera antes do segundo turno para o embedding/persist completar.
