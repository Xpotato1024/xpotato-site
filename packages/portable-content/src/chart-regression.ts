/// <reference path="./vega-statistics.d.ts" />
import {
  regressionExp,
  regressionLinear,
  regressionLoess,
  regressionPoly,
  regressionQuad,
} from "vega-statistics";

export type ChartFit = {
  method: "linear" | "quad" | "poly" | "exp" | "log" | "pow" | "loess";
  degree?: 3 | undefined;
  bandwidth?: number | undefined;
};

type ChartPoint = { x: number; y: number };
type Normalization = { transform: "linear" | "log"; offset: number; scale: number };

export type ChartFitResult = {
  method: ChartFit["method"];
  label: string;
  points: ChartPoint[];
  equation: string | null;
  /** 表示式の z に対する係数。多項式は定数項から、指数・べき乗は [振幅, 指数]。 */
  coefficients: number[] | null;
  rSquared: number | null;
  rmse: number | null;
  domain: [number, number];
  sampleCount: number;
  /** linear: z=(x-offset)/scale、log: z=ln(x/offset)/scale。 */
  normalization?: Normalization;
  note: string;
};

const labels: Record<ChartFit["method"], string> = {
  linear: "線形近似",
  quad: "2次近似",
  poly: "3次近似",
  exp: "指数近似",
  log: "対数近似",
  pow: "べき乗近似",
  loess: "LOESS平滑化",
};
const valueLimit = 1e12;
const curveIntervals = 200;
const readX = (point: ChartPoint) => point.x;
const readY = (point: ChartPoint) => point.y;

function numericalError(label: string): Error {
  return new Error(`${label}を安定して計算できません。値の桁やxの分布を確認してください。`);
}

function validateFit(fit: ChartFit): void {
  if (!fit || typeof fit !== "object" || !Object.hasOwn(labels, fit.method)) {
    throw new Error("近似方法を選んでください。");
  }
  if (Object.keys(fit).some((key) => !["method", "degree", "bandwidth"].includes(key))) {
    throw new Error("近似の設定に対応していない項目があります。");
  }
  if (fit.degree !== undefined && (fit.method !== "poly" || fit.degree !== 3)) {
    throw new Error("次数を指定できるのは3次近似だけです。degreeには3を指定してください。");
  }
  if (fit.bandwidth !== undefined && fit.method !== "loess") {
    throw new Error("帯域幅を指定できるのはLOESS平滑化だけです。");
  }
  if (
    fit.method === "loess" &&
    fit.bandwidth !== undefined &&
    (!Number.isFinite(fit.bandwidth) || fit.bandwidth <= 0 || fit.bandwidth > 1)
  ) {
    throw new Error("LOESSの帯域幅は0より大きく1以下の数値で指定してください。");
  }
}

function validatePoints(points: readonly ChartPoint[], fit: ChartFit): ChartPoint[] {
  if (!Array.isArray(points) || points.length > 500) {
    throw new Error("近似に使うデータは1系列につき500点以内で指定してください。");
  }
  for (const [index, point] of points.entries()) {
    if (
      !point ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      Math.abs(point.x) > valueLimit ||
      Math.abs(point.y) > valueLimit
    ) {
      throw new Error(`${index + 1}点目のxとyには、絶対値1兆以下の有限な数値を指定してください。`);
    }
    if ((fit.method === "log" || fit.method === "pow") && point.x <= 0) {
      throw new Error(`${labels[fit.method]}では、すべてのxを0より大きくしてください。`);
    }
    if ((fit.method === "exp" || fit.method === "pow") && point.y <= 0) {
      throw new Error(`${labels[fit.method]}では、すべてのyを0より大きくしてください。`);
    }
  }
  const distinct = new Set(points.map(readX)).size;
  if (fit.method === "loess" && distinct !== points.length) {
    // vega-statistics 2.0.0 の同一xの局所窓は、観測の並び順で平滑値が変わる。
    throw new Error(
      "LOESS平滑化では同じxを持つ点を扱えません。繰り返し測定の集約方法を決めるか、別の近似方法を選んでください。",
    );
  }
  const minimum = fit.method === "poly" ? 4 : ["quad", "loess"].includes(fit.method) ? 3 : 2;
  if (distinct < minimum) {
    throw new Error(
      `${labels[fit.method]}には、異なるxを持つデータが少なくとも${minimum}点必要です。`,
    );
  }
  return points.map((point) => ({ ...point })).sort((a, b) => a.x - b.x || a.y - b.y);
}

