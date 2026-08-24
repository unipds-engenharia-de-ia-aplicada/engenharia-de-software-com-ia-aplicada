# Data Model: Status de Provedores Externos

**Phase 1 output for** `specs/005-provider-status-tool/plan.md`

Sem persistência. Entidades são valores de passagem (request/response efêmeros).

---

## ProviderId

Identificador fechado do provedor suportado no v1.

| Campo | Tipo | Regras |
|-------|------|--------|
| valor | `"github"` \| `"cloudflare"` | Enum fechado; default na query = `"github"` |

---

## ProviderStatusQuery

Pedido do agente (parâmetro da tool).

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| provider | ProviderId | Não | Omitido → `github`; inválido → rejeição no schema da tool (antes do fetch) |

---

## StatusPagePayload (externo, validado)

Subset do JSON statuspage.io `/api/v2/status.json` que o sistema aceita.

| Campo | Tipo | Regras |
|-------|------|--------|
| status.indicator | string | Obrigatório após parse; não normalizar |
| status.description | string | Obrigatório após parse |
| (outros) | any | Ignorados (`passthrough`) |

Indicadores típicos observados (informativo, não enum interno): `none`, `minor`, `major`, `critical`.

---

## ProviderStatus (resultado lógico de sucesso)

| Campo | Tipo | Origem |
|-------|------|--------|
| provider | ProviderId | Query |
| indicator | string | `status.indicator` |
| description | string | `status.description` |

**Serialização para o agente**: uma linha  
`{indicator} — {description}`  
(sem JSON; sem ecoar o nome do provider no texto de sucesso — o modelo já escolheu o provider).

---

## ProviderStatusError (resultado lógico de falha)

Não é tipo de domínio lançável. Representado como string:

`Error: {mensagem legível}`

Cenários → mensagem (orientação, texto exato pode variar na implementação desde que legível):

| Cenário | Mensagem (ex.) |
|---------|----------------|
| Timeout (após retries) | `Error: timed out consulting {provider} statuspage` |
| Rede (após retries) | `Error: network failure consulting {provider} statuspage` |
| HTTP 4xx / 5xx final | `Error: statuspage returned HTTP {code} for {provider}` |
| JSON/zod inválido | `Error: invalid statuspage response for {provider}` |

---

## Relacionamentos

```text
ProviderStatusQuery ──maps──► URL statuspage
URL + fetch ──validates──► StatusPagePayload
StatusPagePayload ──formats──► ProviderStatus (string compacta)
falha ──formats──► ProviderStatusError (string Error: ...)
```

Nenhuma relação com `OpsStore`, Alert, Incident ou Runbook.
