"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dateLabel, money, percent } from "@/dung-chung/tien-ich/finance";
import { formatChartMoney, hasReportedCashflow, reportChartPalette as palette, reportTooltipStyle as tooltipStyle } from "@/dung-chung/tien-ich/reportChart";
import ReportCardHeader from "./ReportCardHeader";
import styles from "../CSS/analytics.module.css";

import type { ReportTrendPoint } from "@/dung-chung/nghiep-vu/report";

const breakdownTabs = [
  { key: "income", label: "Khoản thu", totalLabel: "Tổng thu", empty: "Chưa có khoản thu được tính trong kỳ." },
  { key: "expense", label: "Khoản chi", totalLabel: "Tổng chi", empty: "Chưa có khoản chi được tính trong kỳ." },
] as const;

type BreakdownKind = (typeof breakdownTabs)[number]["key"];
type Breakdown = { total: number; categories?: Record<string, number> };

function CategoryBreakdown({ income, expense }: Record<BreakdownKind, Breakdown>) {
  const id = useId();
  const [active, setActive] = useState<BreakdownKind>("income");
  const tabRefs = useRef<Partial<Record<BreakdownKind, HTMLButtonElement | null>>>({});
  const datasets = { income, expense };
  const current = datasets[active];
  const parts = Object.entries(current.categories ?? {})
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  const colors = active === "income" ? ["#16796f", "#6682c3", "#dfab49", "#8b9b6e", "#8259ba", "#b4779b"] : palette;
  const color = (index: number) => colors[index % colors.length];

  return (
    <section className={`${styles.panel} ${styles.panelSand} ${styles.breakdownCard}`} aria-labelledby={`${id}-title`}>
      <ReportCardHeader title="Cơ cấu thu chi" titleId={`${id}-title`} description="Tỷ trọng theo danh mục trong kỳ" />
      <div className={styles.breakdownTabs} role="tablist" aria-label="Loại thu chi">
        {breakdownTabs.map(({ key, label }) => (
          <button
            key={key}
            ref={element => { tabRefs.current[key] = element; }}
            id={`${id}-${key}-tab`}
            type="button"
            role="tab"
            aria-selected={active === key}
            aria-controls={`${id}-${key}-panel`}
            tabIndex={active === key ? 0 : -1}
            onClick={() => setActive(key)}
            onKeyDown={event => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? "income" : event.key === "End" ? "expense"
                : key === "income" ? "expense" : "income";
              setActive(next);
              tabRefs.current[next]?.focus();
            }}
          >{label}</button>
        ))}
      </div>
      {breakdownTabs.map(({ key, label, totalLabel, empty }) => (
        <div
          key={key}
          id={`${id}-${key}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${key}-tab`}
          hidden={active !== key}
          tabIndex={0}
          className={styles.breakdownPanel}
        >
          {active === key && <>
            <p className={styles.breakdownTotal}>
              <span>{totalLabel}</span>
              <strong data-kind={key}>{money(current.total)}</strong>
            </p>
            {parts.length ? (
              <div className={styles.breakdownContent}>
                <div className={styles.donut} role="img" aria-label={`${label} theo danh mục`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart accessibilityLayer={false}>
                      <Pie data={parts.map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name"
                        innerRadius={53} outerRadius={74} paddingAngle={2} stroke="none" isAnimationActive={false}>
                        {parts.map(([name], index) => <Cell key={name} fill={color(index)} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} wrapperStyle={{ zIndex: 1 }} formatter={value => money(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.donutCenter} aria-hidden="true">
                    <strong>{parts.length}</strong><small>danh mục</small>
                  </div>
                </div>
                <div className={styles.breakdownScroll} role="region" aria-label={`Danh mục ${label.toLowerCase()}`} tabIndex={0}>
                  <ul className={styles.breakdownList} role="list">
                    {parts.map(([name, value], index) => {
                      const share = current.total > 0 ? value / current.total * 100 : 0;
                      return <li key={name}>
                        <i className={styles.dot} style={{ background: color(index) }} aria-hidden="true" />
                        <span>{name}</span>
                        <span className={styles.breakdownValues}>
                          <strong>{share > 0 && share < 0.1 ? "<0,1" : percent(share)}%</strong>
                          <small>{money(value)}</small>
                        </span>
                      </li>;
                    })}
                  </ul>
                </div>
              </div>
            ) : <p className={styles.breakdownEmpty}>
              {current.categories === undefined ? "Chưa tải được cơ cấu theo danh mục." : empty}
            </p>}
          </>}
        </div>
      ))}
    </section>
  );
}

/**
 * Component kết xuất hệ thống biểu đồ báo cáo tài chính đa chiều.
 *
 * @param data - Dữ liệu thống kê kỳ phân tích, danh mục và chuỗi thời gian.
 * @param mode - Chế độ xem kỳ báo cáo (ngày, tháng, quý, năm, tùy chỉnh).
 */
export default function ReportCharts({
  trend,
  incomeCategories,
  categories,
  previousCategories,
  totalIncome,
  totalExpense,
  showComparison,
  comparison = "previous_period",
  spendingReport,
}: {
  trend: ReportTrendPoint[];
  incomeCategories?: Record<string, number>;
  categories: Record<string, number>;
  previousCategories: Record<string, number>;
  totalIncome: number;
  totalExpense: number;
  showComparison: boolean;
  comparison?: "previous_month" | "previous_period";
  spendingReport: ReactNode;
}) {
  const hasCashflow = hasReportedCashflow(trend);
  const names = Array.from(
    new Set([...Object.keys(categories), ...Object.keys(previousCategories)]),
  )
    .sort((a, b) => (categories[b] || 0) - (categories[a] || 0))
    .slice(0, 5);
  const spacing =
    trend.length > 1
      ? (Date.parse(trend[1].date) - Date.parse(trend[0].date)) / 86_400_000
      : 0;
  const axisLabel = (value: string) => {
    const [, month, year] = dateLabel(value).split("/");
    if (spacing > 60)
      return `Q${Math.floor((Number(month) - 1) / 3) + 1}/${year.slice(2)}`;
    if (spacing > 20) return `T${Number(month)}/${year.slice(2)}`;
    return dateLabel(value).slice(0, 5);
  };
  return (
    <>
      <div className={styles.reportGrid}>
        <section className={`${styles.panel} ${styles.trendCard}`}>
          <div className={styles.trendHeader}>
            <ReportCardHeader context="XU HƯỚNG TRONG KỲ" title="Thu · Chi · Ròng" description="Các điểm dữ liệu thuộc đúng khoảng đã chọn" />
            {hasCashflow && (
              <div className={styles.trendLegend}>
                <span><i aria-hidden="true" style={{ background: "#208f87" }} /> Thu</span>
                <span><i aria-hidden="true" style={{ background: "#e6816c" }} /> Chi</span>
                <span><i aria-hidden="true" data-mark="line" style={{ background: "#8259ba" }} /> Ròng</span>
              </div>
            )}
          </div>
          {!hasCashflow ? (
            <div className={styles.empty}>Chưa có khoản thu/chi được tính trong kỳ.</div>
          ) : (
            <div
              className={`${styles.chart} ${styles.trendChart}`}
              role="img"
              aria-label="Biểu đồ thu nhập, chi tiêu và dòng tiền ròng trong kỳ"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={3}>
                  <CartesianGrid vertical={false} stroke="#eeeae3" strokeDasharray="3 5" />
                  <XAxis dataKey="date" tickFormatter={axisLabel} axisLine={false} tickLine={false} minTickGap={16} tick={{ fill: "#6e6874", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} width={60} tickFormatter={formatChartMoney} tick={{ fill: "#6e6874", fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#cfc6d2" />
                  <Tooltip wrapperStyle={{ zIndex: 2, whiteSpace: "normal", maxWidth: "100%" }} itemStyle={{ whiteSpace: "normal" }} labelFormatter={(value) => dateLabel(String(value))} contentStyle={tooltipStyle} formatter={(value, name) => [ money(Number(value)), String(name), ]} />
                  <Bar name="Thu nhập" dataKey="income" fill="#208f87" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                  <Bar name="Chi tiêu" dataKey="expense" fill="#e6816c" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false}/>
                  <Line type="monotone" name="Dòng tiền ròng" dataKey="net" stroke="#8259ba" strokeWidth={2.5} dot={trend.length < 14} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <CategoryBreakdown
          income={{ total: totalIncome, categories: incomeCategories }}
          expense={{ total: totalExpense, categories }}
        />
      </div>
      <div className={`${styles.reportGrid} ${styles.spendingGrid}`}>
        {spendingReport}
        <section className={`${styles.panel} ${styles.comparisonCard}`}>
          <ReportCardHeader
            title="Nhóm chi tiêu thay đổi"
            context="SO VỚI KỲ TRƯỚC"
            description={showComparison ? comparison === "previous_month" ? "So sánh với toàn bộ tháng lịch trước" : "Kỳ trước có cùng số ngày, ngay trước kỳ đang xem" : "Không so sánh khi xem toàn bộ lịch sử"}
          />
          {!showComparison ? (
            <div className={styles.empty}>Chọn một kỳ cụ thể để so sánh.</div>
          ) : !names.length ? (
            <div className={styles.empty}>Chưa có khoản chi để so sánh.</div>
          ) : (
            <div className={styles.compareList}>
              {names.map((name, index) => {
                const current = categories[name] || 0,
                  previous = previousCategories[name] || 0,
                  scale = Math.max(current, previous, 1);
                const change = previous ? Math.round(((current - previous) / previous) * 100) : null;
                return (
                  <div className={styles.compareRow} key={name}>
                    <div className={styles.compareTop}>
                      <span> <i className={styles.dot} style={{ background: palette[index % palette.length], }} /> {name} </span>
                      <strong>{money(current)}</strong>
                    </div>
                    <div className={styles.compareBars}>
                      <span style={{ width: `${(current / scale) * 100}%`, background: palette[index % palette.length], }} />
                      <span style={{ width: `${(previous / scale) * 100}%` }} />
                    </div>
                    <small> {change === null ? "Kỳ trước chưa có chi tiêu" : `${change > 0 ? "+" : ""}${change}% so với kỳ trước`} </small>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
