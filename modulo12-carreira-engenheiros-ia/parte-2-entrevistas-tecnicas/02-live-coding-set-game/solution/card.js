export const NUMBERS = [1, 2, 3];
export const COLORS = ["red", "green", "purple"];
export const SHAPES = ["oval", "diamond", "squiggle"];
export const SHADINGS = ["solid", "striped", "open"];

export class Card {
  constructor(number, color, shape, shading) {
    if (
      !NUMBERS.includes(number) ||
      !COLORS.includes(color) ||
      !SHAPES.includes(shape) ||
      !SHADINGS.includes(shading)
    ) {
      throw new Error("Invalid card");
    }
    this.number = number;
    this.color = color;
    this.shape = shape;
    this.shading = shading;
  }

  static parse(text) {
    const [n, c, s, f] = text.split(" ");
    return new Card(Number(n), c, s, f);
  }

  toString() {
    return `${this.number} ${this.color} ${this.shape} ${this.shading}`;
  }

  formsSetWith(b, c) {
    for (const key of ["number", "color", "shape", "shading"]) {
      // 1 distinct value: all the same. 3: all different. 2: not a set.
      if (new Set([this[key], b[key], c[key]]).size === 2) return false;
    }
    return true;
  }
}
