import { useEffect, useRef, useState } from "react";
import { ChartCsvImport } from "./ChartCsvImport.js";
import { BlockIcon } from "./BlockIcon.js";

interface Point {
  x: string;
  y: string;
}
const fitMethods = ["linear", "quad", "poly", "exp", "log", "pow", "loess"] as const;
type FitMethod = (typeof fitMethods)[number];
interface Fit {
  method: FitMethod;
  degree?: 3;
  bandwidth?: number | string;
}
interface PointSeries {
  label: string;
  points: Point[];
  role?: "observed" | "curve";
  fit?: Fit;
}
interface Formula {
  expression: string;
  xMin: string;
  xMax: string;
  samples?: string;
}
interface FormulaSeries {
  label: string;
  role: "formula";
  formula: Formula;
}
type Series = PointSeries | FormulaSeries;
const methodLabels: Record<FitMethod, string> = {
  linear: "線形",
  quad: "二次曲線",
  poly: "三次曲線",
  exp: "指数曲線",
  log: "対数曲線",
  pow: "べき乗曲線",
  loess: "LOESS（局所回帰）",
};
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function editableNumber(value: unknown): value is number | string {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}
function readSeries(value: string): Series[] | null {
  try {
    const data: unknown = JSON.parse(value);
    if (
      !Array.isArray(data) ||
      !data.every((item) => {
        if (!record(item) || typeof item.label !== "string") {
          return false;
        }
        if (item.role === "formula") {
          return (
            Object.keys(item).every((key) => ["label", "role", "formula"].includes(key)) &&
            record(item.formula) &&
            Object.keys(item.formula).every((key) =>
              ["expression", "xMin", "xMax", "samples"].includes(key),
            ) &&
            typeof item.formula.expression === "string" &&
            editableNumber(item.formula.xMin) &&
            editableNumber(item.formula.xMax) &&
            (item.formula.samples === undefined || editableNumber(item.formula.samples))
          );
        }
        if (
          Object.keys(item).some((key) => !["label", "points", "role", "fit"].includes(key)) ||
          (item.role !== undefined && item.role !== "observed" && item.role !== "curve") ||
          !Array.isArray(item.points) ||
          !item.points.every(
            (point) =>
              record(point) &&
              Object.keys(point).every((key) => key === "x" || key === "y") &&
              editableNumber(point.x) &&
              editableNumber(point.y),
          )
        ) {
          return false;
        }
        return (
          item.fit === undefined ||
          (record(item.fit) &&
            Object.keys(item.fit).every((key) => ["method", "degree", "bandwidth"].includes(key)) &&
            fitMethods.includes(item.fit.method as FitMethod) &&
            (item.fit.degree === undefined || item.fit.degree === 3) &&
            (item.fit.bandwidth === undefined || editableNumber(item.fit.bandwidth)))
        );
      })
    ) {
      return null;
    }
    return data.map((item) =>
      item.role === "formula"
        ? {
            ...item,
            formula: {
              ...item.formula,
              xMin: String(item.formula.xMin),
              xMax: String(item.formula.xMax),
              ...(item.formula.samples === undefined
                ? {}
                : { samples: String(item.formula.samples) }),
            },
          }
        : {
            ...item,
            points: item.points.map((point: Point) => ({ x: String(point.x), y: String(point.y) })),
          },
    ) as Series[];
  } catch {
    return null;
  }
}
function numericValue(text: string): number | string {
  const value = Number(text);
  if (
    !text.trim() ||
    !/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/u.test(text.trim()) ||
    !Number.isFinite(value) ||
    (value === 0 && /[1-9]/u.test(text.split(/[eE]/u)[0]!))
  ) {
    return text;
  }
  return value;
}
function serializeSeries(series: Series[]) {
  return JSON.stringify(
    series.map((item) => {
      if (item.role === "formula") {
        return {
          ...item,
          formula: {
            expression: item.formula.expression,
            xMin: numericValue(item.formula.xMin),
            xMax: numericValue(item.formula.xMax),
            ...(item.formula.samples?.trim()
              ? { samples: numericValue(item.formula.samples) }
              : {}),
          },
        };
      }
      return {
        ...item,
        ...(item.fit
          ? {
              fit: {
                ...item.fit,
                ...(typeof item.fit.bandwidth === "string"
                  ? { bandwidth: numericValue(item.fit.bandwidth) }
                  : {}),
              },
            }
          : {}),
        points: item.points.map((point) => ({
          x: numericValue(point.x),
          y: numericValue(point.y),
        })),
      };
    }),
  );
}

