# live-coding-duplicates

Exemplo do vídeo "Live coding: como funciona a entrevista". Um problema pequeno para praticar o método de seis passos.

## O problema

Dada uma lista de números, retorne os que aparecem mais de uma vez.

```js
duplicates([1, 2, 2, 3, 3, 3]); // [2, 3]
```

## O método

1. **Entender o problema e fazer perguntas.** A ordem do resultado importa? A lista pode vir vazia? Pode ter números negativos?
2. **Definir um exemplo de teste.** `[1, 2, 2, 3, 3, 3]` → `[2, 3]`.
3. **Explicar o plano.** Contar quantas vezes cada número aparece e devolver os que passam de 1.
4. **Escrever a versão mais simples.** Em `src/duplicates.js`.
5. **Rodar os testes e os edge cases.** Lista vazia, lista sem repetidos.
6. **Melhorar e dizer o que faria com mais tempo.** Custo O(n) de tempo e de memória. Com mais tempo: validar a entrada. Se a lista não couber na memória: processar em partes.

## Como rodar

Precisa do Node.js 18 ou mais novo.

```bash
npm test                # testa o seu código em src/
npm run test:solution   # testa a solução de referência
```

## Estrutura

```
src/duplicates.js       seu código
solution/duplicates.js  solução de referência
test/duplicates.test.js testes
scripts/                verify-solution.js
```
