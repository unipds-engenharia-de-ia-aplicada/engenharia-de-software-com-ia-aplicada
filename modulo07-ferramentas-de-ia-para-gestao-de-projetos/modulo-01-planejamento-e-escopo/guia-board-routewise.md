# Guia do Board RouteWise no Jira
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 1.2**

> **Artefato de Demo - Módulo 1.2**
> Passo a passo para subir o backlog RouteWise no Jira e manter o board no estado certo a cada módulo do curso.

---

## Parte 1 — Criar o projeto e importar o backlog

### Antes de começar

- Crie uma conta gratuita do Jira Cloud em `atlassian.com/software/jira/free` (plano grátis suporta até 10 usuários, suficiente para o curso).
- Você precisa ter perfil de **Administrador** no site Jira: a importação de CSV exige essa permissão.
- Baixe o arquivo `routewise-jira-import.csv` desta pasta de materiais.

### Criar o projeto

1. No Jira, clique em "Projects" → "Create project".
2. Escolha o template **Scrum** — o CSV já traz Sprints e Story Points, que o board Scrum entende nativamente.
3. Dê um nome (ex: `RouteWise`) e confirme. Anote a chave do projeto gerada (ex: `RW`).

Se o template pedir tipo de projeto, escolha "Team-managed" ou "Company-managed": ambos funcionam. O Company-managed costuma ter o importador de CSV mais completo.

### Abrir o importador de CSV

1. Clique no ícone de engrenagem no canto superior direito → "System".
2. No menu lateral, em "Import and Export", clique em "External System Import".
3. Escolha "CSV" e selecione o arquivo `routewise-jira-import.csv`.

Não encontrou o menu? Em alguns projetos o caminho é: Project settings → "Import issues from CSV". O resultado é o mesmo importador.

### Configurar a importação

- **CSV delimiter:** vírgula (`,`)
- **Encoding:** UTF-8 — essencial para preservar acentos (ç, ã, é)
- **Projeto de destino:** o projeto criado acima

**Mapeamento de campos:**

| Coluna no CSV | Campo no Jira | Observação |
|---|---|---|
| Summary | Summary | Título do item |
| Issue Type | Issue Type | Epic / Story / Task |
| Priority | Priority | High / Medium / Low |
| Description | Description | Descrição completa |
| Story Points | Story Points | Habilite o campo no board (ver nota abaixo) |
| Epic Name | Epic Name | Só para linhas do tipo Epic |
| Epic Link | Epic Link | Liga a história ao épico pelo nome |
| Sprint | Sprint | Cria as sprints automaticamente |
| Labels | Labels | Etiquetas |
| Component/s | Component/s | Componente do módulo |

Se "Story Points" não aparecer no mapeamento: vá em Project settings → Features e ative "Estimation / Story points", ou adicione o campo ao tipo de issue antes de importar.

### Rodar e validar

1. Clique em "Begin Import". As ~400 linhas levam de alguns segundos a 1-2 minutos.
2. Ao terminar, o Jira mostra quantos itens foram criados. Clique no link para ver os resultados.
3. Abra o Backlog e confirme: épicos visíveis, histórias ligadas aos épicos certos via Epic Link, sprints criadas.
4. Abra um épico (ex: "Segurança e Redução de Sinistros") e verifique se as histórias filhas estão lá.

**Problemas comuns:**

- **Acentos quebrados (Ã©, Ã§):** a importação não usou UTF-8. Refaça selecionando UTF-8 no encoding.
- **Histórias sem épico:** confirme que o valor em "Epic Link" da história bate exatamente com o "Epic Name" do épico.
- **Story Points vazios:** o campo não estava habilitado — ative em Features e reimporte, ou edite os itens depois.
- **Sprints não criadas:** alguns projetos Team-managed criam as sprints só ao abrir o board pela primeira vez — abra o Backlog e elas aparecem.

---

## Parte 2 — Estado do board por módulo

Cada módulo do curso usa o board num snapshot específico. Abaixo está o estado ideal para cada aula — você pode configurar manualmente ou usar o script da Parte 3.

### Módulo 1.2 — Planejamento e Escopo com IA

**Estado:** backlog recém-importado, Sprint 1 visível mas não iniciado.

Nenhuma configuração adicional além do import. Todas as issues devem estar como "A fazer" e nenhum sprint ativo.

### Módulo 2.3 — Priorização Inteligente de Backlog

**Estado:** igual ao M1.2, backlog flat, Sprint 1 não iniciado.

O foco é usar IA para priorizar as histórias. O board serve como referência visual das USs, não precisa de status específico.

### Módulo 3.2 — Scheduling com IA

**Estado:** Sprint 1 ativo, issues de Sprint 1 em "A fazer" ou "Em andamento".

