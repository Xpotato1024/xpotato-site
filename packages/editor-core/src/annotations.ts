/** Review data stays outside MDX. Anchors are verified against source before applying edits. */
export interface SourceSelection {
  quote: string;
  start?: number;
  end?: number;
  blockStart?: number;
  blockEnd?: number;
  blockSource?: string;
}
export interface ReviewAnchor {
  /** An article-wide target deliberately has no text range. Legacy anchors omit scope. */
  scope?: "article";
  quote: string;
  prefix: string;
  suffix: string;
  blockSource?: string;
  offset?: number;
}
export interface ReviewProposal {
  id: string;
  expected: string;
  replacement: string;
  reason: string;
  receivedAt: string;
}
export interface ReviewComment {
  id: string;
  contentId: string;
  anchor: ReviewAnchor;
  instruction: string;
  createdAt: string;
  status: "open" | "resolved" | "applied" | "rejected";
  proposal?: ReviewProposal | undefined;
  targetHistory?: {
    anchor: ReviewAnchor;
    proposal?: ReviewProposal | undefined;
    changedAt: string;
  }[];
}
export interface LocatedAnchor {
  start: number;
  end: number;
}

function occurrences(source: string, quote: string): number[] {
  if (!quote) return [];
  const result: number[] = [];
  let index = source.indexOf(quote);
  while (index !== -1 && result.length < 1000) {
    result.push(index);
    index = source.indexOf(quote, index + 1);
  }
  return result;
}

export function anchorSelection(body: string, selection: SourceSelection): ReviewAnchor {
  const { quote } = selection;
  if (!quote.trim()) throw Error("添削する本文を選択してください。");
  let start = selection.start;
  if (start === undefined || body.slice(start, selection.end) !== quote) {
    const from = selection.blockStart ?? 0;
    const region = body.slice(from, selection.blockEnd ?? body.length);
    const found = occurrences(region, quote);
    if (found.length !== 1)
      throw Error("選択位置を特定できません。MDX表示で範囲を選択してください。");
    start = from + found[0]!;
  }
  const block = selection.blockSource;
  return {
    quote,
    prefix: body.slice(Math.max(0, start - 64), start),
    suffix: body.slice(start + quote.length, start + quote.length + 64),
    ...(block && block.includes(quote)
      ? { blockSource: block, offset: start - (selection.blockStart ?? start) }
      : {}),
  };
}

export function articleReviewAnchor(): ReviewAnchor {
  return { scope: "article", quote: "", prefix: "", suffix: "" };
}

export function reattachReviewComment(
  body: string,
  comment: ReviewComment,
  selection: SourceSelection,
): ReviewComment {
  if (comment.anchor.scope === "article" || comment.status !== "open")
    throw Error("対象を変更できません。");
  if ((comment.targetHistory?.length ?? 0) >= 20)
    throw Error("対象変更の履歴が上限に達しました。新しい指摘を追加してください。");
  return {
    ...comment,
    anchor: anchorSelection(body, selection),
    proposal: undefined,
    targetHistory: [
      ...(comment.targetHistory ?? []),
      {
        anchor: comment.anchor,
        ...(comment.proposal ? { proposal: comment.proposal } : {}),
        changedAt: new Date().toISOString(),
      },
    ],
  };
}

export function locateAnchor(body: string, anchor: ReviewAnchor): LocatedAnchor | null {
  if (anchor.scope === "article") return null;
  // A moved, otherwise unchanged block remains the strongest identity available in portable MDX.
  if (anchor.blockSource) {
    const blocks = occurrences(body, anchor.blockSource);
    const offset = anchor.offset;
    if (
      blocks.length === 1 &&
      offset !== undefined &&
      anchor.blockSource.slice(offset, offset + anchor.quote.length) === anchor.quote
    ) {
      const start = blocks[0]! + offset;
      return { start, end: start + anchor.quote.length };
    }
  }
  const candidates = occurrences(body, anchor.quote).filter((start) => {
    const before = body.slice(Math.max(0, start - anchor.prefix.length), start);
    const after = body.slice(
      start + anchor.quote.length,
      start + anchor.quote.length + anchor.suffix.length,
    );
    return before === anchor.prefix && after === anchor.suffix;
  });
  if (candidates.length !== 1) return null;
  return { start: candidates[0]!, end: candidates[0]! + anchor.quote.length };
}

