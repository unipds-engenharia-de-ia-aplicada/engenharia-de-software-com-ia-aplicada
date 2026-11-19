import type { Question } from '../src/types.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formatFeedback, formatQuestion, formatResult } from '../src/format.ts';

const question: Question = {
  text: 'Qual é o resultado de typeof "42"?',
  correct: 'string',
  wrong: ['number'],
  explanation: 'As aspas tornam esse valor uma string.',
};

describe('Textos da tela', () => {
  test('mostra o progresso e dá uma letra a cada alternativa', () => {
    const text = formatQuestion(question.text, ['number', 'string'], 3, 10);

    assert.equal(
      text,
      '3/10  Qual é o resultado de typeof "42"?\n  a) number\n  b) string'
    );
  });

  test('confirma o acerto ou mostra a resposta certa, sempre com a explicação', () => {
    const right = formatFeedback(question, 'b', true);
    const wrong = formatFeedback(question, 'b', false);

    assert.equal(right, '✔ Certo! As aspas tornam esse valor uma string.');
    assert.equal(
      wrong,
      '✘ Errado, a resposta é b) string. As aspas tornam esse valor uma string.'
    );
  });

  test('escolhe a mensagem final pela pontuação', () => {
    assert.equal(formatResult(10, 10), 'Resultado: 10 de 10. Gabaritou! 🏆');
    assert.equal(formatResult(5, 10), 'Resultado: 5 de 10. Mandou bem!');
    assert.equal(
      formatResult(4, 10),
      'Resultado: 4 de 10. Que tal rever as aulas?'
    );
  });
});
