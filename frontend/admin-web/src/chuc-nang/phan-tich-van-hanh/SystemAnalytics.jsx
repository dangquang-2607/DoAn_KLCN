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
 *   Chỉ dùng số liệu tổng hợp theo kỳ từ API; không truy xuất giao dịch cá nhân.
 * ============================================================================
 */
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { ErrorState, Loading } from "../../dung-chung/UI-chung/design";
import PageHead from "../../dung-chung/UI-chung/WorkspaceHead";
import SystemMetricCards from "./thanh-phan/SystemMetricCards";
import TopCategoriesChart from "./thanh-phan/TopCategoriesChart";
import TransactionCompositionWidget from "./thanh-phan/TransactionCompositionWidget";
import AnalyticsPeriodFilter from "./thanh-phan/AnalyticsPeriodFilter";
import AnalyticsVolumeChart from "./thanh-phan/AnalyticsVolumeChart";
import { periodLabel, todayInVietnam, units } from "./xu-ly/report-period";
import { dateLabel } from "../../dung-chung/tien-ich/format";
import api from "../../dung-chung/connect-api/api";

export default function SystemAnalytics() {
  const [unit, setUnit] = useState("month");
  const [anchor, setAnchor] = useState(todayInVietnam);
  const query = useQuery({ queryKey: ["admin-analytics", unit, anchor], queryFn: async ({ signal }) => (await api.get("/admin/system/analytics", { params: { unit, anchor, periods: 12 }, signal })).data });
  const data = query.data;
  const comparisonNote = data ? `${dateLabel(data.comparison.current_start)}–${dateLabel(data.comparison.current_end)} đối chiếu ${dateLabel(data.comparison.previous_start)}–${dateLabel(data.comparison.previous_end)}. ${data.period.partial ? "Kỳ hiện tại chưa kết thúc; đối chiếu cùng số ngày lịch." : "So sánh hai kỳ trọn vẹn."}` : "";

  return (
    <div className="adm-surface sa-demo adm-live">
      <PageHead eyebrow="VẬN HÀNH" title="Phân tích hệ thống" description="Số liệu sử dụng tổng hợp, không hiển thị nội dung giao dịch cá nhân." actions={<button className="cf-btn" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw />Làm mới</button>} />
      <AnalyticsPeriodFilter unit={unit} anchor={anchor} period={data?.period} today={data?.period.today || todayInVietnam()} onUnit={setUnit} onAnchor={setAnchor} />
      {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : (
        <>
          <SystemMetricCards data={data} />
          <AnalyticsVolumeChart view={{ label: units[unit], trend: data.trend.map((item) => ({ ...item, label: periodLabel({ ...item, unit }, true) })) }} period={{ id: data.period.start, total: data.metrics.total, comparableTotal: data.comparison.current, previous: data.comparison.previous, previousLabel: dateLabel(data.comparison.previous_start), comparisonNote }} />
          <div className="sa-demo__charts">
            <TopCategoriesChart data={data.top_categories} total={data.metrics.total} context={periodLabel(data.period)} />
            <TransactionCompositionWidget transactions={data.metrics} />
          </div>
          <p className="cf-data-note">Đếm bản ghi theo ngày giao dịch (transaction_date), không theo ngày tạo. Chuyển tiền gồm hai bản ghi đối ứng; không xem tăng khối lượng là tăng doanh thu. Không có giao dịch vẫn hiển thị 0.</p>
        </>
      )}
    </div>
  );
}
