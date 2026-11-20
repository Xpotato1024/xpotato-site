import { useEffect, useMemo, useRef, useState } from "react";
import {
  chartCsvLimits,
  mapChartCsv,
  parseChartCsv,
  type ChartCsvSeries,
  type CsvDelimiter,
} from "@xpotato/editor-core/chart-csv";

export function ChartCsvImport({
  seriesLabels,
  onImport,
  onCancel,
}: {
  seriesLabels: string[];
  onImport: (series: ChartCsvSeries[], replaceIndex: number | null) => void;
  onCancel: () => void;
}) {
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [filename, setFilename] = useState("");
  const [encoding, setEncoding] = useState("utf-8");
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(",");
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState("");
  const [xColumn, setXColumn] = useState(0);
  const [yColumns, setYColumns] = useState<number[]>([]);
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [role, setRole] = useState<"observed" | "curve">("observed");
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const readRevision = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    fileInput.current?.focus();
    return () => {
      readRevision.current += 1;
    };
  }, []);
  const parsed = useMemo(() => {
    if (!bytes) {
      return { table: null, error: "" };
    }
    let text: string;
    try {
      text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
    } catch {
      return {
        table: null,
        error:
          "文字コードを確認してください。文字化けする場合はUTF-8またはShift_JISを選び直してください。",
      };
    }
    try {
      return { table: parseChartCsv(text, delimiter), error: "" };
    } catch (error) {
      return {
        table: null,
        error: error instanceof Error ? error.message : "CSVを読み込めませんでした。",
      };
    }
  }, [bytes, encoding, delimiter]);
  useEffect(() => {
    setXColumn(0);
    setYColumns(parsed.table && parsed.table.headers.length > 1 ? [1] : []);
    setLabels({});
  }, [parsed.table]);
  const availableSeries =
    chartCsvLimits.maxSeries - seriesLabels.length + (replaceIndex === null ? 0 : 1);
  const mapped = useMemo(() => {
    if (!parsed.table) {
      return { series: null, error: "" };
    }
    if (availableSeries < 1) {
      return {
        series: null,
        error: "系列は6つまでです。取り込み先で置き換える系列を選んでください。",
      };
    }
    if (yColumns.length === 0) {
      return { series: null, error: "Yに使う列を1つ以上選んでください。" };
    }
    if (yColumns.length > availableSeries) {
      return {
        series: null,
        error: `この取り込み先には${availableSeries}系列まで取り込めます。Yの列を減らすか、取り込み先を変更してください。`,
      };
    }
    try {
      return {
        series: mapChartCsv(parsed.table, {
          xColumn,
          yColumns,
          labels: yColumns.map((column) => labels[column] ?? parsed.table!.headers[column]!),
          role,
        }),
        error: "",
      };
    } catch (error) {
      return {
        series: null,
        error: error instanceof Error ? error.message : "選択した列を確認してください。",
      };
    }
  }, [parsed.table, xColumn, yColumns, labels, role, availableSeries]);
  const readFile = async (file: File | undefined) => {
    const revision = ++readRevision.current;
    setBytes(null);
    setReadError("");
    setFilename(file?.name ?? "");
    setReading(false);
    if (!file) {
      return;
    }
    if (file.size > chartCsvLimits.maxBytes) {
      setReadError("1MB以下のCSVを選んでください。");
      return;
    }
    setReading(true);
    setDelimiter(/\.tsv$/iu.test(file.name) ? "\t" : ",");
    try {
      const nextBytes = await file.arrayBuffer();
      if (readRevision.current === revision) {
        setBytes(nextBytes);
      }
    } catch {
      if (readRevision.current === revision) {
        setReadError("ファイルを読み込めませんでした。もう一度選んでください。");
      }
    } finally {
      if (readRevision.current === revision) {
        setReading(false);
      }
    }
  };
  const table = parsed.table;
  const error = readError || parsed.error || mapped.error;
  return (
    <fieldset className="cms-chart-csv">
      <legend>CSVを取り込む</legend>
      <p className="cms-chart-help">先頭行を列名にしたCSV・TSVを選びます。500行・32列・1MBまで。</p>
      <label>
        ファイル
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.tsv,text/csv,text/tab-separated-values"
          onChange={(event) => void readFile(event.target.files?.[0])}
        />
      </label>
      <div className="cms-chart-import-options">
        <label>
          文字コード
          <select value={encoding} onChange={(event) => setEncoding(event.target.value)}>
            <option value="utf-8">UTF-8</option>
            <option value="shift_jis">Shift_JIS</option>
          </select>
        </label>
        <label>
          区切り文字
          <select
            value={delimiter}
            onChange={(event) => setDelimiter(event.target.value as CsvDelimiter)}
          >
            <option value=",">カンマ</option>
            <option value={"\t"}>タブ</option>
            <option value=";">セミコロン</option>
          </select>
        </label>
        <label>
          取り込み先
          <select
            value={replaceIndex === null ? "append" : String(replaceIndex)}
            onChange={(event) =>
              setReplaceIndex(event.target.value === "append" ? null : Number(event.target.value))
            }
          >
            <option value="append">新しい系列として追加</option>
            {seriesLabels.map((label, index) => (
              <option
                key={index}
                value={index}
              >{`系列${index + 1}「${label}」を置き換える`}</option>
            ))}
          </select>
        </label>
        <label>
          データの種類
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "observed" | "curve")}
          >
            <option value="observed">測定値</option>
            <option value="curve">計算済み・理論曲線</option>
          </select>
        </label>
      </div>
      {reading && <p role="status">読み込んでいます。</p>}
      {table && (
        <>
          <div
            className="cms-chart-csv-preview"
            tabIndex={0}
            role="region"
            aria-label="CSVの先頭5行"
          >
            <table>
              <caption>
                {filename}：{table.rows.length}行（先頭5行を表示）
              </caption>
              <thead>
                <tr>
                  <th scope="col">行</th>
                  {table.headers.map((header, index) => (
                    <th scope="col" key={index}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.slice(0, 5).map((row) => (
                  <tr key={row.line}>
                    <th scope="row">{row.line}</th>
                    {row.cells.map((cell, index) => (
                      <td key={index}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label>
            Xに使う列
            <select
              value={xColumn}
              onChange={(event) => {
                const column = Number(event.target.value);
                setXColumn(column);
                setYColumns((current) => current.filter((index) => index !== column));
              }}
            >
              {table.headers.map((header, index) => (
                <option key={index} value={index}>
                  {header}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="cms-chart-csv-columns">
            <legend>Yに使う列・系列名</legend>
            {table.headers.map(
              (header, column) =>
                column !== xColumn && (
                  <div className="cms-chart-csv-column" key={column}>
                    <label className="cms-check-field">
                      <input
                        type="checkbox"
                        checked={yColumns.includes(column)}
                        onChange={(event) => {
                          setYColumns((current) =>
                            event.target.checked
                              ? [...current, column].sort((a, b) => a - b)
                              : current.filter((index) => index !== column),
                          );
                        }}
                      />
                      {header}
                    </label>
                    {yColumns.includes(column) && (
                      <label>
                        系列名
                        <input
                          aria-label={`${header}列の系列名`}
                          maxLength={100}
                          value={labels[column] ?? header}
                          onChange={(event) =>
                            setLabels((current) => ({ ...current, [column]: event.target.value }))
                          }
                        />
                      </label>
                    )}
                  </div>
                ),
            )}
          </fieldset>
          <p className="cms-chart-help">
            軸の名前と単位は、グラフ設定の「横軸」「縦軸」で指定してください。
          </p>
          {role === "observed" && (
            <p className="cms-chart-help">
              測定値を取り込むと、グラフの表示を「実験・近似曲線」に切り替えます。
            </p>
          )}
          {role === "curve" && (
            <p className="cms-chart-help">
              計算済みの点を線で結びます。Xを小さい順に並べてください。係数や適合度は計算しません。
            </p>
          )}
        </>
      )}
      {error && (
        <p className="cms-field-error" role="alert">
          {error}
        </p>
      )}
      {mapped.series && (
        <p role="status" className="cms-chart-help">
          {mapped.series.length}系列・各{mapped.series[0]!.points.length}点を
          {replaceIndex === null ? "追加します。" : `系列${replaceIndex + 1}と置き換えます。`}
        </p>
      )}
      <div className="cms-chart-series-actions">
        <button
          type="button"
          className="primary"
          disabled={!mapped.series || reading}
          onClick={() => {
            if (mapped.series) {
              onImport(mapped.series, replaceIndex);
            }
          }}
        >
          {replaceIndex === null ? "系列を追加して取り込む" : "系列を置き換えて取り込む"}
        </button>
        <button type="button" onClick={onCancel}>
          取り込みをキャンセル
        </button>
      </div>
    </fieldset>
  );
}
