import {
  ANSWER_LETTERS,
  ENCOURAGEMENT_SCORE_RATIO,
  TITLE_BORDER_PADDING,
} from './config.js';

export const formatTitle = (title) => {
  const line = '═'.repeat(title.length + TITLE_BORDER_PADDING);
  return `${line}\n ${title}\n${line}`;
};

export const formatQuestion = (text, options, position, total) => {
  const lines = options.map(
    (option, index) => `  ${ANSWER_LETTERS[index]}) ${option}`
  );
  return [`${position}/${total}  ${text}`, ...lines].join('\n');
};

export const formatFeedback = (question, correctLetter, isCorrect) => {
  const { correct, explanation } = question;
  return isCorrect
    ? `✔ Certo! ${explanation}`
    : `✘ Errado, a resposta é ${correctLetter}) ${correct}. ${explanation}`;
};

export const formatResult = (score, total) => {
  const summary = `Resultado: ${score} de ${total}.`;
  if (score === total) return `${summary} Gabaritou! 🏆`;
  if (score >= total * ENCOURAGEMENT_SCORE_RATIO) return `${summary} Mandou bem!`;
  return `${summary} Que tal rever as aulas?`;
};
