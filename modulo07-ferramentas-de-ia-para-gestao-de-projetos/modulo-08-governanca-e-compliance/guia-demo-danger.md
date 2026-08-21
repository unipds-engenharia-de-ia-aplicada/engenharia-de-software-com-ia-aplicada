# Guia de Demo - Governança como Código com Danger.js
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 8.2**
> Guia passo a passo para a demo de Governança como Código com Danger.js e GitHub Actions.

---

## Por que criamos o Danger

Em projetos reais, a governanca de Pull Requests depende de convencoes informais: o time combina que todo PR precisa de referencia ao Jira, que arquivos criticos exigem dois revisores, que PRs grandes devem ser divididos. Esse tipo de acordo funciona enquanto o time e pequeno e a pressao e baixa.

Quando o ritmo aumenta, as convencoes escorregam. Um PR entra sem referencia ao card. Um arquivo de integracao e aprovado por um unico revisor junior. Ninguem percebe na hora. O problema aparece depois, em producao ou em auditoria.

O Danger resolve isso transformando as convencoes do time em codigo executavel. A cada Pull Request, o pipeline de CI roda o `dangerfile.js` (ou o equivalente Python) e verifica automaticamente se as regras estao sendo seguidas. O resultado aparece como comentario no proprio PR, antes de qualquer merge.

O Danger nao substitui o julgamento humano. Ele libera o revisor de checar o burocrático para que possa focar no que importa: a logica, a arquitetura, os riscos de negocio.

---

## O que esta na pasta de demos

| Arquivo | O que e |
|---|---|
| `danger-config-template.js` | Template Danger.js comentado, pronto para adaptar ao seu projeto |
| `danger-config-routewise.py` | Equivalente Python, com modo local para demo sem CI |
| `pr-mock-routewise.json` | Mock de PR que passa em todas as regras |
| `pr-mock-falhas.json` | Mock de PR que falha em quatro regras |
| `guia-demo-danger.md` | Este arquivo |

O repositorio de referencia com o pipeline completo esta em:
https://github.com/unipds-engenharia-de-ia-aplicada/routewise-danger-demo

---

## As duas versoes: JS e Python

**Danger.js** e a ferramenta original. Roda dentro do GitHub Actions, le o `dangerfile.js`, posta o comentario no PR e define o commit status (o icone verde ou vermelho que aparece ao lado do commit). Exige Node.js no pipeline e um `GITHUB_TOKEN` com permissoes adequadas.

**danger-config-routewise.py** e o equivalente em Python produzido para esta disciplina. Implementa as mesmas cinco regras usando a API REST do GitHub. Tem duas vantagens em relacao ao JS para fins de aprendizado:

- Roda localmente sem nenhuma dependencia de CI ou token (`--local`)
- O codigo e mais legivel para quem nao conhece o ecossistema Node

Em producao, as duas versoes sao equivalentes. Voce escolhe qual usar no seu projeto.

---

## Cenario 1: demo local, PR que passa

Simula um PR bem configurado. Nenhuma regra e violada.

**O que o mock representa:**

- Titulo: `ROUTEWISE-42: modulo de alertas de velocidade - integracao GPS em producao`
- Dois aprovadores: Priya (TI/Infra) e Carlos Mendonca (Operacoes)
- 359 linhas alteradas (abaixo do limite de 500)
- Cobertura caiu 1.7 pontos percentuais (abaixo do limite de 5)
- Descricao completa explicando o contexto e os testes realizados

**Como executar:**

```bash
# No terminal, dentro desta pasta:
python danger-config-routewise.py --local
```

**O que voce vai ver no terminal:**

```
[MODO LOCAL] Lendo PR: ROUTEWISE-42: modulo de alertas de velocidade...
Arquivos alterados: 7 | Aprovadores: 2 | Linhas: 359

------------------------------------------------------------
GOVERNANCE CHECK -- RESULTADO
------------------------------------------------------------

INFORMACAO (3):

  1. Arquivo critico com 2 aprovadores -- requisito de revisao atendido.
  2. Cobertura de testes: 81.4% (queda de 1.7p em relacao a base 83.1%) -- dentro do limite aceitavel.
  3. Dados de cobertura encontrados e validados.

------------------------------------------------------------
Status final: OK
------------------------------------------------------------
```

