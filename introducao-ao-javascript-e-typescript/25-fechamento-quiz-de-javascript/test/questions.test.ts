import type { Question } from '../src/types.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { QUESTIONS_PER_RUN } from '../src/config.ts';
import { loadQuestions } from '../src/providers/questions.ts';
import { selectQuestions } from '../src/questions.ts';

const createBank = (size: number): Question[] =>
  Array.from({ length: size }, (_, index) => ({
    text: `Pergunta ${index + 1}`,
    correct: 'Certa',
    wrong: ['Errada'],
    explanation: 'Explicação',
  }));

describe('Perguntas do Gist', () => {
  test('sorteia dez perguntas diferentes do banco', () => {
    const bank = createBank(12);

    const selected = selectQuestions(bank);
    const texts = new Set(selected.map(({ text }) => text));

    assert.equal(selected.length, 10);
    assert.equal(texts.size, 10);
    assert.ok(selected.every((question) => bank.includes(question)));
  });

  test('recusa um banco com menos de dez perguntas', () => {
    assert.throws(() => selectQuestions(createBank(9)), /at least 10/);
  });

  test('recusa dados que não formam perguntas válidas', () => {
    const [question, ...others] = createBank(10);

    assert.throws(() => selectQuestions(null), /valid quiz questions/);
    assert.throws(
      () => selectQuestions([{ ...question, wrong: [] }, ...others]),
      /valid quiz questions/
    );
    assert.throws(
      () => selectQuestions([{ ...question, wrong: ['Certa'] }, ...others]),
      /valid quiz questions/
    );
  });

  test('avisa quando o Gist responde erro HTTP', async () => {
    const fakeFetch = async () => new Response('', { status: 503 });

    await assert.rejects(loadQuestions(QUESTIONS_PER_RUN, fakeFetch), /HTTP 503/);
  });
});