function linearNormalization(values: readonly number[]): Normalization {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum;
  return { transform: "linear", offset: minimum + range / 2, scale: range || 1 };
}

function logRatio(value: number, reference: number): number {
  const relative = (value - reference) / reference;
  // 近接した大きな値では log(value)-log(reference) の桁が失われる。
  return Math.abs(relative) < 0.5 ? Math.log1p(relative) : Math.log(value) - Math.log(reference);
}

function normalize(value: number, normalization: Normalization): number {
  return normalization.transform === "log"
    ? logRatio(value, normalization.offset) / normalization.scale
    : (value - normalization.offset) / normalization.scale;
}

function checkPolynomialCondition(points: readonly ChartPoint[], degree: number, label: string) {
  const basis: number[][] = [];
  for (let power = 0; power <= degree; power += 1) {
    const column = points.map((point) => point.x ** power);
    const originalNorm = column.reduce((sum, value) => sum + value * value, 0);
    // 正規方程式を使うVegaへ、ほぼ従属した列を渡して有限の誤答を出させない。
    for (let pass = 0; pass < 2; pass += 1) {
      for (const previous of basis) {
        const projection = column.reduce((sum, value, index) => sum + value * previous[index]!, 0);
        for (let index = 0; index < column.length; index += 1) {
          column[index] = column[index]! - projection * previous[index]!;
        }
      }
    }
    const norm = column.reduce((sum, value) => sum + value * value, 0);
    if (!Number.isFinite(norm) || norm <= originalNorm * 1e-12) {
      throw numericalError(label);
    }
    basis.push(column.map((value) => value / Math.sqrt(norm)));
  }
}

type Model = { coef: number[]; predict: (x: number) => number };

function ordinaryModel(points: readonly ChartPoint[], degree: number): Model {
  const y = linearNormalization(points.map(readY));
  const scaled = points.map((point) => ({ x: point.x, y: normalize(point.y, y) }));
  const model =
    degree === 1
      ? regressionLinear(scaled, readX, readY)
      : degree === 2
        ? regressionQuad(scaled, readX, readY)
        : regressionPoly(scaled, readX, readY, degree);
  return {
    coef: model.coef.map(
      (coefficient, index) => coefficient * y.scale + (index === 0 ? y.offset : 0),
    ),
    predict: (x) => model.predict(x) * y.scale + y.offset,
  };
}

function scaledExponential(exponent: number, scale: number): number {
  const value = scale * Math.exp(exponent);
  return value === 0 || !Number.isFinite(value) ? Math.exp(Math.log(scale) + exponent) : value;
}

function exponentialModel(points: readonly ChartPoint[], label: string): Model {
  const scale = Math.max(...points.map(readY));
  const scaled = points.map((point) => ({ x: point.x, y: point.y / scale }));
  if (scaled.some((point) => point.y === 0)) {
    throw numericalError(label);
  }
  const totalWeight = scaled.reduce((sum, point) => sum + point.y, 0);
  const center = scaled.reduce((sum, point) => sum + point.x * point.y, 0) / totalWeight;
  const variance =
    scaled.reduce((sum, point) => sum + point.y * (point.x - center) ** 2, 0) / totalWeight;
  if (variance <= 1e-12) {
    throw new Error(
      "指数近似の重みが一部の点に偏り、安定して計算できません。yの値の範囲を確認してください。",
    );
  }
  const model = regressionExp(scaled, readX, readY);
  const [amplitude, exponent] = model.coef;
  if (!(amplitude! > 0) || !Number.isFinite(amplitude) || !Number.isFinite(exponent)) {
    throw numericalError(label);
  }
  const intercept = Math.log(amplitude!);
  return {
    coef: [scaledExponential(intercept, scale), exponent!],
    predict: (x) => scaledExponential(intercept + exponent! * x, scale),
  };
}

function powerModel(points: readonly ChartPoint[]): Model {
  const scale = Math.max(...points.map(readY));
  const model = ordinaryModel(
    points.map((point) => ({ x: point.x, y: logRatio(point.y, scale) })),
    1,
  );
  return {
    coef: [scaledExponential(model.coef[0]!, scale), model.coef[1]!],
    predict: (x) => scaledExponential(model.predict(x), scale),
  };
}

function checkedPrediction(value: number, label: string, positive: boolean): number {
  if (!Number.isFinite(value) || (positive && value <= 0)) {
    throw numericalError(label);
  }
  if (Math.abs(value) > valueLimit) {
    throw new Error(`${label}の曲線が絶対値1兆を超えます。値の単位や近似方法を見直してください。`);
  }
  return value;
}

