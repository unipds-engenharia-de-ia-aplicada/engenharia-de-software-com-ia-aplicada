import type { Question } from './types.ts';
import {
  ANSWER_LETTERS,
  ENCOURAGEMENT_SCORE_RATIO,
  TITLE_BORDER_PADDING,
} from './config.ts';

export const formatTitle = (title: string): string => {
  const line = '═'.repeat(title.length + TITLE_BORDER_PADDING);

  return `${line}\n ${title}\n${line}`;
};

export const formatQuestion = (
  text: string,
  options: string[],
  position: number,
  total: number
): string => {
  const lines = options.map(
    (option, index) => `  ${ANSWER_LETTERS[index]}) ${option}`
  );

  return [`${position}/${total}  ${text}`, ...lines].join('\n');
};

export const formatFeedback = (
  question: Question,
  correctLetter: string,
  isCorrect: boolean
): string => {
  const { correct, explanation } = question;

  return isCorrect
    ? `✔ Certo! ${explanation}`
    : `✘ Errado, a resposta é ${correctLetter}) ${correct}. ${explanation}`;
};

export const formatResult = (score: number, total: number): string => {
  const summary = `Resultado: ${score} de ${total}.`;

  if (score === total) return `${summary} Gabaritou! 🏆`;
  if (score >= total * ENCOURAGEMENT_SCORE_RATIO)
    return `${summary} Mandou bem!`;

  return `${summary} Que tal rever as aulas?`;
};