**Como iniciar o Sprint 1:**
1. No backlog, clique nos três pontos ao lado de "Sprint 1"
2. Selecione "Iniciar sprint"
3. Defina data de início e fim (sugestão: 3 semanas)

### Módulo 4.2 — Probability Forecast

**Estado:** Sprint 1 ativo, story points visíveis nas histórias do MVP.

Confirme os story points das histórias principais:

| Issue | Story Points |
|---|---|
| US-01 (Alertas de Velocidade) | 8 SP |
| US-02 (Manutenção Preditiva) | 13 SP |
| US-03 (Score de Comportamento) | 8 SP |
| US-04 (Painel de Motoristas) | 5 SP |
| US-05 (Dashboard Base) | 14 SP |

### Módulo 5.2 — AIOps de Projeto

**Estado:** Sprint 1 concluído, Sprint 2 ativo.

**Como fazer:**
1. Conclua o Sprint 1: clique em "Concluir sprint" no backlog
2. Mova issues incompletas para o backlog ou Sprint 2 quando solicitado
3. Inicie o Sprint 2

Os bugs acumulados nos sprints anteriores ilustram os riscos técnicos que serão mapeados com IA.

### Módulo 6.2 — Meeting Digest com IA

**Estado:** Sprint 2 ou 3 ativo, com pelo menos um bug "A fazer" visível.

### Módulo 7.2 — Status Reports com IA

**Estado:** Sprint 4 ativo, com status mistos conforme a tabela abaixo.

Este é o snapshot mais específico do curso. O output de status report gerado na aula descreve exatamente este estado:

| Issue | Descrição | Status |
|---|---|---|
| ROUTEWISE-201 | US-01 Alertas de Velocidade | Feito |
| ROUTEWISE-202 | US-05 Dashboard Base | Feito |
| ROUTEWISE-203 | US-02 Manutenção Preditiva | Fazendo |
| ROUTEWISE-204 | US-03 Score de Comportamento | A fazer (bloqueado) |
| ROUTEWISE-205 | US-06 Painel de Motoristas | Fazendo |
| ROUTEWISE-206 a 211 | BUG-S4-01 a 06 | Feito |
| ROUTEWISE-212 a 216 | BUG-S4-07 a 11 | A fazer |

Story points entregues no Sprint 4: **22/30** (US-01 8SP + US-05 14SP).

**Como configurar manualmente:**
1. Conclua os Sprints 1, 2 e 3 em sequência ("Concluir sprint")
2. Inicie o Sprint 4
3. Altere o status de cada issue conforme a tabela acima: clique na issue → clique no status atual → selecione o novo status

Ou use o script da Parte 3 para automatizar.

### Módulo 10.2 — OKR Aligner com IA

**Estado:** Sprint 4 ativo (mesmo snapshot do M7.2), com épicos visíveis.

Os épicos devem aparecer no backlog com seus vínculos estratégicos:
- `[EPIC] Segurança e Redução de Sinistros` → KR 1.1
- `[EPIC] Manutenção Inteligente` → KR 2.1

As histórias sem sprint (US-08, US-09, US-10) devem permanecer no backlog sem sprint atribuído — representam itens ainda não alinhados a OKRs.

---

## Parte 3 — Script para configurar via API

Se preferir automatizar a configuração do board (especialmente o snapshot do M7.2), use a API REST do Jira. Os scripts abaixo estão disponíveis em JavaScript e Python — escolha a linguagem com que se sentir mais confortável.

### Obter o API Token

1. Acesse: `https://id.atlassian.com/manage-profile/security/api-tokens`
2. Clique em "Create API token"
3. Dê um nome (ex: `routewise-curso`) e copie o token gerado

---

### JavaScript (Node.js)

**Pré-requisito:** Node.js instalado. Sem dependências externas — usa apenas o `fetch` nativo disponível no Node 18+.

#### Script base — descobrir IDs de transição

Execute este script primeiro para mapear os IDs de transição do seu projeto (variam entre instâncias do Jira):

```js
const JIRA_URL  = "https://SEU-DOMINIO.atlassian.net";
const EMAIL     = "seu-email@exemplo.com";
const API_TOKEN = "seu-token-aqui";
const PROJECT   = "RW"; // ajuste para a chave do seu projeto

const auth = Buffer.from(`${EMAIL}:${API_TOKEN}`).toString("base64");
const headers = {
  "Authorization": `Basic ${auth}`,
  "Accept": "application/json",
};

const res = await fetch(
  `${JIRA_URL}/rest/api/3/issue/${PROJECT}-201/transitions`,
  { headers }
);
const data = await res.json();

console.log("Transicoes disponiveis:");
for (const t of data.transitions) {
  console.log(`  ID ${t.id} → ${t.name}`);
}
```

Para rodar: salve como `descobrir-transicoes.mjs` e execute `node descobrir-transicoes.mjs`.

