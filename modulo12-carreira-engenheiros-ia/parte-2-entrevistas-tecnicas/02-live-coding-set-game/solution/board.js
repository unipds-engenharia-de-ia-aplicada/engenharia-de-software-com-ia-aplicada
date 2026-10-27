export class Board {
  constructor(deck) {
    this.deck = deck;
    this.cards = deck.draw(12);
  }

  findSets() {
    const sets = [];
    const c = this.cards;
    for (let i = 0; i < c.length; i++)
      for (let j = i + 1; j < c.length; j++)
        for (let k = j + 1; k < c.length; k++)
          if (c[i].formsSetWith(c[j], c[k])) sets.push([c[i], c[j], c[k]]);
    return sets;
  }

  dealUntilSet() {
    while (this.findSets().length === 0 && this.deck.size > 0) {
      this.cards.push(...this.deck.draw(3));
    }
    return this;
  }
}
