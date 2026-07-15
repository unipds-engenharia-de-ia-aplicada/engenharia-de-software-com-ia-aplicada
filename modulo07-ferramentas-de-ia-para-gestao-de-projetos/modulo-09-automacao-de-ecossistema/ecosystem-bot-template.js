// ecosystem-bot-template.js - NL to Workflow: Integração Slack → Jira via IA
//
// Artefato de Demo - Unidade 9
// Template de integração que converte mensagens em linguagem natural em cards do Jira,
// com parser baseado em Claude e notificações de sincronização via Slack.
//
// ─────────────────────────────────────────────────────────────────────────────
// NOTA DE DEMO (U9.2):
// A demo em vídeo usa o AI Studio para demonstrar o parser NL diretamente -
// sem precisar de infraestrutura configurada. Este arquivo é o artefato técnico
// que os alunos podem usar para implementar o fluxo completo em seus projetos.
// ─────────────────────────────────────────────────────────────────────────────
//
// REQUISITOS:
//   npm install @slack/bolt @anthropic-ai/sdk axios dotenv
//
// VARIÁVEIS DE AMBIENTE (.env):
//   SLACK_BOT_TOKEN=xoxb-...
//   SLACK_APP_TOKEN=xapp-...
//   ANTHROPIC_API_KEY=sk-ant-...
//   JIRA_BASE_URL=https://seu-workspace.atlassian.net
//   JIRA_EMAIL=seu@email.com
//   JIRA_API_TOKEN=...
//   JIRA_PROJECT_KEY=ROUTEWISE
//
// ALTERNATIVA SEM INFRAESTRUTURA:
//   Use o NL_PARSER_PROMPT abaixo diretamente no AI Studio (claude.ai)
//   para demonstrar o parsing sem configurar o bot completo.

