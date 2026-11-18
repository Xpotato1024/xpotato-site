import type { PublicSeries } from "@xpotato/portable-content/series";

export const isSeriesSitemapEligible = (page: string, series: readonly PublicSeries[]): boolean => {
  const path = new URL(page).pathname;
  if (path === "/series/") {
    return series.length > 0;
  }
  if (!path.startsWith("/series/")) {
    return true;
  }
  return series.some((item) => item.route === path);
};
