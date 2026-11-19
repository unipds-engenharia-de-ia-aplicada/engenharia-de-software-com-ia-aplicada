export const QUESTIONS_PER_RUN = 10;

// process.env.QUIZ_TITLE vem do .env (via --env-file)
// ?? → se não existir, usa o texto padrão
export const QUIZ_TITLE =
  process.env.QUIZ_TITLE ?? 'Quiz: o que o JavaScript faz diferente';

export const ANSWER_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
export const TITLE_BORDER_PADDING = 2;
export const ENCOURAGEMENT_SCORE_RATIO = 0.5;
