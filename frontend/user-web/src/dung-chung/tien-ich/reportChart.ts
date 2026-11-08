import type { ReportTrendPoint } from "../nghiep-vu/report";

const axisNumber = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

export const reportChartPalette = ["#8259ba", "#e6816c", "#208f87", "#dfab49", "#6682c3", "#b4779b", "#8b9b6e", "#71586c"];

export const reportTooltipStyle = {
  border: "1px solid #e9e4dc",
  borderRadius: 8,
  background: "#fffdf9",
  boxShadow: "0 10px 30px #28213414",
  fontSize: 14,
  lineHeight: "20px",
  fontFamily: "var(--font-inter, var(--cf-font))",
  padding: "10px 12px",
  maxWidth: "min(280px, calc(100vw - 48px))",
  overflowWrap: "anywhere" as const,
  whiteSpace: "normal" as const,
};

/** Zero-filled calendar buckets do not imply reported activity; net zero may. */
export function hasReportedCashflow(trend: ReportTrendPoint[]): boolean {
  return trend.some(({ income, expense }) => income !== 0 || expense !== 0);
}

export function formatChartMoney(value: number): string {
  const magnitude = Math.abs(value);
  if (value === 0) return "0";
  if (magnitude >= 1_000_000) return `${axisNumber.format(value / 1_000_000)} tr`;
  if (magnitude >= 1_000) return `${axisNumber.format(value / 1_000)}k`;
  return `${axisNumber.format(value)} đ`;
}

