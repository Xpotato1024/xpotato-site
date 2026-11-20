import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { semanticContentModuleJsonSchemas } from "@xpotato/content-contracts/content";
import { renderLineChart } from "@xpotato/portable-content/charts";
import { ChartSeriesEditor } from "./ChartSeriesEditor.js";
import { ChartAxisSettings, chartAxisFields } from "./ChartAxisSettings.js";
import { LineChartPreview } from "./LineChartPreview.js";
import { BlockIcon } from "./BlockIcon.js";
import {
  readModuleSource,
  updateModuleChildren,
  updateModuleProps,
  moduleChildKinds,
  flowChildKinds,
  blockTree,
} from "@xpotato/editor-core/blocks";
export interface EditorMedia {
  id: string;
  label?: string;
  src?: string;
}
export interface EditorTool {
  id: string;
  label: string;
}
interface FieldSchema {
  type?: string;
  enum?: unknown[];
  maxLength?: number;
  minLength?: number;
}
interface ModuleSchema {
  properties?: Record<string, FieldSchema>;
  required?: string[];
}
const schemas = semanticContentModuleJsonSchemas() as Record<string, ModuleSchema>;
const labels: Record<string, string> = {
  asset: "画像",
  alt: "代替テキスト",
  title: "タイトル",
  caption: "キャプション",
  note: "補記",
  credit: "クレジット",
  sourceUrl: "出典URL",
  width: "表示幅",
  label: "ラベル",
  layout: "画像の種類",
  columns: "PCの列数",
  tabletColumns: "タブレットの列数",
  mobileColumns: "モバイルの列数",
  gap: "画像の間隔",
  fit: "画像の収め方",
  kind: "種類",
  analysisDisplay: "近似式・計算情報の表示",
  summary: "開閉ラベル",
  open: "初めから開く",
  module: "ツール",
  description: "説明",
  href: "リンク先URL",
  external: "外部リンクとして表示",
  symptom: "症状",
  check: "確認すること",
  action: "対処方法",
  reason: "理由",
  result: "結果",
  leftLabel: "左側のラベル",
  rightLabel: "右側のラベル",
  unit: "単位",
  max: "最大値",
  rows: "グラフの値",
  series: "測定系列",
  xLabel: "横軸（単位を含む）",
  yLabel: "縦軸（単位を含む）",
  xMin: "横軸の最小値",
  xMax: "横軸の最大値",
  yMin: "縦軸の最小値",
  yMax: "縦軸の最大値",
  xPadding: "横軸の余白",
  yPadding: "縦軸の余白",
};
const choices: Record<string, string> = {
  content: "本文幅",
  wide: "広く",
  full: "全幅",
  compact: "小さく",
  images: "写真・画像",
  diagrams: "図・説明",
  none: "なし",
  small: "狭い",
  medium: "標準",
  large: "広い",
  contain: "全体を表示",
  cover: "枠に合わせる",
  note: "補足",
  tip: "ヒント",
  warning: "注意",
  important: "重要",
  line: "折れ線",
  scatter: "散布図",
  analysis: "実験・近似曲線",
  concise: "簡潔（TeX数式・R²・RMSE）",
  detailed: "詳細（計算座標・係数も確認）",
  hidden: "非表示（グラフとデータ表だけ）",
};
const names: Record<string, string> = {
  Group: "グループ",
  Figure: "画像・図",
  Gallery: "ギャラリー",
  Callout: "補足・注意",
  Steps: "手順",
  Step: "手順",
  Comparison: "比較",
  LinkCard: "リンクカード",
  Details: "折りたたみ",
  Demo: "ブラウザツール",
  DiagnosticList: "症状と対処",
  DiagnosticItem: "症状",
  ArticleEndnote: "エンドノート",
  BarChart: "棒グラフ",
  LineChart: "折れ線・散布図・近似曲線",
  ComparisonCase: "比較条件",
};
interface ChartRow {
  label: string;
  value: number | string;
  note?: string;
  tone?: string;
}
function readRows(value: string): ChartRow[] | null {
  try {
    const data: unknown = JSON.parse(value);
    return Array.isArray(data) &&
      data.every(
        (row) =>
          row &&
          typeof row === "object" &&
          typeof row.label === "string" &&
          ["number", "string"].includes(typeof row.value),
      )
      ? (data as ChartRow[])
      : null;
  } catch {
    return null;
  }
}
function ChartRows({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rows = readRows(value);
  if (!rows)
    return (
      <label>
        グラフの値（JSON）
        <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  const change = (index: number, patch: Partial<ChartRow>) =>
    onChange(JSON.stringify(rows.map((row, i) => (i === index ? { ...row, ...patch } : row))));
  return (
    <fieldset className="cms-chart-fields">
      <legend>グラフの値</legend>
      {rows.map((row, index) => (
        <div className="cms-chart-row" key={index}>
          <label>
            項目
            <input
              value={row.label}
              onChange={(event) => change(index, { label: event.target.value })}
            />
          </label>
          <label>
            値
            <input
              type="number"
              min="0"
              step="any"
              value={row.value}
              onChange={(event) =>
                change(index, {
                  value: event.target.value === "" ? "" : Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            補記
            <input
              value={row.note ?? ""}
              onChange={(event) => {
                const next = { ...row };
                if (event.target.value) next.note = event.target.value;
                else delete next.note;
                onChange(JSON.stringify(rows.map((r, i) => (i === index ? next : r))));
              }}
            />
          </label>
          <label>
            色
            <select
              value={row.tone ?? "accent"}
              onChange={(event) => change(index, { tone: event.target.value })}
            >
              <option value="accent">強調</option>
              <option value="muted">控えめ</option>
            </select>
          </label>
          <button
            type="button"
            aria-label={"グラフの項目" + (index + 1) + "を削除"}
            disabled={rows.length <= 1}
            onClick={() => onChange(JSON.stringify(rows.filter((_, i) => i !== index)))}
          >
            <BlockIcon name="close" />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={rows.length >= 30}
        onClick={() => onChange(JSON.stringify([...rows, { label: "新しい項目", value: 0 }]))}
      >
        <BlockIcon name="plus" />
        項目を追加
      </button>
    </fieldset>
  );
}
function ModuleFields({
  source,
  onApply,
  media,
  tools,
}: {
  source: string;
  onApply: (source: string) => void;
  media: EditorMedia[];
  tools: EditorTool[];
}) {
  const module = readModuleSource(source)!;
  const serialized = JSON.stringify(module.props);
  const [values, setValues] = useState<Record<string, string | boolean>>(module.props);
  const [error, setError] = useState("");
  useEffect(() => {
    setValues(JSON.parse(serialized) as Record<string, string | boolean>);
    setError("");
  }, [serialized]);
  const schema = schemas[module.name];
  const fields = Object.entries(schema?.properties ?? {}).filter(
    ([name]) => module.name !== "LineChart" || !chartAxisFields.some((field) => field === name),
  );
  const requiredFields =
    module.name === "Comparison" ? ["leftLabel", "rightLabel"] : (schema?.required ?? []);
  const mainField = (name: string) =>
    requiredFields.includes(name) ||
    (module.name === "LineChart" && (name === "kind" || name === "analysisDisplay"));
  const update = (name: string, value: string | boolean) =>
    setValues((current) => ({ ...current, [name]: value }));
  const apply = () => {
    const prepared = Object.fromEntries(
      Object.entries(values).filter(([key, value]) => value !== "" || requiredFields.includes(key)),
    );
    try {
      if (module.name === "Comparison" && (!prepared.leftLabel || !prepared.rightLabel)) {
        setError("両方の条件名を入力してください。");
        return;
      }
      if (module.name === "LineChart") {
        renderLineChart(prepared);
      }
      onApply(updateModuleProps(source, prepared));
      setError("");
    } catch (caught) {
      const issues =
        caught && typeof caught === "object" && "issues" in caught && Array.isArray(caught.issues)
          ? (caught.issues as { code?: string; path?: (string | number)[]; message?: string }[])
          : [];
      const chartIssue =
        module.name === "LineChart"
          ? issues.find(
              (issue) =>
                issue.message &&
                (issue.path?.[0] === "series" ||
                  (issue.code === "custom" &&
                    chartAxisFields.some((field) => field === issue.path?.[0]))),
            )
          : undefined;
      const fields = [
        ...new Set(
          issues.map(
            (issue) => labels[String(issue.path?.[0])] ?? String(issue.path?.[0] ?? "入力"),
          ),
        ),
      ];
      setError(
        chartIssue?.message ??
          (module.name === "LineChart" && caught instanceof Error && !issues.length
            ? caught.message
            : undefined) ??
          (fields.length
            ? fields.join("、") + "を確認してください。必須項目・値の範囲・URL形式を確認できます。"
            : "入力内容を確認してください。"),
      );
    }
  };
  const field = ([name, specification]: [string, FieldSchema]) => {
    const required = requiredFields.includes(name);
    const value = values[name];
    if (name === "series")
      return (
        <ChartSeriesEditor
          key={name}
          value={String(value ?? "[]")}
          onChange={(next) => update(name, next)}
          onAnalysisMode={() => update("kind", "analysis")}
        />
      );
    if (name === "rows")
      return (
        <ChartRows
          key={name}
          value={String(value ?? "[]")}
          onChange={(next) => update(name, next)}
        />
      );
    if (specification.type === "boolean")
      return (
        <label key={name} className="cms-check-field">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => update(name, event.target.checked)}
          />
          {labels[name] ?? name}
        </label>
      );
    const options = specification.enum?.filter(
      (option): option is string => typeof option === "string",
    );
    return (
      <label key={name}>
        <span>
          {module.name === "LineChart" && name === "kind" ? "グラフの表示" : (labels[name] ?? name)}
          {required && <small>必須</small>}
        </span>
        {options ? (
          <select
            value={String(value ?? "")}
            onChange={(event) => update(name, event.target.value)}
          >
            <option value="">{required ? "選択してください" : "標準"}</option>
            {options.map((option) => (
              <option value={option} key={option}>
                {choices[option] ?? option}
              </option>
            ))}
          </select>
        ) : name === "asset" && media.length ? (
          <select
            value={String(value ?? "")}
            onChange={(event) => update(name, event.target.value)}
          >
            <option value={String(value ?? "")}>
              {media.some((item) => item.id === value)
                ? "画像を選択"
                : String(value || "画像を選択")}
            </option>
            {media.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label ?? item.id}
              </option>
            ))}
          </select>
        ) : name === "module" && tools.length ? (
          <select
            value={String(value ?? "")}
            onChange={(event) => update(name, event.target.value)}
          >
            <option value={String(value ?? "")}>{String(value || "ツールを選択")}</option>
            {tools.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        ) : ["caption", "note", "description", "reason", "action"].includes(name) ? (
          <textarea
            rows={2}
            value={String(value ?? "")}
            maxLength={specification.maxLength}
            onChange={(event) => update(name, event.target.value)}
          />
        ) : (
          <input
            value={String(value ?? "")}
            type={name === "max" ? "number" : "text"}
            min={name === "max" ? "0.000001" : undefined}
            step={name === "max" ? "any" : undefined}
            maxLength={specification.maxLength}
            placeholder={
              name === "asset"
                ? "画像ID"
                : name === "sourceUrl" || name === "href"
                  ? "https://…"
                  : ""
            }
            onChange={(event) => update(name, event.target.value)}
          />
        )}
      </label>
    );
  };
  return (
    <div className="cms-module-fields">
      <div className="cms-field-grid">{fields.filter(([name]) => mainField(name)).map(field)}</div>
      {module.name === "LineChart" && (
        <ChartAxisSettings
          values={values}
          onChange={update}
          onReset={() => {
            setValues((current) => {
              const next = { ...current };
              for (const field of chartAxisFields) {
                delete next[field];
              }
              return next;
            });
            setError("");
          }}
        />
      )}
      {fields.some(([name]) => !mainField(name)) && (
        <details className="cms-optional-fields">
          <summary>表示・補足の設定</summary>
          <div className="cms-field-grid">
            {fields.filter(([name]) => !mainField(name)).map(field)}
          </div>
        </details>
      )}
      {error && (
        <p className="cms-field-error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="primary" onClick={apply}>
        設定を適用
      </button>
    </div>
  );
}
export function ModuleBlock({
  source,
  onChange,
  renderChildren,
  media = [],
  tools = [],
}: {
  source: string;
  onChange: (source: string) => void;
  renderChildren: (
    source: string,
    offset: number,
    parent: string,
    onChange: (source: string) => void,
    allowedKinds?: readonly string[],
  ) => ReactNode;
  media?: EditorMedia[];
  tools?: EditorTool[];
}) {
  const module = useMemo(() => readModuleSource(source), [source]);
  const [settings, setSettings] = useState(false);
  if (!module) return null;
  const value = (name: string) => String(module.props[name] ?? "");
  const container = Boolean(moduleChildKinds[module.name]?.length);
  const legacyComparison = module.name === "Comparison" && Boolean(value("leftLabel"));
  const childBody = module.children ?? "";
  const incompleteComparison =
    module.name === "Comparison" &&
    !legacyComparison &&
    (blockTree(childBody).children?.filter((child) => child.name === "ComparisonCase").length ??
      0) < 2;
  const children = container
    ? renderChildren(
        childBody,
        module.openingEnd,
        module.name,
        (body) => onChange(updateModuleChildren(source, body)),
        legacyComparison ? flowChildKinds : undefined,
      )
    : null;
  if (module.name === "Group") {
    return <div className="cms-module cms-module-group">{children}</div>;
  }
  const rowData = module.name === "BarChart" ? readRows(value("rows")) : null;
  const image =
    module.name === "Figure" ? media.find((item) => item.id === value("asset")) : undefined;
  const style =
    module.name === "Gallery"
      ? ({
          "--gallery-columns": value("columns") || "2",
          "--gallery-tablet-columns": value("tabletColumns") || value("columns") || "2",
          "--gallery-mobile-columns": value("mobileColumns") || "1",
          "--gallery-gap":
            (
              { none: "0", small: "0.5rem", medium: "1.25rem", large: "2rem" } as Record<
                string,
                string
              >
            )[value("gap")] ?? "1.25rem",
          "--gallery-fit": value("fit") || "contain",
        } as CSSProperties)
      : undefined;
  return (
    <section
      className={"cms-module cms-module-" + module.name.toLowerCase()}
      style={style}
      data-image-fit={module.name === "Gallery" ? value("fit") : undefined}
    >
      <div className="cms-module-caption">
        <strong>
          {module.name === "LineChart"
            ? names[module.name]
            : value("title") ||
              value("summary") ||
              value("label") ||
              names[module.name] ||
              module.name}
        </strong>
        {Object.keys(schemas[module.name]?.properties ?? {}).length > 0 &&
          (module.name !== "Comparison" || legacyComparison) && (
            <button type="button" aria-expanded={settings} onClick={() => setSettings(!settings)}>
              設定
            </button>
          )}
      </div>
      {module.name === "Figure" && (
        <figure>
          {image?.src ? (
            <img src={image.src} alt={value("alt")} />
          ) : (
            <div className="cms-figure-placeholder">
              <BlockIcon name="Figure" />
              <strong>{value("alt") || "画像を選択"}</strong>
              <small>{value("asset")}</small>
            </div>
          )}
          {value("caption") && <figcaption>{value("caption")}</figcaption>}
        </figure>
      )}
      {module.name === "LineChart" && <LineChartPreview props={module.props} />}
      {module.name === "BarChart" && (
        <div className="cms-bar-chart">
          {rowData?.map((row, index) => (
            <div key={index}>
              <span>{row.label}</span>
              <div>
                <i
                  style={{
                    width:
                      Math.max(0, Math.min(100, (Number(row.value) / Number(value("max"))) * 100)) +
                      "%",
                    opacity: row.tone === "muted" ? 0.45 : 1,
                  }}
                />
              </div>
              <b>
                {row.value}
                {value("unit")}
              </b>
            </div>
          ))}
        </div>
      )}
      {module.name === "LinkCard" && (
        <div className="cms-link-card">
          <BlockIcon name="LinkCard" />
          <div>
            <strong>{value("title")}</strong>
            <p>{value("description")}</p>
            <small>{value("href")}</small>
          </div>
        </div>
      )}
      {module.name === "Demo" && (
        <div className="cms-demo-placeholder">
          <BlockIcon name="Demo" />
          <div>
            <strong>
              {tools.find((tool) => tool.id === value("module"))?.label ?? value("module")}
            </strong>
            <p>{value("description")}</p>
          </div>
        </div>
      )}
      {module.name === "DiagnosticItem" && (
        <dl className="cms-diagnostic">
          <dt>症状</dt>
          <dd>{value("symptom")}</dd>
          <dt>確認</dt>
          <dd>{value("check")}</dd>
          {value("action") && (
            <>
              <dt>対処</dt>
              <dd>{value("action")}</dd>
            </>
          )}
          {value("reason") && (
            <>
              <dt>理由</dt>
              <dd>{value("reason")}</dd>
            </>
          )}
        </dl>
      )}
      {module.name === "Comparison" && value("leftLabel") && value("rightLabel") && (
        <div className="cms-comparison-labels">
          <span>{value("leftLabel")}</span>
          <span>{value("rightLabel")}</span>
        </div>
      )}
      {settings && <ModuleFields source={source} onApply={onChange} media={media} tools={tools} />}
      {incompleteComparison && (
        <p className="cms-field-error" role="status">
          比較には条件を2つ以上追加してください。
        </p>
      )}
      {module.name === "Comparison" && !legacyComparison ? (
        <div className="cms-comparison-grid">{children}</div>
      ) : (
        children
      )}
      {module.name === "Step" && value("result") && (
        <p className="cms-step-result">結果：{value("result")}</p>
      )}
    </section>
  );
}