function criticalCoordinates(coef: readonly number[]): number[] {
  const a = 3 * (coef[3] ?? 0);
  const b = 2 * (coef[2] ?? 0);
  const c = coef[1] ?? 0;
  if (a === 0) {
    return b === 0 ? [] : [-c / b];
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return [];
  }
  if (discriminant === 0) {
    return [-b / (2 * a)];
  }
  const q = -0.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(discriminant));
  return [q / a, c / q];
}

function sampleModel(
  predict: (x: number) => number,
  domain: [number, number],
  observations: readonly ChartPoint[],
  logarithmic: boolean,
  label: string,
): ChartPoint[] {
  const coordinates = new Set<number>(domain);
  const span = domain[1] - domain[0];
  const logarithmicSpan = logarithmic ? logRatio(domain[1], domain[0]) : 0;
  for (let index = 1; index < curveIntervals; index += 1) {
    const fraction = index / curveIntervals;
    coordinates.add(domain[0] + span * fraction);
    if (logarithmic) {
      coordinates.add(
        Math.min(
          domain[1],
          Math.max(domain[0], scaledExponential(logarithmicSpan * fraction, domain[0])),
        ),
      );
    }
  }
  const initial = [...coordinates].sort((a, b) => a - b).map((x) => ({ x, y: predict(x) }));
  const values = [...observations.map(readY), ...initial.map(readY)];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const tolerance = Math.max(
    (maximum - minimum) * 0.0005,
    Math.max(Math.abs(minimum), Math.abs(maximum)) * Number.EPSILON * 16,
    Number.MIN_VALUE,
  );
  const pending: Array<[ChartPoint, ChartPoint]> = [];
  for (let index = initial.length - 1; index > 0; index -= 1) {
    pending.push([initial[index - 1]!, initial[index]!]);
  }
  const curve = [initial[0]!];
  let count = initial.length;
  while (pending.length > 0) {
    const [left, right] = pending.pop()!;
    const midpoint = left.x + (right.x - left.x) / 2;
    if (midpoint === left.x || midpoint === right.x) {
      curve.push(right);
      continue;
    }
    const middle = { x: midpoint, y: predict(midpoint) };
    const deviates = [0.25, 0.5, 0.75].some((fraction) => {
      const value = fraction === 0.5 ? middle.y : predict(left.x + (right.x - left.x) * fraction);
      return Math.abs(value - (left.y + (right.y - left.y) * fraction)) > tolerance;
    });
    if (deviates) {
      count += 1;
      if (count > 1001) {
        throw new Error(
          `${label}の曲線をこの値域で十分な精度で描画できません。データの範囲や近似方法を見直してください。`,
        );
      }
      pending.push([middle, right], [left, middle]);
    } else {
      curve.push(right);
    }
  }
  return curve;
}

function metrics(points: readonly ChartPoint[], predict: (x: number) => number, label: string) {
  const errors = points.map((point) => predict(point.x) - point.y);
  const errorScale = Math.max(...errors.map(Math.abs));
  const rmse =
    errorScale === 0
      ? 0
      : errorScale *
        Math.sqrt(
          errors.reduce((sum, value) => sum + (value / errorScale) ** 2, 0) / points.length,
        );
  if (points.every((point) => point.y === points[0]!.y)) {
    return { rSquared: null, rmse };
  }
  const y = linearNormalization(points.map(readY));
  const centered = points.map((point) => normalize(point.y, y));
  const mean = centered.reduce((sum, value) => sum + value, 0) / points.length;
  const total = centered.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const residual = errors.reduce((sum, value) => sum + (value / y.scale) ** 2, 0);
  const rSquared = 1 - residual / total;
  if (!Number.isFinite(rSquared) || !Number.isFinite(rmse)) {
    throw numericalError(label);
  }
  return { rSquared, rmse };
}

function equation(
  method: ChartFit["method"],
  coef: readonly number[],
  normalization: Normalization,
) {
  const number = (value: number) => Number(value.toPrecision(8)).toString();
  const expression =
    method === "exp" || method === "pow"
      ? `${number(coef[0]!)} × exp(${number(coef[1]!)} × z)`
      : coef.slice(1).reduce((text, value, index) => {
          const power = index === 0 ? "" : index === 1 ? "²" : "³";
          return `${text} ${value < 0 ? "−" : "+"} ${number(Math.abs(value))} × z${power}`;
        }, number(coef[0]!));
  const offset =
    normalization.offset < 0 ? `(${normalization.offset})` : String(normalization.offset);
  const definition =
    normalization.transform === "log"
      ? `ln(x / ${offset}) / ${normalization.scale}`
      : `(x − ${offset}) / ${normalization.scale}`;
  return `y ≈ ${expression}；z = ${definition}`;
}

