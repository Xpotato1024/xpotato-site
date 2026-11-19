import {
  lineChartModulePropsSchema,
  lineChartSeriesSchema,
  type LineChartSeries,
} from "@xpotato/content-contracts/content";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
const tickLabel = (value: number) => value.toLocaleString("ja-JP", { maximumSignificantDigits: 4 });

export function lineChartGeometry(series: LineChartSeries) {
  const width = 640,
    height = 380,
    left = 100,
    top = 26,
    right = 38,
    bottom = 70;
  const points = series.flatMap((item) => item.points);
  const extent = (axis: "x" | "y") => {
    let min = Math.min(...points.map((point) => point[axis]));
    let max = Math.max(...points.map((point) => point[axis]));
    if (min === max) {
      const margin = Math.max(1, Math.abs(min) * 0.1);
      min -= margin;
      max += margin;
    }
    return { min, max };
  };
  const x = extent("x"),
    y = extent("y");
  const sx = (value: number) => left + ((value - x.min) / (x.max - x.min)) * (width - left - right);
  const sy = (value: number) =>
    height - bottom - ((value - y.min) / (y.max - y.min)) * (height - top - bottom);
  const ticks = ({ min, max }: { min: number; max: number }) =>
    Array.from({ length: 5 }, (_, index) => min + (max - min) * (index / 4));
  return {
    width,
    height,
    left,
    top,
    right,
    bottom,
    xTicks: ticks(x).map((value) => ({ value, at: sx(value) })),
    yTicks: ticks(y).map((value) => ({ value, at: sy(value) })),
    series: series.map((item) => ({
      label: item.label,
      path: item.points
        .map(
          (point, index) =>
            `${index ? "L" : "M"}${sx(point.x).toFixed(2)} ${sy(point.y).toFixed(2)}`,
        )
        .join(" "),
      points: item.points.map((point) => ({ ...point, cx: sx(point.x), cy: sy(point.y) })),
    })),
  };
}

const shapes = ["circle", "square", "triangle", "diamond", "cross", "plus"] as const;
function marker(index: number, x: number, y: number, title = "") {
  const label = title ? `<title>${escape(title)}</title>` : "";
  const common = 'class="article-line-chart__point"';
  switch (shapes[index % shapes.length]) {
    case "square":
      return `<rect ${common} x="${x - 4}" y="${y - 4}" width="8" height="8">${label}</rect>`;
    case "triangle":
      return `<path ${common} d="M${x} ${y - 5}l5 9h-10Z">${label}</path>`;
    case "diamond":
      return `<path ${common} d="M${x} ${y - 5}l5 5 -5 5 -5 -5Z">${label}</path>`;
    case "cross":
      return `<path ${common} d="M${x - 4} ${y - 4}l8 8m-8 0l8 -8">${label}</path>`;
    case "plus":
      return `<path ${common} d="M${x} ${y - 5}v10m-5 -5h10">${label}</path>`;
    default:
      return `<circle ${common} cx="${x}" cy="${y}" r="4">${label}</circle>`;
  }
}

/** A single escaped, static renderer shared by Astro, the canvas and the preview iframe. */
export function renderLineChart(input: unknown): string {
  const props = lineChartModulePropsSchema.parse(input);
  const data = lineChartSeriesSchema.parse(JSON.parse(props.series));
  const plot = lineChartGeometry(data);
  const kind = props.kind ?? "line";
  const grid = plot.yTicks
    .map(
      (tick) =>
        `<g><line class="article-line-chart__grid" x1="${plot.left}" y1="${tick.at}" x2="${plot.width - plot.right}" y2="${tick.at}"/><text class="article-line-chart__tick" x="${plot.left - 10}" y="${tick.at + 5}" text-anchor="end">${tickLabel(tick.value)}</text></g>`,
    )
    .join("");
  const ticks = plot.xTicks
    .map(
      (tick) =>
        `<text class="article-line-chart__tick" x="${tick.at}" y="${plot.height - plot.bottom + 28}" text-anchor="middle">${tickLabel(tick.value)}</text>`,
    )
    .join("");
  const curves = plot.series
    .map(
      (item, index) =>
        `<g class="article-line-chart__series--${index + 1}">${kind === "line" ? `<path class="article-line-chart__line" d="${item.path}"/>` : ""}${item.points.map((point) => marker(index, point.cx, point.cy, `${item.label}: ${props.xLabel} ${point.x}, ${props.yLabel} ${point.y}`)).join("")}</g>`,
    )
    .join("");
  const legend = plot.series
    .map(
      (item, index) =>
        `<li class="article-line-chart__legend-item article-line-chart__series--${index + 1}"><svg viewBox="0 0 24 14" aria-hidden="true">${kind === "line" ? '<path class="article-line-chart__line" d="M1 7H23"/>' : ""}${marker(index, 12, 7)}</svg>${escape(item.label)}</li>`,
    )
    .join("");
  const rows = data
    .flatMap((item) =>
      item.points.map(
        (point) =>
          `<tr><th scope="row">${escape(item.label)}</th><td>${point.x}</td><td>${point.y}</td></tr>`,
      ),
    )
    .join("");
  return `<figure class="article-line-chart" data-kind="${kind}">
    <figcaption class="article-line-chart__title">${escape(props.title)}</figcaption>
    ${props.description ? `<p class="article-line-chart__description">${escape(props.description)}</p>` : ""}
    <div class="article-line-chart__viewport" tabindex="0" role="region" aria-label="${escape(props.title)}のグラフ">
      <svg class="article-line-chart__plot" viewBox="0 0 ${plot.width} ${plot.height}" role="img" aria-label="${escape(props.title)}。横軸${escape(props.xLabel)}、縦軸${escape(props.yLabel)}。各点の値は後のデータ表でも確認できます。">
        ${grid}${ticks}<path class="article-line-chart__axis" d="M${plot.left} ${plot.top}V${plot.height - plot.bottom}H${plot.width - plot.right}"/>${curves}
        <text class="article-line-chart__axis-title" x="${plot.width / 2}" y="${plot.height - 8}" text-anchor="middle">${escape(props.xLabel)}</text>
        <text class="article-line-chart__axis-title" transform="translate(20 ${plot.height / 2}) rotate(-90)" text-anchor="middle">${escape(props.yLabel)}</text>
      </svg>
    </div>
    <ul class="article-line-chart__legend" aria-label="系列">${legend}</ul>
    <details class="article-line-chart__data"><summary class="disclosure-summary">データ表を見る</summary><div class="article-line-chart__table"><table><caption>${escape(props.title)}のデータ</caption><thead><tr><th scope="col">系列</th><th scope="col">${escape(props.xLabel)}</th><th scope="col">${escape(props.yLabel)}</th></tr></thead><tbody>${rows}</tbody></table></div></details>
  </figure>`;
}
