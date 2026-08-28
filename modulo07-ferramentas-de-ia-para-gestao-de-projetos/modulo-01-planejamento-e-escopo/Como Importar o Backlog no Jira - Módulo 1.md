# Como Importar o Backlog no Jira

Módulo 1 - RouteWise · Arquivo: `routewise-jira-import.csv`

*Guia rápido para subir o backlog completo (épicos, histórias, sprints e story points) num Jira gratuito em poucos minutos.*

Atualizado em 28/08/2026 com os problemas reais relatados pela turma. O que o CSV contém: **68 itens** (2 épicos, 16 histórias, 19 tasks e 31 bugs). O arquivo tem 443 linhas porque as descrições têm quebras de linha; o número que importa na validação é 68.

---

## Antes de começar

- Crie uma conta gratuita do Jira Cloud em atlassian.com/software/jira/free (plano grátis: até 10 usuários, suficiente para o curso).
- Você precisa ter perfil de **Administrador** no site Jira. A importação completa exige admin: o importador disponível pra quem não é admin tem limite de 250 itens e não liga histórias a épicos.
- Baixe o arquivo `routewise-jira-import.csv` desta pasta de materiais.
- Dica de idioma: a tabela de mapeamento abaixo traz os nomes dos campos em inglês e em português. Se preferir, mude temporariamente o idioma do seu perfil pra English (foto do perfil > Configurações > Idioma) pra tela bater com os nomes clássicos.

---

## Parte 1 - Criar o projeto

1. No Jira, crie um projeto novo. Atenção: a Atlassian vem renomeando "Projects" pra "Spaces" (Espaços) na interface; dependendo da sua conta, o botão é "Create project" ou "Create space". É a mesma coisa.
2. Escolha o template **Scrum**: o CSV traz Sprints e Story Points, que o Scrum board já entende.
3. Dê um nome (ex: RouteWise) e confirme. Anote a chave do projeto gerada (ex: RW).
4. Se pedir o tipo de projeto, prefira **Company-managed** (gerenciado pela empresa): é o que tem o importador mais completo e consegue criar tipos de item durante a importação.
5. **Passo que evita o erro mais comum da turma**: o CSV tem 31 bugs. Confirme que o projeto tem o tipo de item "Bug" antes de importar (em team-managed, crie em Configurações do projeto > Tipos de item). E nunca mapeie Bug como "Subtask": subtarefa exige um item pai, e os 31 bugs vão falhar em bloco.

---

## Parte 2 - Abrir o importador de CSV

**Caminho direto (o mais confiável, funciona mesmo com a interface nova)**: cole no navegador

```
https://SEU-SITE.atlassian.net/secure/admin/ExternalImport1.jspa
```

trocando `SEU-SITE` pelo endereço do seu Jira. Esse link abre o importador clássico ("External System Import"), que é o que este guia descreve.

Pelo menu: ícone de engrenagem (⚙) > System > Import and Export > **External System Import** > CSV. Se a sua conta mostrar a experiência nova de importação (um hub com Asana, Trello, monday etc.), procure o link **"switch to the old experience"** pra chegar no importador clássico.

Selecione o arquivo `routewise-jira-import.csv`. Em "Use an existing configuration file", deixe em branco na primeira vez.

---

## Parte 3 - Configurar a importação

- Delimitador (CSV delimiter): vírgula (,).
- Encoding do arquivo: **UTF-8**, essencial para preservar acentos (ç, ã, é). Nas versões novas da tela já vem como padrão, em "Advanced settings"; só confirme.
- Selecione o projeto de destino que você criou na Parte 1.

Mapeamento de campos (Map fields). A coluna do meio vale pra Jira em inglês, a da direita pra Jira em português:

| Coluna no CSV | Jira em inglês | Jira em português | Observação |
|---------------|----------------|-------------------|------------|
| Summary | Summary | Resumo | Obrigatório |
| Issue Type | Issue Type | Tipo de item | Epic / Story / Task / Bug |
| Priority | Priority | Prioridade | High / Medium / Low |
| Description | Description | Descrição | Descrição completa |
| Story Points | Story Points | Story Points | Em projeto team-managed o campo se chama "Story point estimate" (Estimativa de story points) |
| Epic Name | Epic Name | Nome do épico | Só para as 2 linhas do tipo Epic |
| Epic Link | Epic Link | Link do épico | Liga a história ao épico; ver a seção de erros se não aparecer |
| Sprint | Sprint | Sprint | Ver a seção de erros: pode não criar as sprints |
| Labels | Labels | Etiquetas | Ver a seção de erros; não é "Categorias" |
| Component/s | Component/s | Componentes | Componente / módulo |

---

## Parte 4 - Rodar e validar

1. Clique em "Begin Import". A importação leva de alguns segundos a 1-2 minutos.
2. Ao terminar, o Jira mostra quantos itens foram criados. **O número certo é 68.** Se vier ~35, veja o item 1 da seção de erros.
3. Abra o Backlog do projeto e confirme: os 2 épicos aparecem, as histórias estão ligadas aos épicos certos, e as sprints foram criadas (se o seu importador as criou; ver seção de erros).
4. Abra um épico (ex: "Segurança e Redução de Sinistros") e verifique se as histórias filhas estão lá.

---

## Erros de importação e mapeamento que já aconteceram na turma

1. **"Importou com muitos erros e só vejo ~35 itens"**: sintoma clássico do tipo Bug mapeado errado. 35 = as 16 histórias + 19 tasks; os 31 bugs (rejeitados, por exemplo se mapeados como Subtask) e os 2 épicos ficaram de fora. Volte na Parte 1, passo 5, garanta o tipo Bug no projeto e repita a importação num projeto limpo.
2. **"Não acho Labels, Rótulos nem Etiquetas no mapeamento"**: em português o campo do Jira costuma aparecer como "Etiquetas". "Categorias" não é o campo certo. Se nem "Etiquetas" nem "Labels" aparecerem na lista, deixe essa coluna sem mapear: as etiquetas são um extra, nada no curso depende delas.
3. **"Story Points não aparece"**: em company-managed, ative Estimation em Configurações do projeto > Features; em team-managed, procure "Story point estimate".
4. **"Sprints não foram criadas"**: versões atuais do importador esperam o ID numérico da sprint e ignoram o nome silenciosamente. Se as sprints não vierem: crie "Sprint 1" a "Sprint 5" no Backlog e arraste os itens conforme a coluna Sprint do CSV, ou siga sem sprints por enquanto. Pro Módulo 1, o que importa é o backlog com épicos e histórias.
5. **"Histórias sem épico"**: a Atlassian descontinuou o campo Epic Link em favor de "Parent" (Item principal). Se o seu mapeamento não oferecer "Epic Link"/"Link do épico", importe sem esse campo e depois arraste as histórias pros 2 épicos direto no Backlog (são só 2 épicos, é rápido).
6. **Acentos quebrados (Ã©, Ã§)**: a importação não usou UTF-8. Refaça selecionando UTF-8 no encoding.
7. **"A tela de importação está totalmente diferente do guia"**: você caiu na experiência nova de importação. Use o link direto da Parte 2 pra voltar ao importador clássico.

---

Pronto: com o backlog importado, você consegue navegar pelos épicos, abrir as histórias e ver o planejamento da RouteWise exatamente como mostrado na demo do Módulo 1, sem precisar criar cada item à mão. Se travar em algo que não está aqui, reporte no canal da turma: este guia é atualizado com os casos reais.
