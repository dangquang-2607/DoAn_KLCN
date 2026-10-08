"use client";

import { Area, AreaChart, Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dateLabel, money } from "@/dung-chung/tien-ich/finance";
import styles from "../CSS/analytics.module.css";

import type { ReportTrendPoint } from "@/dung-chung/nghiep-vu/report-types";
const palette = ["#8259ba", "#e6816c", "#208f87", "#dfab49", "#6682c3", "#b4779b", "#8b9b6e", "#71586c"];
const tooltipStyle = { border: "1px solid #e9e4dc", borderRadius: 12, background: "#fffdf9", boxShadow: "0 10px 30px #28213414", fontSize: 13 };
const compact = (value: number) => value >= 1_000_000 || value <= -1_000_000 ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value / 1_000_000)} tr` : `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value / 1_000)}k`;

function Header({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className={styles.sectionHead}><span className={styles.overline}>{eyebrow}</span><h2>{title}</h2><p>{description}</p></header>;
}

export default function ReportCharts({ trend, categories, previousCategories, totalExpense, net, showComparison }: {
  trend: ReportTrendPoint[];
  categories: Record<string, number>;
  previousCategories: Record<string, number>;
  totalExpense: number;
  net: number;
  showComparison: boolean;
}) {
  const parts = Object.entries(categories).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  const names = Array.from(new Set([...Object.keys(categories), ...Object.keys(previousCategories)])).sort((a, b) => (categories[b] || 0) - (categories[a] || 0)).slice(0, 5);
  const spacing = trend.length > 1 ? (Date.parse(trend[1].date) - Date.parse(trend[0].date)) / 86_400_000 : 0;
  const axisLabel = (value: string) => {
    const [, month, year] = dateLabel(value).split("/");
    if (spacing > 60) return `Q${Math.floor((Number(month) - 1) / 3) + 1}/${year.slice(2)}`;
    if (spacing > 20) return `T${Number(month)}/${year.slice(2)}`;
    return dateLabel(value).slice(0, 5);
  };
  return <>
    <div className={styles.charts}>
      <section className={styles.panel}>
        <Header eyebrow="XU HƯỚNG TRONG KỲ" title="Thu · Chi · Ròng" description="Các điểm dữ liệu thuộc đúng khoảng đã chọn" />
        <div className={styles.legend}><span><i style={{ background: "#208f87" }} />Thu nhập</span><span><i style={{ background: "#e6816c" }} />Chi tiêu</span><span><i style={{ background: "#8259ba" }} />Ròng</span></div>
        {!trend.length ? <div className={styles.empty}>Chưa có giao dịch trong kỳ.</div> : <div className={`${styles.chart} ${styles.chartTall}`} role="img" aria-label="Biểu đồ thu nhập, chi tiêu và dòng tiền ròng trong kỳ"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trend} margin={{ top: 18, right: 12, bottom: 2, left: 0 }} barGap={3}>
          <CartesianGrid vertical={false} stroke="#eeeae3" strokeDasharray="3 5" /><XAxis dataKey="date" tickFormatter={axisLabel} axisLine={false} tickLine={false} minTickGap={22} tick={{ fill: "#837f88", fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} width={52} tickFormatter={compact} tick={{ fill: "#837f88", fontSize: 12 }} /><Tooltip labelFormatter={(value) => dateLabel(String(value))} contentStyle={tooltipStyle} formatter={(value, name) => [money(Number(value)), String(name)]} />
          <Bar name="Thu nhập" dataKey="income" fill="#208f87" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} /><Bar name="Chi tiêu" dataKey="expense" fill="#e6816c" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} /><Line type="monotone" name="Dòng tiền ròng" dataKey="net" stroke="#8259ba" strokeWidth={2.5} dot={trend.length < 14} isAnimationActive={false} />
        </ComposedChart></ResponsiveContainer></div>}
      </section>
      <section className={`${styles.panel} ${styles.panelSand}`}>
        <Header eyebrow="CƠ CẤU CHI TIÊU" title="Tiền ra theo nhóm" description="Tỷ trọng trong kỳ đang xem" />
        {!parts.length ? <div className={styles.empty}>Chưa có khoản chi trong kỳ.</div> : <>
          <div className={styles.donut} role="img" aria-label="Cơ cấu chi tiêu theo danh mục"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={parts.map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" innerRadius={62} outerRadius={82} paddingAngle={2} stroke="none" isAnimationActive={false}>{parts.map(([name], index) => <Cell key={name} fill={palette[index % palette.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value) => money(Number(value))} /></PieChart></ResponsiveContainer><div className={styles.donutCenter}><strong>{parts.length}</strong><small>danh mục</small></div></div>
          <div className={styles.miniList}>{parts.slice(0, 5).map(([name, value], index) => <div key={name}><i className={styles.dot} style={{ background: palette[index % palette.length] }} /><span>{name}</span><strong>{Math.round(value / totalExpense * 100)}%</strong></div>)}</div>
        </>}
      </section>
    </div>
    <div className={styles.secondary}>
      <section className={`${styles.panel} ${styles.panelPurple}`}>
        <Header eyebrow="TÍCH LŨY THEO THỜI GIAN" title="Còn lại bao nhiêu?" description="Dòng tiền ròng cộng dồn từ đầu kỳ" />
        {!trend.length ? <div className={styles.empty}>Chưa có dữ liệu để vẽ biểu đồ.</div> : <div className={`${styles.chart} ${styles.chartSmall}`} role="img" aria-label="Biểu đồ dòng tiền ròng lũy kế"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 16, right: 10, bottom: 0, left: 0 }}><CartesianGrid vertical={false} stroke="#eeeae3" strokeDasharray="3 5" /><XAxis dataKey="date" tickFormatter={axisLabel} axisLine={false} tickLine={false} minTickGap={24} tick={{ fill: "#837f88", fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} width={52} tickFormatter={compact} tick={{ fill: "#837f88", fontSize: 12 }} /><Tooltip labelFormatter={(value) => dateLabel(String(value))} contentStyle={tooltipStyle} formatter={(value) => [money(Number(value)), "Lũy kế"]} /><Area type="monotone" dataKey="cumulative" name="Lũy kế" stroke="#8259ba" strokeWidth={3} fill="#8259ba" fillOpacity={0.10} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>}
        <p className={styles.footnote}>Điểm cuối kỳ: <strong>{money(net)}</strong></p>
      </section>
      <section className={styles.panel}>
        <Header eyebrow="SO VỚI KỲ TRƯỚC" title="Nhóm chi tiêu thay đổi" description={showComparison ? "Kỳ trước có cùng số ngày, ngay trước kỳ đang xem" : "Không so sánh khi xem toàn bộ lịch sử"} />
        {!showComparison ? <div className={styles.empty}>Chọn một kỳ cụ thể để so sánh.</div> : !names.length ? <div className={styles.empty}>Chưa có khoản chi để so sánh.</div> : <div className={styles.compareList}>{names.map((name, index) => {
          const current = categories[name] || 0, previous = previousCategories[name] || 0, scale = Math.max(current, previous, 1);
          const change = previous ? Math.round((current - previous) / previous * 100) : null;
          return <div className={styles.compareRow} key={name}><div className={styles.compareTop}><span><i className={styles.dot} style={{ background: palette[index % palette.length] }} />{name}</span><strong>{money(current)}</strong></div><div className={styles.compareBars}><span style={{ width: `${current / scale * 100}%`, background: palette[index % palette.length] }} /><span style={{ width: `${previous / scale * 100}%` }} /></div><small>{change === null ? "Kỳ trước chưa có chi tiêu" : `${change > 0 ? "+" : ""}${change}% so với kỳ trước`}</small></div>;
        })}</div>}
      </section>
    </div>
  </>;
}
