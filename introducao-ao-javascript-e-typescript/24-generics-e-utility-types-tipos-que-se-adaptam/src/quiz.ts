import type { Question, QuizInteraction } from './types.ts';
import { ANSWER_LETTERS } from './config.ts';
import { formatFeedback, formatQuestion } from './format.ts';
import { shuffle } from './shuffle.ts';

export const runQuiz = async (
  questions: Question[],
  interaction: QuizInteraction
): Promise<number> => {
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
