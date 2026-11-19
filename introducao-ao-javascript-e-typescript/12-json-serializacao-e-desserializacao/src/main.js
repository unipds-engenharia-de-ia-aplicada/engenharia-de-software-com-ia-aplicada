import { readFileSync } from 'node:fs';

const raw = readFileSync(new URL('../questions.json', import.meta.url), 'utf8');
const questions = JSON.parse(raw);

console.log(`Banco com ${questions.length} perguntas.`);
console.log(questions[0].text);
