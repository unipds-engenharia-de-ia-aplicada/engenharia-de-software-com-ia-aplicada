# Contract: README Pages / War Room

**Phase 1 output for** `specs/017-pages-web-deploy/plan.md`

---

## `README.md` (raiz) — seções mínimas

1. **OpsPilot** — uma frase (copiloto de plantão / agente + War Room).
2. **Desenvolvimento local**
   - API: `npm run dev` (porta 3000)
   - War Room: `npm run web:dev` → `http://localhost:5173/opspilot/`
3. **GitHub Pages (War Room)**
   - Pré-requisito: Settings → Pages → Source = **GitHub Actions**
   - Workflow: `.github/workflows/pages.yml`
   - URL: `https://thiagobussola.github.io/ops-pilot/`
   - Nota: build de produção no CI usa base `/ops-pilot/` (path do project site); dev local mantém `/opspilot/`
   - API **não** está no Pages — configurar URL na engrenagem da War Room (CORS liberado por padrão na API)
4. **Scripts úteis** — `npm test`, `npm run web:build`, etc. (lista curta)

---

## `web/README.md`

Substituir template Vite por:

- Título: OpsPilot War Room
- 2–4 frases: SPA Vite+React; docs e Pages no [README raiz](../README.md)
- Dev: `npm run web:dev` / build: `npm run web:build`

---

## Critério de aceite doc

Um leitor localiza URL Pages + passo “Source = GitHub Actions” em < 2 min (SC-004).
