import { ANSWER_LETTERS } from './config.js';
import { formatFeedback, formatQuestion } from './format.js';
import { shuffle } from './shuffle.js';

export const runQuiz = async (questions, interaction) => {
  const total = questions.length;
  let score = 0;

  for (const [index, question] of questions.entries()) {
    const options = shuffle(
      [question.correct, ...question.wrong],
      interaction.random
    );
    const correctLetter = ANSWER_LETTERS[options.indexOf(question.correct)];
    const choice = await interaction.ask(
      `\n${formatQuestion(question.text, options, index + 1, total)}`
    );
    const isCorrect = choice.trim().toLowerCase() === correctLetter;
    if (isCorrect) score++;
    interaction.show(formatFeedback(question, correctLetter, isCorrect));
  }

  return score;
};
