import { memo } from "react";
import { renderLineChart } from "@xpotato/portable-content/charts";
import "../../../../site/src/shared/styles/article-line-chart.css";

function ChartPreview({ props }: { props: Record<string, unknown> }) {
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

// Selecting a block rerenders its parent. Keep the native disclosure DOM when
// chart inputs are unchanged so clicking a summary can open it and retain focus.
export const LineChartPreview = memo(
  ChartPreview,
  (previous, next) => JSON.stringify(previous.props) === JSON.stringify(next.props),
);
