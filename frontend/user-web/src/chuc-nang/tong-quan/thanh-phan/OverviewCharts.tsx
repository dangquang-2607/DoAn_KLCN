"use client";

import { useId, useState, type ReactNode } from "react";
import CardAction from "./CardAction";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dateLabel, money } from "@/dung-chung/tien-ich/finance";
import { formatChartMoney } from "@/dung-chung/tien-ich/reportChart";
import {
  monthlyComparison,
  monthlyTotals,
  type Metric,
  type MonthlyTrend,
} from "../monthlyTrend";
import styles from "../CSS/overview.module.css";

type Props = { data?: MonthlyTrend; state?: ReactNode };
const labels = { expense: "Tổng đã chi", income: "Tổng thu" };
const colors = { expense: "#c9474b", income: "#077da2" };

export default function OverviewCharts({ data, state }: Props) {
  const [metric, setMetric] = useState<Metric>("expense");
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const gradient = useId();
  const month = data?.through.slice(0, 7);
  const points = data ? monthlyComparison(data, metric) : [];
  const cutoff = Number(data?.through.slice(-2));
  const selected = points[(hoverDay ?? cutoff) - 1] ?? points[cutoff - 1];
  const color = colors[metric];
  const totals = data && monthlyTotals(data);

  return (
    <section
      className={`${styles.panel} ${styles.monthlyCard}`}
      aria-label="Báo cáo theo tháng"
    >
      <header className={styles.monthlyHead}>
        <h2>Báo cáo xu hướng</h2>
        <CardAction href="/analytics">Xem báo cáo</CardAction>
      </header>
      {state ??
        (totals && selected && month && (
          <>
            <div
              className={styles.metricSwitch}
              role="group"
              aria-label="Chọn khoản thu hoặc chi"
            >
              {(["expense", "income"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={metric === key}
                  style={{ color: colors[key] }}
                  onClick={() => {
                    setMetric(key);
                    setHoverDay(null);
                  }}
                >
                  <span>{labels[key]}</span>
                  <strong>{money(totals[key])}</strong>
                </button>
              ))}
            </div>
            <div className={styles.readout}>
              <div>
                <time dateTime={selected.date}>{dateLabel(selected.date)}</time>
                <strong style={{ color }}>
                  {selected.actual === null ? "—" : money(selected.actual)}
                </strong>
              </div>
              <div>
                <span>Trung bình 3 tháng trước</span>
                <b>{money(Math.round(selected.average))}</b>
              </div>
            </div>
            <div
              className={styles.plotScroll}
              role="region"
              aria-label="Biểu đồ theo từng ngày trong tháng"
              tabIndex={0}
            >
              <div className={styles.monthPlot}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={points}
                    margin={{ top: 12, bottom: 3, right: 8, left: 28 }}
                    onMouseMove={(event) => {
                      if (event.activeLabel != null)
                        setHoverDay(Number(event.activeLabel));
                    }}
                    onClick={(event) => {
                      if (event.activeLabel != null)
                        setHoverDay(Number(event.activeLabel));
                    }}
                    onMouseLeave={() => setHoverDay(null)}
                  >
                    <defs>
                      <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                        <stop stopColor={color} stopOpacity={0.17} />
                        <stop
                          offset="100%"
                          stopColor={color}
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="#e7e4e0"
                      strokeDasharray="4 5"
                    />
                    <XAxis
                      dataKey="day"
                      interval={1}
                      height={30}
                      tickFormatter={(day) =>
                        `${day}/${Number(month.slice(5))}`
                      }
                      tick={{ fill: "#625e68", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      orientation="right"
                      width={54}
                      tickFormatter={formatChartMoney}
                      tickCount={4}
                      tick={{ fill: "#625e68", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={() => null} cursor={false} />
                    <Line
                      dataKey="average"
                      name="Trung bình 3 tháng trước"
                      type="linear"
                      stroke="#a7a8b0"
                      strokeWidth={3}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Area
                      dataKey="actual"
                      name={labels[metric]}
                      type="linear"
                      stroke={color}
                      strokeWidth={3}
                      fill={`url(#${gradient})`}
                      isAnimationActive={false}
                    />
                    <ReferenceLine x={selected.day} stroke="#cbc7c8" />
                    {selected.actual !== null && (
                      <ReferenceDot
                        x={selected.day}
                        y={selected.actual}
                        r={4}
                        fill="white"
                        stroke={color}
                        strokeWidth={2.5}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={styles.seriesKey}>
              <span>
                <i style={{ background: color }} />
                Tháng này
              </span>
              <span>
                <i />
                Trung bình 3 tháng trước
              </span>
            </div>
            <table className={styles.srOnly}>
              <caption>{labels[metric]} lũy kế theo ngày</caption>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Tháng này</th>
                  <th>Trung bình 3 tháng trước</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.date}>
                    <th>{dateLabel(point.date)}</th>
                    <td>{point.actual === null ? "—" : money(point.actual)}</td>
                    <td>{money(Math.round(point.average))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ))}
    </section>
  );
}