/** 全観測を使って近似し、観測範囲内だけの描画点と元のy単位の指標を返す。 */
export function fitChartSeries(points: readonly ChartPoint[], fit: ChartFit): ChartFitResult {
  validateFit(fit);
  const observations = validatePoints(points, fit);
  const label = labels[fit.method];
  const domain: [number, number] = [observations[0]!.x, observations.at(-1)!.x];
  const normalization: Normalization =
    fit.method === "log" || fit.method === "pow"
      ? { transform: "log", offset: domain[0], scale: logRatio(domain[1], domain[0]) }
      : linearNormalization(observations.map(readX));
  if (!Number.isFinite(normalization.scale) || normalization.scale <= 0) {
    throw numericalError(label);
  }
  const normalized = observations.map((point) => ({
    x: normalize(point.x, normalization),
    y: point.y,
  }));
  if (normalized.some((point) => !Number.isFinite(point.x))) {
    throw numericalError(label);
  }
  const common = { method: fit.method, label, domain, sampleCount: observations.length };

  if (fit.method === "loess") {
    const bandwidth = fit.bandwidth ?? 0.3;
    const neighbors = Math.max(2, Math.floor(observations.length * bandwidth));
    const y = linearNormalization(normalized.map(readY));
    const smoothed = regressionLoess(
      normalized.map((point) => ({ x: point.x, y: normalize(point.y, y) })),
      readX,
      readY,
      bandwidth,
    );
    if (smoothed.length !== observations.length) {
      throw numericalError(label);
    }
    const curve = smoothed.map(([x, value], index) => {
      if (!Number.isFinite(x) || Math.abs(x - normalized[index]!.x) > 64 * Number.EPSILON) {
        throw numericalError(label);
      }
      return {
        x: observations[index]!.x,
        y: checkedPrediction(value * y.scale + y.offset, label, false),
      };
    });
    return {
      ...common,
      points: curve,
      equation: null,
      coefficients: null,
      rSquared: null,
      rmse: null,
      note: `全${observations.length}点を使った局所的な平滑化です。帯域幅${bandwidth}、近傍${neighbors}点。単一の近似式やR²・RMSEは表示しません。${neighbors <= 3 ? "近傍が3点以下では元の点をほぼそのまま通る場合があります。平滑化したい場合は帯域幅を増やしてください。" : ""}`,
    };
  }

  const degree = fit.method === "quad" ? 2 : fit.method === "poly" ? 3 : 1;
  checkPolynomialCondition(normalized, degree, label);
  const model =
    fit.method === "exp"
      ? exponentialModel(normalized, label)
      : fit.method === "pow"
        ? powerModel(normalized)
        : ordinaryModel(normalized, degree);
  if (model.coef.length !== degree + 1 || model.coef.some((value) => !Number.isFinite(value))) {
    throw numericalError(label);
  }
  const positive = fit.method === "exp" || fit.method === "pow";
  const predict = (x: number) =>
    checkedPrediction(model.predict(normalize(x, normalization)), label, positive);
  // サンプリング間にある多項式の極値も、描画値の上限を確認する。
  if (degree > 1) {
    for (const x of criticalCoordinates(model.coef)) {
      if (x >= normalized[0]!.x && x <= normalized.at(-1)!.x) {
        checkedPrediction(model.predict(x), label, false);
      }
    }
  }
  const curve = sampleModel(
    predict,
    domain,
    observations,
    normalization.transform === "log",
    label,
  );
  const statistics = metrics(observations, predict, label);
  const estimation =
    fit.method === "exp"
      ? "ln(y)に対する最小二乗で、各点の重みは観測値yです。"
      : fit.method === "pow"
        ? "ln(x)とln(y)に対する最小二乗です。"
        : fit.method === "log"
          ? "ln(x)と元のyに対する最小二乗です。"
          : "元のyに対する最小二乗です。";
  return {
    ...common,
    points: curve,
    equation: equation(fit.method, model.coef, normalization),
    coefficients: model.coef,
    ...statistics,
    normalization,
    note: `全${observations.length}点を使い、観測範囲内だけを表示しています。${estimation}R²とRMSEは元のyで計算しています。${statistics.rSquared === null ? "yがすべて同じ値のため、R²は定義できません。" : ""}`,
  };
}