export function applyReviewProposal(
  body: string,
  comment: ReviewComment,
): { body: string; comment: ReviewComment } {
  if (comment.anchor.scope === "article")
    throw Error("記事全体の指摘は本文を編集して確認し、解決してください。");
  if (comment.status === "applied") return { body, comment };
  const proposal = comment.proposal;
  if (!proposal || proposal.expected !== comment.anchor.quote)
    throw Error("修正案の対象が一致しません。");
  const target = locateAnchor(body, comment.anchor);
  if (!target || body.slice(target.start, target.end) !== proposal.expected) {
    throw Error("指摘後に対象が変更されています。原稿と修正案を確認してください。");
  }
  return {
    body: body.slice(0, target.start) + proposal.replacement + body.slice(target.end),
    comment: { ...comment, status: "applied" },
  };
}

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function validAnchor(a: unknown): a is ReviewAnchor {
  if (!record(a)) return false;
  if (a.scope === "article")
    return (
      a.quote === "" &&
      a.prefix === "" &&
      a.suffix === "" &&
      a.blockSource === undefined &&
      a.offset === undefined
    );
  return (
    a.scope === undefined &&
    text(a.quote, 200000) &&
    Boolean(a.quote) &&
    text(a.prefix, 64) &&
    text(a.suffix, 64) &&
    (a.blockSource === undefined || text(a.blockSource, 200000)) &&
    (a.offset === undefined || (Number.isSafeInteger(a.offset) && Number(a.offset) >= 0))
  );
}
function validProposal(p: unknown, a: ReviewAnchor): boolean {
  return (
    a.scope !== "article" &&
    record(p) &&
    text(p.id, 100) &&
    text(p.expected, 200000) &&
    p.expected === a.quote &&
    text(p.replacement, 200000) &&
    text(p.reason, 20000) &&
    text(p.receivedAt, 40)
  );
}
export function validateReviewComments(value: unknown, contentId?: string): ReviewComment[] {
  if (!Array.isArray(value) || value.length > 500) throw Error("REVIEW_DATA_INVALID");
  const ids = new Set<string>();
  for (const c of value) {
    if (
      !record(c) ||
      !text(c.id, 36) ||
      !uuid.test(c.id) ||
      ids.has(c.id) ||
      !text(c.contentId, 36) ||
      !uuid.test(c.contentId) ||
      (contentId && c.contentId !== contentId) ||
      !text(c.instruction, 20000) ||
      !text(c.createdAt, 40) ||
      !["open", "resolved", "applied", "rejected"].includes(String(c.status)) ||
      !record(c.anchor)
    )
      throw Error("REVIEW_DATA_INVALID");
    const a = c.anchor;
    if (
      !validAnchor(a) ||
      (a.scope === "article" && c.status === "applied") ||
      (c.proposal !== undefined && !validProposal(c.proposal, a))
    )
      throw Error("REVIEW_DATA_INVALID");
    if (c.targetHistory !== undefined) {
      if (
        !Array.isArray(c.targetHistory) ||
        c.targetHistory.length > 20 ||
        c.targetHistory.some(
          (h) =>
            !record(h) ||
            !validAnchor(h.anchor) ||
            h.anchor.scope === "article" ||
            !text(h.changedAt, 40) ||
            (h.proposal !== undefined && !validProposal(h.proposal, h.anchor)),
        )
      )
        throw Error("REVIEW_DATA_INVALID");
    }
    ids.add(c.id);
  }
  return value as ReviewComment[];
}

export function importReviewProposals(
  value: unknown,
  contentId: string,
  comments: ReviewComment[],
): ReviewComment[] {
  if (
    !record(value) ||
    value.version !== 1 ||
    value.contentId !== contentId ||
    !Array.isArray(value.proposals) ||
    value.proposals.length > 500
  )
    throw Error("別の原稿、または未対応の修正案です。");
  const next = structuredClone(comments);
  const seen = new Set<string>();
  for (const p of value.proposals) {
    if (
      !record(p) ||
      !text(p.commentId, 36) ||
      seen.has(p.commentId) ||
      !text(p.expected, 200000) ||
      !text(p.replacement, 200000) ||
      !text(p.reason, 20000)
    )
      throw Error("修正案の形式が不正です。");
    const comment = next.find((c) => c.id === p.commentId);
    if (!comment || comment.anchor.scope === "article" || p.expected !== comment.anchor.quote)
      throw Error("修正案に対応する指摘が見つかりません。");
    if (comment.status !== "applied")
      comment.proposal = {
        id: crypto.randomUUID(),
        expected: p.expected,
        replacement: p.replacement,
        reason: p.reason,
        receivedAt: new Date().toISOString(),
      };
    seen.add(p.commentId);
  }
  return validateReviewComments(next, contentId);
}
