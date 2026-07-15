// danger-config-template.js -- Governança como Codigo
//
// Artefato de Demo -- Unidade 8
// Template de script Danger.js para verificacao automatica de conformidade em PRs.
//
// Requisitos:
//   npm install -g danger
//   Configurar GITHUB_TOKEN no ambiente de CI (ver workflow abaixo)
//
// Ativar no GitHub Actions: adicione ao seu .github/workflows/ci.yml
//
//   - name: Danger JS
//     uses: danger/danger-js@11.3.1
//     env:
//       GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
//
// Referencia: https://danger.systems/js/

// ---------------------------------------------------------------------------
// CONFIGURACAO DO PROJETO -- ajuste para o seu contexto
// ---------------------------------------------------------------------------

const CONFIG = {
  // Prefixo do identificador de cards no Jira
  // Exemplos: "ROUTEWISE", "PROJ", "ENG"
  jiraPrefix: "ROUTEWISE",

  // Arquivos criticos que exigem pelo menos dois aprovadores
  // Use strings de correspondencia parcial de caminho
  criticalPaths: [
    "src/integrations/gps",
    "src/services/notifications",
    "src/api/routes",
    "migrations/",
    ".env",
    "docker-compose",
  ],

  // Numero minimo de aprovadores para arquivos criticos
  criticalApprovers: 2,

  // Tamanho maximo de PR antes de emitir aviso de revisao cuidadosa (linhas)
  largePRThreshold: 500,

  // Queda de cobertura de testes (em pontos percentuais) que gera aviso
  coverageDropThreshold: 5,
};

// ---------------------------------------------------------------------------
// REGRA 1 -- O PR deve referenciar um card do Jira no titulo ou na descricao
// ---------------------------------------------------------------------------

const jiraPattern = new RegExp(`${CONFIG.jiraPrefix}-\\d+`, "i");
const titleHasJira = jiraPattern.test(danger.github.pr.title);
const bodyHasJira  = jiraPattern.test(danger.github.pr.body || "");

if (!titleHasJira && !bodyHasJira) {
  fail(
    `Card do Jira nao encontrado. O titulo ou a descricao do PR deve conter ` +
    `o identificador do card (ex: \`${CONFIG.jiraPrefix}-123\`). ` +
    `Isso garante rastreabilidade entre o PR e o trabalho planejado.`
  );
}

// ---------------------------------------------------------------------------
// REGRA 2 -- Arquivos criticos exigem pelo menos N aprovadores
// ---------------------------------------------------------------------------

const changedFiles = [
  ...danger.git.created_files,
  ...danger.git.modified_files,
];

const touchesCriticalPath = changedFiles.some((file) =>
  CONFIG.criticalPaths.some((cp) => file.includes(cp))
);

if (touchesCriticalPath) {
  const approvals = danger.github.reviews.filter(
    (r) => r.state === "APPROVED"
  ).length;

  const criticalFilesFound = changedFiles
    .filter((f) => CONFIG.criticalPaths.some((cp) => f.includes(cp)))
    .join(", ");

  if (approvals < CONFIG.criticalApprovers) {
    fail(
      `Arquivo critico modificado com aprovadores insuficientes. ` +
      `Este PR toca modulos de integracao ou arquivos sensiveis. ` +
      `Necessario pelo menos ${CONFIG.criticalApprovers} aprovadores ` +
      `(atual: ${approvals}). ` +
      `Arquivos criticos detectados: ${criticalFilesFound}`
    );
  } else {
    message(
      `Arquivo critico com ${approvals} aprovadores -- requisito de revisao atendido.`
    );
  }
}

// ---------------------------------------------------------------------------
// REGRA 3 -- PRs grandes recebem aviso de revisao cuidadosa
// ---------------------------------------------------------------------------

const totalChanges = danger.github.pr.additions + danger.github.pr.deletions;

if (totalChanges > CONFIG.largePRThreshold) {
  warn(
    `PR grande detectado (${totalChanges} linhas alteradas). ` +
    `PRs acima de ${CONFIG.largePRThreshold} linhas aumentam o risco de bugs passarem despercebidos. ` +
    `Considere dividir em PRs menores ou agendar uma sessao de revisao dedicada.`
  );
}

// ---------------------------------------------------------------------------
// REGRA 4 -- Cobertura de testes nao deve cair mais que o threshold
//
// Esta regra requer que o CI gere coverage/coverage-summary.json
// (Jest com --coverage --coverageReporters=json-summary).
//
// Se o seu projeto nao usa Jest, comente esta secao.
// ---------------------------------------------------------------------------

const fs = require("fs");
const coveragePath = "./coverage/coverage-summary.json";

if (fs.existsSync(coveragePath)) {
  try {
    const coverage     = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
    const currentPct   = coverage.total?.lines?.pct;
    const basePath     = "./coverage/base-coverage.json";

    if (fs.existsSync(basePath) && currentPct !== undefined) {
      const basePct = JSON.parse(fs.readFileSync(basePath, "utf8")).total?.lines?.pct;
      const drop    = basePct - currentPct;

      if (drop > CONFIG.coverageDropThreshold) {
        warn(
          `Cobertura de testes caiu ${drop.toFixed(1)} pontos ` +
          `(de ${basePct.toFixed(1)}% para ${currentPct.toFixed(1)}%). ` +
          `Queda acima de ${CONFIG.coverageDropThreshold}% indica codigo novo sem cobertura. ` +
          `Adicione testes ou justifique na descricao do PR.`
        );
      } else {
        message(
          `Cobertura de testes: ${currentPct.toFixed(1)}% -- dentro do limite aceitavel.`
        );
      }
    } else {
      message(
        `Cobertura atual: ${currentPct?.toFixed(1) ?? "indisponivel"}%. ` +
        `Arquivo de cobertura base nao encontrado -- comparacao nao realizada.`
      );
    }
  } catch (e) {
    warn(
      `Nao foi possivel ler o arquivo de cobertura de testes. ` +
      `Verifique se o Jest esta configurado com coverageReporters: json-summary.`
    );
  }
} else {
  message(
    `Arquivo de cobertura nao encontrado em ${coveragePath}. ` +
    `Para ativar esta regra: configure Jest com --coverage --coverageReporters=json-summary.`
  );
}

// ---------------------------------------------------------------------------
// REGRA 5 -- PRs sem descricao recebem aviso
// ---------------------------------------------------------------------------

const prBody = (danger.github.pr.body || "").trim();

if (prBody.length < 30) {
  warn(
    `Descricao do PR muito curta ou ausente. ` +
    `Uma boa descricao explica o que muda e por que -- nao apenas lista arquivos alterados. ` +
    `Isso facilita revisao, facilita rollback e fica no historico do projeto.`
  );
}

// ---------------------------------------------------------------------------
// RESUMO FINAL
// ---------------------------------------------------------------------------

message(
  `Danger check concluido. ` +
  `Regras verificadas: referencia Jira, aprovadores para arquivos criticos, ` +
  `tamanho do PR, cobertura de testes e qualidade da descricao. ` +
  `Itens marcados como falha bloqueiam o merge. Avisos nao bloqueiam.`
);
