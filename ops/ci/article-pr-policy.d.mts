import type { ContentCollection } from "@xpotato/content-contracts/common";

export const articleIndexPath: string;
export function articleSourceCollection(path: string): ContentCollection | null;

export interface ArticlePrCandidate {
  article: boolean;
  reason: string;
  sources: { path: string; status: "A" | "M" }[];
}

export function articlePrDecision(input?: {
  impact?: {
    base: string | null;
    head: string | null;
    comparisonAvailable: boolean;
    changes: { status: string; paths: string[] }[];
  };
  env?: NodeJS.ProcessEnv;
  actualHead?: string;
  sourceMode?: (path: string, revision: string) => string | null;
}): ArticlePrCandidate;

export function inspectArticlePrDecision(input?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): ArticlePrCandidate;
