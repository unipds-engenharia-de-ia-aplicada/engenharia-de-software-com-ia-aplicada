# Quickstart: Status de Provedores Externos

**Phase 1 output for** `specs/005-provider-status-tool/plan.md`

Guia de validação end-to-end. Sem código de implementação completo.

Referências: [data-model.md](./data-model.md), [contracts/check-provider-status.md](./contracts/check-provider-status.md).

---

## Pré-requisitos

- Node.js 22+
- `npm install` na raiz

---

## 1. Validação automatizada (sem rede)

```bash
npm test
npm run typecheck
```

**Esperado**: verdes, incluindo:

| # | Caso | Esperado |
|---|------|----------|
| 1 | Fake fetch 200 + JSON válido (`github`) | String `indicator — description` |
| 2 | Fake fetch timeout/Abort nas tentativas | `Error: ...`; 2 chamadas ao fake |
| 3 | Fake fetch 200 + body inválido | `Error: ...`; sem retry por validação |
| 4 | (se coberto) 503 depois 200 | Sucesso na 2ª tentativa |
| 5 | (se coberto) HTTP 404 | `Error: ...`; 1 chamada |
| 6 | `createTools` | Inclui tool nomeada `check_provider_status` (6 tools) |
| 7 | Default `provider` omitido | Consulta URL GitHub (assertável via URL passada ao fake) |

Nenhum teste MUST chamar `githubstatus.com` / `cloudflarestatus.com`.

---

## 2. Smoke manual com rede (opcional)

Só para sanity local — **não** é gate de CI:

```bash
npm run arena
# ou POST /chat após npm run dev
# pergunta: "o GitHub Status está ok? é problema nosso ou do provedor?"
```

**Esperado**: o agente chama `check_provider_status` (provider github ou default) e a observação contém indicador + descrição oficiais, ou `Error: ...` se a statuspage estiver inacessível.

Cloudflare:

```text
"cloudflare está degradado?"
```

**Esperado**: tool com `provider=cloudflare`.

---

## 3. Regressão do catálogo existente

```bash
npm test
```

Tools anteriores (`list_alerts`, `open_incident`, `resolve_incident`, `list_incidents`, `consultar_runbook`) MUST continuar passando sobre `:memory:` — esta feature só adiciona a 6ª tool.
