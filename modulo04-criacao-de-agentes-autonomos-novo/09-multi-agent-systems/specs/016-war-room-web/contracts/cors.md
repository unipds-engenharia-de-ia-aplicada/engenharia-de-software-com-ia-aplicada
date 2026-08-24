# Contract: CORS

**Phase 1 output for** `specs/016-war-room-web/plan.md`

---

## Configuração

| Env | Default | Formato |
|-----|---------|---------|
| `OPSPILOT_CORS_ORIGINS` | `*` (allow all) | Omit / `*` = refletir qualquer `Origin`. Lista separada por vírgula restringe (trim, sem trailing slash) |

Exemplo (restringir):

```bash
OPSPILOT_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Default (sem env): CORS ativo para qualquer origem do browser.

---

## Middleware

Aplicar **antes** das rotas JSON, em `createApp`:

1. Ler `Origin` do request.
2. Se `OPTIONS`:
   - Se origin allowlisted (ou ausente em non-browser tools — responder 204 sem ACAO se sem Origin): `204` + headers CORS.
   - Se origin presente e **não** allowlisted: `403` sem refletir origin (ou `204` sem ACAO — preferência: `403` `{ "error": "cors_origin_denied" }` só se quisermos estrito; **v1**: `204` sem headers CORS → browser bloqueia).
3. Se método real (`GET`/`POST`): se origin allowlisted, setar headers na response; se não allowlisted e Origin presente, não setar ACAO (browser bloqueia).

### Headers (quando allowlisted)

| Header | Valor |
|--------|-------|
| `Access-Control-Allow-Origin` | Exact match da `Origin` do request (nunca `*` com lista) |
| `Access-Control-Allow-Methods` | `GET,POST,OPTIONS` |
| `Access-Control-Allow-Headers` | `Content-Type, X-Request-Id` |
| `Access-Control-Expose-Headers` | `X-Request-Id` |
| `Access-Control-Max-Age` | `86400` (preflight cache) |

**Não** enviar `Access-Control-Allow-Credentials` (v1 sem cookies).

---

## Rotas cobertas

Todas as rotas do `createApp` (incluindo `/chat`, `/approvals/:id`, `/requests/:id`, `/stats`, `/memories`) herdam o middleware global.

---

## Testes mínimos

| # | Caso | Esperado |
|---|------|----------|
| 1 | `OPTIONS /chat` Origin allowlisted | `204` + ACAO = Origin |
| 2 | `POST /chat` Origin allowlisted | Response inclui ACAO |
| 3 | `POST /chat` Origin estranha | Sem ACAO (ou não ecoa estranha) |
| 4 | `OPTIONS /approvals/:id` allowlisted | `204` + methods incluem POST |
