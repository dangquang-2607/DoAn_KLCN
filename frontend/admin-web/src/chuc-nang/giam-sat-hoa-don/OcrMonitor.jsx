import density from "../../dung-chung/CSS/management.module.css";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Alert, ErrorState, Loading } from "../../dung-chung/UI-chung/ui";
import PageHead from "../../dung-chung/UI-chung/WorkspaceHead";
import OcrWorkspace from "./thanh-phan/OcrWorkspace";
import api from "../../dung-chung/connect-api/api";
import { errorMessage } from "../../dung-chung/tien-ich/format";

const refreshInterval = 5000;

export default function OcrMonitor() {
  const [retrying, setRetrying] = useState("");
  const [retryError, setRetryError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const query = useQuery({
    queryKey: ["admin-ocr"],
    queryFn: async ({ signal }) => (await api.get("/admin/system/ocr-monitor", { signal })).data,
    staleTime: 0,
    refetchInterval: refreshInterval,
  });

  // Sau khi backend chấp nhận retry, tải lại monitor để đồng bộ trạng thái mới nhất.
  const retry = async (jobId) => {
    if (pending.current || !jobId) return;
    pending.current = true;
    setRetrying(jobId); setRetryError(""); setNotice("");
    try {
      await api.post(`/admin/system/ocr-jobs/${jobId}/retry`);
      setNotice("Đã yêu cầu xử lý lại OCR. Theo dõi trạng thái tác vụ để xem kết quả.");
      await query.refetch();
    } catch (error) {
      setRetryError(errorMessage(error));
      // A concurrent confirmation/retry may have changed eligibility.
      await query.refetch();
    } finally { pending.current = false; setRetrying(""); }
  };

  return (
    <div className={`adm-surface adm-live adm-ocr ${density.page}`}>
      <PageHead eyebrow="HÓA ĐƠN & NHẬN DIỆN" title="Giám sát hóa đơn" description="Theo dõi quá trình nhận diện và những lần xử lý cần kiểm tra." />
      {retryError && <Alert onDismiss={() => setRetryError("")}>{retryError}</Alert>}
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      {query.isPending ? <Loading /> : query.isError && !query.data ? <ErrorState retry={() => query.refetch()} /> : (
        <>
          <OcrWorkspace data={query.data} retrying={retrying} onRetry={retry} />
          <p className={`cf-muted ${density.note}`}>
            Cập nhật lúc {new Date(query.dataUpdatedAt).toLocaleTimeString("vi-VN")} · Tự làm mới mỗi {refreshInterval / 1000} giây khi mở trang.
          </p>
          {query.isRefetchError && <Alert persistent>Lần cập nhật gần nhất thất bại. Số liệu trên thuộc lần tải trước.</Alert>}
        </>
      )}
    </div>
  );
}
