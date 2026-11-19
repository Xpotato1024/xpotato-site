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
  onSelect?: ((id: string, trigger: HTMLButtonElement) => void) | undefined;
}) {
  const primary = primaryReviewMark(marks);
  if (!primary) return null;
  const current = marks.find((mark) => mark.id === activeCommentId);
  const target = current ?? primary;
  const label = reviewStateLabel(target.state);
  return (
    <button
      type="button"
      className="cms-review-indicator"
      data-review-state={target.state}
      aria-pressed={Boolean(current)}
      aria-controls="workspace-panel"
      aria-label={
        label + "、この箇所を添削" + (marks.length > 1 ? "、指摘" + marks.length + "件" : "")
      }
      title="この箇所を添削"
      disabled={!onSelect}
      onClick={(event) => onSelect?.(target.id, event.currentTarget)}
    >
      <ReviewStatusIcon complete={target.state === "resolved" || target.state === "applied"} />
      <span>
        {label}
        {marks.length > 1 ? " " + marks.length : ""}
      </span>
      <svg
        className="cms-review-action-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="m15 5 4 4M5 15l10-10a2.8 2.8 0 0 1 4 4L9 19l-5 1 1-5Z" />
      </svg>
    </button>
  );
}
