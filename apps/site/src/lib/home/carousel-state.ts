/** Logical item identity stays independent of the visual loop sentinels. */
export function carouselIndex(index: number, count: number): number {
  return count > 0 ? ((index % count) + count) % count : 0;
}
export function canRotate(count: number, pauses: ReadonlySet<string>): boolean {
  return count > 1 && pauses.size === 0;
}
/** One sentinel can be centred during a wrap; another must fill its outer peek. */
export function carouselSentinels(count: number) {
  const size = count > 1 ? 2 : 0;
  return {
    before: Array.from({ length: size }, (_, i) => carouselIndex(count - size + i, count)),
    after: Array.from({ length: size }, (_, i) => i),
  };
}
