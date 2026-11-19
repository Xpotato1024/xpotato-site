import { renderLineChart } from "@xpotato/portable-content/charts";
import "../../../../site/src/shared/styles/article-line-chart.css";

export function LineChartPreview({ props }: { props: Record<string, unknown> }) {
  try {
    return (
      <div
        className="cms-chart-preview"
        dangerouslySetInnerHTML={{ __html: renderLineChart(props) }}
      />
    );
  } catch {
    return (
      <p className="cms-field-error" role="status">
        グラフの設定を確認してください。入力した値は保持されています。
      </p>
    );
  }
}
