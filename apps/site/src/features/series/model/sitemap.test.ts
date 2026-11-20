import { expect, it } from "vitest";
import { isSeriesSitemapEligible } from "./sitemap.js";

it("keeps empty or unpublished series out of sitemap while preserving other pages", () => {
  expect(isSeriesSitemapEligible("https://xpotato.net/series/", [])).toBe(false);
  expect(isSeriesSitemapEligible("https://xpotato.net/series/unpublished/", [])).toBe(false);
  expect(isSeriesSitemapEligible("https://xpotato.net/articles/", [])).toBe(true);
  const published = [
    {
      id: "public",
      slug: "public",
      title: "公開連載",
      description: "公開済み",
      kind: "series" as const,
      status: "ongoing" as const,
      route: "/series/public/",
      entries: [],
    },
  ];
  expect(isSeriesSitemapEligible("https://xpotato.net/series/", published)).toBe(true);
  expect(isSeriesSitemapEligible("https://xpotato.net/series/public/", published)).toBe(true);
  expect(isSeriesSitemapEligible("https://xpotato.net/series/unpublished/", published)).toBe(false);
});
