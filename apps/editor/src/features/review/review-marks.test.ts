import { describe, expect, it } from "vitest";
import {
  anchorSelection,
  applyReviewProposal,
  type ReviewComment,
} from "@xpotato/editor-core/annotations";
import {
  locateReviewMarks,
  reviewMarkersForRegion,
  splitReviewText,
  type LocatedReviewMark,
} from "./review-marks.js";

function comment(body: string, quote: string): ReviewComment {
  const start = body.indexOf(quote);
  return {
    id: "22222222-2222-4222-8222-222222222222",
    contentId: "11111111-1111-4111-8111-111111111111",
    instruction: "条件を補う",
    createdAt: "2026-11-19T00:00:00Z",
    status: "open",
    anchor: anchorSelection(body, { quote, start, end: start + quote.length }),
  };
}

describe("review display locations", () => {
  it("marks unresolved, proposed and resolved comments without changing their source anchor", () => {
    const body = "先頭。強度が上がる。末尾。";
    const original = comment(body, "強度が上がる");
    const proposed: ReviewComment = {
      ...original,
      proposal: {
        id: "p",
        expected: original.anchor.quote,
        replacement: "条件による",
        reason: "",
        receivedAt: "",
      },
    };
    const before = JSON.stringify(proposed);
    expect(locateReviewMarks(body, [original])[0]?.state).toBe("open");
    expect(locateReviewMarks(body, [proposed])[0]?.state).toBe("proposal");
    expect(locateReviewMarks(body, [{ ...original, status: "resolved" }])[0]?.state).toBe(
      "resolved",
    );
    const applied = applyReviewProposal(body, proposed);
    const marks = locateReviewMarks(applied.body, [applied.comment]);
    expect(marks[0]?.state).toBe("applied");
    expect(applied.body.slice(marks[0]!.start, marks[0]!.end)).toBe("条件による");
    expect(JSON.stringify(proposed)).toBe(before);
  });

  it("does not mark deleted, stale or ambiguous anchors at another occurrence", () => {
    const original = comment("左。同じ文。右。", "同じ文");
    expect(locateReviewMarks("新しい左。同じ文。別の右。同じ文。", [original])).toEqual([]);
    const applied: ReviewComment = {
      ...original,
      status: "applied",
      proposal: {
        id: "p",
        expected: original.anchor.quote,
        replacement: "",
        reason: "",
        receivedAt: "",
      },
    };
    expect(locateReviewMarks("左。。右。", [applied])).toEqual([]);
    const ambiguous: ReviewComment = {
      ...original,
      anchor: { quote: "同じ文", prefix: "", suffix: "" },
    };
    expect(locateReviewMarks("同じ文。同じ文。", [ambiguous])).toEqual([]);
  });

  it("places a nested comment badge only on its smallest region, while a group annotation stays on the group", () => {
    const marks: LocatedReviewMark[] = [
      { id: "group", start: 0, end: 45, state: "open" },
      { id: "paragraph", start: 18, end: 23, state: "proposal" },
    ];
    const group = { start: 0, end: 45 };
    const heading = { start: 9, end: 15 };
    const paragraph = { start: 17, end: 32 };
    expect(
      reviewMarkersForRegion(marks, group, [heading, paragraph]).map((mark) => mark.id),
    ).toEqual(["group"]);
    expect(reviewMarkersForRegion(marks, heading)).toEqual([]);
    expect(reviewMarkersForRegion(marks, paragraph).map((mark) => mark.id)).toEqual(["paragraph"]);
  });

  it("splits overlapping source ranges without adding text or losing offsets across regions", () => {
    const text = "あいうえお";
    const marks: LocatedReviewMark[] = [
      { id: "a", start: 8, end: 13, state: "open" },
      { id: "b", start: 12, end: 17, state: "resolved" },
    ];
    const segments = splitReviewText(text, 10, marks);
    expect(segments.map((segment) => segment.text).join("")).toBe(text);
    expect(segments.map((segment) => [segment.text, segment.marks.map((mark) => mark.id)])).toEqual(
      [
        ["あい", ["a"]],
        ["う", ["a", "b"]],
        ["えお", ["b"]],
      ],
    );
  });
});
