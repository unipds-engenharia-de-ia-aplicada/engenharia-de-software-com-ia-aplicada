const questions = [
  {
    text: 'Qual é o resultado de 0 === false?',
    correct: 'false',
    wrong: ['true', 'undefined', 'TypeError'],
    explanation: 'A comparação estrita não converte tipos diferentes.',
  },
  {
    text: 'Qual é o resultado de typeof "42"?',
    correct: 'string',
    wrong: ['number', 'object', 'NaN'],
    explanation: 'As aspas tornam esse valor uma string.',
  },
];

const assertUniqueOptions = (question) => {
  const options = [question.correct, ...question.wrong];
  return new Set(options).size === options.length;
};

for (const question of questions) {
  console.log(question.text);
  console.log('  alternativas únicas?', assertUniqueOptions(question));
}


































