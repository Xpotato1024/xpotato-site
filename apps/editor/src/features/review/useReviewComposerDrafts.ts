import { useCallback, useState } from "react";

export interface ReviewComposerDraft {
  instruction: string;
  followUps: Readonly<Record<string, string>>;
}

export type ReviewComposerDrafts = Readonly<Record<string, ReviewComposerDraft>>;

const empty: ReviewComposerDraft = { instruction: "", followUps: {} };

export function updateReviewComposerDrafts(
  current: ReviewComposerDrafts,
  draftId: string,
  commentId: string | null,
  value: string,
): ReviewComposerDrafts {
  const previous = current[draftId] ?? empty;
  return {
    ...current,
    [draftId]:
      commentId === null
        ? { ...previous, instruction: value }
        : { ...previous, followUps: { ...previous.followUps, [commentId]: value } },
  };
}

/** Panel navigation keeps unfinished input, without registering or saving a review comment. */
export function useReviewComposerDrafts(draftId: string) {
  const [drafts, setDrafts] = useState<ReviewComposerDrafts>({});
  const change = useCallback(
    (commentId: string | null, value: string) =>
      setDrafts((current) => updateReviewComposerDrafts(current, draftId, commentId, value)),
    [draftId],
  );
  return [drafts[draftId] ?? empty, change] as const;
}
