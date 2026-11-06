/** Logical item identity stays independent of the visual loop sentinels. */
export function carouselIndex(index: number, count: number): number {
  return count > 0 ? ((index % count) + count) % count : 0;
}
export function canRotate(count: number, pauses: ReadonlySet<string>): boolean {
  return count > 1 && pauses.size === 0;
}
