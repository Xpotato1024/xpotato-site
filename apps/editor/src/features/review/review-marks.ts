import {
  locateAnchor,
  type LocatedAnchor,
  type ReviewComment,
} from "@xpotato/editor-core/annotations";

export type ReviewMarkState = ReviewComment["status"] | "proposal";

export interface LocatedReviewMark extends LocatedAnchor {
  id: string;
  state: ReviewMarkState;
}

export function reviewMarkState(comment: ReviewComment): ReviewMarkState {
  return comment.status === "open" && comment.proposal ? "proposal" : comment.status;
}

export function reviewStateLabel(state: ReviewMarkState): string {
  return {
    open: "指摘済み",
    proposal: "修正案あり",
    resolved: "解決済み",
    applied: "反映済み",
    rejected: "見送り",
  }[state];
}

/** Applied proposals retain their original anchor; only an unambiguous replacement is marked. */
export function locateReviewComment(body: string, comment: ReviewComment): LocatedAnchor | null {
  if (comment.anchor.scope === "article") return null;
  if (comment.status !== "applied") return locateAnchor(body, comment.anchor);
  if (!comment.proposal?.replacement) return null;
  return locateAnchor(body, {
    quote: comment.proposal.replacement,
    prefix: comment.anchor.prefix,
    suffix: comment.anchor.suffix,
  });
}

export function locateReviewMarks(
  body: string,
  comments: readonly ReviewComment[],
): LocatedReviewMark[] {
  return comments.flatMap((comment) => {
    const location = locateReviewComment(body, comment);
    return location ? [{ ...location, id: comment.id, state: reviewMarkState(comment) }] : [];
  });
}

/** Attach the action badge once, at the smallest rendered region containing its start. */
export function reviewMarkersForRegion(
  marks: readonly LocatedReviewMark[],
  region: LocatedAnchor,
  children: readonly LocatedAnchor[] = [],
): LocatedReviewMark[] {
  return marks.filter(
    (mark) =>
      mark.start >= region.start &&
      mark.start < region.end &&
      !children.some((child) => mark.start >= child.start && mark.start < child.end),
  );
}

export interface ReviewTextSegment {
  text: string;
  marks: readonly LocatedReviewMark[];
}

/** Split display text without adding characters or changing the source/selection offsets. */
export function splitReviewText(
  text: string,
  sourceStart: number,
  marks: readonly LocatedReviewMark[],
): ReviewTextSegment[] {
  const sourceEnd = sourceStart + text.length;
  const relevant = marks.filter((mark) => mark.start < sourceEnd && mark.end > sourceStart);
  if (!relevant.length) return [{ text, marks: [] }];
  const points = new Set([0, text.length]);
  for (const mark of relevant) {
    points.add(Math.max(0, mark.start - sourceStart));
    points.add(Math.min(text.length, mark.end - sourceStart));
  }
  const boundaries = [...points].sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]!;
    return {
      text: text.slice(start, end),
      marks: relevant.filter(
        (mark) => mark.start < sourceStart + end && mark.end > sourceStart + start,
      ),
    };
  });
}

export function primaryReviewMark(
  marks: readonly LocatedReviewMark[],
): LocatedReviewMark | undefined {
  return (
    marks.find((mark) => mark.state === "proposal") ??
    marks.find((mark) => mark.state === "open") ??
    marks[0]
  );
}
