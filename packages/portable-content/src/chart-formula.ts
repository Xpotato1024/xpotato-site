export interface ChartFormula {
  expression: string;
  xMin: number;
  xMax: number;
  /** Initial sampling density. Curved intervals may add points, up to 1001 in total. */
  samples?: number | undefined;
}

export interface ChartFormulaResult {
  expression: string;
  domain: readonly [number, number];
  points: { x: number; y: number }[];
  sampleCount: number;
  note: string;
}

type BinaryOperator = "+" | "-" | "*" | "/" | "^";
const functionNames = [
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "exp",
  "ln",
  "log",
  "log10",
  "sqrt",
  "abs",
] as const;
type FunctionName = (typeof functionNames)[number];
type Node = { key: string } & (
  | { kind: "number"; value: number }
  | { kind: "x" }
  | { kind: "unary"; operator: "+" | "-"; argument: Node }
  | { kind: "binary"; operator: BinaryOperator; left: Node; right: Node }
  | { kind: "call"; name: FunctionName; argument: Node }
);
type Token = { text: string; position: number };
type Range = { min: number; max: number };
type IntervalState = {
  oscillates: boolean;
  values: Map<string, Range>;
  derivatives: Map<string, Range | null>;
};
type Point = { x: number; y: number };
const valueLimit = 1e12;
const maxPoints = 1001;
const maxEvaluations = 12000;
const maxDepth = 32;

function syntaxError(message: string, token?: Token): Error {
  return new Error(`理論式${token ? `の${token.position + 1}文字目` : ""}：${message}`);
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  while (position < expression.length) {
    const remaining = expression.slice(position);
    const whitespace = /^\s+/u.exec(remaining);
    if (whitespace) {
      position += whitespace[0].length;
      continue;
    }
    const found =
      /^(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[a-zA-Z_][a-zA-Z_0-9]*|\*\*|[+\-*/^()])/u.exec(
        remaining,
      );
    if (!found) {
      throw syntaxError("この文字は使えません。数値、x、対応する関数と演算子を使ってください。", {
        text: remaining[0]!,
        position,
      });
    }
    tokens.push({ text: found[0] === "**" ? "^" : found[0], position });
    if (tokens.length > 256) {
      throw syntaxError("式が複雑すぎます。演算や括弧を減らしてください。");
    }
    position += found[0].length;
  }
  tokens.push({ text: "", position: expression.length });
  return tokens;
}