---

## Cenario 2: demo local, PR que falha

Simula um PR mal configurado. Quatro problemas sao detectados.

**O que o mock representa:**

- Titulo: `fix: corrige bug de conexao GPS` (sem referencia ao Jira)
- Descricao: `corrigido` (uma palavra, menos de 30 caracteres)
- Um unico aprovador para arquivos criticos (precisa de dois)
- 635 linhas alteradas (acima do limite de 500)
- Cobertura caiu 11.1 pontos percentuais (acima do limite de 5)

**Como executar:**

```bash
python danger-config-routewise.py --local --mock pr-mock-falhas.json
```

**O que voce vai ver no terminal:**

```
[MODO LOCAL] Lendo PR: fix: corrige bug de conexao GPS
Arquivos alterados: 3 | Aprovadores: 1 | Linhas: 635

------------------------------------------------------------
GOVERNANCE CHECK -- RESULTADO
------------------------------------------------------------

FALHAS (2) -- bloqueiam o merge:

  1. Card do Jira nao encontrado. O titulo ou a descricao deve conter
     o identificador do card (ex: ROUTEWISE-123).
  2. Arquivo critico modificado com aprovadores insuficientes.
     Necessario pelo menos 2 aprovadores (atual: 1).
     Arquivos criticos: src/integrations/gps/tracker-client.js, ...

AVISOS (2) -- nao bloqueiam:

  1. PR grande detectado (635 linhas alteradas). PRs acima de 500 linhas
     aumentam o risco de bugs. Considere dividir em PRs menores.
  2. Cobertura de testes caiu 11.1 pontos (de 83.1% para 72.0%).
     Queda acima de 5% indica codigo novo sem cobertura.

------------------------------------------------------------
Status final: FALHOU
------------------------------------------------------------
```

O script sai com codigo 1. Em um pipeline de CI, isso encerra o job com erro e bloqueia o merge.

---

## Cenario 3: PRs reais no GitHub com Danger.js

Para ver o Danger rodando em producao, com comentario automatico e status no commit, voce precisa de um repositorio no GitHub com o pipeline configurado.

### Usando o repositorio de referencia da disciplina

**Passo 1: faca um fork**

- Acesse https://github.com/unipds-engenharia-de-ia-aplicada/routewise-danger-demo
- Clique em "Fork" (canto superior direito)
- Escolha sua conta como destino
- O GitHub cria uma copia completa do repositorio, incluindo o pipeline

**Passo 2: clone o fork**

```bash
git clone https://github.com/SEU_USUARIO/routewise.git
cd routewise
npm install
```

**Passo 3: abra um PR que vai falhar (cenario mais pedagogico)**

Crie uma branch sem seguir as convencoes:

```bash
git checkout -b fix/sem-jira
echo "// alteracao de teste" >> src/integrations/gps/guard-filter.js
git add .
git commit -m "fix: corrige comportamento do guard"
git push origin fix/sem-jira
```

Abra um Pull Request no GitHub apontando de `fix/sem-jira` para `main`. Em menos de dois minutos, o Danger vai postar um comentario no PR com as falhas detectadas.

**Passo 4: abra um PR que vai passar**

```bash
git checkout main
git checkout -b feat/ROUTEWISE-99-minha-feature
echo "// feature documentada" >> src/api/routes/alerts.js
git add .
git commit -m "ROUTEWISE-99: adiciona documentacao ao endpoint de alertas"
git push origin feat/ROUTEWISE-99-minha-feature
```

Abra um Pull Request. O Danger vai reportar FALHA na regra de aprovadores (zero aprovadores para arquivo critico). Para ver o PR passar completamente, convide um colaborador e peca duas aprovacoes.

**Onde ver o resultado:**

- Aba "Pull requests" do repositorio, dentro do PR aberto
- O comentario do Danger aparece no corpo do PR
- O status verde ou vermelho aparece na secao "Checks" e ao lado de cada commit

