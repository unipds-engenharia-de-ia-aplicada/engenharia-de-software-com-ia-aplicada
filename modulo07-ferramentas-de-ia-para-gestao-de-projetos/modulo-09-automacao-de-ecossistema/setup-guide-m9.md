# Guia de Setup - Módulo 9: NL to Workflow
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 9.2**
> Passo a passo completo para configurar a automação antes da atividade prática. Faça isso **antes** de assistir ao vídeo B.

**Tempo estimado de setup:** 30–45 minutos  
**Pré-requisitos:** conta no Slack (workspace próprio ou de teste), conta no Jira Cloud, conta no Make.com (plano gratuito)

---

## Opção A - Make.com (recomendada, sem código)

### Passo 1 - Criar um Slack App

Você precisa de um Slack App para que o Make.com possa ler mensagens do canal.

1. Acesse **api.slack.com/apps** e clique em **"Create New App"**
2. Escolha **"From scratch"**
3. Nome sugerido: `routewise-bot` (ou qualquer nome)
4. Selecione o workspace onde você vai testar
5. Clique em **"Create App"**

**Configurar permissões:**
1. No menu lateral, clique em **"OAuth & Permissions"**
2. Em **"Bot Token Scopes"**, adicione:
   - `channels:history` — lê mensagens do canal
   - `channels:read` — lista canais
   - `chat:write` — (opcional) permite o bot responder
3. Clique em **"Install to Workspace"** e autorize
4. Copie o **Bot User OAuth Token** (começa com `xoxb-`) — você vai precisar dele no Make.com

**Adicionar o bot ao canal:**
1. No Slack, abra o canal onde você vai testar (ex: `#projeto-routewise`)
2. Digite `/invite @routewise-bot` e pressione Enter

---

### Passo 2 - Criar conta e cenário no Make.com

1. Acesse **make.com** e crie uma conta gratuita
2. Clique em **"Create a new scenario"**
3. Clique no **"+"** para adicionar o primeiro módulo

**Configurar o trigger (Slack):**
1. Busque por **"Slack"** e selecione o módulo **"Watch Messages"**
2. Clique em **"Add"** para criar uma conexão
3. Cole o **Bot User OAuth Token** do Passo 1
4. Selecione o canal onde o bot foi adicionado
5. Em **"Trigger"**, escolha **"New Message Posted to Channel"**

**Configurar a ação (Jira):**
1. Clique no **"+"** após o módulo do Slack
2. Busque por **"Jira Software"** e selecione **"Create an Issue"**
3. Clique em **"Add"** para criar uma conexão Jira:
   - URL do seu Jira: `https://seu-workspace.atlassian.net`
   - Email da conta Atlassian
   - API Token: acesse **id.atlassian.com/manage-profile/security/api-tokens**, clique em **"Create API token"**, copie o token
4. Configure o card:
   - **Project:** selecione seu projeto Jira
   - **Issue Type:** `Task` (padrão)
   - **Summary:** selecione a variável `{{1.text}}` do módulo Slack (texto da mensagem)
   - **Description:** `Criado automaticamente via Slack — canal: {{1.channel}}`

**Testar:**
1. Clique em **"Run once"** no Make.com
2. Envie uma mensagem no canal do Slack
3. Verifique se o card foi criado no Jira

---

### Passo 3 - Adicionar o NL to Workflow com IA

Agora vamos inserir o processamento de linguagem natural entre o Slack e o Jira.

1. Clique no **"+"** entre o módulo Slack e o módulo Jira
2. Busque por **"HTTP"** e selecione **"Make a request"**
3. Configure a chamada para a API do Gemini (ou outra de sua preferência):

```
URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=SUA_API_KEY
Method: POST
Headers: Content-Type: application/json
Body (JSON):
{
  "contents": [{
    "parts": [{
      "text": "Analise esta mensagem de projeto e retorne um JSON com: {\"type\": \"Bug|Feature|Decision|Impediment|Status\", \"title\": \"título curto\", \"assignee\": \"nome ou null\", \"priority\": \"Low|Medium|High|Critical\", \"summary\": \"resumo de 1 linha\"}. Mensagem: {{1.text}}"
    }]
  }]
}
```

4. Obtenha sua API Key: acesse **aistudio.google.com → Get API Key**
5. Atualize o módulo Jira para usar as variáveis do response da IA:
   - **Summary:** `{{response.candidates[0].content.parts[0].text.title}}`
   - **Priority:** mapeado do campo `priority` do JSON

> **Nota:** o Make.com tem um módulo nativo para parsing de JSON - use **"JSON → Parse JSON"** entre o HTTP e o Jira para facilitar o mapeamento de variáveis.

---

### Atalho - importar o template pronto (blueprint)

Em vez de montar o cenário módulo a módulo, você pode importar o template do fluxo:

1. No Make, clique em **"Create a new scenario"**
2. No menu **"..."** (parte inferior da tela do editor), escolha **"Import Blueprint"**
3. Selecione o arquivo **`make-blueprint-m9.json`** (disponível nos materiais deste módulo)
4. Após importar, recrie as duas conexões (Slack e Jira) com as suas credenciais e substitua `SUA_API_KEY` no módulo HTTP pela sua chave do AI Studio

> Se a importação falhar na sua versão do Make, siga o passo a passo manual acima - o fluxo é idêntico (Slack -> HTTP/Gemini -> Parse JSON -> Jira).

---

## Opção B - Node.js (recomendada para devs)

