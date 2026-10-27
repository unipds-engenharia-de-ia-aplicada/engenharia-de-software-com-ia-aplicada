// Returns the numbers that appear more than once, in order of first appearance.
export function duplicates(nums) {
  const counts = new Map();
  for (const n of nums) {
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return [...counts]
    .filter(([n, c]) => c > 1)
    .map(([n]) => n);
}
