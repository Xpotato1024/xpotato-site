const paths = {
  back: "M15 5l-7 7 7 7",
  close: "M6 6l12 12 M18 6 6 18",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  undo: "M9 5 4 10l5 5 M4 10h10a6 6 0 0 1 0 12",
  redo: "M15 5l5 5-5 5 M20 10H10a6 6 0 0 0 0 12",
  split: "M3 4h18v16H3z M12 4v16",
  outline: "M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01",
  media: "M3 4h18v16H3z M3 16l5-5 4 4 3-3 6 6 M15 8h.01",
  review: "M4 3h16v14H9l-5 4z M8 7h8 M8 11h5",
  library: "M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5",
  metadata: "M4 6h16 M4 12h16 M4 18h16 M9 3v6 M15 9v6 M8 15v6",
  series: "M9 5h12 M9 12h12 M9 19h12 M3 3v4 M2 7h3 M2 11h3l-3 3h3 M2 17h3v4H2",
  history: "M3 12a9 9 0 1 0 3-7 M3 3v5h5 M12 7v5l3 2",
  workflow: "M4 3h13l3 3v15H4z M8 3v6h8V3 M8 21v-8h8v8",
} as const;

export function WorkspaceIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
