import { QUESTIONS_PER_RUN, QUIZ_TITLE } from './config.ts';
import { formatResult, formatTitle } from './format.ts';
import { loadQuestions } from './providers/questions.ts';
import { createTerminal, showMessage } from './providers/terminal.ts';
import { runQuiz } from './quiz.ts';

const args = process.argv.slice(2);
const limitIndex = args.indexOf('--limit');

let limit = QUESTIONS_PER_RUN;
if (limitIndex !== -1) {
  limit = Number(args[limitIndex + 1]);
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error('Use --limit com um número positivo. Ex.: --limit 5');
  }
}

showMessage(formatTitle(QUIZ_TITLE));

try {
  const questions = await loadQuestions(limit);
  const terminal = createTerminal();
  let score: number;

  try {
    score = await runQuiz(questions, terminal);
  } finally {
    terminal.close();
  }

  showMessage(`\n${formatResult(score, questions.length)}`);
} catch (error) {
  const leftEarly = error instanceof Error && error.name === 'AbortError';
  if (!leftEarly) throw error;
  showMessage('\nAté a próxima!');
}