Anote os IDs retornados antes de usar o script de configuração abaixo.

#### Script de configuração — snapshot M7.2

```js
const JIRA_URL  = "https://SEU-DOMINIO.atlassian.net";
const EMAIL     = "seu-email@exemplo.com";
const API_TOKEN = "seu-token-aqui";
const PROJECT   = "RW";

const auth = Buffer.from(`${EMAIL}:${API_TOKEN}`).toString("base64");
const headers = {
  "Authorization": `Basic ${auth}`,
  "Accept": "application/json",
  "Content-Type": "application/json",
};

// Ajuste os IDs conforme o output do script anterior
const ID_FEITO   = "31"; // exemplo
const ID_FAZENDO = "21"; // exemplo

const issuesFeito   = ["201", "202", "206", "207", "208", "209", "210", "211"];
const issuesFazendo = ["203", "205"];

// A fazer (bloqueado): issue 204 — altere o status e adicione flag de bloqueio manualmente
// As issues de bug A fazer (212-216) já estão nesse status pelo import

async function transicionar(numero, transitionId) {
  const key = `${PROJECT}-${numero}`;
  const res = await fetch(
    `${JIRA_URL}/rest/api/3/issue/${key}/transitions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ transition: { id: transitionId } }),
    }
  );
  const ok = res.status === 204;
  console.log(`  ${ok ? "OK" : "ERRO"} ${key} → transicao ${transitionId}`);
  // pausa de 300ms para respeitar o rate limit da API
  await new Promise((r) => setTimeout(r, 300));
}

console.log("Configurando issues para Feito...");
for (const n of issuesFeito) await transicionar(n, ID_FEITO);

console.log("Configurando issues para Fazendo...");
for (const n of issuesFazendo) await transicionar(n, ID_FAZENDO);

console.log("Pronto. Verifique o board no Jira.");
```

Para rodar: salve como `configurar-board.mjs` e execute `node configurar-board.mjs`.

---

### Python

**Pré-requisito:**

```bash
pip install requests
```

#### Script base — descobrir IDs de transição

```python
import requests
from requests.auth import HTTPBasicAuth

JIRA_URL  = "https://SEU-DOMINIO.atlassian.net"
EMAIL     = "seu-email@exemplo.com"
API_TOKEN = "seu-token-aqui"
PROJECT   = "RW"

auth    = HTTPBasicAuth(EMAIL, API_TOKEN)
headers = {"Accept": "application/json", "Content-Type": "application/json"}

r = requests.get(
    f"{JIRA_URL}/rest/api/3/issue/{PROJECT}-201/transitions",
    auth=auth, headers=headers
)
print("Transicoes disponiveis:")
for t in r.json().get("transitions", []):
    print(f"  ID {t['id']} → {t['name']}")
```

#### Script de configuração — snapshot M7.2

```python
import requests, time
from requests.auth import HTTPBasicAuth

JIRA_URL  = "https://SEU-DOMINIO.atlassian.net"
EMAIL     = "seu-email@exemplo.com"
API_TOKEN = "seu-token-aqui"
PROJECT   = "RW"

auth    = HTTPBasicAuth(EMAIL, API_TOKEN)
headers = {"Accept": "application/json", "Content-Type": "application/json"}

ID_FEITO   = "31"   # exemplo
ID_FAZENDO = "21"   # exemplo

issues_feito   = [f"{PROJECT}-201", f"{PROJECT}-202",
                  f"{PROJECT}-206", f"{PROJECT}-207", f"{PROJECT}-208",
                  f"{PROJECT}-209", f"{PROJECT}-210", f"{PROJECT}-211"]

issues_fazendo = [f"{PROJECT}-203", f"{PROJECT}-205"]

# A fazer (bloqueado): ROUTEWISE-204 - altere o status e adicione flag de bloqueio manualmente
# As issues de bug A fazer (212-216) já estão nesse status pelo import

def transicionar(key, transition_id):
    r = requests.post(
        f"{JIRA_URL}/rest/api/3/issue/{key}/transitions",
        auth=auth, headers=headers,
        json={"transition": {"id": transition_id}}
    )
    ok = r.status_code == 204
    print(f"  {'OK' if ok else 'ERRO'} {key} → transicao {transition_id}")
    time.sleep(0.3)
    return ok

print("Configurando issues para Feito...")
for key in issues_feito:
    transicionar(key, ID_FEITO)

print("Configurando issues para Fazendo...")
for key in issues_fazendo:
    transicionar(key, ID_FAZENDO)

print("Pronto. Verifique o board no Jira.")
```

---

**Importante:** os IDs de transição (`ID_FEITO`, `ID_FAZENDO`) são específicos de cada instância do Jira. Use sempre o script de descoberta antes de rodar o de configuração.

---

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
