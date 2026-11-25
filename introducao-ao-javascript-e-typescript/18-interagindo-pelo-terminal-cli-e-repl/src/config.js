export const QUESTIONS_PER_RUN = 10;

export const QUIZ_TITLE =
  process.env.QUIZ_TITLE ?? 'Quiz: o que o JavaScript faz diferente';

export const ANSWER_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
export const MAX_ALTERNATIVES = ANSWER_LETTERS.length;
export const MIN_WRONG_ALTERNATIVES = 1;
export const ENCOURAGEMENT_SCORE_RATIO = 0.5;
export const TITLE_BORDER_PADDING = 2;
export const ANSWER_PROMPT = '> ';
