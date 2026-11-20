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
interface Series {
  label: string;
  points: Point[];
  role?: "observed" | "curve";
  fit?: Fit;
}
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
        if (
          !record(item) ||
          Object.keys(item).some((key) => !["label", "points", "role", "fit"].includes(key)) ||
          typeof item.label !== "string" ||
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
    return data.map((item) => ({
      ...item,
      points: item.points.map((point: Point) => ({ x: String(point.x), y: String(point.y) })),
    })) as Series[];
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
    series.map((item) => ({
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
      points: item.points.map((point) => ({ x: numericValue(point.x), y: numericValue(point.y) })),
    })),
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
  const closeImport = () => {
    setImporting(false);
    requestAnimationFrame(() => importButton.current?.focus());
  };
  return (
    <fieldset className="cms-chart-fields">
      <legend>系列・測定点</legend>
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
                <label>
                  データの種類
                  <select
                    aria-label={`系列${index + 1}のデータの種類`}
                    value={item.role ?? "observed"}
                    onChange={(event) =>
                      update(index, (previous) => {
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
                    <option value="curve">計算済み・理論曲線</option>
                  </select>
                </label>
                {item.role !== "curve" && (
                  <label>
                    近似方法
                    <select
                      aria-label={`系列${index + 1}の近似方法`}
                      value={item.fit?.method ?? "none"}
                      onChange={(event) => {
                        const method = event.target.value;
                        update(index, (previous) => {
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
                {item.fit?.method === "loess" && (
                  <label>
                    近傍の割合（0より大きく1以下）
                    <input
                      aria-label={`系列${index + 1}の近傍の割合`}
                      type="text"
                      inputMode="decimal"
                      value={item.fit.bandwidth ?? 0.3}
                      onChange={(event) =>
                        update(index, (previous) => ({
                          ...previous,
                          fit: { ...previous.fit!, bandwidth: event.target.value },
                        }))
                      }
                    />
                  </label>
                )}
              </div>
              {item.fit && (
                <p className="cms-chart-help">
                  近似曲線は「実験・近似曲線」で測定点に重ねます。全ての測定点を使い、測定したXの範囲内に描きます。
                </p>
              )}
              {item.fit?.method === "exp" && (
                <p className="cms-chart-help">
                  Yは全て正の値が必要です。Yを重みにしてln(Y)を近似します。
                </p>
              )}
              {item.fit?.method === "log" && (
                <p className="cms-chart-help">Xは全て正の値が必要です。</p>
              )}
              {item.fit?.method === "pow" && (
                <p className="cms-chart-help">
                  XとYは全て正の値が必要です。ln(X)とln(Y)を近似します。
                </p>
              )}
              {item.fit?.method === "loess" && (
                <p className="cms-chart-help">
                  近傍の割合を大きくすると広い範囲を使います。単一の近似式やR²は表示しません。
                </p>
              )}
              {item.role === "curve" && (
                <p className="cms-chart-help">
                  計算済みの点を線で結びます。Xを小さい順に並べてください。係数や適合度は計算しません。
                </p>
              )}
              <ChartPoints
                points={item.points}
                seriesIndex={index}
                onChange={(points) => update(index, (previous) => ({ ...previous, points }))}
              />
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
        </>
      )}
    </fieldset>
  );
}
