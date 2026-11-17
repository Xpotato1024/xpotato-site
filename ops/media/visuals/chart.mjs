import * as vega from "vega";
import * as lite from "vega-lite";
import { chartInput } from "./inputs.mjs";
import { staticSvg } from "./svg.mjs";
import { outlineChartText } from "./fonts.mjs";
const escape = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export async function renderChart(source, theme) {
  const metadata = chartInput(source),
    encoding = structuredClone(metadata.encoding);
  for (const axis of ["x", "y"]) {
    encoding[axis].axis = {
      labelAngle: axis === "x" && metadata.mark === "bar" ? -45 : 0,
      tickCount: 4,
      labelLimit: 100,
      titleLimit: 280,
    };
    if (encoding[axis].type === "quantitative") {
      const specified = encoding[axis].scale?.domain;
      const values = metadata.data.values.map((row) => row[encoding[axis].field]);
      const allZero = values.every((value) => value === 0);
      encoding[axis].scale = {
        ...(specified ? { domain: specified } : allZero ? { domain: [0, 1] } : {}),
        zero: metadata.mark === "bar" || !specified,
        nice: !specified,
      };
    }
  }
  const spec = {
    ...structuredClone(metadata),
    title: undefined,
    width: 220,
    height: 230,
    encoding,
    mark: {
      type: metadata.mark,
      color: theme.accent,
      ...(metadata.mark === "point" ? { filled: true, size: 90 } : {}),
    },
    config: {
      font: theme.font,
      background: theme.background,
      view: { stroke: null },
      axis: {
        labelFontSize: theme.fontSize,
        titleFontSize: theme.fontSize,
        titleFontWeight: 500,
        labelColor: theme.foreground,
        titleColor: theme.foreground,
        gridColor: theme.grid,
        domainColor: theme.muted,
        tickColor: theme.muted,
        titlePadding: 14,
        labelPadding: 6,
      },
    },
  };
  const warnings = [];
  const compiled = lite.compile(spec, {
    logger: {
      level: () => 0,
      warn: (...args) => warnings.push(args.join(" ")),
      info: () => {},
      debug: () => {},
      error: (...args) => {
        throw Error(args.join(" "));
      },
    },
  });
  if (warnings.length) throw Error("Vega-Lite warning: " + warnings.join("; "));
  const loader = vega.loader();
  loader.load = async () => {
    throw Error("Vega external load forbidden");
  };
  loader.sanitize = async () => {
    throw Error("Vega external reference forbidden");
  };
  const view = new vega.View(vega.parse(compiled.spec), { renderer: "none", loader });
  let raw;
  try {
    await view.runAsync();
    raw = await view.toSVG();
  } finally {
    view.finalize();
  }
  // Vega emits presentation attributes, so no browser or CSS evaluation is needed.
  // Root accessibility describes the whole graphic; the visible heading belongs to Figure.
  raw = raw.replace(
    /<svg\b([^>]*)>/u,
    (_, attrs) =>
      "<svg" +
      attrs.replace(/\s(?:role|aria-label|aria-labelledby)="[^"]*"/gu, "") +
      ' role="img" aria-labelledby="technical-title technical-description"><title id="technical-title">' +
      escape(metadata.title) +
      '</title><desc id="technical-description">' +
      escape(metadata.description) +
      "</desc>",
  );
  const outlined = outlineChartText(raw),
    checked = staticSvg(outlined.svg);
  return {
    ...checked,
    metadata,
    tools: { vega: vega.version, vegaLite: lite.version, fontBinding: outlined.fontBinding },
  };
}
