import { readFile } from 'node:fs/promises';
import { QUIZ_TITLE } from './config.js';
import { formatTitle } from './format.js';
import { selectQuestions } from './questions.js';

const loadQuestions = async () => {
  const raw = await readFile(new URL('../questions.json', import.meta.url), 'utf8');
  return JSON.parse(raw);
};

console.log(formatTitle(QUIZ_TITLE));

try {
  const selected = selectQuestions(await loadQuestions());
  console.log(`Pronto: ${selected.length} perguntas sorteadas.`);
  console.log(selected[0].text);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