require("dotenv").config();
const { App } = require("@slack/bolt");
const Anthropic = require("@anthropic-ai/sdk");
const axios = require("axios");

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  // Palavra-chave que ativa o parser quando mencionada na mensagem
  // Exemplo: "card: Investigar alertas em Uberlândia" ou "@bot card ..."
  triggerKeyword: "card:",

  // Canal de destino para notificações de sincronização de status do Jira
  notificationChannel: "#routewise",

  // Membros do time e seus userIDs do Jira (para resolução de assignee)
  // Mapeie os nomes usados no Slack para os accountIds do Jira
  teamMembers: {
    carlos: "accountId-carlos",
    priya: "accountId-priya",
    marcus: "accountId-marcus",
  },

  // Componentes válidos do projeto (para inferência de componente pelo parser)
  projectComponents: [
    "alertas-velocidade",
    "score-comportamento",
    "manutencao-preditiva",
    "dashboard",
    "integracao-gps",
    "notificacoes",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// NL PARSER PROMPT
// Use este prompt diretamente no AI Studio para a demo da U9.2
// ─────────────────────────────────────────────────────────────────────────────

const NL_PARSER_PROMPT = `
Você é um parser de linguagem natural para criação de cards no Jira. Sua função é extrair informações estruturadas de mensagens de texto em linguagem natural - como mensagens de Slack, e-mails ou anotações rápidas - e retornar um objeto JSON pronto para criação de card.

## CONTEXTO DO PROJETO
- Projeto: ${process.env.JIRA_PROJECT_KEY || "ROUTEWISE"} - Sistema de Gestão de Frota
- Componentes disponíveis: alertas-velocidade, score-comportamento, manutencao-preditiva, dashboard, integracao-gps, notificacoes
- Membros do time: Carlos (Diretor de Operações), Priya (TI/Infra), Marcus (Consultor)

## MENSAGEM PARA PROCESSAR

[COLE A MENSAGEM AQUI]

## ANÁLISE SOLICITADA

Extraia as seguintes informações da mensagem e retorne um JSON:

{
  "type": "bug | task | story | spike",
  "title": "título claro e específico - máximo 80 caracteres",
  "priority": "highest | high | medium | low",
  "component": "componente identificado ou null",
  "assignee": "nome do responsável mencionado explicitamente ou null se não mencionado",
  "requestedBy": "quem solicitou, se diferente do assignee, ou null",
  "dueDate": "data extraída ou descrição textual (ex: 'fim do mês corrente') ou null",
  "region": "região ou localização mencionada, se relevante, ou null",
  "reason": "motivação ou contexto de negócio explicitado na mensagem, ou null",
  "description": "descrição expandida para o campo de descrição do card - inclua contexto e pontos de investigação prováveis",
  "actionRequired": "mensagem de alerta se houver informação crítica ausente (ex: assignee não definido, prazo ambíguo), ou null",
  "confidence": "high | medium | low - seu grau de confiança na extração"
}

## RESTRIÇÕES DE COMPORTAMENTO

- Nunca invente assignee - se não foi explicitamente mencionado, retorne null e adicione uma mensagem em actionRequired indicando que o responsável precisa ser definido
- Se a mensagem menciona múltiplas pessoas, identifique quem faz o quê - não atribua a quem estava falando, mas a quem se comprometeu
- Datas implícitas ("urgente", "antes da próxima reunião", "esta semana") devem ser descritas em palavras, não convertidas para datas fixas - você não sabe qual é a data atual
- Para mensagens com solicitação de voluntário ("alguém pode pegar isso?"), sinalize em actionRequired que o assignee precisa ser confirmado antes de mover o card para In Progress
- Se a mensagem não é acionável (ex: "precisamos pensar sobre isso"), retorne type: "spike" e adicione em actionRequired: "Mensagem é uma intenção, não uma ação - refine antes de criar o card"
- O campo confidence deve refletir sua certeza real - se a mensagem é ambígua, declare low
`;

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE ANTHROPIC
// ─────────────────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function parseNaturalLanguage(message) {
  const prompt = NL_PARSER_PROMPT.replace("[COLE A MENSAGEM AQUI]", message);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text;

  // Extrai o JSON da resposta (o modelo pode adicionar texto explicativo ao redor)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Parser não retornou JSON válido");
  }

  return JSON.parse(jsonMatch[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE JIRA
// ─────────────────────────────────────────────────────────────────────────────

const jiraClient = axios.create({
  baseURL: process.env.JIRA_BASE_URL,
  auth: {
    username: process.env.JIRA_EMAIL,
    password: process.env.JIRA_API_TOKEN,
  },
  headers: { "Content-Type": "application/json" },
});

function mapPriorityToJira(priority) {
  const map = { highest: "Highest", high: "High", medium: "Medium", low: "Low" };
  return map[priority] || "Medium";
}

function resolveAssigneeId(name) {
  if (!name) return null;
  const normalized = name.toLowerCase().trim();
  return CONFIG.teamMembers[normalized] || null;
}

async function createJiraCard(parsed, originalMessage, slackUser) {
  const assigneeId = resolveAssigneeId(parsed.assignee);
  const hasUnresolvedAssignee = parsed.assignee && !assigneeId;

  // Constrói a descrição com contexto completo
  let description = parsed.description || "";

  if (parsed.reason) {
    description += `\n\n**Motivação:** ${parsed.reason}`;
  }

  if (parsed.actionRequired) {
    description += `\n\n⚠️ **Ação necessária:** ${parsed.actionRequired}`;
  }

  if (hasUnresolvedAssignee) {
    description += `\n\n⚠️ **Assignee não resolvido:** "${parsed.assignee}" mencionado na mensagem mas não encontrado no mapeamento do time. Defina manualmente.`;
  }

  description += `\n\n---\n_Card criado automaticamente via NL to Workflow a partir de mensagem de ${slackUser}._\n_Mensagem original: "${originalMessage}"_`;

  const payload = {
    fields: {
      project: { key: process.env.JIRA_PROJECT_KEY || "ROUTEWISE" },
      summary: parsed.title,
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: description }],
          },
        ],
      },
      issuetype: {
        name:
          parsed.type === "bug"
            ? "Bug"
            : parsed.type === "spike"
            ? "Task"
            : "Story",
      },
      priority: { name: mapPriorityToJira(parsed.priority) },
      ...(assigneeId && { assignee: { accountId: assigneeId } }),
    },
  };

  const response = await jiraClient.post("/rest/api/3/issue", payload);
  return {
    key: response.data.key,
    url: `${process.env.JIRA_BASE_URL}/browse/${response.data.key}`,
    assigneeResolved: !!assigneeId,
    actionRequired: parsed.actionRequired,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BOT SLACK
// ─────────────────────────────────────────────────────────────────────────────

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// Escuta mensagens com a palavra-chave trigger
app.message(CONFIG.triggerKeyword, async ({ message, say }) => {
  const userMessage = message.text.replace(CONFIG.triggerKeyword, "").trim();
  const slackUser = message.user;

  try {
    await say(`⏳ Processando: _"${userMessage}"_`);

    // 1. Parse via Claude
    const parsed = await parseNaturalLanguage(userMessage);

    // 2. Etapa de confirmação antes de criar o card
    const confirmText = buildConfirmationMessage(parsed);
    await say(confirmText);

    // Nota: em produção, aguardar confirmação via interação do usuário antes do passo 3.
    // Para a demo, o card é criado diretamente para demonstrar o fluxo completo.

    // 3. Criar card no Jira
    const card = await createJiraCard(parsed, userMessage, slackUser);

    // 4. Confirmar criação
    let response =
      `✅ Card criado: *<${card.url}|${card.key}>*\n` +
      `*${parsed.title}*\n` +
      `Prioridade: ${parsed.priority} | Tipo: ${parsed.type}`;

    if (!card.assigneeResolved) {
      response +=
        "\n\n⚠️ *Assignee não atribuído* - defina o responsável no Jira antes de mover para In Progress.";
    }

    if (card.actionRequired) {
      response += `\n\n💬 *Ação necessária:* ${card.actionRequired}`;
    }

    await say(response);
  } catch (error) {
    console.error("Erro no NL to Workflow:", error);
    await say(
      `❌ Não foi possível processar a mensagem. Erro: ${error.message}\n` +
        `Crie o card manualmente ou tente reformular a mensagem.`
    );
  }
});

function buildConfirmationMessage(parsed) {
  return (
    `📋 *Card identificado - confirme antes de criar:*\n\n` +
    `*Tipo:* ${parsed.type}\n` +
    `*Título:* ${parsed.title}\n` +
    `*Prioridade:* ${parsed.priority}\n` +
    `*Responsável:* ${parsed.assignee || "[A DEFINIR]"}\n` +
    `*Prazo:* ${parsed.dueDate || "[A DEFINIR]"}\n` +
    `*Componente:* ${parsed.component || "não identificado"}\n` +
    (parsed.actionRequired
      ? `\n⚠️ *Atenção:* ${parsed.actionRequired}\n`
      : "") +
    `\n_Confiança do parser: ${parsed.confidence}_`
  );
}

// Notificação de mudança de status no Jira → Slack
// Esta função é chamada via webhook do Jira (configure em: Project Settings → Automation → Webhook)
async function handleJiraWebhook(event) {
  if (event.webhookEvent !== "jira:issue_updated") return;

  const issue = event.issue;
  const changelog = event.changelog;
  const statusChange = changelog?.items?.find((i) => i.field === "status");

  if (!statusChange) return;

  const message =
    `🔄 *${issue.key}* - ${issue.fields.summary}\n` +
    `Status: *${statusChange.fromString}* → *${statusChange.toString}*\n` +
    `<${process.env.JIRA_BASE_URL}/browse/${issue.key}|Abrir card>`;

  // Envia notificação para o canal de projeto
  await app.client.chat.postMessage({
    token: process.env.SLACK_BOT_TOKEN,
    channel: CONFIG.notificationChannel,
    text: message,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  await app.start();
  console.log(
    "⚡ NL to Workflow bot ativo - aguardando mensagens com trigger:",
    CONFIG.triggerKeyword
  );
  console.log("Canal de notificações:", CONFIG.notificationChannel);
  console.log("Projeto Jira:", process.env.JIRA_PROJECT_KEY || "ROUTEWISE");
})();

// Exporta para uso em testes ou como webhook handler
module.exports = { parseNaturalLanguage, createJiraCard, handleJiraWebhook, NL_PARSER_PROMPT };
