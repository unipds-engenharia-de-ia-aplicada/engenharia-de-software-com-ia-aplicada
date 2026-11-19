import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formatFeedback, formatQuestion, formatResult } from '../src/format.js';

const question = {
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

  test('escolhe a mensagem final pela pontuação', () => {
    assert.equal(formatResult(10, 10), 'Resultado: 10 de 10. Gabaritou! 🏆');
    assert.equal(formatResult(4, 10), 'Resultado: 4 de 10. Que tal rever as aulas?');
  });

  test('confirma o acerto ou mostra a resposta certa', () => {
    assert.equal(
      formatFeedback(question, 'b', true),
      '✔ Certo! As aspas tornam esse valor uma string.'
    );
  });
});
