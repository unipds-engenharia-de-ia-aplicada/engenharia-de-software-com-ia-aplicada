export const shuffle = (items, random = Math.random) =>
  items
    .map((item) => ({ item, order: random() }))
    .sort((first, second) => first.order - second.order)
    .map(({ item }) => item);
