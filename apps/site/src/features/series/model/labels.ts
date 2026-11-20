import type { PublicSeries } from "@xpotato/portable-content/series";

export const seriesStatusLabel = (status: PublicSeries["status"]): string =>
  ({
    ongoing: "連載中",
    completed: "完結",
    paused: "休止中",
  })[status];

export const seriesKindLabel = (kind: PublicSeries["kind"]): string =>
  kind === "course" ? "学習コース" : "連載";

export const seriesLastEntryLabel = (status: PublicSeries["status"]): string =>
  status === "completed" ? "最終回" : "現在の最新回";
