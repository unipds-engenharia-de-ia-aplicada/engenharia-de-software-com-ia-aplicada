import { QUESTIONS_PER_RUN } from './config.js';
import { shuffle } from './shuffle.js';

export const selectQuestions = (questions) => {
  if (!Array.isArray(questions) || questions.length < QUESTIONS_PER_RUN) {
    throw new Error(
      `O banco precisa de pelo menos ${QUESTIONS_PER_RUN} perguntas válidas.`
    );
  }
  return shuffle(questions).slice(0, QUESTIONS_PER_RUN);
};
