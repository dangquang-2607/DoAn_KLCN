import { useQuery } from "@tanstack/react-query";
import { Clock3 } from "lucide-react";
import DashboardStats from "./thanh-phan/DashboardStats";
import OperationsCenter from "./thanh-phan/OperationsCenter";
import RecentAdminActivity from "./thanh-phan/RecentAdminActivity";
import { ErrorState, Loading } from "../../dung-chung/UI-chung/ui";
import PageHead from "../../dung-chung/UI-chung/WorkspaceHead";
import api from "../../dung-chung/connect-api/api";
import density from "../../dung-chung/CSS/overview.module.css";

export default function Dashboard() {
  // Ba query giữ nguyên khóa cache và endpoint để không thay đổi hành vi runtime.
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: async ({ signal }) => (await api.get("/admin/overview", { signal })).data, refetchInterval: 30000 });
  const monitor = useQuery({ queryKey: ["admin-ocr"], queryFn: async ({ signal }) => (await api.get("/admin/system/ocr-monitor", { signal })).data, refetchInterval: 30000 });
  const activity = useQuery({ queryKey: ["audit-logs", "recent"], queryFn: async ({ signal }) => (await api.get("/admin/audit-logs", { params: { page_size: 5 }, signal })).data, refetchInterval: 30000 });

  return (
    <div className={`adm-surface adm-live adm-dashboard ${density.page}`}>
      <PageHead eyebrow="TRUNG TÂM ĐIỀU HÀNH" title="Bảng điều khiển" description="Tín hiệu quan trọng trước, chi tiết vận hành ở ngay bên dưới." />
      {overview.isPending ? <Loading /> : overview.isError && !overview.data ? <ErrorState retry={() => overview.refetch()} /> : (
        <>
          {monitor.isPending ? <Loading /> : monitor.isError && !monitor.data ? <ErrorState retry={() => monitor.refetch()} /> : <OperationsCenter users={overview.data.users} data={monitor.data} />}
          <DashboardStats data={overview.data} monitor={monitor.data} />
          <RecentAdminActivity query={activity} />
          <p className="adm-dashboard-footer"><Clock3 size={16} />Cập nhật lúc {new Date(overview.dataUpdatedAt).toLocaleTimeString("vi-VN")} · Tự làm mới sau 30 giây. Tài khoản sẵn sàng không phải người đang online.</p>
          {(overview.isRefetchError || monitor.isRefetchError || activity.isRefetchError) && <p role="alert" className="cf-alert">Lần cập nhật mới nhất thất bại. Không coi số liệu đã tải trước đó là trạng thái mới.</p>}
        </>
      )}
    </div>
  );
}
