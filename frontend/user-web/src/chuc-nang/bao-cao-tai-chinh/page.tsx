"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Alert, ErrorState, Loading, PageHead } from "@/dung-chung/UI-chung/ui";
import { dateLabel, localDate, money, errorMessage, exportFinanceExcel, type ExcelTransaction } from "@/dung-chung/tien-ich/finance";
import { resolveReportPeriod, type ReportMode } from "@/dung-chung/nghiep-vu/report-period";
import ReportPeriodFilter from "./thanh-phan/ReportPeriodFilter";
import ReportCharts from "./thanh-phan/ReportCharts";
import type { ReportTrendPoint } from "@/dung-chung/nghiep-vu/report-types";
import styles from "./CSS/analytics.module.css";

type Summary = { income: number; expense: number; net: number };
type AnalyticsData = {
  period: { start_date: string; end_date: string };
  summary: Summary;
  previous_summary: Summary;
  expense_by_category: Record<string, number>;
  previous_expense_by_category: Record<string, number>;
  period_trend: ReportTrendPoint[];
};

export default function Analytics() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [mode, setMode] = useState<ReportMode>("month");
  const [anchor, setAnchor] = useState(() => localDate());
  const [customStart, setCustomStart] = useState(() => `${localDate().slice(0, 7)}-01`);
  const [customEnd, setCustomEnd] = useState(() => localDate());
  const today = localDate();
  const period = resolveReportPeriod(mode, anchor, customStart, customEnd, today);
  const query = useQuery<AnalyticsData>({
    queryKey: ["analytics", mode, period.start, period.end],
    queryFn: async () => (await api.get("/analytics", { params: mode === "all" ? { scope: "all" } : { start_date: period.start, end_date: period.end } })).data,
    enabled: period.valid,
  });
  const data = query.data;
  const changeMode = (next: ReportMode) => { setMode(next); setAnchor(localDate()); };
  const exportReport = async () => {
    if (!data || exporting || !period.valid) return;
    setExporting(true);
    setExportError("");
    const params = mode === "all" ? { scope: "all" } : { start_date: data.period.start_date, end_date: data.period.end_date };
    try {
      const response = await api.get<{ period: AnalyticsData["period"]; transactions: ExcelTransaction[] }>("/analytics/export-data", { params });
      const report = response.data;
      await exportFinanceExcel(`bao-cao-${report.period.start_date}-${report.period.end_date}.xlsx`, {
        title: "CapitalFlow — Báo cáo tài chính",
        scope: `Từ ${dateLabel(report.period.start_date)} đến ${dateLabel(report.period.end_date)}. Toàn bộ ${report.transactions.length} giao dịch trong kỳ.`,
        transactions: report.transactions,
      });
    } catch (error) {
      setExportError(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return <div className={`${styles.canvas} ${styles.reportCanvas}`}>
    <PageHead eyebrow="BỨC TRANH TÀI CHÍNH" title={period.valid ? period.label : "Chọn khoảng ngày"}
      titleAside={period.partial && <span className={styles.partial}>Đến {dateLabel(period.end)}</span>}
      description={data ? `Số liệu thực từ ${dateLabel(data.period.start_date)} đến ${dateLabel(data.period.end_date)}.` : "Chọn mốc thời gian để xem dòng tiền của bạn."}
      actions={<div className={styles.reportActions}><ReportPeriodFilter mode={mode} anchor={anchor} customStart={customStart} customEnd={customEnd} onMode={changeMode} onAnchor={setAnchor} onCustomStart={setCustomStart} onCustomEnd={setCustomEnd} /><button type="button" className="cf-btn" disabled={!data || !period.valid || query.isFetching || exporting} onClick={exportReport}><Download size={16} />{exporting ? "Đang xuất…" : "Xuất Excel"}</button></div>} />
    {exportError && <Alert onDismiss={() => setExportError("")}>{exportError}</Alert>}
    {!period.valid ? <div className={styles.panel}>Khoảng tùy chỉnh phải hợp lệ, không vượt ngày hôm nay và tối đa 367 ngày.</div>
      : query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : data && <>
      <div className={styles.kpis}>
        <div><span>Thu nhập</span><strong>{money(data.summary.income)}</strong><small>{mode === "all" ? "Từ khi bắt đầu ghi nhận" : `Kỳ trước ${money(data.previous_summary.income)}`}</small></div>
        <div><span>Chi tiêu</span><strong>{money(data.summary.expense)}</strong><small>{mode === "all" ? "Từ khi bắt đầu ghi nhận" : `Kỳ trước ${money(data.previous_summary.expense)}`}</small></div>
        <div><span>Dòng tiền ròng</span><strong>{money(data.summary.net)}</strong><small>Thu nhập trừ chi tiêu</small></div>
      </div>
      <ReportCharts trend={data.period_trend} categories={data.expense_by_category} previousCategories={data.previous_expense_by_category} totalExpense={data.summary.expense} net={data.summary.net} showComparison={mode !== "all"} />
      <p className={styles.footnote}>Chỉ tính giao dịch thu/chi thông thường; không tính chuyển tiền giữa các ví và chưa quy đổi ngoại tệ.</p>
    </>}
  </div>;
}
