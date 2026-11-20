import type { ChartFitResult } from "./chart-regression.js";
import { buildChartFormula } from "./chart-formula.js";
import { fitChartTex, formulaChartTex, renderChartMath } from "./chart-math.js";
import { prepareLineChart, tickLabel } from "./charts-core.js";
export { lineChartGeometry, prepareLineChart } from "./charts-core.js";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
const statistic = (value: number | null) =>
  value === null ? "算出なし" : String(Number(value.toPrecision(6)));

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
