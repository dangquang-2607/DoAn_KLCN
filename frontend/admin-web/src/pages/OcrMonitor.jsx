/**
 * ============================================================================
 * TÊN FILE: OcrMonitor.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Giám sát hóa đơn OCR
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối truy vấn giám sát và mutation gửi lại tác vụ OCR lỗi.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React Query, admin API client và các component ocr-monitor.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất route OcrMonitor tự làm mới sau 15 giây.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Retry dùng đúng job ID và khóa thao tác đồng thời để tránh gửi trùng.
 * ============================================================================
 */
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Alert, ErrorState, Loading, PageHead } from "../components/design";
import InvoiceStatusSummary from "../components/ocr-monitor/InvoiceStatusSummary";
import OcrFailureTable from "../components/ocr-monitor/OcrFailureTable";
import OcrStatsGrid from "../components/ocr-monitor/OcrStatsGrid";
import api from "../services/api";

export default function OcrMonitor() {
  const [retrying, setRetrying] = useState("");
  const [retryError, setRetryError] = useState("");
  const query = useQuery({ queryKey: ["admin-ocr"], queryFn: async () => (await api.get("/admin/system/ocr-monitor")).data, refetchInterval: 15000 });

  // Sau khi backend chấp nhận retry, tải lại monitor để đồng bộ trạng thái mới nhất.
  const retry = async (jobId) => {
    setRetrying(jobId); setRetryError("");
    try {
      await api.post(`/admin/system/ocr-jobs/${jobId}/retry`);
      await query.refetch();
    } catch (error) {
      setRetryError(error?.response?.data?.detail || "Không thể gửi lại tác vụ OCR.");
    } finally { setRetrying(""); }
  };

  return (
    <div className="cf-stack">
      <PageHead eyebrow="HÓA ĐƠN & NHẬN DIỆN" title="Giám sát hóa đơn" description="Theo dõi quá trình nhận diện và những lần xử lý cần kiểm tra." actions={<button className="cf-btn" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw />Làm mới</button>} />
      {retryError && <Alert onDismiss={() => setRetryError("")}>{retryError}</Alert>}
      {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : (
        <>
          <OcrStatsGrid data={query.data} />
          <InvoiceStatusSummary invoices={query.data.invoices} />
          <OcrFailureTable failures={query.data.recent_failures} retrying={retrying} onRetry={retry} />
          <p className="cf-muted" style={{ fontSize: 12 }}>Tự làm mới sau 15 giây · “Đã xác nhận” là hóa đơn được người dùng ghi nhận vào giao dịch.</p>
        </>
      )}
    </div>
  );
}
