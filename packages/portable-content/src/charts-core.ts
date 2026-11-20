import {
  lineChartModulePropsSchema,
  lineChartSeriesSchema,
} from "@xpotato/content-contracts/content";
import { fitChartSeries } from "./chart-regression.js";
import { buildChartFormula } from "./chart-formula.js";

export const tickLabel = (value: number) =>
  value !== 0 && (Math.abs(value) >= 1e6 || Math.abs(value) < 0.001)
    ? Number(value.toPrecision(4)).toExponential()
    : value.toLocaleString("ja-JP", { maximumSignificantDigits: 4 });
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
