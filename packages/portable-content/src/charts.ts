import {
  lineChartModulePropsSchema,
  lineChartSeriesSchema,
  type LineChartSeries,
} from "@xpotato/content-contracts/content";
import { fitChartSeries, type ChartFitResult } from "./chart-regression.js";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
const tickLabel = (value: number) =>
  value !== 0 && (Math.abs(value) >= 1e6 || Math.abs(value) < 0.001)
    ? Number(value.toPrecision(4)).toExponential()
    : value.toLocaleString("ja-JP", { maximumSignificantDigits: 4 });
const statistic = (value: number | null) =>
  value === null ? "算出なし" : String(Number(value.toPrecision(6)));

export function lineChartGeometry(
  series: LineChartSeries,
  additionalPoints: readonly { x: number; y: number }[] = [],
) {
  const width = 640,
    height = 380,
    left = 100,
    top = 26,
    right = 38,
    bottom = 70;
  const points = [...series.flatMap((item) => item.points), ...additionalPoints];
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
  const path = (points: readonly { x: number; y: number }[]) =>
    points
      .map(
        (point, index) => `${index ? "L" : "M"}${sx(point.x).toFixed(2)} ${sy(point.y).toFixed(2)}`,
      )
      .join(" ");
  // Close, large values need an explicit axis offset so distinct ticks remain distinct.
  const offset = ({ min, max }: { min: number; max: number }) =>
    Math.abs(min) > (max - min) * 10000 ? min : 0;
  return {
    width,
    height,
    left,
    top,
    right,
    bottom,
    path,
    xOffset: offset(x),
    yOffset: offset(y),
    xTicks: ticks(x).map((value) => ({ value, at: sx(value) })),
    yTicks: ticks(y).map((value) => ({ value, at: sy(value) })),
    series: series.map((item) => ({
      label: item.label,
      path: path(item.points),
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

/** Recompute from observations and settings; never trust saved, potentially stale coefficients. */
export function prepareLineChart(input: unknown) {
  const props = lineChartModulePropsSchema.parse(input);
  const data = lineChartSeriesSchema.parse(JSON.parse(props.series));
  const fits = data.map((item) => {
    if (!item.fit) return null;
    try {
      return fitChartSeries(item.points, item.fit);
    } catch (error) {
      throw new Error(
        `系列「${item.label}」: ${error instanceof Error ? error.message : "近似の設定を確認してください。"}`,
      );
    }
  });
  return { props, data, fits };
}

function fitDetails(label: string, fit: ChartFitResult): string {
  const normalization = fit.normalization
    ? `<dt>計算座標</dt><dd>z = ${fit.normalization.transform === "log" ? `ln(x / ${fit.normalization.offset})` : `(x − ${fit.normalization.offset < 0 ? `(${fit.normalization.offset})` : fit.normalization.offset})`} / ${fit.normalization.scale}</dd>`
    : "";
  const coefficients = fit.coefficients
    ? `<dt>計算に使った係数（丸めなし）</dt><dd><code>${escape(JSON.stringify(fit.coefficients))}</code></dd>`
    : "";
  return `<section class="article-line-chart__fit-result">
    <p><strong>${escape(label)}：${escape(fit.label)}</strong></p>
    <dl>
      ${fit.equation ? `<dt>近似式（表示桁数を丸めています）</dt><dd><code>${escape(fit.equation)}</code></dd>` : ""}
      ${normalization}${coefficients}
      <dt>使用した点数</dt><dd>${fit.sampleCount}点（この系列の全測定点）</dd>
      <dt>計算・表示のX範囲</dt><dd>${fit.domain[0]} ～ ${fit.domain[1]}（外挿なし）</dd>
      ${fit.method !== "loess" ? `<dt>R²（元のYで算出）</dt><dd>${fit.rSquared === null ? "算出できません（Yが一定）" : statistic(fit.rSquared)}</dd><dt>RMSE（Yと同じ単位）</dt><dd>${statistic(fit.rmse)}</dd>` : ""}
    </dl><p>${escape(fit.note)}</p>
  </section>`;
}

/** A single escaped, static renderer shared by Astro, the canvas and the preview iframe. */
export function renderLineChart(input: unknown): string {
  const { props, data, fits } = prepareLineChart(input);
  const plot = lineChartGeometry(
    data,
    fits.flatMap((fit) => fit?.points ?? []),
  );
  const kind = props.kind ?? "line";
  const grid = plot.yTicks
    .map(
      (tick) =>
        `<g><line class="article-line-chart__grid" x1="${plot.left}" y1="${tick.at}" x2="${plot.width - plot.right}" y2="${tick.at}"/><text class="article-line-chart__tick" x="${plot.left - 10}" y="${tick.at + 5}" text-anchor="end">${tickLabel(tick.value - plot.yOffset)}</text></g>`,
    )
    .join("");
  const ticks = plot.xTicks
    .map(
      (tick) =>
        `<text class="article-line-chart__tick" x="${tick.at}" y="${plot.height - plot.bottom + 28}" text-anchor="middle">${tickLabel(tick.value - plot.xOffset)}</text>`,
    )
    .join("");
  const curves = plot.series
    .map((item, index) => {
      const fit = fits[index];
      const curve = data[index]!.role === "curve";
      const connected = curve || (kind === "line" && !fit);
      return `<g class="article-line-chart__series--${index + 1}" data-role="${curve ? "curve" : "observed"}">${connected ? `<path class="article-line-chart__line${curve ? " article-line-chart__external-curve" : ""}" d="${item.path}"/>` : ""}${fit ? `<path class="article-line-chart__line article-line-chart__fit" d="${plot.path(fit.points)}"/>` : ""}${curve ? "" : item.points.map((point) => marker(index, point.cx, point.cy, `${item.label}: ${props.xLabel} ${point.x}, ${props.yLabel} ${point.y}`)).join("")}</g>`;
    })
    .join("");
  const legend = plot.series
    .map((item, index) => {
      const fit = fits[index];
      const curve = data[index]!.role === "curve";
      const connected = curve || (kind === "line" && !fit);
      const itemClass = `article-line-chart__legend-item article-line-chart__series--${index + 1}`;
      const observed = `<li class="${itemClass}"><svg viewBox="0 0 24 14" aria-hidden="true">${connected ? '<path class="article-line-chart__line" d="M1 7H23"/>' : ""}${curve ? "" : marker(index, 12, 7)}</svg>${escape(item.label)}${curve ? "（計算済み曲線）" : fit || kind === "analysis" ? "（測定値）" : ""}</li>`;
      return (
        observed +
        (fit
          ? `<li class="${itemClass}"><svg viewBox="0 0 24 14" aria-hidden="true"><path class="article-line-chart__line article-line-chart__fit" d="M1 7H23"/></svg>${escape(item.label)}：${escape(fit.label)}</li>`
          : "")
      );
    })
    .join("");
  const rows = data
    .flatMap((item) =>
      item.points.map(
        (point) =>
          `<tr><th scope="row">${escape(item.label)}${item.role === "curve" ? "（計算済み曲線）" : ""}</th><td>${point.x}</td><td>${point.y}</td></tr>`,
      ),
    )
    .join("");
  const details = fits
    .map((fit, index) => (fit ? fitDetails(data[index]!.label, fit) : ""))
    .join("");
  const axisOffset = [
    plot.xOffset ? `横軸の目盛りは${plot.xOffset}からの差です。` : "",
    plot.yOffset ? `縦軸の目盛りは${plot.yOffset}からの差です。` : "",
  ].join("");
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
    ${axisOffset ? `<p class="article-line-chart__axis-note">${axisOffset}データ表には元の値を表示します。</p>` : ""}
    <ul class="article-line-chart__legend" aria-label="系列">${legend}</ul>
    ${details ? `<details class="article-line-chart__data article-line-chart__analysis"><summary class="disclosure-summary">近似式・計算条件を見る</summary>${details}</details>` : ""}
    <details class="article-line-chart__data"><summary class="disclosure-summary">データ表を見る</summary><div class="article-line-chart__table"><table><caption>${escape(props.title)}のデータ</caption><thead><tr><th scope="col">系列</th><th scope="col">${escape(props.xLabel)}</th><th scope="col">${escape(props.yLabel)}</th></tr></thead><tbody>${rows}</tbody></table></div></details>
  </figure>`;
}
