import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formatResult } from '../src/format.js';

describe('Resultado do quiz', () => {
  test('gabaritou quando acerta tudo', () => {
    assert.equal(formatResult(10, 10), 'Resultado: 10 de 10. Gabaritou! 🏆');
  });

  test('incentiva quando a nota é baixa', () => {
    assert.equal(
      formatResult(4, 10),
      'Resultado: 4 de 10. Que tal rever as aulas?'
    );
  });
});
