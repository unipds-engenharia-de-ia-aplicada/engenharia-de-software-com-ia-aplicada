export const NUMBERS = [1, 2, 3];
export const COLORS = ["red", "green", "purple"];
export const SHAPES = ["oval", "diamond", "squiggle"];
export const SHADINGS = ["solid", "striped", "open"];

export class Card {
  constructor(number, color, shape, shading) {
    // LEVEL 1: store the four values and throw if any of them is invalid.
  }

  // Already done: builds a card from text like "2 green diamond striped".
  static parse(text) {
    const [n, c, s, f] = text.split(" ");
    return new Card(Number(n), c, s, f);
  }

  toString() {
    // LEVEL 1: return the card as text, e.g. "2 green diamond striped".
  }

  formsSetWith(b, c) {
    // LEVEL 2: return true if this, b and c form a set.
  }
}