function parse(expression: string): Node {
  const tokens = tokenize(expression);
  let index = 0;
  const current = () => tokens[index]!;
  const take = (text: string) => {
    if (current().text !== text) return false;
    index += 1;
    return true;
  };
  const nested = (depth: number) => {
    if (depth > maxDepth) {
      throw syntaxError("括弧や演算の入れ子が深すぎます。式を簡単にしてください。");
    }
  };
  const binary = (operator: BinaryOperator, left: Node, right: Node): Node => ({
    kind: "binary",
    operator,
    left,
    right,
    key: `${operator}(${left.key},${right.key})`,
  });
  function sum(depth: number): Node {
    nested(depth);
    let node = product(depth);
    while (current().text === "+" || current().text === "-") {
      const operator = current().text as "+" | "-";
      index += 1;
      node = binary(operator, node, product(depth));
    }
    return node;
  }
  function product(depth: number): Node {
    let node = unary(depth);
    while (current().text === "*" || current().text === "/") {
      const operator = current().text as "*" | "/";
      index += 1;
      node = binary(operator, node, unary(depth));
    }
    return node;
  }
  function unary(depth: number): Node {
    nested(depth);
    if (current().text === "+" || current().text === "-") {
      const operator = current().text as "+" | "-";
      index += 1;
      const argument = unary(depth + 1);
      return { kind: "unary", operator, argument, key: `u${operator}(${argument.key})` };
    }
    return power(depth);
  }
  function power(depth: number): Node {
    const node = primary(depth);
    // Unary signs bind less tightly than powers; the exponent itself may be signed.
    return take("^") ? binary("^", node, unary(depth + 1)) : node;
  }
  function primary(depth: number): Node {
    nested(depth);
    const token = current();
    if (take("(")) {
      const node = sum(depth + 1);
      if (!take(")")) throw syntaxError("閉じる括弧 ) が必要です。", current());
      return node;
    }
    if (/^(?:\d|\.)/u.test(token.text)) {
      index += 1;
      const value = Number(token.text);
      if (!Number.isFinite(value)) throw syntaxError("数値が大きすぎます。", token);
      if (value === 0 && /[1-9]/u.test(token.text.split(/[eE]/u)[0]!)) {
        throw syntaxError("数値が小さすぎて0になります。数値の桁を確認してください。", token);
      }
      return { kind: "number", value, key: `n${value}` };
    }
    if (take("x")) return { kind: "x", key: "x" };
    if (token.text === "pi" || token.text === "e") {
      index += 1;
      const value = token.text === "pi" ? Math.PI : Math.E;
      return { kind: "number", value, key: `n${value}` };
    }
    if (functionNames.includes(token.text as FunctionName)) {
      index += 1;
      if (!take("(")) throw syntaxError("関数の引数を括弧で囲んでください。", current());
      const argument = sum(depth + 1);
      if (!take(")")) throw syntaxError("閉じる括弧 ) が必要です。", current());
      const name = token.text as FunctionName;
      return { kind: "call", name, argument, key: `${name}(${argument.key})` };
    }
    throw syntaxError(
      token.text
        ? `「${token.text}」は使えません。変数はx、定数はpiとeです。`
        : "数値や式が必要です。",
      token,
    );
  }
  const node = sum(0);
  if (current().text) {
    throw syntaxError("演算子が必要です。掛け算には * を使ってください。", current());
  }
  return node;
}

