import { readFile } from 'node:fs/promises';
import { QUESTIONS_PER_RUN, QUIZ_TITLE } from './config.js';
import { formatTitle } from './format.js';
import { selectQuestions } from './questions.js';

const showMessage = (message) => {
  console.log(message);
};

const args = process.argv.slice(2);
const limitIndex = args.indexOf('--limit');

let limit = QUESTIONS_PER_RUN;
if (limitIndex !== -1) {
  limit = Number(args[limitIndex + 1]);
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error('Use --limit com um número positivo. Ex.: --limit 5');
  }
}

const loadQuestions = async () => {
  const raw = await readFile(
    new URL('../questions.json', import.meta.url),
    'utf8'
  );
  return JSON.parse(raw);
};

showMessage(formatTitle(QUIZ_TITLE));

try {
  const selected = selectQuestions(await loadQuestions(), limit);
  showMessage(`Pronto: ${selected.length} perguntas sorteadas.`);
  showMessage(selected[0].text);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
