/**
 * ============================================================================
 * TÊN FILE: page.tsx
 * MÀN HÌNH / PHÂN HỆ: User Web
 * NHÓM VỆ TINH: page.tsx (Điều phối)
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối dữ liệu, trạng thái và hành vi của màn hình tương ứng.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   TanStack Query, API client, state React và các component vệ tinh của phân hệ.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất page để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
"use client";

/**
 * Trang điều phối dashboard: tải ba nguồn dữ liệu và ghép các widget tổng quan.
 * Component con chỉ trình bày; query key và hành vi làm mới được giữ tập trung tại đây.
 */
import { useQuery } from "@tanstack/react-query";
import { ErrorState, Loading } from "@/dung-chung/UI-chung/ui";
import api from "@/dung-chung/connect-api/api";
import { localDate } from "@/dung-chung/tien-ich/finance";
import { type Account, type Budget } from "@/dung-chung/nghiep-vu/finance";
import { shiftReportDay } from "@/dung-chung/nghiep-vu/report-period";
import AccountsWidget from "./thanh-phan/AccountsWidget";
import BudgetsWidget from "./thanh-phan/BudgetsWidget";
import OverviewStats, { type OverviewData } from "./thanh-phan/OverviewStats";
import OverviewCharts from "./thanh-phan/OverviewCharts";
import QuickActions from "./thanh-phan/QuickActions";
import RecentTransactions from "./thanh-phan/RecentTransactions";
import styles from "./CSS/overview.module.css";

export default function Overview() {
  const dashboardQuery = useQuery<OverviewData>({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/dashboard")).data,
  });
  const accountsQuery = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get("/accounts")).data,
  });
  const budgetsQuery = useQuery<Budget[]>({
    queryKey: ["budgets"],
    queryFn: async () => (await api.get("/budgets")).data,
    refetchInterval: 60_000,
  });
  const today = localDate();
  const trendQuery = useQuery({
    queryKey: ["overview-trend", today],
    queryFn: async () => (await api.get("/analytics", { params: { start_date: shiftReportDay(today, -29), end_date: today } })).data,
  });

  // Làm mới đồng thời các nguồn dữ liệu cấu thành dashboard để tránh số liệu lệch nhau.
  const refresh = () => {
    dashboardQuery.refetch();
    accountsQuery.refetch();
    budgetsQuery.refetch();
    trendQuery.refetch();
  };

  return (
    <div className={styles.canvas}>
      <div className={styles.intro}><div><span className={styles.overline}>KHÔNG GIAN CÁ NHÂN</span><h1>Tiền của bạn, <em>rõ ràng hơn.</em></h1><p>Một cái nhìn nhanh về số dư, nhịp thu chi và điều cần chú ý hôm nay.</p></div><div className={styles.introActions}><QuickActions refreshing={dashboardQuery.isFetching} onRefresh={refresh} /></div></div>
      {dashboardQuery.isPending ? (
        <Loading />
      ) : dashboardQuery.isError ? (
        <ErrorState retry={() => dashboardQuery.refetch()} />
      ) : (
        dashboardQuery.data && (
          <>
            <OverviewStats data={dashboardQuery.data} />
            <OverviewCharts trendQuery={trendQuery} accountsQuery={accountsQuery} />
            <div className={styles.overviewLower}>
              <RecentTransactions transactions={dashboardQuery.data.recent_transactions} />
              <AccountsWidget query={accountsQuery} />
              <BudgetsWidget query={budgetsQuery} />
            </div>
            <p className={styles.overviewFootnote}>
              Cập nhật lúc {new Date(dashboardQuery.dataUpdatedAt).toLocaleTimeString("vi-VN")}. Số liệu tổng hợp theo hệ thống, chưa quy đổi giữa các loại tiền.
            </p>
          </>
        )
      )}
    </div>
  );
}
