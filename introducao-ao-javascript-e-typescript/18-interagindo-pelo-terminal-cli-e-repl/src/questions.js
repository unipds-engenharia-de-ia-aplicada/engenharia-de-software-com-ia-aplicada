import { QUESTIONS_PER_RUN } from './config.js';
import { shuffle } from './shuffle.js';

export const selectQuestions = (questions, limit = QUESTIONS_PER_RUN) => {
  if (!Array.isArray(questions) || questions.length < limit) {
    throw new Error(
      `O banco precisa de pelo menos ${limit} perguntas válidas.`
    );
  }
  return shuffle(questions).slice(0, limit);
};
