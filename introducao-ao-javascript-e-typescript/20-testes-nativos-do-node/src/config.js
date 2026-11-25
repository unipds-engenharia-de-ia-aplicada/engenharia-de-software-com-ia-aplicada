export const QUESTIONS_PER_RUN = 10;

export const QUIZ_TITLE =
  process.env.QUIZ_TITLE ?? 'Quiz: o que o JavaScript faz diferente';

export const QUESTIONS_URL =
  process.env.QUESTIONS_URL ??
  'https://gist.githubusercontent.com/wellwelwel/1d040ee2821b552ac1a16e64b023953d/raw/javascript-quiz.json';

export const DOWNLOAD_TIMEOUT_MS = Number(
  process.env.DOWNLOAD_TIMEOUT_MS ?? '10000'
);

export const ANSWER_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
export const MAX_ALTERNATIVES = ANSWER_LETTERS.length;
export const MIN_WRONG_ALTERNATIVES = 1;
export const ENCOURAGEMENT_SCORE_RATIO = 0.5;
export const TITLE_BORDER_PADDING = 2;
export const ANSWER_PROMPT = '> ';
