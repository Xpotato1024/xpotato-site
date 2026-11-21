const paths: Record<string, string> = {
  paragraph: "M13 4H9a4 4 0 0 0 0 8h4 M13 4v16 M18 4v16 M11 4h9",
  heading: "M5 4v16 M17 4v16 M5 12h12",
  list: "M9 5h12 M9 12h12 M9 19h12 M3 5h.01 M3 12h.01 M3 19h.01",
  orderedList: "M10 5h11 M10 12h11 M10 19h11 M3 3h1v4 M2 7h4 M2 11h4l-4 4h4 M2 18h4v4H2",
  quote: "M9 6H3v6h6V6Z M3 12v2a4 4 0 0 0 4 4 M21 6h-6v6h6V6Z M15 12v2a4 4 0 0 0 4 4",
  divider: "M3 12h18",
  Figure: "M3 4h18v16H3Z M3 16l5-5 4 4 3-3 6 6 M15 8h.01",
  Gallery: "M3 3h7v7H3Z M14 3h7v7h-7Z M3 14h7v7H3Z M14 14h7v7h-7Z",
  table: "M3 4h18v16H3Z M3 10h18 M10 4v16",
  BarChart: "M3 3v18h18 M7 16v-5 M12 16V7 M17 16V4",
  LineChart: "M3 3v18h18 M5 17l5-6 4 3 6-9 M10 11h.01 M14 14h.01 M20 5h.01",
  ComparisonCase: "M4 4h16v16H4Z M8 8h8 M8 12h8 M8 16h5",
  code: "m8 6-6 6 6 6 M16 6l6 6-6 6 M14 4l-4 16",
  math: "M19 4H5l8 8-8 8h14",
  mermaid: "M12 3v5 M12 8 5 14 M12 8l7 6 M5 14v7h7v-7H5z M15 14h7v7h-7z M9 3h6v5H9z",
  Group: "M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5 M7 8h10 M7 12h10 M7 16h6",
  Callout: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 10v7 M12 7h.01",
  Steps: "M3 3h5v5H3Z M3 16h5v5H3Z M5.5 8v8 M12 5h9 M12 18h9",
  Step: "M3 3h5v5H3Z M12 5h9 M3 13h18 M3 19h13",
  Comparison: "M3 4h7v16H3Z M14 4h7v16h-7Z",
  Details: "m3 6 3 3 3-3 M13 6h8 M4 14h17 M4 20h12",
  LinkCard: "M14 3h7v7 M21 3 10 14 M11 5H3v16h16v-8",
  DiagnosticList: "m3 5 2 2 4-4 M12 5h9 M3 12h6 M12 12h9 M3 19h6 M12 19h9",
  DiagnosticItem: "M4 3h16v18H4Z m8 5 3 3 5-5 M8 15h8 M8 18h5",
  ArticleEndnote: "M4 3h16v18H4Z M8 7h8 M8 11h8 M8 16h4",
  Demo: "m8 4 12 8-12 8V4Z",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  grip: "M9 5h.01 M15 5h.01 M9 12h.01 M15 12h.01 M9 19h.01 M15 19h.01",
  up: "M12 20V4 m-6 6 6-6 6 6",
  down: "M12 4v16 m-6-6 6 6 6-6",
  copy: "M8 8h12v12H8Z M16 8V4H4v12h4",
  remove: "M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7",
  plus: "M12 4v16 M4 12h16",
  close: "m5 5 14 14 M5 19 19 5",
  check: "m5 12 4 4L19 6",
  indent: "M10 5h11 M10 12h11 M10 19h11 M3 9l3 3-3 3",
  outdent: "M10 5h11 M10 12h11 M10 19h11 M6 9l-3 3 3 3",
};

export function BlockIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "grip" || name === "more" ? 3 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name] ?? paths.paragraph} />
    </svg>
  );
}