function ChartFormula({
  formula,
  seriesIndex,
  onChange,
}: {
  formula: Formula;
  seriesIndex: number;
  onChange: (formula: Formula) => void;
}) {
  return (
    <div className="cms-chart-formula">
      <label>
        理論式
        <span className="cms-chart-formula-expression">
          <span aria-hidden="true">y =</span>
          <input
            type="text"
            aria-label={`系列${seriesIndex + 1}の理論式`}
            value={formula.expression}
            maxLength={500}
            placeholder="0.5 * 9.81 * x^2"
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            onChange={(event) => onChange({ ...formula, expression: event.target.value })}
          />
        </span>
      </label>
      <div className="cms-chart-import-options">
        {(["xMin", "xMax"] as const).map((bound) => (
          <label key={bound}>
            描画するXの{bound === "xMin" ? "最小値" : "最大値"}
            <input
              type="text"
              inputMode="decimal"
              spellCheck={false}
              aria-label={`系列${seriesIndex + 1}の理論式 X${bound === "xMin" ? "最小値" : "最大値"}`}
              value={formula[bound]}
              onChange={(event) => onChange({ ...formula, [bound]: event.target.value })}
            />
          </label>
        ))}
        <label>
          描画点数の目安（21〜1001）
          <input
            type="text"
            inputMode="numeric"
            spellCheck={false}
            aria-label={`系列${seriesIndex + 1}の描画点数の目安`}
            value={formula.samples ?? ""}
            placeholder="201"
            onChange={(event) => onChange({ ...formula, samples: event.target.value })}
          />
        </label>
      </div>
      <p className="cms-chart-help">
        測定値がなくても描けます。式とXの範囲を保存し、必要に応じて点を増やして描画します。描画点数の目安は空欄で201です。
      </p>
      <p className="cms-chart-help">
        点数や計算の桁数には限りがあるため、ごく細かな変化や、大きな数同士を引いた小さな差は正確に描けないことがあります。
      </p>
      <details className="cms-chart-formula-help">
        <summary>式の書き方</summary>
        <p className="cms-chart-help">
          例：0.5 * 9.81 * x^2。掛け算は *、累乗は ^、括弧は ( ) を使います。変数は x、定数は pi と
          e が使えます。
        </p>
        <p className="cms-chart-help">
          sin、cos、tan、asin、acos、atan、exp、ln、log、log10、sqrt、abs が使えます。ln と log
          は自然対数、三角関数の角度はラジアンです。
        </p>
      </details>
    </div>
  );
}

