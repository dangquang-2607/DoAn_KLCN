"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Alert, ErrorState, Loading, PageHead } from "@/dung-chung/UI-chung/ui";
import {
  dateLabel,
  localDate,
  money,
  errorMessage,
  exportFinanceExcel,
  type ExcelTransaction,
} from "@/dung-chung/tien-ich/finance";
import {
  REPORT_START_DATE,
  SPENDING_REPORT_ID,
  resolveReportPeriod,
  type ReportMode,
} from "@/dung-chung/nghiep-vu/report";
import ReportPeriodFilter from "./thanh-phan/ReportPeriodFilter";
import ReportCharts from "./thanh-phan/ReportCharts";
import SpendingReport from "./thanh-phan/SpendingReport";
import type { FinancialReportData as AnalyticsData } from "@/dung-chung/nghiep-vu/report";
import styles from "./CSS/analytics.module.css";

/**
 * Component trang Phân tích & Báo cáo tài chính người dùng.
 * Quản lý kỳ phân tích, gọi API thống kê và kết xuất dữ liệu Excel.
 */
export default function Analytics({ initialPeriod = "month" }: { initialPeriod?: "week" | "month" }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const scrolledToSpending = useRef(false);
  const [mode, setMode] = useState<ReportMode>(initialPeriod);
  const [anchor, setAnchor] = useState(() => localDate());
  const [customStart, setCustomStart] = useState(() => {
    const monthStart = localDate().slice(0, 7) + "-01";
    return monthStart < REPORT_START_DATE ? REPORT_START_DATE : monthStart;
  });
  const [customEnd, setCustomEnd] = useState(() => localDate());
  const today = localDate();
  const period = resolveReportPeriod(
    mode,
    anchor,
    customStart,
    customEnd,
    today,
    REPORT_START_DATE,
  );
  const query = useQuery<AnalyticsData>({
    queryKey: ["analytics", mode, period.start, period.end],
    queryFn: async () =>
      (
        await api.get("/analytics", {
          params:
            mode === "all"
              ? { scope: "all" }
              : {
                  start_date: period.start,
                  end_date: period.end,
                  comparison: mode === "month" ? "previous_month" : "previous_period",
                },
        })
      ).data,
    enabled: period.valid,
  });
  const data = query.data;
  useEffect(() => {
    if (!data || scrolledToSpending.current || window.location.hash !== `#${SPENDING_REPORT_ID}`) return;
    const card = document.getElementById(SPENDING_REPORT_ID);
    if (!card) return;
    scrolledToSpending.current = true;
    card.scrollIntoView({ block: "start" });
  }, [data]);
  const changeMode = (next: ReportMode) => {
    setMode(next);
    setAnchor(localDate());
  };
  const exportReport = async () => {
    if (!data || exporting || !period.valid) return;
    setExporting(true);
    setExportError("");
    const params =
      mode === "all"
        ? { scope: "all" }
        : {
            start_date: data.period.start_date,
            end_date: data.period.end_date,
          };
    try {
      const response = await api.get<{
        period: AnalyticsData["period"];
        transactions: ExcelTransaction[];
      }>("/analytics/export-data", { params });
      const report = response.data;
      await exportFinanceExcel(
        `bao-cao-${report.period.start_date}-${report.period.end_date}.xlsx`,
        {
          title: "CapitalFlow — Báo cáo tài chính",
          scope: `Từ ${dateLabel(report.period.start_date)} đến ${dateLabel(report.period.end_date)}. Toàn bộ ${report.transactions.length} giao dịch trong kỳ.`,
          transactions: report.transactions,
        },
      );
    } catch (error) {
      setExportError(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={`${styles.canvas} ${styles.reportCanvas}`}>
      <PageHead
        eyebrow="PHÂN TÍCH THEO KỲ"
        title="Báo cáo tài chính"
        titleAside={
          period.partial && (
            <span className={styles.partial}>Đến {dateLabel(period.end)}</span>
          )
        }
        description={
          data
            ? `${period.label} · Số liệu từ ${dateLabel(data.period.start_date)} đến ${dateLabel(data.period.end_date)}.`
            : "Xem chi tiết thu chi theo ngày, tuần, tháng, quý, năm hoặc toàn bộ lịch sử."
        }
        actions={
          <div className={styles.reportActions}>
            <ReportPeriodFilter
              mode={mode}
              anchor={anchor}
              customStart={customStart}
              customEnd={customEnd}
              onMode={changeMode}
              onAnchor={setAnchor}
              onCustomStart={setCustomStart}
              onCustomEnd={setCustomEnd}
            />
            <button
              type="button"
              className="cf-btn"
              disabled={!data || !period.valid || query.isFetching || exporting}
              onClick={exportReport}
            >
              <Download size={16} />
              {exporting ? "Đang xuất…" : "Xuất Excel"}
            </button>
          </div>
        }
      />
      <div className={styles.content}>
        {exportError && (
          <Alert onDismiss={() => setExportError("")}>{exportError}</Alert>
        )}
        {!period.valid ? (
          <div className={styles.panel}>
            {mode === "day" ? "Chọn ngày trên lịch hoặc nhập ngày theo định dạng dd/mm/yyyy."
              : "Khoảng tùy chỉnh phải hợp lệ, không vượt ngày hôm nay và tối đa 367 ngày."}
          </div>
        ) : query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorState retry={() => query.refetch()} />
        ) : (
          data && (
            <>
              <div className={styles.kpis}>
                <div>
                  <span>Thu nhập trong kỳ</span>
                  <strong>{money(data.summary.income)}</strong>
                  <small>
                    {mode === "all"
                      ? "Từ khi bắt đầu ghi nhận"
                      : data.previous_period_available === false ? "Không có kỳ trước hợp lệ để so sánh" : `Kỳ trước ${money(data.previous_summary.income)}`}
                  </small>
                </div>
                <div>
                  <span>Chi tiêu trong kỳ</span>
                  <strong>{money(data.summary.expense)}</strong>
                  <small>
                    {mode === "all"
                      ? "Từ khi bắt đầu ghi nhận"
                      : data.previous_period_available === false ? "Không có kỳ trước hợp lệ để so sánh" : `Kỳ trước ${money(data.previous_summary.expense)}`}
                  </small>
                </div>
                <div>
                  <span>Dòng tiền ròng trong kỳ</span>
                  <strong>{money(data.summary.net)}</strong>
                  <small>Thu nhập trừ chi tiêu</small>
                </div>
              </div>
              <ReportCharts
                trend={data.period_trend}
                incomeCategories={data.income_by_category}
                categories={data.expense_by_category}
                previousCategories={data.previous_expense_by_category}
                totalIncome={data.summary.income}
                totalExpense={data.summary.expense}
                showComparison={mode !== "all"}
                comparison={mode === "month" ? "previous_month" : "previous_period"}
                spendingReport={<SpendingReport report={data} />}
              />
              <p className={styles.footnote}>
                Thu/chi được tổng hợp từ sổ thu chi; giao dịch ví chỉ được tính
                khi bật “Tính vào thu chi”. Mặc định, nạp/rút ngân hàng và chuyển
                giữa các ví của bạn không được tính; thanh toán hóa đơn và
                chuyển/nhận tiền với người khác được tính. Bạn có thể đổi lựa
                chọn này trong chi tiết giao dịch ví. Đơn vị tiền tệ: VND.
              </p>
            </>
          )
        )}
      </div>
    </div>
  );
}
