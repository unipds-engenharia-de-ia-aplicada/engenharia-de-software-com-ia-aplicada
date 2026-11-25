import { QUESTIONS_PER_RUN } from '../config.js';
import { readFile } from 'node:fs/promises';
import { selectQuestions } from '../questions.js';

export const loadQuestions = async (limit = QUESTIONS_PER_RUN) => {
  const raw = await readFile(
    new URL('../../questions.json', import.meta.url),
    'utf8'
  );
  return selectQuestions(JSON.parse(raw), limit);
};
