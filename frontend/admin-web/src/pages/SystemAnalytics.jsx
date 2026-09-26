/**
 * ============================================================================
 * TÊN FILE: SystemAnalytics.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Phân tích vận hành
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối truy vấn và các khối hiển thị số liệu vận hành tổng hợp.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React Query, admin API client và các component system-analytics.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất route SystemAnalytics với trạng thái tải, lỗi và làm mới.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ sử dụng hợp đồng hiện có của /admin/system/analytics.
 * ============================================================================
 */
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { ErrorState, Loading, PageHead } from "../components/design";
import SystemMetricCards from "../components/system-analytics/SystemMetricCards";
import TopCategoriesChart from "../components/system-analytics/TopCategoriesChart";
import TransactionCompositionWidget from "../components/system-analytics/TransactionCompositionWidget";
import { useMotionAllowed } from "../hooks/useMotionAllowed";
import api from "../services/api";

export default function SystemAnalytics() {
  const motionAllowed = useMotionAllowed();
  // Query duy nhất là nguồn dữ liệu có thẩm quyền cho toàn bộ màn hình.
  const query = useQuery({ queryKey: ["admin-analytics"], queryFn: async () => (await api.get("/admin/system/analytics")).data });

  return (
    <div className="cf-stack">
      <PageHead eyebrow="VẬN HÀNH" title="Phân tích hệ thống" description="Số liệu sử dụng tổng hợp, không hiển thị nội dung giao dịch cá nhân." actions={<button className="cf-btn" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw />Làm mới</button>} />
      {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : (
        <>
          <SystemMetricCards data={query.data} />
          <div className="cf-grid-2">
            <TopCategoriesChart data={query.data.top_categories} motionAllowed={motionAllowed} />
            <TransactionCompositionWidget transactions={query.data.transactions} />
          </div>
        </>
      )}
    </div>
  );
}
