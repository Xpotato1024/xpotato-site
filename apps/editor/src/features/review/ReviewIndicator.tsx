import { primaryReviewMark, reviewStateLabel, type LocatedReviewMark } from "./review-marks.js";

export function ReviewStatusIcon({ complete = false }: { complete?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
      focusable="false"
    >
      {complete ? (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m7.5 12 3 3 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M4 4h16v12H9l-5 4V4Z" strokeLinejoin="round" />
          <path d="M8 8h8M8 12h5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function ReviewIndicator({
  marks,
  activeCommentId,
  onSelect,
}: {
  marks: readonly LocatedReviewMark[];
  activeCommentId?: string | null | undefined;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const primary = primaryReviewMark(marks);
  if (!primary) return null;
  const current = marks.find((mark) => mark.id === activeCommentId);
  const label = reviewStateLabel(primary.state);
  return (
    <button
      type="button"
      className="cms-review-indicator"
      data-review-state={primary.state}
      aria-pressed={Boolean(current)}
      aria-label={label + "、添削" + marks.length + "件を確認"}
      title={marks.map((mark) => reviewStateLabel(mark.state)).join("・")}
      disabled={!onSelect}
      onClick={() => onSelect?.((current ?? primary).id)}
    >
      <ReviewStatusIcon complete={primary.state === "resolved" || primary.state === "applied"} />
      <span>
        {label}
        {marks.length > 1 ? " " + marks.length : ""}
      </span>
    </button>
  );
}
