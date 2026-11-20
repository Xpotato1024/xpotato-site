import katex from "katex";
import type { ChartFitResult } from "./chart-regression.js";
import { chartFormulaToTex } from "./chart-formula.js";

function numberTex(value: number): string {
  const rounded = String(Number(value.toPrecision(8)));
  const parts = /^(-?(?:\d+(?:\.\d+)?|\.\d+))e([+-]?\d+)$/u.exec(rounded);
  return parts ? String.raw`${parts[1]}\times 10^{${Number(parts[2])}}` : rounded;
}

/**
 * KaTeX runs while preparing static markup, not in published articles.
 * TeX is constructed from numeric fit results or our bounded formula AST.
 */
export function renderChartMath(tex: string): string {
  return katex
    .renderToString(tex, {
      output: "mathml",
      displayMode: false,
      throwOnError: true,
      trust: false,
      strict: "error",
      maxExpand: 100,
      maxSize: 8,
    })
    .replace("<annotation ", '<annotation data-search-exclude="true" ');
}

export function fitChartTex(fit: ChartFitResult): string[] {
  if (!fit.coefficients || !fit.normalization || !fit.equation) return [];
  const c = fit.coefficients;
  const expression =
    fit.method === "exp" || fit.method === "pow"
      ? String.raw`y\approx ${numberTex(c[0]!)}e^{${numberTex(c[1]!)}z}`
      : String.raw`y\approx ${numberTex(c[0]!)}` +
        c
          .slice(1)
          .map((value, index) => {
            const power = index === 0 ? "z" : String.raw`z^{${index + 1}}`;
            return ` ${value < 0 ? "-" : "+"} ${numberTex(Math.abs(value))}${power}`;
          })
          .join("");
  const n = fit.normalization;
  const scale = numberTex(n.scale);
  const transformed =
    n.transform === "log"
      ? String.raw`\ln\left(\frac{x}{${numberTex(n.offset)}}\right)`
      : n.offset === 0
        ? "x"
        : String.raw`x ${n.offset < 0 ? "+" : "-"} ${numberTex(Math.abs(n.offset))}`;
  return [expression, String.raw`z=\frac{${transformed}}{${scale}}`];
}

export function formulaChartTex(expression: string): string {
  return String.raw`y=${chartFormulaToTex(expression)}`;
}
