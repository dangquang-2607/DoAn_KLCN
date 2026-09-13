import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import api from "../services/api";
import {
  PageHead,
  Panel,
  Stat,
  Loading,
  ErrorState,
  Empty,
} from "../components/design";
export default function OcrMonitor() {
  const query = useQuery({
    queryKey: ["admin-ocr"],
    queryFn: async () => (await api.get("/admin/system/ocr-monitor")).data,
    refetchInterval: 15000,
  });
  const d = query.data;
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="HÓA ĐƠN & NHẬN DIỆN"
        title="Giám sát hóa đơn"
        description="Theo dõi quá trình nhận diện và những lần xử lý cần kiểm tra."
        actions={
          <button
            className="cf-btn"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw />
            Làm mới
          </button>
        }
      />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : (
        <>
          <div className="cf-grid-4">
            <Stat
              label="Tổng hóa đơn"
              value={d.invoices.total}
              note="Toàn hệ thống"
            />
            <Stat
              label="Chờ kiểm tra"
              value={d.invoices.review_required}
              note="Đã quét, chờ người dùng xác nhận"
            />
            <Stat
              label="Lượt xử lý lỗi"
              value={d.ocr_jobs.failed}
              note={`Trong ${d.ocr_jobs.total} lượt xử lý`}
            />
            <Stat
              label="Tỷ lệ xử lý lỗi"
              value={`${d.ocr_jobs.error_rate_pct}%`}
              note="Dựa trên số lượt xử lý"
            />
          </div>
          <Panel title="Trạng thái hóa đơn">
            <div className="cf-panel-body cf-grid">
              {[
                ["uploaded", "Chưa quét"],
                ["processing", "Đang xử lý"],
                ["review_required", "Chờ kiểm tra"],
                ["completed", "Đã xác nhận"],
                ["failed", "Thất bại"],
              ].map(([key, label]) => (
                <div className="cf-row cf-between" key={key}>
                  <span
                    className={`cf-badge ${key === "failed" ? "danger" : key === "completed" ? "success" : "info"}`}
                  >
                    {label}
                  </span>
                  <strong className="cf-number">{d.invoices[key]}</strong>
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title="Các lần xử lý lỗi gần đây"
            description="10 lần thất bại gần nhất"
          >
            {!d.recent_failures.length ? (
              <Empty
                title="Chưa ghi nhận lỗi xử lý"
                description="Các lỗi phát sinh sẽ xuất hiện tại đây."
              />
            ) : (
              <div className="cf-table-wrap">
                <table className="cf-table">
                  <thead>
                    <tr>
                      <th>Mã xử lý</th>
                      <th>Nội dung lỗi</th>
                      <th>Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.recent_failures.map((f) => (
                      <tr key={f.job_id}>
                        <td title={f.job_id}>{f.job_id.slice(0, 8)}</td>
                        <td style={{ whiteSpace: "normal", maxWidth: 650 }}>
                          {f.error || "Không có chi tiết lỗi"}
                        </td>
                        <td>
                          {new Date(f.created_at).toLocaleString("vi-VN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <p className="cf-muted" style={{ fontSize: 12 }}>
            Tự làm mới sau 15 giây · “Đã xác nhận” là hóa đơn được người dùng
            ghi nhận vào giao dịch.
          </p>
        </>
      )}
    </div>
  );
}
