import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, ErrorState, Loading } from "../../dung-chung/UI-chung/ui";
import PageHead from "../../dung-chung/UI-chung/WorkspaceHead";
import { SystemMetricCards, TopCategoriesChart, TransactionCompositionWidget } from "./thanh-phan/AnalyticsSummary";
import AnalyticsPeriodFilter from "./thanh-phan/AnalyticsPeriodFilter";
import AnalyticsVolumeChart from "./thanh-phan/AnalyticsVolumeChart";
import { periodLabel, todayInVietnam, units } from "./xu-ly/report-period";
import { dateLabel } from "../../dung-chung/tien-ich/format";
import api from "../../dung-chung/connect-api/api";
import density from "../../dung-chung/CSS/overview.module.css";

export default function SystemAnalytics() {
  const [unit, setUnit] = useState("month");
  const [anchor, setAnchor] = useState(todayInVietnam);
  const query = useQuery({ queryKey: ["admin-analytics", unit, anchor], queryFn: async ({ signal }) => (await api.get("/admin/system/analytics", { params: { unit, anchor, periods: 12 }, signal })).data });
  const data = query.data;

  return (
    <div className={`adm-surface adm-analytics adm-live ${density.page}`}>
      <PageHead eyebrow="VẬN HÀNH" title="Phân tích hệ thống" description="Số liệu sử dụng tổng hợp, không hiển thị nội dung giao dịch cá nhân." />
      <AnalyticsPeriodFilter unit={unit} anchor={anchor} period={data?.period} today={data?.period?.today || todayInVietnam()} onUnit={setUnit} onAnchor={setAnchor} />
      {query.isPending ? <Loading /> : query.isError && !data ? <ErrorState retry={() => query.refetch()} /> : (
        <>
          <SystemMetricCards data={data} />
          {query.isRefetchError && <Alert persistent>Lần cập nhật gần nhất thất bại. Số liệu trên thuộc lần tải trước.</Alert>}
          <AnalyticsVolumeChart view={{ label: units[unit], trend: (data.trend || []).map((item) => ({ ...item, label: periodLabel({ ...item, unit }, true) })) }} period={{ id: data.period?.start, total: data.metrics?.total, comparableTotal: data.comparison?.current, previous: data.comparison?.previous, previousLabel: dateLabel(data.comparison?.previous_start) }} />
          <div className="adm-analytics__charts">
            <TopCategoriesChart data={data.top_categories} total={data.metrics.total} context={periodLabel(data.period)} />
            <TransactionCompositionWidget transactions={data.metrics} />
          </div>
          <p className="cf-data-note">Đếm bản ghi theo ngày giao dịch, không theo ngày tạo. Chuyển tiền giữa các ví gồm hai bản ghi đối ứng; nạp/rút ngân hàng được đếm theo bản ghi ví. Không xem tăng khối lượng là tăng doanh thu. Không có giao dịch vẫn hiển thị 0.</p>
        </>
      )}
    </div>
  );
}
