"""
danger-config-routewise.py -- Governanca como Codigo (Python)

Artefato de Demo -- Unidade 8
Equivalente Python do danger-config-template.js.
Implementa as mesmas 5 regras de conformidade usando a API REST do GitHub.

===========================================================================
COMO USAR: DOIS CENARIOS DE DEMO
===========================================================================

CENARIO 1 -- Rodando localmente (sem GitHub, sem internet, sem token)
-----------------------------------------------------------------------
Este modo simula a execucao das regras contra um PR ficticio definido
em arquivo JSON. Ideal para apresentacoes em sala ou testes offline.

Passos:

    1. Abra um terminal na pasta onde estao estes arquivos.

    2. Cenario que PASSA em todas as regras:
       - Titulo tem referencia ao Jira (ROUTEWISE-42)
       - Dois aprovadores (Priya e Carlos)
       - 359 linhas alteradas (abaixo do limite de 500)
       - Cobertura caiu 1.7 pontos (abaixo do limite de 5)
       - Descricao detalhada

           python danger-config-routewise.py --local

    3. Cenario que FALHA -- simula PR mal configurado:
       - Sem referencia ao Jira no titulo nem na descricao
       - Apenas 1 aprovador para arquivos criticos (precisa de 2)
       - 635 linhas alteradas (acima do limite de 500)
       - Cobertura caiu 11.1 pontos (acima do limite de 5)
       - Descricao de uma palavra ("corrigido")

           python danger-config-routewise.py --local --mock pr-mock-falhas.json

    Dica: os arquivos pr-mock-routewise.json e pr-mock-falhas.json estao
    nesta mesma pasta. Edite-os para testar outros cenarios.

CENARIO 2 -- Rodando no GitHub com PRs reais (Danger.js via CI)
-----------------------------------------------------------------------
O repositorio https://github.com/ahirtonlopes/routewise tem Danger.js
configurado no pipeline de CI. Ao abrir ou atualizar um PR, o GitHub
Actions executa as regras automaticamente e posta um comentario no PR.

Nao e necessario instalar nada localmente alem do Git.

Passos:

    1. Faca um fork do repositorio no GitHub:
       - Acesse: https://github.com/ahirtonlopes/routewise
       - Clique em "Fork" (canto superior direito)
       - Isso cria uma copia do repo na sua conta

    2. Clone o seu fork localmente:

           git clone https://github.com/SEU_USUARIO/routewise.git
           cd routewise

    3. Para reproduzir o PR que PASSA (branch feat/ROUTEWISE-42):

           git checkout -b feat/ROUTEWISE-42-minha-feature
           # Faca qualquer pequena alteracao, por exemplo:
           echo "// comentario" >> src/api/routes/alerts.js
           git add .
           git commit -m "ROUTEWISE-42: pequena alteracao de teste"
           git push origin feat/ROUTEWISE-42-minha-feature

       Abra um Pull Request no GitHub apontando para a branch main do
       seu fork. O CI vai rodar. Sem aprovadores, o Danger vai reportar
       FALHA na regra de aprovadores para arquivos criticos.

       Para ver o PR PASSAR: adicione um colaborador ao seu repo e
       peca que ele aprove o PR. Com 2 aprovacoes e o titulo contendo
       ROUTEWISE-NNN, o Danger vai reportar todas as regras como OK.

    4. Para reproduzir o PR que FALHA (branch fix/corrige-bug-conexao):

           git checkout -b fix/corrige-bug-sem-jira
           # Altere um arquivo critico sem seguir as convencoes:
           echo "// fix rapido" >> src/integrations/gps/guard-filter.js
           git add .
           git commit -m "fix: corrige bug de conexao GPS"
           git push origin fix/corrige-bug-sem-jira

       Abra um Pull Request. O Danger vai reportar:
       - FALHA: sem referencia ao Jira no titulo
       - FALHA: arquivo critico sem aprovadores suficientes
       - AVISO: descricao muito curta

    5. Onde ver o resultado:
       - Aba "Pull requests" do seu repositorio
       - Dentro do PR, clique em "Checks" para ver os jobs de CI
       - O comentario automatico do Danger aparece no corpo do PR
       - O status verde/vermelho aparece ao lado de cada commit

CENARIO 3 -- Usando o script Python em modo CI (alternativa ao Danger.js)
--------------------------------------------------------------------------
Se quiser substituir o Danger.js por este script no seu proprio projeto:

    1. Copie danger-config-routewise.py para a raiz do seu repositorio.

    2. Adicione ao seu .github/workflows/ci.yml:

           - name: Governance Check (Python)
             run: |
               pip install requests
               python danger-config-routewise.py
             env:
               GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
               GITHUB_REPOSITORY: ${{ github.repository }}
               PR_NUMBER: ${{ github.event.pull_request.number }}

    3. Ajuste o bloco CONFIG no inicio do script para o seu projeto:
       - jira_prefix: prefixo dos seus cards (ex: "MEUPROJ")
       - critical_paths: pastas que exigem revisao adicional
       - critical_approvers: quantos revisores sao necessarios
       - large_pr_threshold: limite de linhas antes do aviso
       - coverage_drop_threshold: queda de cobertura tolerada

    4. Para cobertura de testes funcionar, gere o arquivo
       coverage/coverage-summary.json antes deste step no pipeline.
       Com Jest: npm test -- --coverage --coverageReporters=json-summary

===========================================================================
FORMATO DO ARQUIVO DE MOCK
===========================================================================

    {
      "pr": {
        "title": "ROUTEWISE-42: descricao clara da mudanca",
        "body": "Texto detalhado explicando o que muda e por que.",
        "additions": 312,
        "deletions": 47
      },
      "changed_files": [
        "src/integrations/gps/tracker-client.js",
        "src/api/routes/alerts.js"
      ],
      "reviews": [
        { "author": "priya-ti",    "state": "APPROVED" },
        { "author": "carlos-ops",  "state": "APPROVED" }
      ],
      "coverage": {
        "total": { "lines": { "pct": 81.4 } }
      },
      "base_coverage": {
        "total": { "lines": { "pct": 83.1 } }
      }
    }

Valores possiveis para "state" em reviews: APPROVED, CHANGES_REQUESTED,
COMMENTED, DISMISSED. Somente APPROVED conta como aprovacao.

===========================================================================
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# CONFIGURACAO DO PROJETO -- ajuste para o seu contexto
# ---------------------------------------------------------------------------

CONFIG = {
    # Prefixo do identificador de cards no Jira
    "jira_prefix": "ROUTEWISE",

    # Arquivos criticos que exigem pelo menos N aprovadores
    "critical_paths": [
        "src/integrations/gps",
        "src/services/notifications",
        "src/api/routes",
        "migrations/",
        ".env",
        "docker-compose",
    ],

    # Numero minimo de aprovadores para arquivos criticos
    "critical_approvers": 2,

    # Tamanho maximo de PR antes de emitir aviso (linhas)
    "large_pr_threshold": 500,

    # Queda de cobertura de testes (pontos percentuais) que gera aviso
    "coverage_drop_threshold": 5,
}

# ---------------------------------------------------------------------------
# ARGPARSE -- modo local vs modo CI
# ---------------------------------------------------------------------------

parser = argparse.ArgumentParser(description="Governance check para PRs do RouteWise.")
parser.add_argument(
    "--local",
    action="store_true",
    help="Modo local: le dados do PR de um arquivo JSON (sem GitHub API).",
)
parser.add_argument(
    "--mock",
    default="pr-mock-routewise.json",
    help="Caminho para o arquivo de mock (default: pr-mock-routewise.json).",
)
args = parser.parse_args()

# ---------------------------------------------------------------------------
# COLETA DE DADOS DO PR
# ---------------------------------------------------------------------------

if args.local:
    mock_path = Path(args.mock)
    if not mock_path.exists():
        print(f"Arquivo de mock nao encontrado: {mock_path}")
        print("Execute no mesmo diretorio dos materiais ou passe --mock <caminho>.")
        sys.exit(1)

    data         = json.loads(mock_path.read_text())
    pr_title     = data["pr"]["title"]
    pr_body      = data["pr"].get("body", "") or ""
    additions    = data["pr"].get("additions", 0)
    deletions    = data["pr"].get("deletions", 0)
    changed_files = data.get("changed_files", [])
    approvals    = sum(1 for r in data.get("reviews", []) if r.get("state") == "APPROVED")
    coverage_data     = data.get("coverage")
    base_coverage_data = data.get("base_coverage")

    print(f"[MODO LOCAL] Lendo PR: {pr_title}")
    print(f"Arquivos alterados: {len(changed_files)} | Aprovadores: {approvals} | Linhas: {additions + deletions}")
    print()

else:
    try:
        import requests
    except ImportError:
        print("Dependencia ausente: pip install requests")
        sys.exit(1)

    TOKEN     = os.environ.get("GITHUB_TOKEN", "")
    REPO      = os.environ.get("GITHUB_REPOSITORY", "")
    PR_NUMBER = os.environ.get("PR_NUMBER", "")

    if not TOKEN or not REPO or not PR_NUMBER:
        print("Erro: variaveis GITHUB_TOKEN, GITHUB_REPOSITORY e PR_NUMBER sao obrigatorias.")
        print("Para rodar localmente use: python danger-config-routewise.py --local")
        sys.exit(1)

    BASE_URL = f"https://api.github.com/repos/{REPO}"
    HEADERS  = {
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    def get(endpoint):
        r = requests.get(f"{BASE_URL}{endpoint}", headers=HEADERS)
        r.raise_for_status()
        return r.json()

    def post_comment(body):
        requests.post(
            f"{BASE_URL}/issues/{PR_NUMBER}/comments",
            headers=HEADERS,
            json={"body": body},
        )

    pr            = get(f"/pulls/{PR_NUMBER}")
    pr_files      = get(f"/pulls/{PR_NUMBER}/files")
    reviews       = get(f"/pulls/{PR_NUMBER}/reviews")
    pr_title      = pr.get("title", "")
    pr_body       = pr.get("body", "") or ""
    additions     = pr.get("additions", 0)
    deletions     = pr.get("deletions", 0)
    changed_files = [f["filename"] for f in pr_files]
    approvals     = sum(1 for r in reviews if r.get("state") == "APPROVED")
    coverage_data      = None
    base_coverage_data = None

    coverage_path = Path("coverage/coverage-summary.json")
    base_path     = Path("coverage/base-coverage.json")
    if coverage_path.exists():
        coverage_data = json.loads(coverage_path.read_text())
    if base_path.exists():
        base_coverage_data = json.loads(base_path.read_text())

# ---------------------------------------------------------------------------
# ACUMULA RESULTADOS
# ---------------------------------------------------------------------------

failures = []
warnings = []
messages = []

# ---------------------------------------------------------------------------
# REGRA 1 -- O PR deve referenciar um card do Jira
# ---------------------------------------------------------------------------

jira_pattern = re.compile(
    rf"{re.escape(CONFIG['jira_prefix'])}-\d+", re.IGNORECASE
)

if not jira_pattern.search(pr_title) and not jira_pattern.search(pr_body):
    failures.append(
        f"Card do Jira nao encontrado. O titulo ou a descricao deve conter "
        f"o identificador do card (ex: {CONFIG['jira_prefix']}-123). "
        f"Isso garante rastreabilidade entre o PR e o trabalho planejado."
    )

# ---------------------------------------------------------------------------
# REGRA 2 -- Arquivos criticos exigem pelo menos N aprovadores
# ---------------------------------------------------------------------------

critical_files = [
    f for f in changed_files
    if any(cp in f for cp in CONFIG["critical_paths"])
]

if critical_files:
    if approvals < CONFIG["critical_approvers"]:
        failures.append(
            f"Arquivo critico modificado com aprovadores insuficientes. "
            f"Este PR toca modulos de integracao ou arquivos sensiveis. "
            f"Necessario pelo menos {CONFIG['critical_approvers']} aprovadores "
            f"(atual: {approvals}). "
            f"Arquivos criticos: {', '.join(critical_files)}"
        )
    else:
        messages.append(
            f"Arquivo critico com {approvals} aprovadores -- "
            f"requisito de revisao atendido. ({', '.join(critical_files)})"
        )

# ---------------------------------------------------------------------------
# REGRA 3 -- PRs grandes recebem aviso
# ---------------------------------------------------------------------------

total_changes = additions + deletions

if total_changes > CONFIG["large_pr_threshold"]:
    warnings.append(
        f"PR grande detectado ({total_changes} linhas alteradas). "
        f"PRs acima de {CONFIG['large_pr_threshold']} linhas aumentam o risco de bugs. "
        f"Considere dividir em PRs menores ou agendar revisao dedicada."
    )

# ---------------------------------------------------------------------------
# REGRA 4 -- Cobertura de testes
# ---------------------------------------------------------------------------

if coverage_data:
    try:
        current_pct = coverage_data["total"]["lines"]["pct"]
        if base_coverage_data:
            base_pct = base_coverage_data["total"]["lines"]["pct"]
            drop     = base_pct - current_pct
            if drop > CONFIG["coverage_drop_threshold"]:
                warnings.append(
                    f"Cobertura de testes caiu {drop:.1f} pontos "
                    f"(de {base_pct:.1f}% para {current_pct:.1f}%). "
                    f"Queda acima de {CONFIG['coverage_drop_threshold']}% indica "
                    f"codigo novo sem cobertura. Adicione testes ou justifique na descricao."
                )
            else:
                messages.append(
                    f"Cobertura de testes: {current_pct:.1f}% "
                    f"(queda de {drop:.1f}p em relacao a base {base_pct:.1f}%) -- "
                    f"dentro do limite aceitavel."
                )
        else:
            messages.append(
                f"Cobertura atual: {current_pct:.1f}%. "
                f"Cobertura base nao disponivel -- comparacao nao realizada."
            )
    except KeyError:
        warnings.append(
            "Formato do arquivo de cobertura invalido. "
            "Esperado: {'total': {'lines': {'pct': valor}}}."
        )
else:
    messages.append(
        "Dados de cobertura nao encontrados. "
        "Para ativar esta regra, gere coverage-summary.json no pipeline antes deste step."
    )

# ---------------------------------------------------------------------------
# REGRA 5 -- PRs sem descricao recebem aviso
# ---------------------------------------------------------------------------

if len(pr_body.strip()) < 30:
    warnings.append(
        "Descricao do PR muito curta ou ausente. "
        "Uma boa descricao explica o que muda e por que -- nao apenas lista arquivos. "
        "Isso facilita revisao, rollback e historico do projeto."
    )

# ---------------------------------------------------------------------------
# EXIBE RESULTADO NO TERMINAL
# ---------------------------------------------------------------------------

SEP = "-" * 60

print(SEP)
print("GOVERNANCE CHECK -- RESULTADO")
print(SEP)

if failures:
    print(f"\nFALHAS ({len(failures)}) -- bloqueiam o merge:\n")
    for i, f in enumerate(failures, 1):
        print(f"  {i}. {f}")

if warnings:
    print(f"\nAVISOS ({len(warnings)}) -- nao bloqueiam:\n")
    for i, w in enumerate(warnings, 1):
        print(f"  {i}. {w}")

if messages:
    print(f"\nINFORMACAO ({len(messages)}):\n")
    for i, m in enumerate(messages, 1):
        print(f"  {i}. {m}")

print()
print(SEP)
status = "FALHOU" if failures else "OK"
print(f"Status final: {status}")
print(f"Regras verificadas: referencia Jira, aprovadores para arquivos criticos,")
print(f"tamanho do PR, cobertura de testes e qualidade da descricao.")
print(SEP)

# ---------------------------------------------------------------------------
# POSTA COMENTARIO NO PR (apenas modo CI)
# ---------------------------------------------------------------------------

if not args.local:
    lines = ["**Governance Check (Python) -- Resultado**", ""]
    if failures:
        lines.append(f"**FALHAS ({len(failures)}) -- bloqueiam o merge:**")
        for f in failures:
            lines.append(f"- FALHA: {f}")
        lines.append("")
    if warnings:
        lines.append(f"**AVISOS ({len(warnings)}) -- nao bloqueiam:**")
        for w in warnings:
            lines.append(f"- AVISO: {w}")
        lines.append("")
    if messages:
        lines.append("**Informacoes:**")
        for m in messages:
            lines.append(f"- {m}")
        lines.append("")
    lines.append(f"Status final: **{status}**")
    post_comment("\n".join(lines))

# ---------------------------------------------------------------------------
# CODIGO DE SAIDA: 1 se houver falhas (trava o merge via GitHub Actions)
# ---------------------------------------------------------------------------

if failures:
    sys.exit(1)
