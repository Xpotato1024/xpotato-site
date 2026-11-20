declare module "vega-statistics" {
  export type RegressionModel = {
    coef: number[];
    predict: (x: number) => number;
    rSquared: number;
  };

  type Accessor<T> = (datum: T) => number;

  export function regressionLinear<T>(
    data: readonly T[],
    x: Accessor<T>,
    y: Accessor<T>,
  ): RegressionModel;
  export function regressionQuad<T>(
    data: readonly T[],
    x: Accessor<T>,
    y: Accessor<T>,
  ): RegressionModel;
  export function regressionPoly<T>(
    data: readonly T[],
    x: Accessor<T>,
    y: Accessor<T>,
    order: number,
  ): RegressionModel;
  export function regressionExp<T>(
    data: readonly T[],
    x: Accessor<T>,
    y: Accessor<T>,
  ): RegressionModel;
  export function regressionLoess<T>(
    data: readonly T[],
    x: Accessor<T>,
    y: Accessor<T>,
    bandwidth: number,
  ): Array<[number, number]>;
}
