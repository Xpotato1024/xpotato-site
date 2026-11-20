import {
  lineChartModulePropsSchema,
  lineChartSeriesSchema,
} from "@xpotato/content-contracts/content";
import { fitChartSeries, type ChartFitResult } from "./chart-regression.js";
import { buildChartFormula } from "./chart-formula.js";
import { fitChartTex, formulaChartTex, renderChartMath } from "./chart-math.js";

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

type Point = { x: number; y: number };
type Axis = "x" | "y";
type Extent = { min: number; max: number };
type AxisSettings = Partial<Record<`${Axis}${"Min" | "Max" | "Padding"}`, string | undefined>>;

function axisValue(value: string | undefined, axis: Axis, padding = false) {
  if (value === undefined) {
    return undefined;
  }
  const label = axis === "x" ? "横軸" : "縦軸";
  const parsed = Number(value);
  if (
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(value.trim()) ||
    !Number.isFinite(parsed) ||
    Math.abs(parsed) > 1e12 ||
    (parsed === 0 && /[1-9]/u.test(value.split(/[eE]/u)[0]!)) ||
    (padding && (parsed < 0 || parsed > 100))
  ) {
    throw new Error(
      padding
        ? `${label}の余白は0〜100%で指定してください。`
        : `${label}の表示範囲は、絶対値が1兆以下の数値で指定してください。`,
    );
  }
  return parsed;
}

function axisExtent(points: readonly Point[], axis: Axis, settings: AxisSettings) {
  const values = points.map((point) => point[axis]);
  const raw = { min: Math.min(...values), max: Math.max(...values) };
  if (!Number.isFinite(raw.min) || !Number.isFinite(raw.max)) {
    throw new Error("グラフには有限の数値を持つ点が必要です。");
  }
  const fixedMin = axisValue(settings[`${axis}Min`], axis);
  const fixedMax = axisValue(settings[`${axis}Max`], axis);
  const padding = axisValue(settings[`${axis}Padding`], axis, true) ?? 5;
  let baseMin = raw.min;
  let baseMax = raw.max;
  if (baseMin === baseMax) {
    const margin = Math.max(baseMin === 0 ? 1 : Math.abs(baseMin) * 0.1, Number.MIN_VALUE * 8);
    baseMin -= margin;
    baseMax += margin;
  }
  // A positive margin must also move a bound when large values differ by only a few ULPs.
  const margin =
    padding === 0
      ? 0
      : Math.max(
          (baseMax - baseMin) * (padding / 100),
          Math.max(Math.abs(baseMin), Math.abs(baseMax)) * Number.EPSILON * 4,
          Number.MIN_VALUE * 4,
        );
  const min = fixedMin ?? baseMin - margin;
  const max = fixedMax ?? baseMax + margin;
  const label = axis === "x" ? "横軸" : "縦軸";
  if (!(min < max) || !Number.isFinite(max - min)) {
    throw new Error(
      `${label}の最小値は、最大値より小さくしてください。自動の端も含めて確認してください。`,
    );
  }
  const span = max - min;
  if (Math.max(Math.abs(raw.min - min), Math.abs(raw.max - min)) / span > 1e12) {
    throw new Error(`${label}の表示範囲がデータに対して細かすぎます。範囲を広げてください。`);
  }
  return { min, max, raw, cropped: raw.min < min || raw.max > max };
}

function clipSegment(start: Point, end: Point, x: Extent, y: Extent): [Point, Point] | null {
  const region = (point: Point) =>
    (point.x < x.min ? 1 : point.x > x.max ? 2 : 0) |
    (point.y < y.min ? 4 : point.y > y.max ? 8 : 0);
  const interpolate = (a: number, b: number, amount: number) =>
    amount <= 0.5 ? a + (b - a) * amount : b + (a - b) * (1 - amount);
  let a = start;
  let b = end;
  for (let iteration = 0; iteration < 8; iteration++) {
    const aRegion = region(a);
    const bRegion = region(b);
    if (!(aRegion | bRegion)) {
      return [a, b];
    }
    if (aRegion & bRegion) {
      return null;
    }
    const outside = aRegion || bRegion;
    let point: Point;
    if (outside & 12) {
      const boundary = outside & 8 ? y.max : y.min;
      const amount = (boundary - a.y) / (b.y - a.y);
      point = { x: interpolate(a.x, b.x, amount), y: boundary };
    } else {
      const boundary = outside & 2 ? x.max : x.min;
      const amount = (boundary - a.x) / (b.x - a.x);
      point = { x: boundary, y: interpolate(a.y, b.y, amount) };
    }
    if (outside === aRegion) {
      a = point;
    } else {
      b = point;
    }
  }
  throw new Error("表示範囲の境界を十分な精度で描けません。軸の範囲を広げてください。");
}

