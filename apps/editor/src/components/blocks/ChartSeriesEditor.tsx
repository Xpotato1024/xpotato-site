import { useEffect, useRef, useState } from "react";
import { BlockIcon } from "./BlockIcon.js";

interface Point {
  x: string;
  y: string;
}
interface Series {
  label: string;
  points: Point[];
}
function readSeries(value: string): Series[] | null {
  try {
    const data: unknown = JSON.parse(value);
    if (
      !Array.isArray(data) ||
      !data.every(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof item.label === "string" &&
          Array.isArray(item.points) &&
          item.points.every(
            (point: Record<string, unknown>) =>
              point &&
              [point.x, point.y].every(
                (value) =>
                  typeof value === "string" ||
                  (typeof value === "number" && Number.isFinite(value)),
              ),
          ),
      )
    )
      return null;
    return data.map((item) => ({
      label: item.label,
      points: item.points.map((point: Point) => ({ x: String(point.x), y: String(point.y) })),
    }));
  } catch {
    return null;
  }
}
function serializeSeries(series: Series[]) {
  const number = (text: string) =>
    text.trim() &&
    /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/u.test(text.trim()) &&
    Number.isFinite(Number(text))
      ? Number(text)
      : text;
  return JSON.stringify(
    series.map((item) => ({
      ...item,
      points: item.points.map((point) => ({ x: number(point.x), y: number(point.y) })),
    })),
  );
}

export function ChartSeriesEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [series, setSeries] = useState(() => readSeries(value));
  const emitted = useRef(value);
  useEffect(() => {
    if (value !== emitted.current) {
      setSeries(readSeries(value));
      emitted.current = value;
    }
  }, [value]);
  if (!series)
    return (
      <label>
        系列の値（JSON）
        <textarea rows={5} value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  const set = (next: Series[]) => {
    setSeries(next);
    emitted.current = serializeSeries(next);
    onChange(emitted.current);
  };
  const update = (index: number, edit: (item: Series) => Series) =>
    set(series.map((item, position) => (position === index ? edit(item) : item)));
  return (
    <fieldset className="cms-chart-fields">
      <legend>系列・測定点</legend>
      {series.map((item, index) => (
        <fieldset key={index} className="cms-chart-series">
          <legend>系列 {index + 1}</legend>
          <label>
            名前
            <input
              aria-label={`系列${index + 1}の名前`}
              value={item.label}
              onChange={(event) =>
                update(index, (previous) => ({ ...previous, label: event.target.value }))
              }
            />
          </label>
          <div className="cms-chart-series-points">
            {item.points.map((point, position) => (
              <div className="cms-chart-point" key={position}>
                {(["x", "y"] as const).map((axis) => (
                  <label key={axis}>
                    {axis.toUpperCase()}
                    <input
                      type="text"
                      inputMode="decimal"
                      spellCheck={false}
                      aria-label={`系列${index + 1}の点${position + 1} ${axis.toUpperCase()}`}
                      value={point[axis]}
                      onChange={(event) =>
                        update(index, (previous) => ({
                          ...previous,
                          points: previous.points.map((original, n) =>
                            n === position ? { ...original, [axis]: event.target.value } : original,
                          ),
                        }))
                      }
                    />
                  </label>
                ))}
                <button
                  type="button"
                  aria-label={`系列${index + 1}の点${position + 1}を削除`}
                  disabled={item.points.length <= 1}
                  onClick={() =>
                    update(index, (previous) => ({
                      ...previous,
                      points: previous.points.filter((_, n) => n !== position),
                    }))
                  }
                >
                  <BlockIcon name="remove" />
                </button>
              </div>
            ))}
          </div>
          <div className="cms-chart-series-actions">
            <button
              type="button"
              disabled={item.points.length >= 500}
              onClick={() =>
                update(index, (previous) => ({
                  ...previous,
                  points: [...previous.points, { x: "", y: "" }],
                }))
              }
            >
              <BlockIcon name="plus" />
              点を追加
            </button>
            <button
              type="button"
              disabled={series.length <= 1}
              onClick={() => set(series.filter((_, n) => n !== index))}
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
    </fieldset>
  );
}