### Adicionando o pipeline ao seu proprio projeto

Copie os arquivos abaixo para o seu repositorio:

```
dangerfile.js                              <- regras de governanca
.github/workflows/ci.yml                   <- avalia o PR (roda codigo do PR/fork)
.github/workflows/post-danger-comment.yml  <- posta o comentario e o status
```

Ajuste o `dangerfile.js` para as convencoes do seu time: prefixo do Jira, caminhos criticos, numero de aprovadores, limites de tamanho.

**Por que dois workflows, e nao um so:** um PR de fork (exatamente o fluxo do Passo 1 acima) roda com um `GITHUB_TOKEN` que o proprio GitHub forca a ser somente-leitura, nao importa o que o `permissions:` do workflow declare. Se um unico job, disparado por `pull_request`, tentasse rodar o Danger e postar o comentario, a postagem falharia com `403` em qualquer PR vindo de um fork -- exatamente o cenario que este guia pede para o aluno reproduzir.

A solucao (o mesmo padrao que a documentacao do GitHub recomenda para evitar "pwn requests"):

- `ci.yml`, disparado por `pull_request`, roda `npx danger ci --text-only`. Essa flag faz o Danger avaliar as regras e imprimir o resultado, mas nunca postar nada. O resultado e publicado como artefato do workflow. Esse job so precisa de permissao de leitura.
- `post-danger-comment.yml`, disparado por `workflow_run` (quando o `ci.yml` termina), baixa esse artefato e posta o comentario + define o commit status. Como `workflow_run` sempre executa a versao do arquivo que esta na branch padrao do repositorio -- nunca a versao trazida pelo fork -- e nunca faz checkout do codigo do PR, ele pode receber `pull-requests: write` com seguranca:

```yaml
# post-danger-comment.yml
permissions:
  pull-requests: write
  statuses: write
```

Um cuidado ao implementar: leia o conteudo do artefato dentro do script (por exemplo, com `fs.readFileSync` no `actions/github-script`), nunca interpolando o texto do artefato diretamente numa expressao `${{ }}` do workflow. Interpolar conteudo que veio de um PR nao confiavel numa expressao de workflow reabre a mesma vulnerabilidade que esse desenho existe para fechar.

---

## Criando seus proprios mocks

Para testar regras diferentes sem abrir um PR real, edite o arquivo JSON ou crie um novo:

```json
{
  "pr": {
    "title": "ROUTEWISE-99: titulo claro com referencia ao card",
    "body": "Descricao explicando o que muda e por que.",
    "additions": 80,
    "deletions": 20
  },
  "changed_files": [
    "src/api/routes/alerts.js",
    "tests/api/alerts.test.js"
  ],
  "reviews": [
    { "author": "revisor-1", "state": "APPROVED" },
    { "author": "revisor-2", "state": "APPROVED" }
  ],
  "coverage": {
    "total": { "lines": { "pct": 85.0 } }
  },
  "base_coverage": {
    "total": { "lines": { "pct": 84.0 } }
  }
}
```

Valores possiveis para `state` em `reviews`: `APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`, `DISMISSED`. Apenas `APPROVED` conta como aprovacao nas regras.

Execute com:

```bash
python danger-config-routewise.py --local --mock nome-do-seu-mock.json
```

---

## Resumo das regras implementadas

| Regra | Tipo | Criterio |
|---|---|---|
| Referencia ao card do Jira | Falha | Titulo ou descricao deve conter `ROUTEWISE-NNN` |
| Aprovadores para arquivos criticos | Falha | `src/integrations/gps`, `src/api/routes` e outros exigem 2 aprovadores |
| Tamanho do PR | Aviso | Acima de 500 linhas gera recomendacao de divisao |
| Cobertura de testes | Aviso | Queda acima de 5 pontos percentuais gera aviso |
| Descricao do PR | Aviso | Menos de 30 caracteres gera aviso |

Falhas bloqueiam o merge via GitHub branch protection rules.
Avisos aparecem no comentario mas nao bloqueiam.

---

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
