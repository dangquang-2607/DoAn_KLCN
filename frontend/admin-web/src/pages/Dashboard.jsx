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
import { RefreshCw } from "lucide-react";
import DashboardStats from "../components/dashboard/DashboardStats";
import InvoiceProgressWidget from "../components/dashboard/InvoiceProgressWidget";
import QuickManagementLinks from "../components/dashboard/QuickManagementLinks";
import RecentAdminActivity from "../components/dashboard/RecentAdminActivity";
import { ErrorState, Loading, PageHead } from "../components/design";
import api from "../services/api";

export default function Dashboard() {
  // Ba query giữ nguyên khóa cache và endpoint để không thay đổi hành vi runtime.
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: async () => (await api.get("/admin/overview")).data, refetchInterval: 30000 });
  const monitor = useQuery({ queryKey: ["admin-ocr"], queryFn: async () => (await api.get("/admin/system/ocr-monitor")).data, refetchInterval: 30000 });
  const activity = useQuery({ queryKey: ["audit-logs", "recent"], queryFn: async () => (await api.get("/admin/audit-logs", { params: { page_size: 5 } })).data });

  const refresh = () => {
    overview.refetch();
    monitor.refetch();
    activity.refetch();
  };

  return (
    <div className="cf-stack">
      <PageHead eyebrow="TRUNG TÂM ĐIỀU HÀNH" title="Tổng quan hệ thống" description="Theo dõi người dùng, giao dịch và quá trình xử lý hóa đơn." actions={<button className="cf-btn" onClick={refresh} disabled={overview.isFetching}><RefreshCw />Làm mới</button>} />
      {overview.isPending ? <Loading /> : overview.isError ? <ErrorState retry={() => overview.refetch()} /> : (
        <>
          <DashboardStats data={overview.data} />
          <div className="cf-split"><RecentAdminActivity query={activity} /><InvoiceProgressWidget query={monitor} /></div>
          <QuickManagementLinks />
          <p className="cf-muted" style={{ fontSize: 12 }}>Cập nhật lúc {new Date(overview.dataUpdatedAt).toLocaleTimeString("vi-VN")} · Tự làm mới sau 30 giây.</p>
        </>
      )}
    </div>
  );
}
