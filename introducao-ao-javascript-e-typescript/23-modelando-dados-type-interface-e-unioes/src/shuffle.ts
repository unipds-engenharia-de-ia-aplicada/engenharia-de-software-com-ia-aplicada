export const shuffle = (
  items: any[],
  random: () => number = Math.random
): any[] =>
  items
    .map((item) => ({ item, order: random() }))
    .sort((first, second) => first.order - second.order)
    .map(({ item }) => item);
