import { Card, NUMBERS, COLORS, SHAPES, SHADINGS } from "./card.js";

export class Deck {
  constructor(cards = Deck.full()) {
    this.cards = [...cards];
  }

  static full() {
    const cards = [];
    for (const n of NUMBERS)
      for (const c of COLORS)
        for (const s of SHAPES)
          for (const f of SHADINGS) cards.push(new Card(n, c, s, f));
    return cards;
  }

  get size() {
    return this.cards.length;
  }

  shuffle(random = Math.random) {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    return this;
  }

  draw(n) {
    return this.cards.splice(0, n);
  }
}
