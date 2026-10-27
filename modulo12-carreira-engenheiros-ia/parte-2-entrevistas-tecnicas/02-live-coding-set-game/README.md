# set-game

Exercício de live coding em 4 níveis: o jogo de cartas **Set**, com JavaScript orientado a objetos. É o problema resolvido no vídeo "Live coding: o jogo Set".

Cada nível implementa uma parte do jogo e usa o que foi feito no anterior. Os testes dizem se você acertou.

## O jogo

Cada carta tem quatro características:

| Característica | Valores |
|---|---|
| Número (`number`) | 1, 2, 3 |
| Cor (`color`) | red, green, purple |
| Formato (`shape`) | oval, diamond, squiggle |
| Preenchimento (`shading`) | solid, striped, open |

Três cartas formam um **set** quando, em cada característica, os valores são **todos iguais** ou **todos diferentes**. Dois iguais e um diferente não vale.

## Como rodar

Precisa do Node.js 18 ou mais novo. Não há dependências para instalar.

```bash
npm test             # todos os níveis
npm run test:1       # só o nível 1 (troque o número para os outros)
npm run test:solution  # roda os testes contra a solução de referência
```

Comece pelo nível 1. Os níveis seguintes só passam quando os anteriores estiverem prontos.

## Os níveis

Você edita só os arquivos de `src/`. Os comentários `LEVEL N` mostram o que fazer.

**Nível 1: `Card`** (`src/card.js`)
- O construtor guarda as quatro características e lança erro se algum valor for inválido.
- `toString()` devolve o texto da carta, por exemplo `"2 green diamond striped"`.
- `Card.parse(text)` já vem pronto.

**Nível 2: regra do set** (`src/card.js`)
- `formsSetWith(b, c)` devolve `true` se `this`, `b` e `c` formam um set.

**Nível 3: `Deck`** (`src/deck.js`)
- `Deck.full()` devolve as 81 cartas, variando nesta ordem: número, cor, formato, preenchimento.
- O construtor guarda uma cópia da lista recebida. Por padrão usa `Deck.full()`.
- `size` diz quantas cartas restam.
- `shuffle(random)` embaralha com a função recebida e devolve o próprio deck.
- `draw(n)` tira `n` cartas do topo. Se faltarem, devolve as que houver.

**Nível 4: `Board`** (`src/board.js`)
- Ao ser criado, tira 12 cartas do deck para a mesa (`this.cards`).
- `findSets()` devolve todos os sets da mesa, cada um como uma lista de 3 cartas.
- `dealUntilSet()` acrescenta 3 cartas por vez até aparecer um set ou o deck acabar.

## Dicas

- Para saber se uma característica é "toda igual ou toda diferente", conte quantos valores distintos aparecem entre as três cartas.
- Rode os testes com frequência. A mensagem de cada teste diz o que era esperado.
- Treine falando em voz alta, como numa entrevista.

## Estrutura

```
set-game/
  src/        seu código (card.js, deck.js, board.js)
  test/       testes de cada nível
  support/    helper usado pelos testes
  solution/   solução de referência
  scripts/    verify-solution.js
```

Tente resolver antes de abrir a pasta `solution/`.
