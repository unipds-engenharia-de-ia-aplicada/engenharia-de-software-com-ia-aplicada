import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { runQuiz } from '../src/quiz.js';

const questions = [
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

const play = async (answers, random = () => 0.5) => {
  const shown = [];
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
    assert.equal(shown.length, 2);
  });
});
