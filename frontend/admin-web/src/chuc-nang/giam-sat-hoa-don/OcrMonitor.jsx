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
import { Alert, ErrorState, Loading } from "../../dung-chung/UI-chung/design";
import PageHead from "../../dung-chung/UI-chung/WorkspaceHead";
import OcrWorkspace from "./thanh-phan/OcrWorkspace";
import api from "../../dung-chung/connect-api/api";

export default function OcrMonitor() {
  const [retrying, setRetrying] = useState("");
  const [retryError, setRetryError] = useState("");
  const query = useQuery({ queryKey: ["admin-ocr"], queryFn: async () => (await api.get("/admin/system/ocr-monitor")).data, refetchInterval: 15000 });

  // Sau khi backend chấp nhận retry, tải lại monitor để đồng bộ trạng thái mới nhất.
  const retry = async (jobId) => {
    if (retrying) return;
    setRetrying(jobId); setRetryError("");
    try {
      await api.post(`/admin/system/ocr-jobs/${jobId}/retry`);
      await query.refetch();
    } catch (error) {
      setRetryError(error?.response?.data?.detail || "Không thể gửi lại tác vụ OCR.");
    } finally { setRetrying(""); }
  };

  return (
    <div className="adm-surface adm-live adm-ocr-demo">
      <PageHead eyebrow="HÓA ĐƠN & NHẬN DIỆN" title="Giám sát hóa đơn" description="Theo dõi quá trình nhận diện và những lần xử lý cần kiểm tra." actions={<button className="cf-btn" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw />Làm mới</button>} />
      {retryError && <Alert onDismiss={() => setRetryError("")}>{retryError}</Alert>}
      {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : (
        <>
          <OcrWorkspace data={query.data} retrying={retrying} onRetry={retry} />
          <p className="cf-muted" style={{ fontSize: 12 }}>Tự làm mới sau 15 giây · “Đã xác nhận” là hóa đơn được người dùng ghi nhận vào giao dịch.</p>
          {query.isRefetchError && <Alert persistent>Lần cập nhật gần nhất thất bại. Số liệu trên thuộc lần tải trước.</Alert>}
        </>
      )}
    </div>
  );
}
