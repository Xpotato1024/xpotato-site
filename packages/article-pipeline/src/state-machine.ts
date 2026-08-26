import { articleJobStateSchema, type ArticleJobState } from "@xpotato/content-contracts";

const normalTransitions = {
  CREATED: ["SOURCES_READY"],
  SOURCES_READY: ["EVIDENCE_READY"],
  EVIDENCE_READY: ["DRAFTED"],
  DRAFTED: ["EXAMPLES_ASSESSED"],
  EXAMPLES_ASSESSED: ["CONTENT_AUDITED"],
  CONTENT_AUDITED: ["REVISION_REQUIRED", "CONTENT_READY"],
  REVISION_REQUIRED: ["DRAFTED"],
  CONTENT_READY: ["VISUAL_PLANNED"],
  VISUAL_PLANNED: ["VISUAL_READY"],
  VISUAL_READY: ["VISUAL_AUDITED"],
  VISUAL_AUDITED: ["MEDIA_READY"],
  MEDIA_READY: ["CANDIDATE_READY"],
  CANDIDATE_READY: ["PREVIEW_VALIDATED"],
  PREVIEW_VALIDATED: ["HUMAN_REVIEW_READY"],
  HUMAN_REVIEW_READY: ["HUMAN_APPROVED"],
  HUMAN_APPROVED: ["MEDIA_SOURCE_STORED"],
  MEDIA_SOURCE_STORED: ["MEDIA_PUBLISHED"],
  MEDIA_PUBLISHED: ["MEDIA_PROTECTED"],
  MEDIA_PROTECTED: ["EXPORTED"],
  EXPORTED: [],
  BLOCKED: [],
  FAILED: [],
  CANCELLED: [],
} as const satisfies Record<ArticleJobState, readonly ArticleJobState[]>;

const terminalStates = new Set<ArticleJobState>(["EXPORTED", "BLOCKED", "FAILED", "CANCELLED"]);

export class InvalidArticleJobTransitionError extends Error {
  constructor(readonly from: ArticleJobState, readonly to: ArticleJobState) {
    super(`Invalid Article Job transition: ${from} -> ${to}`);
  }
}

export const canTransition = (fromInput: string, toInput: string): boolean => {
  const from = articleJobStateSchema.parse(fromInput);
  const to = articleJobStateSchema.parse(toInput);
  if (normalTransitions[from].includes(to as never)) return true;
  return !terminalStates.has(from) && (["BLOCKED", "FAILED", "CANCELLED"] as const).includes(to as never);
};

export const transition = (from: ArticleJobState, to: ArticleJobState): ArticleJobState => {
  if (!canTransition(from, to)) throw new InvalidArticleJobTransitionError(from, to);
  return to;
};

export const assertRevisionBudget = (used: number, maximum: number): void => {
  if (!Number.isInteger(used) || !Number.isInteger(maximum) || used < 0 || maximum < 0 || used > maximum) {
    throw new Error("Article revision budget exhausted or invalid");
  }
};

export type StalenessCause =
  | "job_spec"
  | "source_or_disclosure"
  | "source"
  | "evidence"
  | "draft"
  | "visual"
  | "media_profile_or_toolchain"
  | "candidate_after_approval"
  | "source_receipt"
  | "publication_manifest"
  | "protection_receipt";

export const staleFrom: Readonly<Record<StalenessCause, ArticleJobState>> = Object.freeze({
  job_spec: "CREATED",
  source_or_disclosure: "SOURCES_READY",
  source: "SOURCES_READY",
  evidence: "EVIDENCE_READY",
  draft: "DRAFTED",
  visual: "VISUAL_PLANNED",
  media_profile_or_toolchain: "MEDIA_READY",
  candidate_after_approval: "CANDIDATE_READY",
  source_receipt: "HUMAN_APPROVED",
  publication_manifest: "MEDIA_SOURCE_STORED",
  protection_receipt: "MEDIA_PUBLISHED",
});
