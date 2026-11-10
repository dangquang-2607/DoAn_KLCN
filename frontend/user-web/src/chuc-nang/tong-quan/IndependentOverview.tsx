"use client";

/**
 * Trang điều phối dashboard: tải các nguồn dữ liệu và ghép các widget tổng quan.
 * Component con chỉ trình bày; query key và hành vi làm mới được giữ tập trung tại đây.
 */
import { useQuery } from "@tanstack/react-query";
import { ErrorState, Loading, PageHead } from "@/dung-chung/UI-chung/ui";
import api from "@/dung-chung/connect-api/api";
import { type Account, type Budget } from "@/dung-chung/nghiep-vu/finance";
import BudgetsWidget from "./thanh-phan/BudgetsWidget";
import OverviewStats, { type OverviewData } from "./thanh-phan/OverviewStats";
import SpendingReports from "./thanh-phan/SpendingReports";
import { useVietnamDay } from "./useVietnamDay";
import type { MonthlyTrend } from "./monthlyTrend";
import QuickActions from "./thanh-phan/QuickActions";
import styles from "./CSS/overview.module.css";

export default function Overview() {
  const dashboardQuery = useQuery<OverviewData>({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/bookkeeping/dashboard")).data,
  });
  const accountsQuery = useQuery<Account[]>({
    queryKey: ["wallets"],
    queryFn: async () =>
      (await api.get<Account[]>("/wallets")).data.map((w) => ({
        ...w,
        account_type: "WALLET",
      })),
  });
  const budgetsQuery = useQuery<Budget[]>({
    queryKey: ["budgets"],
    queryFn: async () => (await api.get("/budgets")).data,
    refetchInterval: 60_000,
  });
  const today = useVietnamDay();
  const monthlyQuery = useQuery({
    queryKey: ["analytics", "monthly-trend", today],
    enabled: Boolean(today),
    refetchInterval: 60_000,
    queryFn: async ({ signal }) => (await api.get<MonthlyTrend>("/analytics/monthly-trend", { signal })).data,
  });
  const sources = [
    { label: "Giao dịch gần đây", query: dashboardQuery },
    { label: "Số dư ví", query: accountsQuery },
    { label: "Ngân sách", query: budgetsQuery },
    { label: "Báo cáo tháng", query: monthlyQuery },
  ];
  const isRefreshing = sources.some(({ query }) => query.isFetching);
  const reportState = monthlyQuery.isPending ? <Loading /> : monthlyQuery.isError ? <ErrorState retry={() => monthlyQuery.refetch()} /> : undefined;

  return (
    <div className={styles.canvas}>
      <PageHead
        eyebrow="KHÔNG GIAN CÁ NHÂN"
        title="Tiền của bạn, rõ ràng hơn"
        description="Số dư ví hiện tại, thu chi trong tháng và ngân sách của bạn."
        actions={<QuickActions />}
      />
      {dashboardQuery.isPending ? (
        <Loading />
      ) : dashboardQuery.isError ? (
        <ErrorState retry={() => dashboardQuery.refetch()} />
      ) : (
        dashboardQuery.data && (
          <div className={styles.content}>
            <OverviewStats data={dashboardQuery.data} report={monthlyQuery.data} reportState={reportState} accountsQuery={accountsQuery} />
            <SpendingReports data={monthlyQuery.data} state={reportState} transactions={dashboardQuery.data.recent_transactions} />
            <BudgetsWidget query={budgetsQuery} />
            <section className={styles.dataUpdates} aria-label="Tình trạng cập nhật dữ liệu">
              <div>
                <p>Lần tải thành công gần nhất của từng nguồn dữ liệu</p>
                <ul>
                  {sources.map(({ label, query }) => (
                    <li key={label}>
                      <span>{label}: </span>
                      {query.dataUpdatedAt > 0 ? (
                        <time dateTime={new Date(query.dataUpdatedAt).toISOString()}>
                          {new Date(query.dataUpdatedAt).toLocaleString("vi-VN")}
                        </time>
                      ) : "Chưa tải được"}
                      {query.isError ? " · Cập nhật thất bại" : query.isFetching ? " · Đang cập nhật…" : ""}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                className="cf-btn"
                disabled={isRefreshing}
                onClick={() => { void Promise.all(sources.map(({ query }) => query.refetch())); }}
              >
                {isRefreshing ? "Đang cập nhật…" : "Làm mới dữ liệu"}
              </button>
            </section>
          </div>
        )
      )}
    </div>
  );
}