Use o template disponível em `ecosystem-bot-template.js` na pasta deste módulo.

### Pré-requisitos

```bash
node --version  # requer Node.js 18+
npm install
```

### Configuração

Crie um arquivo `.env` na raiz do projeto com:

```env
SLACK_BOT_TOKEN=xoxb-...          # Bot User OAuth Token do Passo 1
SLACK_SIGNING_SECRET=...           # Em api.slack.com/apps → Basic Information
JIRA_BASE_URL=https://seu-workspace.atlassian.net
JIRA_EMAIL=seu@email.com
JIRA_API_TOKEN=...                 # Criado em id.atlassian.com
JIRA_PROJECT_KEY=PROJ              # Chave do projeto Jira (ex: ROUTE)
GEMINI_API_KEY=...                 # De aistudio.google.com
```

### Expor o servidor localmente (para desenvolvimento)

O Slack precisa de uma URL pública para enviar eventos. Use o ngrok:

```bash
npm install -g ngrok
ngrok http 3000
# Copie a URL gerada: https://abc123.ngrok.io
```

**Configurar Event Subscriptions no Slack App:**
1. Acesse **api.slack.com/apps → seu app → Event Subscriptions**
2. Ative **"Enable Events"**
3. Em **"Request URL"**, cole: `https://abc123.ngrok.io/slack/events`
4. Em **"Subscribe to bot events"**, adicione: `message.channels`
5. Clique em **"Save Changes"**

### Rodar

```bash
node ecosystem-bot-template.js
```

Envie uma mensagem no canal e verifique o terminal — deve aparecer o JSON parseado e a confirmação de criação do card no Jira.

---

---

## Jira para Slack - notificação de mudança de status (a "segunda direção")

A demo do vídeo mostra as duas direções do ecossistema: mensagem no Slack vira card no Jira (seções acima), e mudança de status no Jira vira notificação no Slack. Esta segunda direção é a mais simples de configurar - sem código e sem Make.com, usando a automação nativa do Jira.

### Passo 1 - Criar o Incoming Webhook no Slack

1. Acesse **api.slack.com/apps** e abra o seu app (o mesmo `routewise-bot` do Passo 1 da Opção A)
2. No menu lateral, clique em **"Incoming Webhooks"** e ative o toggle **"Activate Incoming Webhooks"**
3. Clique em **"Add New Webhook to Workspace"**, escolha o canal do projeto e clique em **"Allow"**
4. Copie a URL gerada (formato `https://hooks.slack.com/services/...`) - ela é o endereço de entrega das notificações

### Passo 2 - Criar a regra de automação no Jira

1. No seu projeto Jira, abra **Configurações do projeto > Automação** e clique em **"Criar fluxo"** (ou "Create rule")
2. **Acionador (WHEN):** busque **"Item transicionado"** (Issue transitioned). Para notificar só entradas em andamento, preencha "Para" com `Em andamento`; para notificar qualquer movimento, deixe os campos vazios
3. **Ação (THEN):** busque **"Enviar mensagem do Slack"** (Send Slack message)
4. Cole a **Webhook URL** do Passo 1 e monte a mensagem com as variáveis do Jira:

```
🔄 {{issue.key}} - {{issue.summary}} movido para {{issue.status.name}} por {{initiator.displayName}}
```

5. Dê um nome à regra (ex: `Notificação de transição - Slack`) e clique em **"Ativar"**

### Passo 3 - Testar

Arraste qualquer card entre colunas do board. A notificação deve aparecer no canal em poucos segundos. Se não aparecer, veja a aba **"Log de auditoria"** da tela de Automação - cada execução aparece lá com o status (sucesso, erro ou condição não atendida).

> **Atenção com o plano Free do Jira:** regras de automação têm cota mensal de execuções. Se o log mostrar execuções bloqueadas por limite (throttled), a regra volta a funcionar no ciclo seguinte - ou filtre o acionador para disparar em menos transições. Monitorar as próprias automações é parte da disciplina: automação que falha em silêncio é pior do que processo manual.

---

## Problemas comuns

| Problema | Causa provável | Solução |
|---|---|---|
| "not_in_channel" no Slack | Bot não foi adicionado ao canal | `/invite @nome-do-bot` no canal |
| 401 no Jira | API Token expirado ou email errado | Gerar novo token em id.atlassian.com |
| Make.com não recebe mensagens | Webhook não configurado | Verificar se o trigger está em "Watching" |
| JSON inválido no response da IA | Modelo retornou texto fora do JSON | Adicionar ao prompt: "Retorne APENAS o JSON, sem texto antes ou depois" |
| Notificação Jira→Slack não chega | Regra desativada ou cota do plano Free estourada | Conferir toggle da regra e o Log de auditoria da Automação |
| ngrok URL muda a cada reinício | Sessão do ngrok expirou | Usar o flag `--subdomain` no plano pago, ou configurar um domínio fixo |

---

## Não consigo configurar - o que faço na atividade?

Se o setup não funcionar no tempo disponível, **a atividade ainda é válida**:

- Documente cada passo que você tentou e o obstáculo específico encontrado
- Use o arquivo `ecosystem-bot-template.js` como referência e documente as 3 regras de NL parsing que você implementaria
- Teste o parsing de mensagens diretamente no AI Studio sem a integração Jira/Slack — cole as 5 mensagens da atividade e avalie o output do modelo

O objetivo da atividade não é ter a automação rodando em produção — é entender onde os pontos de atrito estão na configuração e como o NL to Workflow falha e acerta na prática.
---

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
