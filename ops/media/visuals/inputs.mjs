export const limits = Object.freeze({
  inputBytes: 65536,
  nodes: 40,
  edges: 80,
  rows: 500,
  svgBytes: 2 * 1024 * 1024,
  svgNodes: 12000,
  dimension: 4096,
  pixels: 12 * 1024 * 1024,
  timeoutMs: 45000,
});
const fail = (message) => {
  throw Error(message);
};
const text = (value, min, max) =>
  typeof value === "string" &&
  value.trim().length >= min &&
  value.length <= max &&
  !/[<>\u0000-\u001f\u007f]/u.test(value) &&
  !/(?:https?:|file:|data:|javascript:|\/\/|\\)/iu.test(value);
const keys = (value, allowed) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    fail("Unsupported specification property");
};

/** Deliberately bounded Mermaid flowchart grammar; Mermaid performs the actual layout. */
export function mermaidInput(source) {
  if (
    new TextEncoder().encode(source).byteLength > limits.inputBytes ||
    /[<{}\x60;\\]|%%|https?:|file:|data:|javascript:|\/\//iu.test(source)
  )
    fail("Unsafe or oversized Mermaid source");
  const lines = source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!/^flowchart (?:TB|TD|LR|RL|BT)$/u.test(lines.shift() ?? ""))
    fail("Only flowchart TB/TD/LR/RL/BT is supported");
  const nodes = new Map(),
    edges = [];
  let title, description;
  for (const line of lines) {
    let match;
    if ((match = /^accTitle: (.+)$/u.exec(line))) {
      if (title) fail("Duplicate accessible title");
      title = match[1];
    } else if ((match = /^accDescr: (.+)$/u.exec(line))) {
      if (description) fail("Duplicate description");
      description = match[1];
    } else if ((match = /^([A-Za-z][A-Za-z0-9_]{0,31})\["([^"\[\]|]+)"\]$/u.exec(line))) {
      if (nodes.has(match[1]) || !text(match[2], 1, 48)) fail("Invalid or duplicate node");
      nodes.set(match[1], match[2]);
    } else if (
      (match =
        /^([A-Za-z][A-Za-z0-9_]{0,31}) -->(?:\|([^|]+)\|)? ([A-Za-z][A-Za-z0-9_]{0,31})$/u.exec(
          line,
        ))
    ) {
      if (match[2] && !text(match[2], 1, 32)) fail("Invalid edge label");
      edges.push({ from: match[1], to: match[3], label: match[2] ?? "" });
    } else
      fail(
        "Unsupported Mermaid statement (no directives, actions, HTML, classes or configuration)",
      );
  }
  if (!text(title, 4, 120) || !text(description, 16, 1000) || title === description)
    fail("Useful accTitle and accDescr are required");
  if (nodes.size < 2 || !edges.length || nodes.size > limits.nodes || edges.length > limits.edges)
    fail("Mermaid graph budget exceeded or graph is empty");
  if (edges.some((edge) => !nodes.has(edge.from) || !nodes.has(edge.to)))
    fail("Declare every referenced node");
  return { title, description, nodes: [...nodes].map(([id, label]) => ({ id, label })), edges };
}

/** A small real Vega-Lite single-view subset, not arbitrary Vega expressions. */
export function chartInput(source) {
  if (Buffer.byteLength(source) > limits.inputBytes) fail("Chart input budget exceeded");
  const spec = JSON.parse(source);
  keys(spec, ["title", "description", "data", "mark", "encoding"]);
  if (!text(spec.title, 4, 120) || !text(spec.description, 16, 1000))
    fail("Useful chart title and description are required");
  if (!["line", "point", "bar"].includes(spec.mark))
    fail("Only line, point (scatter), bar are supported");
  keys(spec.data, ["values"]);
  const rows = spec.data.values;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > limits.rows)
    fail("Chart requires 1–500 inline rows");
  keys(spec.encoding, ["x", "y"]);
  const fields = [];
  for (const axis of ["x", "y"]) {
    const encoding = spec.encoding[axis];
    keys(encoding, ["field", "type", "title", "scale"]);
    if (
      !/^[A-Za-z][A-Za-z0-9_]{0,31}$/u.test(encoding.field) ||
      !text(encoding.title, 3, 80) ||
      !/[（(][^()（）]+[）)]/u.test(encoding.title)
    )
      fail("Each axis needs a field and explicit unit in parentheses (including category)");
    const expected = axis === "x" && spec.mark === "bar" ? "nominal" : "quantitative";
    if (encoding.type !== expected) fail("Bar x must be nominal; other axes must be quantitative");
    if (encoding.scale !== undefined) {
      keys(encoding.scale, ["domain"]);
      const domain = encoding.scale.domain;
      if (
        expected !== "quantitative" ||
        !Array.isArray(domain) ||
        domain.length !== 2 ||
        !domain.every(Number.isFinite) ||
        domain[0] >= domain[1] ||
        (spec.mark === "bar" && domain[0] > 0)
      )
        fail("Invalid or misleading domain");
    }
    fields.push(encoding.field);
  }
  if (fields[0] === fields[1]) fail("Axes must use distinct fields");
  for (const row of rows) {
    keys(row, fields);
    for (const axis of ["x", "y"]) {
      const encoding = spec.encoding[axis],
        value = row[encoding.field];
      if (
        encoding.type === "quantitative"
          ? !Number.isFinite(value) || Math.abs(value) > 1e12
          : !text(value, 1, 32)
      )
        fail("Missing, nonfinite or invalid chart value");
      const domain = encoding.scale?.domain;
      if (domain && (value < domain[0] || value > domain[1])) fail("Domain clips observed data");
    }
  }
  if (spec.mark !== "bar" && rows.length < 2) fail("Line/scatter needs at least two observations");
  if (spec.mark !== "point" && new Set(rows.map((row) => row[fields[0]])).size !== rows.length)
    fail("Duplicate x/category requires explicit prior aggregation");
  if (
    spec.mark === "line" &&
    rows.some((row, i) => i > 0 && row[fields[0]] <= rows[i - 1][fields[0]])
  )
    fail("Line x must be strictly increasing");
  if (spec.mark === "bar" && spec.encoding.y.scale?.domain && spec.encoding.y.scale.domain[1] < 0)
    fail("Bar domain must contain zero");
  return spec;
}

export function readableData(spec) {
  const axes = [spec.encoding.x, spec.encoding.y];
  const quote = (value) => '"' + String(value).replaceAll('"', '""') + '"';
  // Prefix spreadsheet formula metacharacters in the human CSV; JSON retains exact data.
  const csvCell = (value) =>
    quote(typeof value === "string" && /^[=+@\-\t\r]/u.test(value) ? "'" + value : value);
  const csv =
    [
      axes.map((a) => csvCell(a.title)).join(","),
      ...spec.data.values.map((row) => axes.map((a) => csvCell(row[a.field])).join(",")),
    ].join("\r\n") + "\r\n";
  const cell = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
  const markdown =
    [
      spec.description,
      "",
      "| " + axes.map((a) => cell(a.title)).join(" | ") + " |",
      "| --- | --- |",
      ...spec.data.values.map(
        (row) => "| " + axes.map((a) => cell(row[a.field])).join(" | ") + " |",
      ),
    ].join("\n") + "\n";
  return { csv, markdown };
}
