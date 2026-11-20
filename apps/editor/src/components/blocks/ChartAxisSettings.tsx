export const chartAxisFields = ["xMin", "xMax", "yMin", "yMax", "xPadding", "yPadding"] as const;

export function ChartAxisSettings({
  values,
  onChange,
  onReset,
}: {
  values: Record<string, string | boolean>;
  onChange: (name: (typeof chartAxisFields)[number], value: string) => void;
  onReset: () => void;
}) {
  return (
    <details className="cms-chart-axis-settings">
      <summary>軸の範囲・余白</summary>
      <p className="cms-chart-help">
        最小値・最大値は空欄で自動です。自動の端に付ける余白は、標準でデータ範囲の5%です。
      </p>
      {(["x", "y"] as const).map((axis) => {
        const name = axis === "x" ? "横軸" : "縦軸";
        return (
          <fieldset key={axis} className="cms-chart-axis">
            <legend>
              {name}（{axis.toUpperCase()}）
            </legend>
            <div className="cms-chart-axis-inputs">
              {(["Min", "Max", "Padding"] as const).map((setting) => {
                const key = `${axis}${setting}` as const;
                const label =
                  setting === "Min" ? "最小値" : setting === "Max" ? "最大値" : "余白（%）";
                return (
                  <label key={setting}>
                    {label}
                    <input
                      type="text"
                      inputMode="decimal"
                      spellCheck={false}
                      aria-label={`${name}の${label}`}
                      value={String(values[key] ?? "")}
                      placeholder={setting === "Padding" ? "5" : "自動"}
                      onChange={(event) => onChange(key, event.target.value)}
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      <p className="cms-chart-help">
        余白は0〜100%で指定できます。最小値・最大値を指定した側には、余白を追加しません。
      </p>
      <button type="button" onClick={onReset}>
        自動に戻す
      </button>
    </details>
  );
}