function ChartPoints({
  points,
  seriesIndex,
  onChange,
}: {
  points: Point[];
  seriesIndex: number;
  onChange: (points: Point[]) => void;
}) {
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(points.length <= 12);
  const pageSize = 20;
  const lastPage = Math.max(0, Math.ceil(points.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const first = currentPage * pageSize;
  return (
    <details
      className="cms-chart-point-editor"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>点を編集（{points.length}点）</summary>
      {points.length > pageSize && (
        <nav className="cms-chart-series-actions" aria-label={`系列${seriesIndex + 1}の点のページ`}>
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            前の20点
          </button>
          <span role="status">
            {first + 1}–{Math.min(first + pageSize, points.length)} / {points.length}点
          </span>
          <button
            type="button"
            disabled={currentPage === lastPage}
            onClick={() => setPage(currentPage + 1)}
          >
            次の20点
          </button>
        </nav>
      )}
      <div className="cms-chart-series-points">
        {points.slice(first, first + pageSize).map((point, offset) => {
          const position = first + offset;
          return (
            <div className="cms-chart-point" key={position}>
              {(["x", "y"] as const).map((axis) => (
                <label key={axis}>
                  {axis.toUpperCase()}
                  <input
                    type="text"
                    inputMode="decimal"
                    spellCheck={false}
                    aria-label={`系列${seriesIndex + 1}の点${position + 1} ${axis.toUpperCase()}`}
                    value={point[axis]}
                    onChange={(event) =>
                      onChange(
                        points.map((original, index) =>
                          index === position
                            ? { ...original, [axis]: event.target.value }
                            : original,
                        ),
                      )
                    }
                  />
                </label>
              ))}
              <button
                type="button"
                aria-label={`系列${seriesIndex + 1}の点${position + 1}を削除`}
                disabled={points.length <= 1}
                onClick={() => onChange(points.filter((_, index) => index !== position))}
              >
                <BlockIcon name="remove" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        disabled={points.length >= 500}
        onClick={() => {
          setPage(Math.floor(points.length / pageSize));
          setExpanded(true);
          onChange([...points, { x: "", y: "" }]);
        }}
      >
        <BlockIcon name="plus" />
        点を追加
      </button>
    </details>
  );
}

export function ChartSeriesEditor({
  value,
  onChange,
  onAnalysisMode,
}: {
  value: string;
  onChange: (value: string) => void;
  onAnalysisMode: () => void;
}) {
  const [series, setSeries] = useState(() => readSeries(value));
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState("");
  const emitted = useRef(value);
  const importButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (value !== emitted.current) {
      setSeries(readSeries(value));
      setImporting(false);
      setStatus("");
      emitted.current = value;
    }
  }, [value]);
  if (!series) {
    return (
      <label>
        系列の値（JSON）
        <textarea rows={5} value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }
  const set = (next: Series[]) => {
    setSeries(next);
    emitted.current = serializeSeries(next);
    onChange(emitted.current);
  };
  const update = (index: number, edit: (item: Series) => Series) =>
    set(series.map((item, position) => (position === index ? edit(item) : item)));
  const updatePoints = (index: number, edit: (item: PointSeries) => PointSeries) =>
    update(index, (item) => (item.role === "formula" ? item : edit(item)));
  const closeImport = () => {
    setImporting(false);
    requestAnimationFrame(() => importButton.current?.focus());
  };
  return (
    <fieldset className="cms-chart-fields">
      <legend>系列・測定点・理論式</legend>
      <button
        ref={importButton}
        type="button"
        aria-expanded={importing}
        onClick={() => {
          setImporting(true);
          setStatus("");
        }}
        disabled={importing}
      >
        CSVを取り込む
      </button>
      {status && (
        <p className="cms-chart-help" role="status">
          {status}
        </p>
      )}
      {importing ? (
        <ChartCsvImport
          seriesLabels={series.map((item) => item.label)}
          onCancel={closeImport}
          onImport={(imported, replaceIndex) => {
            const next = imported.map((item) => ({
              ...item,
              points: item.points.map((point) => ({ x: String(point.x), y: String(point.y) })),
            }));
            set(
              replaceIndex === null
                ? [...series, ...next]
                : [...series.slice(0, replaceIndex), ...next, ...series.slice(replaceIndex + 1)],
            );
            if (imported.some((item) => item.role !== "curve")) {
              onAnalysisMode();
            }
            setStatus(
              `${imported.length}系列・各${imported[0]!.points.length}点を取り込みました。「設定を適用」でグラフに反映します。`,
            );
            closeImport();
          }}
        />
      ) : (
        <>
          {series.map((item, index) => (
            <fieldset key={index} className="cms-chart-series">
              <legend>系列 {index + 1}</legend>
              <div className="cms-chart-import-options">
                <label>
                  名前
                  <input
                    aria-label={`系列${index + 1}の名前`}
                    value={item.label}
                    maxLength={100}
                    onChange={(event) =>
                      update(index, (previous) => ({ ...previous, label: event.target.value }))
                    }
                  />
                </label>
                {item.role === "formula" ? (
                  <p className="cms-chart-help">理論式から描く曲線</p>
                ) : (
                  <label>
                    データの種類
                    <select
                      aria-label={`系列${index + 1}のデータの種類`}
                      value={item.role ?? "observed"}
                      onChange={(event) =>
                        updatePoints(index, (previous) => {
                          const next = {
                            ...previous,
                            role: event.target.value as "observed" | "curve",
                          };
                          if (next.role === "curve") {
                            delete next.fit;
                          }
                          return next;
                        })
                      }
                    >
                      <option value="observed">測定値</option>
                      <option value="curve">計算済みの点列</option>
                    </select>
                  </label>
                )}
                {item.role !== "formula" && item.role !== "curve" && (
                  <label>
                    近似方法
                    <select
                      aria-label={`系列${index + 1}の近似方法`}
                      value={item.fit?.method ?? "none"}
                      onChange={(event) => {
                        const method = event.target.value;
                        updatePoints(index, (previous) => {
                          const next = { ...previous };
                          if (method === "none") {
                            delete next.fit;
                          } else {
                            next.fit = {
                              method: method as FitMethod,
                              ...(method === "poly" ? { degree: 3 as const } : {}),
                              ...(method === "loess" ? { bandwidth: 0.3 } : {}),
                            };
                          }
                          return next;
                        });
                        if (method !== "none") {
                          onAnalysisMode();
                        }
                      }}
                    >
                      <option value="none">なし</option>
                      {fitMethods.map((method) => (
                        <option key={method} value={method}>
                          {methodLabels[method]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {item.role !== "formula" && item.fit?.method === "loess" && (
                  <label>
                    近傍の割合（0より大きく1以下）
                    <input
                      aria-label={`系列${index + 1}の近傍の割合`}
                      type="text"
                      inputMode="decimal"
                      value={item.fit.bandwidth ?? 0.3}
                      onChange={(event) =>
                        updatePoints(index, (previous) => ({
                          ...previous,
                          fit: { ...previous.fit!, bandwidth: event.target.value },
                        }))
                      }
                    />
                  </label>
                )}
              </div>
              {item.role !== "formula" && item.fit && (
                <p className="cms-chart-help">
                  近似曲線は「実験・近似曲線」で測定点に重ねます。全ての測定点を使い、測定したXの範囲内に描きます。
                </p>
              )}
              {item.role !== "formula" && item.fit?.method === "exp" && (
                <p className="cms-chart-help">
                  Yは全て正の値が必要です。Yを重みにしてln(Y)を近似します。
                </p>
              )}
              {item.role !== "formula" && item.fit?.method === "log" && (
                <p className="cms-chart-help">Xは全て正の値が必要です。</p>
              )}
              {item.role !== "formula" && item.fit?.method === "pow" && (
                <p className="cms-chart-help">
                  XとYは全て正の値が必要です。ln(X)とln(Y)を近似します。
                </p>
              )}
              {item.role !== "formula" && item.fit?.method === "loess" && (
                <p className="cms-chart-help">
                  近傍の割合を大きくすると広い範囲を使います。単一の近似式やR²は表示しません。
                </p>
              )}
              {item.role === "curve" && (
                <p className="cms-chart-help">
                  計算済みの点を線で結びます。Xを小さい順に並べてください。係数や適合度は計算しません。
                </p>
              )}
              {item.role === "formula" ? (
                <ChartFormula
                  formula={item.formula}
                  seriesIndex={index}
                  onChange={(formula) =>
                    update(index, (previous) =>
                      previous.role === "formula" ? { ...previous, formula } : previous,
                    )
                  }
                />
              ) : (
                <ChartPoints
                  points={item.points}
                  seriesIndex={index}
                  onChange={(points) =>
                    updatePoints(index, (previous) => ({ ...previous, points }))
                  }
                />
              )}
              <div className="cms-chart-series-actions">
                <button
                  type="button"
                  disabled={series.length <= 1}
                  onClick={() => set(series.filter((_, position) => position !== index))}
                >
                  <BlockIcon name="remove" />
                  系列を削除
                </button>
              </div>
            </fieldset>
          ))}
          <div className="cms-chart-series-actions">
            <button
              type="button"
              disabled={series.length >= 6}
              onClick={() =>
                set([
                  ...series,
                  {
                    label: `系列${series.length + 1}`,
                    points: [
                      { x: "", y: "" },
                      { x: "", y: "" },
                    ],
                  },
                ])
              }
            >
              <BlockIcon name="plus" />
              系列を追加
            </button>
            <button
              type="button"
              disabled={series.length >= 6}
              onClick={() => {
                set([
                  ...series,
                  {
                    label: `理論曲線${series.length + 1}`,
                    role: "formula",
                    formula: { expression: "x^2", xMin: "0", xMax: "10" },
                  },
                ]);
                onAnalysisMode();
                setStatus("理論式を追加しました。「設定を適用」でグラフに反映します。");
              }}
            >
              <BlockIcon name="plus" />
              理論式を追加
            </button>
          </div>
        </>
      )}
    </fieldset>
  );
}