export function lineChartGeometry<T extends { label: string; points: readonly Point[] }>(
  series: readonly T[],
  additionalPoints: readonly Point[] = [],
  settings: AxisSettings = {},
) {
  const width = 640,
    height = 380,
    left = 100,
    top = 26,
    right = 38,
    bottom = 70;
  const points = [...series.flatMap((item) => item.points), ...additionalPoints];
  const x = axisExtent(points, "x", settings),
    y = axisExtent(points, "y", settings);
  const sx = (value: number) => left + ((value - x.min) / (x.max - x.min)) * (width - left - right);
  const sy = (value: number) =>
    height - bottom - ((value - y.min) / (y.max - y.min)) * (height - top - bottom);
  const ticks = ({ min, max }: Extent) => [
    ...new Set(Array.from({ length: 5 }, (_, index) => min + (max - min) * (index / 4))),
  ];
  const visible = (point: Point) =>
    point.x >= x.min && point.x <= x.max && point.y >= y.min && point.y <= y.max;
  const position = (point: Point) => `${sx(point.x).toFixed(2)} ${sy(point.y).toFixed(2)}`;
  // Clip before serialization: huge offscreen SVG coordinates can lose visible precision.
  const path = (points: readonly Point[]) => {
    if (points.length === 1) {
      return visible(points[0]!) ? `M${position(points[0]!)}` : "";
    }
    const commands: string[] = [];
    let previousEnd: Point | null = null;
    for (let index = 1; index < points.length; index++) {
      const segment = clipSegment(points[index - 1]!, points[index]!, x, y);
      if (!segment) {
        previousEnd = null;
        continue;
      }
      const [start, end] = segment;
      if (!previousEnd || previousEnd.x !== start.x || previousEnd.y !== start.y) {
        commands.push(`M${position(start)}`);
      }
      commands.push(`L${position(end)}`);
      previousEnd = end;
    }
    return commands.join(" ");
  };
  // Close, large values need an explicit axis offset so distinct ticks remain distinct.
  const offset = (domain: Extent & { raw: Extent }) => {
    const { min, max, raw } = domain;
    const values = ticks(domain);
    const repeatedLabels = new Set(values.map(tickLabel)).size !== values.length;
    if (repeatedLabels || Math.abs(min) > (max - min) * 10000) {
      return raw.min >= min && raw.min <= max ? raw.min : min;
    }
    return 0;
  };
  return {
    width,
    height,
    left,
    top,
    right,
    bottom,
    path,
    xDomain: { min: x.min, max: x.max },
    yDomain: { min: y.min, max: y.max },
    cropped: x.cropped || y.cropped,
    xOffset: offset(x),
    yOffset: offset(y),
    xTicks: ticks(x).map((value) => ({ value, at: sx(value) })),
    yTicks: ticks(y).map((value) => ({ value, at: sy(value) })),
    series: series.map((item) => ({
      label: item.label,
      path: path(item.points),
      points: item.points.map((point) => ({
        ...point,
        cx: sx(point.x),
        cy: sy(point.y),
        visible: visible(point),
      })),
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
  const source = lineChartSeriesSchema.parse(JSON.parse(props.series));
  const formulas = source.map((item) => {
    if (item.role !== "formula") {
      return null;
    }
    try {
      return buildChartFormula(item.formula);
    } catch (error) {
      throw new Error(
        `系列「${item.label}」: ${error instanceof Error ? error.message : "理論式と計算範囲を確認してください。"}`,
      );
    }
  });
  const data = source.map((item, index) =>
    item.role === "formula" ? { ...item, points: formulas[index]!.points } : item,
  );
  const fits = data.map((item) => {
    if (item.role === "formula" || !item.fit) {
      return null;
    }
    try {
      return fitChartSeries(item.points, item.fit);
    } catch (error) {
      throw new Error(
        `系列「${item.label}」: ${error instanceof Error ? error.message : "近似の設定を確認してください。"}`,
      );
    }
  });
  const plot = lineChartGeometry(
    data,
    fits.flatMap((fit) => fit?.points ?? []),
    props,
  );
  return { props, data, fits, formulas, plot };
}

function mathLines(lines: string[]): string {
  return `<div class="article-line-chart__math-lines">${lines
    .map((line) => `<div class="article-line-chart__math-line">${renderChartMath(line)}</div>`)
    .join("")}</div>`;
}

function formulaDetails(
  label: string,
  formula: ReturnType<typeof buildChartFormula>,
  detailed: boolean,
): string {
  return `<section class="article-line-chart__fit-result article-line-chart__formula-result">
    <p class="article-line-chart__fit-title"><strong>${escape(label)}：理論式</strong></p>
    ${mathLines([formulaChartTex(formula.expression)])}
    ${
      detailed
        ? `<details class="article-line-chart__diagnostics"><summary class="disclosure-summary">計算の詳細</summary>
          <dl>
            <dt>計算するXの範囲</dt><dd>${formula.domain[0]} ～ ${formula.domain[1]}</dd>
            <dt>描画点数</dt><dd>${formula.sampleCount}点（理論式から計算）</dd>
          </dl>
          <p>${escape(formula.note)}</p>
          <p>有限個の点と通常の数値精度を使って描画しています。</p>
        </details>`
        : ""
    }
  </section>`;
}

function fitDetails(label: string, fit: ChartFitResult, detailed: boolean): string {
  const tex = fitChartTex(fit);
  const normalization = fit.normalization
    ? `<dt>計算座標</dt><dd>${
        fit.normalization.transform === "log"
          ? `z = ln(x / ${fit.normalization.offset}) / ${fit.normalization.scale}`
          : `z = (x − ${fit.normalization.offset}) / ${fit.normalization.scale}`
      }</dd>`
    : "";
  const coefficients = fit.coefficients
    ? `<dt>計算に使った係数（丸めなし）</dt><dd><code>${escape(JSON.stringify(fit.coefficients))}</code></dd>`
    : "";
  const metrics =
    fit.method !== "loess"
      ? `<dl class="article-line-chart__metrics">
          <dt>R²</dt><dd>${fit.rSquared === null ? "算出できません（Yが一定）" : statistic(fit.rSquared)}</dd>
          <dt>RMSE</dt><dd>${statistic(fit.rmse)}（Yと同じ単位）</dd>
        </dl>`
      : '<p class="article-line-chart__loess-note">局所的な平滑化です。単一の近似式はありません。</p>';
  return `<section class="article-line-chart__fit-result">
    <p class="article-line-chart__fit-title"><strong>${escape(label)}：${escape(fit.label)}</strong></p>
    ${tex.length ? mathLines(tex) : ""}
    ${metrics}
    ${
      detailed
        ? `<details class="article-line-chart__diagnostics"><summary class="disclosure-summary">計算の詳細</summary>
          <dl>
            ${normalization}${coefficients}
            <dt>使用した点数</dt><dd>${fit.sampleCount}点（この系列の全測定点）</dd>
            <dt>計算・表示のX範囲</dt><dd>${fit.domain[0]} ～ ${fit.domain[1]}（外挿なし）</dd>
          </dl>
          <p>${tex.length ? "数式の表示係数は丸めています。計算には丸め前の値を使用しています。" : ""}${escape(fit.note)}</p>
        </details>`
        : ""
    }
  </section>`;
}

/** A single escaped, static renderer shared by Astro, the canvas and the preview iframe. */
export function renderLineChart(input: unknown): string {
  const { props, data, fits, formulas, plot } = prepareLineChart(input);
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
      const formula = data[index]!.role === "formula";
      const curve = data[index]!.role === "curve" || formula;
      const connected = curve || (kind === "line" && !fit);
      const line = connected
        ? `<path class="article-line-chart__line${formula ? " article-line-chart__formula" : curve ? " article-line-chart__external-curve" : ""}" d="${item.path}"/>`
        : "";
      const fitted = fit
        ? `<path class="article-line-chart__line article-line-chart__fit" d="${plot.path(fit.points)}"/>`
        : "";
      const observations = curve
        ? ""
        : item.points
            .filter((point) => point.visible)
            .map((point) =>
              marker(
                index,
                point.cx,
                point.cy,
                `${item.label}: ${props.xLabel} ${point.x}, ${props.yLabel} ${point.y}`,
              ),
            )
            .join("");
      return `<g class="article-line-chart__series--${index + 1}" data-role="${formula ? "formula" : curve ? "curve" : "observed"}">${line}${fitted}${observations}</g>`;
    })
    .join("");
  const legend = plot.series
    .map((item, index) => {
      const fit = fits[index];
      const formula = data[index]!.role === "formula";
      const curve = data[index]!.role === "curve" || formula;
      const connected = curve || (kind === "line" && !fit);
      const itemClass = `article-line-chart__legend-item article-line-chart__series--${index + 1}`;
      const observed = `<li class="${itemClass}"><svg viewBox="0 0 24 14" aria-hidden="true">${connected ? '<path class="article-line-chart__line" d="M1 7H23"/>' : ""}${curve ? "" : marker(index, 12, 7)}</svg>${escape(item.label)}${formula ? "（理論式）" : curve ? "（計算済み曲線）" : fit || kind === "analysis" ? "（測定値）" : ""}</li>`;
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
          `<tr><th scope="row">${escape(item.label)}${item.role === "formula" ? "（理論式の計算値）" : item.role === "curve" ? "（計算済み曲線）" : ""}</th><td>${point.x}</td><td>${point.y}</td></tr>`,
      ),
    )
    .join("");
  const analysisDisplay = props.analysisDisplay ?? "concise";
  const details =
    analysisDisplay === "hidden"
      ? ""
      : data
          .map((item, index) =>
            formulas[index]
              ? formulaDetails(item.label, formulas[index], analysisDisplay === "detailed")
              : fits[index]
                ? fitDetails(item.label, fits[index], analysisDisplay === "detailed")
                : "",
          )
          .join("");
  const hasFormula = formulas.some(Boolean);
  const detailsLabel = hasFormula
    ? fits.some(Boolean)
      ? "理論式・近似式・計算条件を見る"
      : "理論式・計算条件を見る"
    : "近似式・計算条件を見る";
  const axisOffset = [
    plot.xOffset ? `横軸の目盛りは${plot.xOffset}からの差です。` : "",
    plot.yOffset ? `縦軸の目盛りは${plot.yOffset}からの差です。` : "",
  ].join("");
  return `<figure class="article-line-chart" data-kind="${kind}">
    <figcaption class="article-line-chart__title">${escape(props.title)}</figcaption>
    ${props.description ? `<p class="article-line-chart__description">${escape(props.description)}</p>` : ""}
    <div class="article-line-chart__viewport" tabindex="0" role="region" aria-label="${escape(props.title)}のグラフ">
      <svg class="article-line-chart__plot" viewBox="0 0 ${plot.width} ${plot.height}" role="img" aria-label="${escape(props.title)}。横軸${escape(props.xLabel)}、縦軸${escape(props.yLabel)}。各系列の値は後のデータ表でも確認できます。">
        ${grid}${ticks}<path class="article-line-chart__axis" d="M${plot.left} ${plot.top}V${plot.height - plot.bottom}H${plot.width - plot.right}"/>
        <svg class="article-line-chart__drawing" x="${plot.left}" y="${plot.top}" width="${plot.width - plot.left - plot.right}" height="${plot.height - plot.top - plot.bottom}" viewBox="${plot.left} ${plot.top} ${plot.width - plot.left - plot.right} ${plot.height - plot.top - plot.bottom}" overflow="hidden">${curves}</svg>
        <text class="article-line-chart__axis-title" x="${plot.width / 2}" y="${plot.height - 8}" text-anchor="middle">${escape(props.xLabel)}</text>
        <text class="article-line-chart__axis-title" transform="translate(20 ${plot.height / 2}) rotate(-90)" text-anchor="middle">${escape(props.yLabel)}</text>
      </svg>
    </div>
    ${axisOffset ? `<p class="article-line-chart__axis-note">${axisOffset}データ表には元の値を表示します。</p>` : ""}
    ${plot.cropped ? `<p class="article-line-chart__axis-note article-line-chart__range-note">表示範囲の外にある点や曲線はグラフに表示していません。データ表には全ての値を残しています。${fits.some(Boolean) ? "近似には全ての測定点を使っています。" : ""}</p>` : ""}
    <ul class="article-line-chart__legend" aria-label="系列">${legend}</ul>
    ${details ? `<details class="article-line-chart__data article-line-chart__analysis"><summary class="disclosure-summary">${detailsLabel}</summary>${details}</details>` : ""}
    <details class="article-line-chart__data"><summary class="disclosure-summary">データ表を見る</summary><div class="article-line-chart__table"><table><caption>${escape(props.title)}のデータ</caption><thead><tr><th scope="col">系列</th><th scope="col">${escape(props.xLabel)}</th><th scope="col">${escape(props.yLabel)}</th></tr></thead><tbody>${rows}</tbody></table></div></details>
  </figure>`;
}
