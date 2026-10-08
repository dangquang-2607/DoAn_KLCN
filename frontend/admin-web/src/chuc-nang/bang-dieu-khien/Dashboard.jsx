/**
 * ============================================================================
 * TÊN FILE: Dashboard.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Bảng điều khiển
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối dữ liệu tổng quan, OCR và hoạt động quản trị cho trang Dashboard.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React Query, admin API client và các component trong components/dashboard.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất route Dashboard với đầy đủ trạng thái tải, lỗi và làm mới.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Giữ nguyên endpoint, chu kỳ tự làm mới 30 giây và không hiển thị dữ liệu cá nhân.
 * ============================================================================
 */
import { useQuery } from "@tanstack/react-query";
import { Clock3, RefreshCw } from "lucide-react";
import DashboardStats from "./thanh-phan/DashboardStats";
import OperationsCenter from "./thanh-phan/OperationsCenter";
import RecentAdminActivity from "./thanh-phan/RecentAdminActivity";
import { ErrorState, Loading } from "../../dung-chung/UI-chung/design";
import PageHead from "../../dung-chung/UI-chung/WorkspaceHead";
import api from "../../dung-chung/connect-api/api";

export default function Dashboard() {
  // Ba query giữ nguyên khóa cache và endpoint để không thay đổi hành vi runtime.
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: async () => (await api.get("/admin/overview")).data, refetchInterval: 30000 });
  const monitor = useQuery({ queryKey: ["admin-ocr"], queryFn: async () => (await api.get("/admin/system/ocr-monitor")).data, refetchInterval: 30000 });
  const activity = useQuery({ queryKey: ["audit-logs", "recent"], queryFn: async () => (await api.get("/admin/audit-logs", { params: { page_size: 5 } })).data, refetchInterval: 30000 });

  const refresh = () => {
    overview.refetch();
    monitor.refetch();
    activity.refetch();
  };

  return (
    <div className="adm-surface adm-live adm-dashboard-demo">
      <PageHead eyebrow="TRUNG TÂM ĐIỀU HÀNH" title="Bảng điều khiển" description="Tín hiệu quan trọng trước, chi tiết vận hành ở ngay bên dưới." actions={<button className="cf-btn" onClick={refresh} disabled={overview.isFetching || monitor.isFetching || activity.isFetching}><RefreshCw />Làm mới</button>} />
      {overview.isPending ? <Loading /> : overview.isError ? <ErrorState retry={() => overview.refetch()} /> : (
        <>
          {monitor.isPending ? <Loading /> : monitor.isError ? <ErrorState retry={() => monitor.refetch()} /> : <OperationsCenter users={overview.data.users} data={monitor.data} />}
          <DashboardStats data={overview.data} monitor={monitor.isError ? null : monitor.data} />
          <RecentAdminActivity query={activity} />
          <p className="adm-dashboard-footer"><Clock3 size={16} />Cập nhật lúc {new Date(overview.dataUpdatedAt).toLocaleTimeString("vi-VN")} · Tự làm mới sau 30 giây. Tài khoản sẵn sàng không phải người đang online.</p>
          {(overview.isRefetchError || monitor.isRefetchError || activity.isRefetchError) && <p role="alert" className="cf-alert">Lần cập nhật mới nhất thất bại. Không coi số liệu đã tải trước đó là trạng thái mới.</p>}
        </>
      )}
    </div>
  );
}
