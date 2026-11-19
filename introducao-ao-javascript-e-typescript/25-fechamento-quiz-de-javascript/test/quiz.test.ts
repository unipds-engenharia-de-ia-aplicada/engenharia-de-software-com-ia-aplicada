import type { Question } from '../src/types.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { runQuiz } from '../src/quiz.ts';

const questions: Question[] = [
  {
    text: 'Qual é o resultado de 0 === false?',
    correct: 'false',
    wrong: ['true'],
    explanation: 'A comparação estrita não converte tipos diferentes.',
  },
  {
    text: 'Qual é o resultado de typeof "42"?',
    correct: 'string',
    wrong: ['number'],
    explanation: 'As aspas tornam esse valor uma string.',
  },
];
const keepOrder = () => 0.5;

const play = async (answers: string[], random = keepOrder) => {
  const shown: string[] = [];

  const score = await runQuiz(questions, {
    ask: async () => answers.shift() ?? '',
    show: (message) => shown.push(message),
    random,
  });

  return { score, shown };
};

describe('Partida do quiz', () => {
  test('conta os acertos e corrige cada resposta', async () => {
    const { score, shown } = await play(['a', 'b']);

    assert.equal(score, 1);
    assert.deepStrictEqual(shown, [
      '✔ Certo! A comparação estrita não converte tipos diferentes.',
      '✘ Errado, a resposta é a) string. As aspas tornam esse valor uma string.',
    ]);
  });

  test('aceita a letra em maiúscula e com espaços em volta', async () => {
    const { score } = await play([' A ', 'A']);

    assert.equal(score, 2);
  });

  test('a letra certa acompanha a alternativa depois do sorteio', async () => {
    const draws = [0.9, 0.1, 0.9, 0.1];

    const { score } = await play(['b', 'b'], () => draws.shift() ?? 0);

    assert.equal(score, 2);
  });
});
