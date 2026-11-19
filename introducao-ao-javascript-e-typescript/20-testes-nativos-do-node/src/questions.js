import {
  MAX_ALTERNATIVES,
  MIN_WRONG_ALTERNATIVES,
  QUESTIONS_PER_RUN,
} from './config.js';
import { shuffle } from './shuffle.js';

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

const isQuestion = (value) => {
  if (typeof value !== 'object' || value === null) return false;
  if (
    !('text' in value) ||
    !('correct' in value) ||
    !('wrong' in value) ||
    !('explanation' in value)
  ) {
    return false;
  }
  if (
    !isNonEmptyString(value.text) ||
    !isNonEmptyString(value.correct) ||
    !isNonEmptyString(value.explanation) ||
    !Array.isArray(value.wrong)
  ) {
    return false;
  }
  const options = [value.correct, ...value.wrong];
  return (
    value.wrong.length >= MIN_WRONG_ALTERNATIVES &&
    options.length <= MAX_ALTERNATIVES &&
    options.every(isNonEmptyString) &&
    new Set(options).size === options.length
  );
};

export const selectQuestions = (questions, limit = QUESTIONS_PER_RUN) => {
  if (!Array.isArray(questions) || !questions.every(isQuestion)) {
    throw new Error('The Gist must contain an array of valid quiz questions.');
  }
  if (questions.length < limit) {
    throw new Error(
      `The Gist must contain at least ${limit} questions.`
    );
  }
  if (
    new Set(questions.map(({ text }) => text.trim())).size !== questions.length
  ) {
    throw new Error('The Gist must contain unique questions.');
  }
  return shuffle(questions).slice(0, limit);
};
