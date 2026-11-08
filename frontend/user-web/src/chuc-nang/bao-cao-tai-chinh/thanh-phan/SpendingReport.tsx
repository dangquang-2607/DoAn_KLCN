"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { reportDayCount, spendingTrendBuckets, SPENDING_REPORT_ID, type FinancialReportData } from "@/dung-chung/nghiep-vu/report";
import { dateLabel, money } from "@/dung-chung/tien-ich/finance";
import { formatChartMoney, reportTooltipStyle } from "@/dung-chung/tien-ich/reportChart";
import ReportCardHeader from "./ReportCardHeader";
import styles from "../CSS/analytics.module.css";

function historyLink(start: string, end: string) {
  const params = new URLSearchParams({ type: "EXPENSE", start_date: start, end_date: end, included: "true" });
  return `/transactions?${params}`;
}

function SpendingTrend({ report }: { report: FinancialReportData }) {
  const buckets = spendingTrendBuckets(report.period_trend, report.period).map(bucket => ({
    ...bucket,
    label: bucket.start === bucket.end ? dateLabel(bucket.start) : `${dateLabel(bucket.start)} – ${dateLabel(bucket.end)}`,
  }));
  if (report.summary.expense === 0) return <p className={styles.empty}>Kỳ này chưa có khoản chi.</p>;
  const crossesYears = report.period.start_date.slice(0, 4) !== report.period.end_date.slice(0, 4);

  return (
    <div className={`${styles.chart} ${styles.spendingBarChart}`} role="group" aria-label="Biểu đồ khoản chi theo thời gian">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eeeae3" strokeDasharray="3 5" />
          <XAxis dataKey="start" tickFormatter={(value: string) => {
            const label = dateLabel(value);
            return crossesYears ? `${label.slice(0, 5)}/${label.slice(-2)}` : label.slice(0, 5);
          }} minTickGap={16} tickLine={false} axisLine={false} tick={{ fill: "#6e6874", fontSize: 12 }} />
          <YAxis tickFormatter={formatChartMoney} width={60} tickLine={false} axisLine={false} tick={{ fill: "#6e6874", fontSize: 12 }} />
          <Tooltip contentStyle={reportTooltipStyle} wrapperStyle={{ zIndex: 1 }} formatter={value => money(Number(value))}
            labelFormatter={(value, payload) => payload[0]?.payload?.label ?? dateLabel(String(value))} />
          <Bar name="Chi tiêu" dataKey="expense" fill="#c45257" maxBarSize={44} isAnimationActive={false}
            shape={({ originalDataIndex, x, y, width, height, fill }) => {
              const bucket = buckets[originalDataIndex];
              const bar = <Rectangle x={x} y={y} width={width} height={height} fill={fill} radius={[4, 4, 0, 0]} />;
              if (!bucket || bucket.expense <= 0) return bar;
              return (
                <Link className={styles.spendingBarLink} href={historyLink(bucket.start, bucket.end)} prefetch={false} tabIndex={0}
                  aria-label={`Xem giao dịch ngày ${bucket.label}, đã chi ${money(bucket.expense)}`}>
                  {bar}
                </Link>
              );
            }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function SpendingReport({ report }: { report: FinancialReportData }) {
  const headingId = `${SPENDING_REPORT_ID}-heading`;
  const days = reportDayCount(report.period);

  return (
    <section id={SPENDING_REPORT_ID} className={`${styles.panel} ${styles.spendingReport}`} aria-labelledby={headingId}>
      <ReportCardHeader title="Xu hướng chi tiêu" titleId={headingId} />
      <dl className={styles.spendingMetrics}>
        <div><dt>Tổng đã chi</dt><dd>{money(report.summary.expense)}</dd></div>
        <div><dt>Chi trung bình/ngày</dt><dd>{money(report.summary.expense / days)}<small>Tính trên {days} ngày trong kỳ</small></dd></div>
      </dl>
      <div className={styles.spendingTrend}>
        <SpendingTrend report={report} />
      </div>
    </section>
  );
}
