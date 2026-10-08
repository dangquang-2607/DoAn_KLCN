"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorState, Loading } from "@/dung-chung/UI-chung/ui";
import { dateLabel, money } from "@/dung-chung/tien-ich/finance";
import { type Account } from "@/dung-chung/nghiep-vu/finance";
import type { ReportTrendPoint } from "@/dung-chung/nghiep-vu/report-types";
import styles from "../CSS/overview.module.css";

const palette = ["#208f87", "#8259ba", "#dfab49", "#e6816c", "#6682c3", "#b4779b", "#8b9b6e"];
const compact = (value: number) => `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value / 1_000_000)} tr`;
const tooltipStyle = { border: "1px solid #e9e4dc", borderRadius: 12, background: "#fffdf9", fontSize: 12 };

export default function OverviewCharts({ trendQuery, accountsQuery }: {
  trendQuery: UseQueryResult<{ period_trend: ReportTrendPoint[] }>;
  accountsQuery: UseQueryResult<Account[]>;
}) {
  const trend = trendQuery.data?.period_trend ?? [];
  const accounts = (accountsQuery.data ?? []).filter((account) => account.is_active && !account.exclude_from_total && Number(account.balance) > 0);
  const chartAccounts = accounts.map((account) => ({ ...account, amount: Number(account.balance) }));
  const total = accounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const mixedCurrencies = new Set(accounts.map((account) => account.currency)).size > 1;
  return <div className={styles.charts}>
    <section className={styles.panel}>
      <header className={styles.sectionHead}><span className={styles.overline}>GÓC NHÌN 30 NGÀY</span><h2>Dòng tiền có nhịp điệu</h2><p>Thu và chi theo từng ngày gần đây</p></header>
      <div className={styles.legend}><span><i style={{ background: "#208f87" }} />Thu nhập</span><span><i style={{ background: "#e6816c" }} />Chi tiêu</span></div>
      {trendQuery.isPending ? <Loading /> : trendQuery.isError ? <ErrorState retry={() => trendQuery.refetch()} /> : !trend.length ? <div className={styles.empty}>Chưa có giao dịch trong 30 ngày qua.</div> : <div className={styles.chart} role="img" aria-label="Xu hướng thu nhập và chi tiêu trong 30 ngày qua"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 12, right: 10, bottom: 0, left: 0 }}><CartesianGrid vertical={false} stroke="#eeeae3" strokeDasharray="3 5" /><XAxis dataKey="date" tickFormatter={(value) => dateLabel(value).slice(0, 5)} axisLine={false} tickLine={false} minTickGap={24} tick={{ fill: "#837f88", fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} width={49} tickFormatter={compact} tick={{ fill: "#837f88", fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => dateLabel(String(value))} formatter={(value, name) => [money(Number(value)), String(name)]} /><Area type="monotone" name="Thu nhập" dataKey="income" stroke="#208f87" strokeWidth={2.5} fill="#208f87" fillOpacity={0.09} isAnimationActive={false} /><Area type="monotone" name="Chi tiêu" dataKey="expense" stroke="#e6816c" strokeWidth={2.5} fill="#e6816c" fillOpacity={0.10} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>}
    </section>
    <section className={`${styles.panel} ${styles.panelPurple}`}>
      <header className={styles.sectionHead}><span className={styles.overline}>CƠ CẤU TÀI SẢN</span><h2>Tiền đang ở đâu?</h2><p>Phân bổ theo số dư hiện có</p></header>
      {accountsQuery.isPending ? <Loading /> : accountsQuery.isError ? <ErrorState retry={() => accountsQuery.refetch()} /> : mixedCurrencies ? <div className={styles.empty}>Các ví dùng nhiều loại tiền. Chưa thể hiện tỷ trọng khi chưa quy đổi.</div> : !total ? <div className={styles.empty}>Chưa có số dư tài khoản để phân bổ.</div> : <>
        <div className={styles.donut} role="img" aria-label="Phân bổ số dư theo tài khoản"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartAccounts} dataKey="amount" nameKey="name" innerRadius={62} outerRadius={82} paddingAngle={3} stroke="none" isAnimationActive={false}>{accounts.map((account, index) => <Cell key={account.id} fill={palette[index % palette.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value) => money(Number(value))} /></PieChart></ResponsiveContainer><div className={styles.donutCenter}><strong>{accounts.length}</strong><small>nguồn tiền</small></div></div>
        <div className={styles.miniList}>{accounts.slice(0, 5).map((account, index) => <div key={account.id}><i className={styles.dot} style={{ background: palette[index % palette.length] }} /><span>{account.name}</span><strong>{Math.round(Number(account.balance) / total * 100)}%</strong></div>)}</div>
      </>}
    </section>
  </div>;
}
