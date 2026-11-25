import { readFile } from 'node:fs/promises';

const QUESTIONS_PER_RUN = 10; // quantas perguntas entram em cada partida

const loadQuestions = async () => {
  // lê o arquivo como texto (Promise) — await espera terminar
  const raw = await readFile(
    new URL('../questions.json', import.meta.url), // sobe de src/ pra raiz
    'utf8'
  );
  // texto JSON → valor JS (aqui: um array de objetos)
  return JSON.parse(raw);
};

const selectQuestions = (questions) => {
  // Array.isArray: confere se o valor é mesmo uma lista []
  // (JSON.parse de objeto vira {}, não array — sem isso a gente cairia depois)
  if (!Array.isArray(questions) || questions.length < QUESTIONS_PER_RUN) {
    // throw: interrompe e joga o erro pro catch lá embaixo
    throw new Error(
      `O banco precisa de pelo menos ${QUESTIONS_PER_RUN} perguntas válidas.`
    );
  }

  // slice(início, fim): devolve um pedaço do array, sem mudar o original
  // slice(0, 10) → índices 0 até 9 (as 10 primeiras)
  return questions.slice(0, QUESTIONS_PER_RUN);
};

try {
  const bank = await loadQuestions();
  const selected = selectQuestions(bank);
  console.log(`Selecionou ${selected.length} perguntas.`);
} catch (error) {
  // instanceof Error: o catch pode receber qualquer coisa;
  // se for Error, a gente lê .message com segurança
  console.error(error instanceof Error ? error.message : error);
  // exitCode 1 = processo terminou com falha (0 seria sucesso)
  process.exitCode = 1;
}
