import {
  anchorSelection,
  type ReviewComment,
  type SourceSelection,
} from "@xpotato/editor-core/annotations";
import { locateReviewComment } from "./review-marks.js";

export function reviewCommentSelection(
  body: string,
  comment: ReviewComment,
): SourceSelection | null {
  const location = locateReviewComment(body, comment);
  return location ? { ...location, quote: body.slice(location.start, location.end) } : null;
}

/** A further correction targets the current text and leaves the earlier decision intact. */
export function followUpReviewComment(
  body: string,
  comment: ReviewComment,
  instruction: string,
): ReviewComment {
  const selection = reviewCommentSelection(body, comment);
  if (!selection) throw Error("対象が変更されています。本文を選び直してください。");
  if (!instruction.trim()) throw Error("指摘を入力してください。");
  return {
    id: crypto.randomUUID(),
    contentId: comment.contentId,
    anchor: anchorSelection(body, selection),
    instruction: instruction.trim(),
    createdAt: new Date().toISOString(),
    status: "open",
  };
}
