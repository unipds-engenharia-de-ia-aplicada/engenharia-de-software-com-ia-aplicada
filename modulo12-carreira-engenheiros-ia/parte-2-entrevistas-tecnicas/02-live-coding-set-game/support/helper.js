// Tests import from here. By default they use your code in src/.
// With "npm run test:solution" they use the reference solution in solution/.
const base = process.env.SOLUTION ? "../solution" : "../src";

const { Card } = await import(`${base}/card.js`);
const { Deck } = await import(`${base}/deck.js`);
const { Board } = await import(`${base}/board.js`);

export { Card, Deck, Board };

// 12 cards that contain no set.
export const BOARD_WITHOUT_SET = [
  "3 purple squiggle solid", "1 green diamond open", "1 purple diamond solid", "2 red diamond solid",
  "1 green diamond solid", "2 green diamond striped", "2 red squiggle open", "1 purple oval open",
  "2 green oval solid", "1 red oval striped", "2 green oval striped", "3 red diamond striped",
];
