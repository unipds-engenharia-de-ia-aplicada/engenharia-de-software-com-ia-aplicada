export const shuffle = <T>(
  items: T[],
  random: () => number = Math.random
): T[] =>
  items
    .map((item) => ({ item, order: random() }))
    .sort((first, second) => first.order - second.order)
    .map(({ item }) => item);
