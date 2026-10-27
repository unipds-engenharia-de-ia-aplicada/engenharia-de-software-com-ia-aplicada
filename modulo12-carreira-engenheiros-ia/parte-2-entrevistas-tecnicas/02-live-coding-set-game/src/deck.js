import { Card, NUMBERS, COLORS, SHAPES, SHADINGS } from "./card.js";

export class Deck {
  constructor(cards = Deck.full()) {
    // LEVEL 3: store a copy of the card list (do not change the original).
  }

  static full() {
    // LEVEL 3: return all 81 cards, varying in this order:
    // number, then color, then shape, then shading.
  }

  get size() {
    // LEVEL 3: how many cards are still in the deck.
  }

  shuffle(random = Math.random) {
    // LEVEL 3: shuffle the cards using the random function (returns numbers from 0 to 1).
    // Return this so calls can be chained.
  }

  draw(n) {
    // LEVEL 3: take n cards from the top (index 0) and return them. If there are fewer, return what is left.
  }
}
