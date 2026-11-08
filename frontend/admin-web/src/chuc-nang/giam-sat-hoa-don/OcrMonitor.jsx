import density from "../../dung-chung/CSS/management.module.css";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Alert, ErrorState, Loading } from "../../dung-chung/UI-chung/ui";
import PageHead from "../../dung-chung/UI-chung/WorkspaceHead";
import OcrWorkspace from "./thanh-phan/OcrWorkspace";
import api from "../../dung-chung/connect-api/api";
import { errorMessage } from "../../dung-chung/tien-ich/format";

export default function OcrMonitor() {
  const [retrying, setRetrying] = useState("");
  const [retryError, setRetryError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const query = useQuery({ queryKey: ["admin-ocr"], queryFn: async ({ signal }) => (await api.get("/admin/system/ocr-monitor", { signal })).data, refetchInterval: 15000 });

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
          <p className={`cf-muted ${density.note}`}>Tự làm mới sau 15 giây · “Đã xác nhận” là hóa đơn được người dùng ghi nhận vào giao dịch.</p>
          {query.isRefetchError && <Alert persistent>Lần cập nhật gần nhất thất bại. Số liệu trên thuộc lần tải trước.</Alert>}
        </>
      )}
    </div>
  );
}
