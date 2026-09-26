/**
 * ============================================================================
 * TÊN FILE: page.tsx
 * MÀN HÌNH / PHÂN HỆ: Báo cáo tài chính
 * NHÓM VỆ TINH: page.tsx (Điều phối)
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối dữ liệu, trạng thái và hành vi của màn hình tương ứng.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   TanStack Query, API client, state React và các component vệ tinh của phân hệ.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất page để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ trình bày dữ liệu tổng hợp; chưa tự quy đổi giữa các loại tiền.
 * ============================================================================
 */
"use client";

/** Điều phối kỳ báo cáo, truy vấn API và xuất CSV; biểu đồ nằm trong `_components`. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import api from "@/lib/api";
import { ErrorState, Field, Loading, PageHead } from "@/components/ui/ui";
import { useMotionAllowed } from "@/hooks/useMotionAllowed";
import CashflowBarChart, { type CashflowPoint } from "./_components/CashflowBarChart";
import CashflowSummaryTable, { type CashflowSummary } from "./_components/CashflowSummaryTable";
import CategoryExpensePie from "./_components/CategoryExpensePie";
import { analyticsStyles } from "./_styles/analytics.styles";

interface AnalyticsData {
  period: { start_date: string; end_date: string };
  summary: CashflowSummary;
  previous_summary: CashflowSummary;
  expense_by_category: Record<string, number>;
  trend: CashflowPoint[];
}

export default function Analytics() {
  const motionAllowed = useMotionAllowed();
  const [period, setPeriod] = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
  const [mode, setMode] = useState<"MONTH" | "CUSTOM">("MONTH");
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const query = useQuery<AnalyticsData>({
    queryKey: ["analytics", mode, period, startDate, endDate],
    queryFn: async () => (await api.get("/analytics", { params: mode === "MONTH"
      ? { year: Number(period.slice(0, 4)), month: Number(period.slice(5)) }
      : { start_date: startDate, end_date: endDate } })).data,
    enabled: mode === "MONTH" ? !!period : Boolean(startDate && endDate && startDate <= endDate),
  });
  const data = query.data;
  const periodLabel = data ? `${data.period.start_date} → ${data.period.end_date}` : period;
  // Tải báo cáo đúng khoảng ngày backend đã trả về và thu hồi URL blob sau khi dùng.
  const exportReport = async () => {
    if (!data) return;
    const response = await api.get("/analytics/export.csv", { params: { start_date: data.period.start_date, end_date: data.period.end_date }, responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-${data.period.start_date}-${data.period.end_date}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="cf-stack">
    <PageHead eyebrow="BÁO CÁO" title="Phân tích tài chính" description="Hiểu cơ cấu chi tiêu và xu hướng dòng tiền." actions={<>
      <Field label="Phạm vi"><select className="cf-input" value={mode} onChange={(event) => setMode(event.target.value as "MONTH" | "CUSTOM")}><option value="MONTH">Theo tháng</option><option value="CUSTOM">Khoảng ngày</option></select></Field>
      {mode === "MONTH" ? <Field label="Kỳ báo cáo"><input className="cf-input" type="month" required value={period} onChange={(event) => event.target.value && setPeriod(event.target.value)} /></Field> : <>
        <Field label="Từ ngày"><input className="cf-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field>
        <Field label="Đến ngày"><input className="cf-input" type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field>
      </>}
      <button className="cf-btn" disabled={!data} onClick={exportReport}><Download />Xuất CSV</button>
    </>} />
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : data && <>
      <CashflowSummaryTable current={data.summary} previous={data.previous_summary} periodLabel={periodLabel} />
      <div className="cf-split"><CashflowBarChart data={data.trend} animate={motionAllowed} /><CategoryExpensePie values={data.expense_by_category} periodLabel={periodLabel} animate={motionAllowed} /></div>
      <p className="cf-muted" style={analyticsStyles.footnote}>Số liệu tổng hợp từ các giao dịch đã ghi nhận; chưa quy đổi giữa các loại tiền.</p>
    </>}
  </div>;
}
