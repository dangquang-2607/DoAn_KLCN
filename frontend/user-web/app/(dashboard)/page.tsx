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
import { ErrorState, Loading, PageHead } from "@/components/ui/ui";
import api from "@/lib/api";
import type { Account, Budget } from "@/lib/finance";
import AccountsWidget from "./_components/AccountsWidget";
import BudgetsWidget from "./_components/BudgetsWidget";
import OverviewStats, { type OverviewData } from "./_components/OverviewStats";
import QuickActions from "./_components/QuickActions";
import RecentTransactions from "./_components/RecentTransactions";
import { overviewStyles } from "./_styles/overview.styles";

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
  });

  // Làm mới đồng thời các nguồn dữ liệu cấu thành dashboard để tránh số liệu lệch nhau.
  const refresh = () => {
    dashboardQuery.refetch();
    accountsQuery.refetch();
    budgetsQuery.refetch();
  };

  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="KHÔNG GIAN CÁ NHÂN"
        title="Tổng quan tài chính"
        description="Nắm bắt số dư, dòng tiền và kế hoạch chi tiêu của bạn."
        actions={
          <QuickActions
            refreshing={dashboardQuery.isFetching}
            onRefresh={refresh}
          />
        }
      />
      {dashboardQuery.isPending ? (
        <Loading />
      ) : dashboardQuery.isError ? (
        <ErrorState retry={() => dashboardQuery.refetch()} />
      ) : (
        dashboardQuery.data && (
          <>
            <OverviewStats data={dashboardQuery.data} />
            <div className="cf-split">
              <div className="cf-stack">
                <RecentTransactions
                  transactions={dashboardQuery.data.recent_transactions}
                />
                <BudgetsWidget query={budgetsQuery} />
              </div>
              <div className="cf-stack">
                <AccountsWidget query={accountsQuery} />
                <p className="cf-muted" style={overviewStyles.updatedAt}>
                  Cập nhật lúc{" "}
                  {new Date(dashboardQuery.dataUpdatedAt).toLocaleTimeString(
                    "vi-VN",
                  )}
                  . Số liệu tổng hợp theo hệ thống, chưa quy đổi giữa các loại tiền.
                </p>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
