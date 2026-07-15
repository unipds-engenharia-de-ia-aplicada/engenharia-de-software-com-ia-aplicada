# Output Dangerfile - U8.2 Backup
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 8.2**
> Output de referência gerado em pré-gravação. Use como backup caso o modelo produza resultado inesperado na demo ao vivo.

Gerado em: 2026-07-10 (AI Studio - Gemini 3.1 Pro Preview)
Input: 4 regras — card Jira (ROUTEWISE-), 2 aprovadores para GPS, aviso de cobertura −5%, aviso de PR > 500 linhas
Temperatura: 0.3

---

Como o Danger.js não calcula a cobertura de testes nativamente (ele precisa ler um relatório gerado pelo CI, como o Jest/Istanbul), o modelo adicionou uma lógica que lê um arquivo de diferença de cobertura, acompanhada de instruções de integração.

## dangerfile.js

```javascript
import { danger, warn, fail, message } from 'danger';
import fs from 'fs';

// ====================================================================
// 1. Validação do Card do Jira (Padrão ROUTEWISE-)
// ====================================================================
const prTitle = danger.github.pr.title || "";
const prBody = danger.github.pr.body || "";
const jiraRegex = /ROUTEWISE-\d+/i;

if (!jiraRegex.test(prTitle) && !jiraRegex.test(prBody)) {
  fail(
    "🚨 **Falta o Card do Jira**: Todo PR deve mencionar o número do card do Jira (ex: `ROUTEWISE-123`) no título ou na descrição para garantir a rastreabilidade."
  );
}

// ====================================================================
// 2. Aviso de PRs Grandes (> 500 linhas)
// ====================================================================
const bigPRThreshold = 500;
const totalChanges = danger.github.pr.additions + danger.github.pr.deletions;

if (totalChanges > bigPRThreshold) {
  warn(
    `⚠️ **PR muito grande**: Este PR possui ${totalChanges} linhas modificadas (limite recomendado: ${bigPRThreshold}). Por favor, revise com cuidado extra ou considere dividi-lo em PRs menores no futuro.`
  );
}

// ====================================================================
// 3. Regra de Aprovação para Integração GPS
// ====================================================================
const changedFiles = [...danger.git.modified_files, ...danger.git.created_files];
// Identifica se algum arquivo modificado contém 'gps' no caminho/nome
const hasGPSChanges = changedFiles.some(file => file.toLowerCase().includes('gps'));

if (hasGPSChanges) {
  // Busca as revisões do GitHub
  const reviews = danger.github.reviews || [];
  const approvedReviews = reviews.filter(review => review.state === 'APPROVED');

  if (approvedReviews.length < 2) {
    fail(
      "🛰️ **Integração GPS Modificada**: Arquivos críticos de GPS foram alterados. Este PR exige pelo menos **2 aprovações** antes de ser mergeado."
    );
  } else {
    message("✅ Modificações no GPS validadas por múltiplos revisores.");
  }
}

// ====================================================================
// 4. Verificação de Queda na Cobertura de Testes (> 5%)
// ====================================================================
// Nota: O CI deve gerar um arquivo JSON com a diferença de cobertura
// (ex: usando jest-coverage-ratchet ou scripts customizados) antes de rodar o Danger.
const coverageDiffPath = './coverage-diff.json';

try {
  if (fs.existsSync(coverageDiffPath)) {
    const coverageData = JSON.parse(fs.readFileSync(coverageDiffPath, 'utf8'));

    // Assumindo que o JSON tenha uma chave 'coverageDropPercentage'
    const drop = coverageData.coverageDropPercentage || 0;

    if (drop > 5) {
      warn(
        `📉 **Queda na Cobertura de Testes**: A cobertura caiu **${drop}%** (o limite máximo de queda é 5%). Adicione mais testes para cobrir as novas implementações.`
      );
    }
  } else {
    message("ℹ️ Arquivo de relatório de cobertura não encontrado. Verificação de testes ignorada.");
  }
} catch (error) {
  warn("⚠️ Ocorreu um erro ao tentar ler o relatório de cobertura de testes no Dangerfile.");
}
```

### 📌 Notas de Implementação para o Pipeline (CI/CD)

1. **Permissões do GitHub Token:** para a regra de **Aprovadores do GPS** funcionar, o token usado pelo Danger no CI (`DANGER_GITHUB_API_TOKEN`) precisa ter permissão para ler as *Reviews* do Pull Request.
2. **Cobertura de Testes:** o Danger.js não roda os testes, ele apenas avalia os resultados. Para a regra 4 funcionar, o pipeline precisa: rodar os testes (`npm test -- --coverage`), comparar a cobertura atual com a da branch `main`, e salvar o resultado em `./coverage-diff.json` no formato `{"coverageDropPercentage": 6.2}`. *Alternativa:* bibliotecas prontas como `danger-plugin-jest` substituem o bloco 4.

---

## Pontos para destacar na gravação

- **Regex do Jira:** `/ROUTEWISE-\d+/i` no título ou descrição — a mesma lógica de parsing de structured prompts, agora como regra de pipeline.
- **Warn vs. fail calibrado:** cobertura e PR grande são `warn`; card do Jira e aprovadores de GPS são `fail` — exatamente a calibragem ensinada no 8.1.
- **Mensagem de sucesso incluída:** o modelo adicionou `✅ Modificações no GPS validadas por múltiplos revisores` — a prática da quinta armadilha (sinal de sucesso explícito) já veio no output.
- **Ponto de curadoria (customização ao vivo):** a regra 3 usa `includes('gps')` — qualquer caminho contendo "gps" dispara a regra. Um diretório `gps-mock/` de testes entraria por engano; um rename para `telemetry/` desligaria a regra silenciosamente. É o gancho para a demo do `danger.config.json` com paths configuráveis.
- **Honestidade técnica:** o modelo avisou que o Danger não calcula cobertura nativamente e documentou a integração necessária no CI — limitação sinalizada, não escondida.

---

*Artefato de referência para gravação — usar este arquivo em tela durante a demo.*

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
