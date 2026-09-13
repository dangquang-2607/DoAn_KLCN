import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users,
  ArrowLeftRight,
  ScanLine,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import api from "../services/api";
import {
  PageHead,
  Panel,
  Stat,
  Loading,
  ErrorState,
  Empty,
} from "../components/design";
export default function Dashboard() {
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => (await api.get("/admin/overview")).data,
    refetchInterval: 30000,
  });
  const monitor = useQuery({
    queryKey: ["admin-ocr"],
    queryFn: async () => (await api.get("/admin/system/ocr-monitor")).data,
    refetchInterval: 30000,
  });
  const activity = useQuery({
    queryKey: ["audit-logs", "recent"],
    queryFn: async () =>
      (await api.get("/admin/audit-logs", { params: { page_size: 5 } })).data,
  });
  const data = overview.data;
  const refresh = () => {
    overview.refetch();
    monitor.refetch();
    activity.refetch();
  };
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="TRUNG TÂM ĐIỀU HÀNH"
        title="Tổng quan hệ thống"
        description="Theo dõi người dùng, giao dịch và quá trình xử lý hóa đơn."
        actions={
          <button
            className="cf-btn"
            onClick={refresh}
            disabled={overview.isFetching}
          >
            <RefreshCw />
            Làm mới
          </button>
        }
      />
      {overview.isPending ? (
        <Loading />
      ) : overview.isError ? (
        <ErrorState retry={() => overview.refetch()} />
      ) : (
        <>
          <div className="cf-grid-4">
            <Stat
              label="Tổng người dùng"
              value={data.users.total.toLocaleString("vi-VN")}
              icon={<Users />}
              note="Tài khoản đã đăng ký"
            />
            <Stat
              label="Tài khoản hoạt động"
              value={data.users.active.toLocaleString("vi-VN")}
              icon={<ShieldCheck />}
              note={`${data.users.banned} tài khoản đang bị khóa`}
            />
            <Stat
              label="Tổng giao dịch"
              value={data.total_transactions.toLocaleString("vi-VN")}
              icon={<ArrowLeftRight />}
              note="Tất cả thời gian"
            />
            <Stat
              label="Tổng hóa đơn"
              value={data.invoices.total.toLocaleString("vi-VN")}
              icon={<ScanLine />}
              note={`${data.invoices.completed} đã xác nhận`}
            />
          </div>
          <div className="cf-split">
            <Panel
              title="Hoạt động gần đây"
              description="Các thao tác được ghi nhận trong nhật ký"
              action={
                <Link className="cf-inline-link" to="/audit-logs">
                  Xem nhật ký →
                </Link>
              }
            >
              {activity.isPending ? (
                <Loading />
              ) : activity.isError ? (
                <ErrorState retry={() => activity.refetch()} />
              ) : !activity.data?.items?.length ? (
                <Empty title="Chưa có hoạt động quản trị" />
              ) : (
                <div className="cf-table-wrap">
                  <table className="cf-table">
                    <thead>
                      <tr>
                        <th>Hành động</th>
                        <th>Đối tượng</th>
                        <th>Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.data.items.map((l) => (
                        <tr key={l.id}>
                          <td>
                            <span className="cf-badge info">{l.action}</span>
                          </td>
                          <td>{l.target_type || "—"}</td>
                          <td className="cf-muted">
                            {new Date(l.created_at).toLocaleString("vi-VN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
            <Panel
              title="Tiến trình hóa đơn"
              action={
                <Link className="cf-inline-link" to="/ocr-monitor">
                  Chi tiết →
                </Link>
              }
            >
              {monitor.isPending ? (
                <Loading />
              ) : monitor.isError ? (
                <ErrorState retry={() => monitor.refetch()} />
              ) : (
                <div className="cf-panel-body cf-stack" style={{ gap: 20 }}>
                  {[
                    ["uploaded", "Chưa quét"],
                    ["processing", "Đang xử lý"],
                    ["review_required", "Chờ kiểm tra"],
                    ["completed", "Đã xác nhận"],
                    ["failed", "Xử lý thất bại"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <div
                        className="cf-row cf-between"
                        style={{ fontSize: 14, marginBottom: 9 }}
                      >
                        <span>{label}</span>
                        <strong className="cf-number">
                          {monitor.data.invoices[key]}
                        </strong>
                      </div>
                      <div className="cf-progress">
                        <span
                          style={{
                            width: `${monitor.data.invoices.total ? (monitor.data.invoices[key] / monitor.data.invoices.total) * 100 : 0}%`,
                            background:
                              key === "failed" ? "var(--cf-danger)" : undefined,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
          <div className="cf-grid">
            {[
              [
                "/users",
                "Quản lý người dùng",
                "Kiểm tra tài khoản và điều chỉnh quyền truy cập.",
                Users,
              ],
              [
                "/ocr-monitor",
                "Giám sát xử lý hóa đơn",
                "Theo dõi trạng thái và xem các lần xử lý lỗi.",
                ScanLine,
              ],
              [
                "/email-logs",
                "Email & thông báo",
                "Xem lịch sử gửi thư và cấu hình máy chủ.",
                ShieldCheck,
              ],
            ].map(([href, title, desc, Icon]) => (
              <Panel key={href}>
                <div className="cf-panel-body cf-stack" style={{ gap: 14 }}>
                  <span className="cf-icon">
                    <Icon />
                  </span>
                  <h2>{title}</h2>
                  <p className="cf-muted" style={{ fontSize: 14, margin: 0 }}>
                    {desc}
                  </p>
                  <Link className="cf-inline-link" to={href}>
                    Mở quản lý{" "}
                    <ArrowRight size={14} style={{ display: "inline" }} />
                  </Link>
                </div>
              </Panel>
            ))}
          </div>
          <p className="cf-muted" style={{ fontSize: 12 }}>
            Cập nhật lúc{" "}
            {new Date(overview.dataUpdatedAt).toLocaleTimeString("vi-VN")} · Tự
            làm mới sau 30 giây.
          </p>
        </>
      )}
    </div>
  );
}
