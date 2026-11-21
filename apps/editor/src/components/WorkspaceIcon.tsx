const paths = {
  back: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
  close: "M6 6l12 12 M18 6 6 18",
  plus: "M12 4v16 M4 12h16",
  up: "M12 20V4 m-6 6 6-6 6 6",
  down: "M12 4v16 m-6-6 6 6 6-6",
  external: "M14 3h7v7 M21 3 10 14 M11 5H3v16h16v-8",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  undo: "M9 5 4 10l5 5 M4 10h10a6 6 0 0 1 0 12",
  redo: "M15 5l5 5-5 5 M20 10H10a6 6 0 0 0 0 12",
  split: "M3 4h18v16H3z M12 4v16",
  desktop: "M3 4h18v13H3z M8 21h8 M12 17v4",
  tablet: "M5 2h14v20H5z M11 18h2",
  phone: "M7 2h10v20H7z M11 18h2",
  blocks: "M4 3h16v5H4z M4 11h7v10H4z M14 11h6v10h-6z",
  preview: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  code: "M8 5 2 12l6 7 M16 5l6 7-6 7 M14 3l-4 18",
  home: "M3 10 12 3l9 7 M5 9v12h14V9 M9 21v-8h6v8",
  new: "M4 3h11l5 5v13H4z M14 3v6h6 M8 14h8 M12 10v8",
  revise: "M4 3h9 M4 3v18h16v-8 M9 15l1-4L19 2l3 3-9 9-4 1",
  branch:
    "M6 3v14a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M18 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M18 9v2a5 5 0 0 1-5 5H6",
  tags: "M3 3h8l10 10-8 8L3 11z M7 7h.01",
  outline: "M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01",
  media: "M3 4h18v16H3z M3 16l5-5 4 4 3-3 6 6 M15 8h.01",
  review: "M4 3h16v14H9l-5 4z M8 7h8 M8 11h5",
  library: "M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5",
  metadata: "M4 6h16 M4 12h16 M4 18h16 M9 3v6 M15 9v6 M8 15v6",
  series: "M9 5h12 M9 12h12 M9 19h12 M3 3v4 M2 7h3 M2 11h3l-3 3h3 M2 17h3v4H2",
  history: "M3 12a9 9 0 1 0 3-7 M3 3v5h5 M12 7v5l3 2",
  workflow: "M4 3h13l3 3v15H4z M8 3v6h8V3 M8 21v-8h8v8",
  refresh: "M20 7v5h-5 M4 17v-5h5 M5.5 9A7 7 0 0 1 18 6l2 1 M18.5 15A7 7 0 0 1 6 18l-2-1",
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