function finite(value: number, operation: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${operation}を有限の数値として計算できません。式と定義域を確認してください。`);
  }
  return value;
}

function call(name: FunctionName, argument: number): number {
  let value: number;
  switch (name) {
    case "ln":
    case "log":
      value = Math.log(argument);
      break;
    default:
      value = Math[name](argument);
  }
  if (name === "exp" && value === 0) {
    throw new Error("expの結果が小さすぎて0になります。式とXの範囲を確認してください。");
  }
  return finite(value, name);
}

function evaluate(node: Node, x: number): number {
  if (node.kind === "number") return node.value;
  if (node.kind === "x") return x;
  if (node.kind === "unary") {
    const value = evaluate(node.argument, x);
    return node.operator === "-" ? -value : value;
  }
  if (node.kind === "call") return call(node.name, evaluate(node.argument, x));
  const left = evaluate(node.left, x),
    right = evaluate(node.right, x);
  let value: number;
  switch (node.operator) {
    case "+":
      value = left + right;
      break;
    case "-":
      value = left - right;
      break;
    case "*":
      value = left * right;
      break;
    case "/":
      if (right === 0) throw new Error("0で割る式です。式とXの範囲を確認してください。");
      value = left / right;
      break;
    case "^":
      if (left === 0 && right === 0) {
        throw new Error("0の0乗は扱えません。式とXの範囲を確認してください。");
      }
      value = left ** right;
  }
  if (
    value === 0 &&
    left !== 0 &&
    (node.operator === "/" || node.operator === "^" || (node.operator === "*" && right !== 0))
  ) {
    throw new Error("計算途中の数値が小さすぎて0になります。式とXの範囲を確認してください。");
  }
  return finite(value, node.operator);
}

class UncertainDomain extends Error {}
const containsZero = (range: Range) => range.min <= 0 && range.max >= 0;
const rangeOf = (...values: number[]): Range => {
  if (values.some((value) => !Number.isFinite(value))) {
    throw new UncertainDomain("計算途中の値が有限になることを確認できません。");
  }
  return { min: Math.min(...values), max: Math.max(...values) };
};
const containsPhase = (range: Range, phase: number, period: number) =>
  Math.ceil((range.min - phase) / period) <= Math.floor((range.max - phase) / period);
function intervalCall(name: FunctionName, value: number): number {
  try {
    return call(name, value);
  } catch {
    // A wide interval may overestimate a correlated expression; subdivide before rejecting it.
    throw new UncertainDomain(
      `${name}をこの区間で有限の数値として計算できることを確認できません。`,
    );
  }
}

function trigonometricRange(name: "sin" | "cos", argument: Range): Range {
  const { min, max } = argument;
  if (max - min >= Math.PI * 2) return { min: -1, max: 1 };
  const offset = name === "sin" ? Math.PI / 2 : 0;
  const values = [intervalCall(name, min), intervalCall(name, max)];
  if (containsPhase(argument, offset, Math.PI * 2)) values.push(1);
  if (containsPhase(argument, offset + Math.PI, Math.PI * 2)) values.push(-1);
  return rangeOf(...values);
}

function complementarySquares(left: Node, right: Node): boolean {
  const square = (node: Node): Node | undefined => {
    if (node.kind !== "binary") return undefined;
    if (node.operator === "^" && node.right.kind === "number" && node.right.value === 2)
      return node.left;
    if (node.operator === "*" && node.left.key === node.right.key) return node.left;
    return undefined;
  };
  const a = square(left),
    b = square(right);
  return Boolean(
    a?.kind === "call" &&
    b?.kind === "call" &&
    a.argument.key === b.argument.key &&
    ((a.name === "sin" && b.name === "cos") || (a.name === "cos" && b.name === "sin")),
  );
}

function interval(node: Node, x: Range, state: IntervalState): Range {
  const cached = state.values.get(node.key);
  if (cached) return cached;
  const result = calculateInterval(node, x, state);
  state.values.set(node.key, result);
  return result;
}

function calculateInterval(node: Node, x: Range, state: IntervalState): Range {
  if (node.kind === "number") return { min: node.value, max: node.value };
  if (node.kind === "x") return x;
  if (node.kind === "unary") {
    const value = interval(node.argument, x, state);
    return node.operator === "-" ? { min: -value.max, max: -value.min } : value;
  }
  if (node.kind === "call") {
    const argument = interval(node.argument, x, state),
      { min, max } = argument;
    if (["sin", "cos", "tan"].includes(node.name)) {
      // Endpoint/quarter-point checks alone can alias a periodic function to a flat line.
      state.oscillates ||= max - min > Math.PI / 4;
    }
    if (node.name === "tan" && containsPhase(argument, Math.PI / 2, Math.PI)) {
      throw new UncertainDomain("tanが定義されない点を含む可能性があります。");
    }
    if (["ln", "log", "log10"].includes(node.name) && min <= 0) {
      throw new UncertainDomain("対数の引数が0以下になる可能性があります。");
    }
    if (node.name === "sqrt" && min < 0) {
      throw new UncertainDomain("sqrtの引数が負になる可能性があります。");
    }
    if (["asin", "acos"].includes(node.name) && (min < -1 || max > 1)) {
      throw new UncertainDomain("asin・acosの引数が−1から1の範囲を外れる可能性があります。");
    }
    if (node.name === "abs") {
      return {
        min: containsZero(argument) ? 0 : Math.min(Math.abs(min), Math.abs(max)),
        max: Math.max(Math.abs(min), Math.abs(max)),
      };
    }
    if (node.name === "sin" || node.name === "cos") {
      return trigonometricRange(node.name, argument);
    }
    return rangeOf(intervalCall(node.name, min), intervalCall(node.name, max));
  }
  const left = interval(node.left, x, state),
    right = interval(node.right, x, state);
  switch (node.operator) {
    case "+":
      if (complementarySquares(node.left, node.right)) return { min: 1, max: 1 };
      return rangeOf(left.min + right.min, left.max + right.max);
    case "-":
      return node.left.key === node.right.key
        ? { min: 0, max: 0 }
        : rangeOf(left.min - right.max, left.max - right.min);
    case "*":
      // Repeated factors are correlated: x*x cannot be negative when its interval crosses zero.
      if (node.left.key === node.right.key) {
        return rangeOf(containsZero(left) ? 0 : left.min ** 2, left.min ** 2, left.max ** 2);
      }
      return rangeOf(
        left.min * right.min,
        left.min * right.max,
        left.max * right.min,
        left.max * right.max,
      );
    case "/":
      if (containsZero(right)) {
        throw new UncertainDomain("分母が0になる可能性があります。");
      }
      return rangeOf(
        left.min / right.min,
        left.min / right.max,
        left.max / right.min,
        left.max / right.max,
      );
    case "^": {
      if (right.min === right.max && Number.isSafeInteger(right.min)) {
        const exponent = right.min;
        if (exponent === 0 && containsZero(left)) {
          throw new UncertainDomain("累乗に0の0乗を含む可能性があります。");
        }
        if (exponent < 0 && containsZero(left)) {
          throw new UncertainDomain("負の指数の底が0になる可能性があります。");
        }
        const endpoints = rangeOf(left.min ** exponent, left.max ** exponent);
        if (exponent > 0 && exponent % 2 === 0 && containsZero(left)) endpoints.min = 0;
        return endpoints;
      }
      if (left.min < 0 || (left.min === 0 && right.min <= 0)) {
        throw new UncertainDomain("累乗を実数として連続に計算できない可能性があります。");
      }
      return rangeOf(
        left.min ** right.min,
        left.min ** right.max,
        left.max ** right.min,
        left.max ** right.max,
      );
    }
  }
}

const constantRange = (value: number): Range => ({ min: value, max: value });
const zeroDerivative = (value: Range) => value.min === 0 && value.max === 0;
const addRanges = (left: Range, right: Range) =>
  rangeOf(left.min + right.min, left.max + right.max);
const subtractRanges = (left: Range, right: Range) =>
  rangeOf(left.min - right.max, left.max - right.min);
const multiplyRanges = (left: Range, right: Range) =>
  rangeOf(left.min * right.min, left.min * right.max, left.max * right.min, left.max * right.max);
const divideRanges = (left: Range, right: Range) => {
  if (containsZero(right)) throw new UncertainDomain("導関数の範囲が有限に定まりません。");
  return rangeOf(
    left.min / right.min,
    left.min / right.max,
    left.max / right.min,
    left.max / right.max,
  );
};
function powerRange(base: Range, exponent: number): Range {
  if (exponent === 0) return constantRange(1);
  if ((exponent < 0 && containsZero(base)) || (base.min < 0 && !Number.isSafeInteger(exponent))) {
    throw new UncertainDomain("導関数の累乗を有限の実数として評価できません。");
  }
  const result = rangeOf(base.min ** exponent, base.max ** exponent);
  if (exponent > 0 && exponent % 2 === 0 && containsZero(base)) result.min = 0;
  return result;
}

function derivative(node: Node, x: Range, state: IntervalState): Range | null {
  if (state.derivatives.has(node.key)) return state.derivatives.get(node.key)!;
  let result: Range | null;
  try {
    result = calculateDerivative(node, x, state);
  } catch (error) {
    if (!(error instanceof UncertainDomain)) throw error;
    result = null;
  }
  state.derivatives.set(node.key, result);
  return result;
}

function centeredRange(node: Node, x: Range, value: Range, slope: Range): Range {
  const midpoint = x.min + (x.max - x.min) / 2;
  const center = evaluate(node, midpoint);
  const delta = multiplyRanges(slope, { min: x.min - midpoint, max: x.max - midpoint });
  const rounding =
    64 * Number.EPSILON * Math.max(Math.abs(center), Math.abs(delta.min), Math.abs(delta.max));
  const min = Math.max(value.min, center + delta.min - rounding),
    max = Math.min(value.max, center + delta.max + rounding);
  return min <= max ? { min, max } : value;
}

function calculateDerivative(node: Node, x: Range, state: IntervalState): Range | null {
  if (node.kind === "number") return constantRange(0);
  if (node.kind === "x") return constantRange(1);
  if (node.kind === "unary") {
    const argument = derivative(node.argument, x, state);
    return (
      argument && (node.operator === "-" ? { min: -argument.max, max: -argument.min } : argument)
    );
  }
  if (node.kind === "call") {
    const slope = derivative(node.argument, x, state);
    if (!slope || zeroDerivative(slope)) return slope;
    const argument = centeredRange(node.argument, x, interval(node.argument, x, state), slope),
      value = interval(node, x, state);
    let factor: Range;
    switch (node.name) {
      case "sin":
        factor = trigonometricRange("cos", argument);
        break;
      case "cos": {
        const sine = trigonometricRange("sin", argument);
        factor = { min: -sine.max, max: -sine.min };
        break;
      }
      case "tan":
        factor = addRanges(constantRange(1), powerRange(value, 2));
        break;
      case "asin":
      case "acos": {
        const remaining = subtractRanges(constantRange(1), powerRange(argument, 2));
        if (remaining.min <= 0) return null;
        const denominator = powerRange(remaining, 0.5);
        factor = divideRanges(constantRange(node.name === "asin" ? 1 : -1), denominator);
        break;
      }
      case "atan":
        factor = divideRanges(
          constantRange(1),
          addRanges(constantRange(1), powerRange(argument, 2)),
        );
        break;
      case "exp":
        factor = rangeOf(intervalCall("exp", argument.min), intervalCall("exp", argument.max));
        break;
      case "ln":
      case "log":
        factor = divideRanges(constantRange(1), argument);
        break;
      case "log10":
        factor = divideRanges(constantRange(1), multiplyRanges(argument, constantRange(Math.LN10)));
        break;
      case "sqrt":
        factor = divideRanges(constantRange(1), multiplyRanges(constantRange(2), value));
        break;
      case "abs":
        factor =
          argument.min >= 0
            ? constantRange(1)
            : argument.max <= 0
              ? constantRange(-1)
              : { min: -1, max: 1 };
    }
    return multiplyRanges(factor, slope);
  }
  // Domain checks run first; cancellation must not admit an undefined expression such as 1/x-1/x.
  if ((node.operator === "-" || node.operator === "/") && node.left.key === node.right.key) {
    return constantRange(0);
  }
  if (node.operator === "+" && complementarySquares(node.left, node.right)) {
    return constantRange(0);
  }
  const left = interval(node.left, x, state),
    right = interval(node.right, x, state),
    leftSlope = derivative(node.left, x, state),
    rightSlope = derivative(node.right, x, state);
  if (node.operator === "^") {
    if (left.min === left.max && (left.min === 1 || (left.min === 0 && right.min > 0))) {
      return constantRange(0);
    }
    if (rightSlope && zeroDerivative(rightSlope) && right.min === right.max) {
      if (right.min === 0) return constantRange(0);
      if (!leftSlope || zeroDerivative(leftSlope)) return leftSlope;
      return multiplyRanges(
        multiplyRanges(constantRange(right.min), powerRange(left, right.min - 1)),
        leftSlope,
      );
    }
    if (!leftSlope || !rightSlope || left.min <= 0) return null;
    const logarithm = rangeOf(Math.log(left.min), Math.log(left.max));
    return multiplyRanges(
      interval(node, x, state),
      addRanges(
        multiplyRanges(rightSlope, logarithm),
        divideRanges(multiplyRanges(right, leftSlope), left),
      ),
    );
  }
  if (!leftSlope || !rightSlope) return null;
  switch (node.operator) {
    case "+":
      return addRanges(leftSlope, rightSlope);
    case "-":
      return subtractRanges(leftSlope, rightSlope);
    case "*":
      return addRanges(multiplyRanges(leftSlope, right), multiplyRanges(left, rightSlope));
    case "/":
      return divideRanges(
        subtractRanges(multiplyRanges(leftSlope, right), multiplyRanges(left, rightSlope)),
        powerRange(right, 2),
      );
  }
}

/** Parse a bounded mathematical expression, then draw only a continuous, finite sampled curve. */
export function buildChartFormula(input: ChartFormula): ChartFormulaResult {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !["expression", "xMin", "xMax", "samples"].includes(key)) ||
    typeof input.expression !== "string" ||
    !input.expression.trim() ||
    input.expression.length > 500
  ) {
    throw new Error("理論式を500文字以内で指定してください。");
  }
  const { xMin, xMax } = input,
    samples = input.samples === undefined ? 201 : input.samples;
  if (
    !Number.isFinite(xMin) ||
    !Number.isFinite(xMax) ||
    Math.abs(xMin) > valueLimit ||
    Math.abs(xMax) > valueLimit ||
    xMin >= xMax
  ) {
    throw new Error("理論式のX範囲は絶対値1兆以下の数値で、最小値より最大値を大きくしてください。");
  }
  if (!Number.isInteger(samples) || samples < 21 || samples > maxPoints) {
    throw new Error("理論式の描画点数の目安は21〜1001の整数で指定してください。");
  }
  const expression = input.expression.trim().replace(/^y\s*=\s*/u, ""),
    node = parse(expression),
    cache = new Map<number, Point>();
  let yMin = Infinity,
    yMax = -Infinity;
  const at = (x: number): Point => {
    const previous = cache.get(x);
    if (previous) return previous;
    if (cache.size >= maxEvaluations) {
      throw new Error(
        "理論式の計算量が上限を超えました。式を簡単にするか、Xの範囲を狭めてください。",
      );
    }
    let y: number;
    try {
      y = evaluate(node, x);
      if (Math.abs(y) > valueLimit) {
        throw new Error("Yの絶対値が1兆を超えています。");
      }
    } catch (error) {
      throw new Error(
        `理論式のx=${x}：${error instanceof Error ? error.message : "計算できません。"}`,
      );
    }
    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);
    const point = { x, y };
    cache.set(x, point);
    return point;
  };
  const initial = Array.from({ length: samples }, (_, index) =>
    at(index === samples - 1 ? xMax : xMin + (xMax - xMin) * (index / (samples - 1))),
  );
  if (initial.some((point, index) => index > 0 && point.x <= initial[index - 1]!.x)) {
    throw new Error(
      "このXの範囲では描画点を区別できません。範囲を広げるか、描画点数の目安を減らしてください。",
    );
  }
  let pointCount = initial.length;
  const points: Point[] = [initial[0]!];
  const refine = (left: Point, right: Point, depth: number) => {
    const state: IntervalState = {
      oscillates: false,
      values: new Map(),
      derivatives: new Map(),
    };
    const xRange = { min: left.x, max: right.x };
    let domainProblem = "";
    let valueRange: Range | undefined;
    try {
      valueRange = interval(node, xRange, state);
    } catch (error) {
      if (!(error instanceof UncertainDomain)) throw error;
      domainProblem = error.message;
    }
    const probes = [0.25, 0.5, 0.75]
      .map((fraction) => left.x + (right.x - left.x) * fraction)
      .filter((x, index, values) => x > left.x && x < right.x && values.indexOf(x) === index)
      .map(at);
    const tolerance = Math.max(
      (yMax - yMin) * 0.0005,
      Math.max(Math.abs(yMin), Math.abs(yMax)) * Number.EPSILON * 64,
      Number.MIN_VALUE * 16,
    );
    const curved = probes.some((point) => {
      const predicted = left.y + (right.y - left.y) * ((point.x - left.x) / (right.x - left.x));
      return Math.abs(point.y - predicted) > tolerance;
    });
    const slopes = valueRange ? derivative(node, xRange, state) : null;
    // Point probes can miss narrow peaks. A slope enclosure also bounds changes between probes.
    // With f' in [m,M], departure from the endpoint chord is at most (M-m)*(b-a)/4.
    // At sqrt/asin endpoints the derivative can be unbounded while the function stays continuous;
    // only those intervals use the looser function-value enclosure instead.
    const enclosedError = slopes
      ? ((slopes.max - slopes.min) * (right.x - left.x)) / 4
      : valueRange
        ? Math.max(
            valueRange.max - Math.min(left.y, right.y),
            Math.max(left.y, right.y) - valueRange.min,
          )
        : Infinity;
    if (domainProblem || state.oscillates || curved || enclosedError > tolerance) {
      const middle = left.x + (right.x - left.x) / 2;
      if (depth >= maxDepth || pointCount >= maxPoints || middle <= left.x || middle >= right.x) {
        throw new Error(
          domainProblem
            ? `理論式の連続性を確認できません。${domainProblem}式かXの範囲を変更してください。`
            : "理論式の細かな変化を描画上限（1001点）内で確認できません。Xの範囲を狭めてください。",
        );
      }
      pointCount += 1;
      const midpoint = at(middle);
      refine(left, midpoint, depth + 1);
      refine(midpoint, right, depth + 1);
    } else {
      points.push(right);
    }
  };
  for (let index = 1; index < initial.length; index += 1) {
    refine(initial[index - 1]!, initial[index]!, 0);
  }
  return {
    expression,
    domain: [xMin, xMax],
    points,
    sampleCount: points.length,
    note: `指定したXの範囲で式を数値計算し、${points.length}点を線で結んでいます。曲がり方に応じて描画点を追加します。三角関数の角度はラジアンです。`,
  };
}


/** Convert the limited formula language into TeX, not arbitrary user-supplied TeX. */
export function chartFormulaToTex(expression: string): string {
  const source = expression.trim().replace(/^y\s*=\s*/u, "");
  if (!source || source.length > 500) {
    throw new Error("理論式を500文字以内で指定してください。");
  }
  const wrap = (node: Node): string => String.raw`\left(${tex(node)}\right)`;
  const tex = (node: Node): string => {
    if (node.kind === "number") {
      const value = String(node.value);
      const scientific = /^(-?(?:\d+(?:\.\d+)?|\.\d+))e([+-]?\d+)$/u.exec(value);
      return scientific
        ? String.raw`${scientific[1]}\times 10^{${Number(scientific[2])}}`
        : value;
    }
    if (node.kind === "x") return "x";
    if (node.kind === "unary") {
      return node.operator + (node.argument.kind === "binary" &&
        (node.argument.operator === "+" || node.argument.operator === "-")
        ? wrap(node.argument) : tex(node.argument));
    }
    if (node.kind === "call") {
      const argument = tex(node.argument);
      if (node.name === "sqrt") return String.raw`\sqrt{${argument}}`;
      if (node.name === "abs") return String.raw`\left|${argument}\right|`;
      const name: Record<FunctionName, string> = {
        sin: "sin", cos: "cos", tan: "tan",
        asin: "arcsin", acos: "arccos", atan: "arctan",
        exp: "exp", ln: "ln", log: "log", log10: "log_{10}",
        sqrt: "sqrt", abs: "abs",
      };
      return "\\" + name[node.name] + String.raw`\left(${argument}\right)`;
    }
    const { left, right, operator } = node;
    if (operator === "/") return String.raw`\frac{${tex(left)}}{${tex(right)}}`;
    if (operator === "^") return String.raw`{${left.kind === "binary" || left.kind === "unary" ? wrap(left) : tex(left)}}^{${tex(right)}}`;
    const l = left.kind === "binary" && ["+", "-"].includes(left.operator) && operator === "*"
      ? wrap(left) : tex(left);
    const r = right.kind === "binary" && ["+", "-"].includes(right.operator)
      && (operator === "*" || operator === "-") ? wrap(right) : tex(right);
    return `${l} ${operator === "*" ? String.raw`\cdot` : operator} ${r}`;
  };
  return tex(parse(source));
}
