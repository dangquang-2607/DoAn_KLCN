"use client";
import { MotionValue } from "@/components/Motion";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  ScanLine,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  Wallet,
} from "lucide-react";
import api from "@/lib/api";
import {
  PageHead,
  Panel,
  Stat,
  Loading,
  ErrorState,
  Empty,
} from "@/components/ui";
import {
  money,
  dateLabel,
  type Transaction,
  type Account,
  type Budget,
} from "@/lib/finance";
interface Overview {
  net_worth: number;
  income_this_month: number;
  expense_this_month: number;
  net_cash_flow: number;
  period: { month: number; year: number };
  recent_transactions: Transaction[];
}
export default function Overview() {
  const query = useQuery<Overview>({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/dashboard")).data,
  });
  const accounts = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get("/accounts")).data,
  });
  const budgets = useQuery<Budget[]>({
    queryKey: ["budgets"],
    queryFn: async () => (await api.get("/budgets")).data,
  });
  const data = query.data;
  const refresh = () => {
    query.refetch();
    accounts.refetch();
    budgets.refetch();
  };
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="KHÔNG GIAN CÁ NHÂN"
        title="Tổng quan tài chính"
        description="Nắm bắt số dư, dòng tiền và kế hoạch chi tiêu của bạn."
        actions={
          <>
            <button
              className="cf-btn"
              onClick={refresh}
              disabled={query.isFetching}
            >
              <RefreshCw size={16} />
              Làm mới
            </button>
            <Link className="cf-btn cf-btn-primary" href="/transactions?new=1">
              <Plus size={17} />
              Thêm giao dịch
            </Link>
          </>
        }
      />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : (
        data && (
          <>
            <div className="cf-grid-4">
              <div className="cf-panel cf-balance">
                <div className="cf-eyebrow">Tổng số dư tài khoản</div>
                <div
                  className="cf-number"
                  style={{ fontSize: 30, margin: "16px 0" }}
                >
                  <MotionValue>{money(data.net_worth)}</MotionValue>
                </div>
                <Link
                  href="/accounts"
                  className="cf-inline-link"
                  style={{ color: "white" }}
                >
                  Quản lý tài khoản{" "}
                  <ArrowRight size={14} style={{ display: "inline" }} />
                </Link>
              </div>
              <Stat
                label="Thu nhập tháng này"
                value={money(data.income_this_month)}
                icon={<ArrowDownLeft />}
                note={`Tháng ${data.period.month}/${data.period.year}`}
              />
              <Stat
                label="Chi tiêu tháng này"
                value={money(data.expense_this_month)}
                icon={<ArrowUpRight />}
                note="Tổng chi tiêu đã ghi nhận"
              />
              <Stat
                label="Dòng tiền thuần"
                value={
                  <span
                    className={
                      data.net_cash_flow >= 0 ? "cf-success" : "cf-danger"
                    }
                  >
                    {money(data.net_cash_flow)}
                  </span>
                }
                icon={<Wallet />}
                note="Thu nhập trừ chi tiêu trong tháng"
              />
            </div>
            <div className="cf-split">
              <div className="cf-stack">
                <Panel
                  title="Giao dịch gần đây"
                  description="5 giao dịch được ghi nhận gần nhất"
                  action={
                    <Link className="cf-inline-link" href="/transactions">
                      Xem tất cả →
                    </Link>
                  }
                >
                  {!data.recent_transactions.length ? (
                    <Empty
                      title="Bắt đầu với giao dịch đầu tiên"
                      description="Tạo ví, sau đó ghi lại một khoản thu hoặc chi."
                      action={
                        <Link
                          className="cf-btn cf-btn-primary"
                          href="/accounts"
                        >
                          Tạo ví của bạn
                        </Link>
                      }
                    />
                  ) : (
                    <div className="cf-table-wrap">
                      <table className="cf-table">
                        <thead>
                          <tr>
                            <th>Giao dịch</th>
                            <th>Ngày</th>
                            <th className="right">Số tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.recent_transactions.map((tx) => (
                            <tr key={tx.id}>
                              <td>
                                <div className="cf-row">
                                  <span className="cf-icon">
                                    {Number(tx.amount) >= 0 ? (
                                      <ArrowDownLeft />
                                    ) : (
                                      <ArrowUpRight />
                                    )}
                                  </span>
                                  <div>
                                    <strong>
                                      {tx.description || "Giao dịch"}
                                    </strong>
                                    <div className="cf-sub">
                                      {tx.type === "INCOME"
                                        ? "Thu nhập"
                                        : tx.type === "EXPENSE"
                                          ? "Chi tiêu"
                                          : "Chuyển tiền"}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="cf-muted">
                                {dateLabel(tx.transaction_date)}
                              </td>
                              <td
                                className={`right cf-number ${Number(tx.amount) > 0 ? "cf-success" : ""}`}
                              >
                                {Number(tx.amount) > 0 ? "+" : ""}
                                {money(tx.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
                <Panel
                  title="Ngân sách của bạn"
                  action={
                    <Link className="cf-inline-link" href="/budgets">
                      Quản lý →
                    </Link>
                  }
                >
                  {budgets.isPending ? (
                    <Loading />
                  ) : budgets.isError ? (
                    <ErrorState retry={() => budgets.refetch()} />
                  ) : !budgets.data?.length ? (
                    <Empty
                      title="Dành chỗ cho kế hoạch mới"
                      description="Đặt hạn mức cho các khoản chi để theo dõi tiến độ."
                      action={
                        <Link className="cf-btn" href="/budgets">
                          Thiết lập ngân sách
                        </Link>
                      }
                    />
                  ) : (
                    budgets.data
                      .filter((b) => b.is_active)
                      .slice(0, 3)
                      .map((b) => (
                        <div className="cf-panel-body" key={b.budget_id}>
                          <div
                            className="cf-row cf-between"
                            style={{ marginBottom: 12 }}
                          >
                            <strong style={{ fontSize: 14 }}>
                              {b.budget_name}
                            </strong>
                            <span style={{ fontSize: 13 }}>
                              {money(b.spent_amount, b.currency)}{" "}
                              <span className="cf-muted">
                                / {money(b.amount_limit, b.currency)}
                              </span>
                            </span>
                          </div>
                          <div className="cf-progress">
                            <span
                              style={{
                                width: `${Math.max(0, Math.min(100, Number(b.usage_percent)))}%`,
                                background:
                                  b.progress_status === "EXCEEDED"
                                    ? "var(--cf-danger)"
                                    : undefined,
                              }}
                            />
                          </div>
                        </div>
                      ))
                  )}
                </Panel>
              </div>
              <div className="cf-stack">
                <Panel
                  title="Ví & tài khoản"
                  action={
                    <Link className="cf-inline-link" href="/accounts">
                      Xem tất cả →
                    </Link>
                  }
                >
                  {accounts.isPending ? (
                    <Loading />
                  ) : accounts.isError ? (
                    <ErrorState retry={() => accounts.refetch()} />
                  ) : !accounts.data?.length ? (
                    <Empty
                      title="Chưa có ví"
                      description="Thêm ví tiền mặt hoặc tài khoản để bắt đầu."
                    />
                  ) : (
                    accounts.data.slice(0, 4).map((a) => (
                      <div className="cf-list-row" key={a.id}>
                        <div>
                          <strong>{a.name}</strong>
                          <small>{a.institution_name || a.currency}</small>
                        </div>
                        <strong className="cf-number">
                          {money(a.balance, a.currency)}
                        </strong>
                      </div>
                    ))
                  )}
                </Panel>
                <div
                  className="cf-panel cf-panel-body"
                  style={{ background: "#edf2ff", borderColor: "#d8e2ff" }}
                >
                  <ScanLine size={26} color="#2454e6" />
                  <h2 style={{ margin: "18px 0 10px" }}>
                    Từ hóa đơn đến giao dịch.
                  </h2>
                  <p
                    className="cf-muted"
                    style={{ fontSize: 14, lineHeight: 1.7 }}
                  >
                    Tải hóa đơn, kiểm tra kết quả nhận diện rồi xác nhận khoản
                    chi vào ví của bạn.
                  </p>
                  <Link href="/ocr" className="cf-btn cf-btn-primary">
                    Quét hóa đơn <ArrowRight size={16} />
                  </Link>
                </div>
                <p className="cf-muted" style={{ fontSize: 12 }}>
                  Cập nhật lúc{" "}
                  {new Date(query.dataUpdatedAt).toLocaleTimeString("vi-VN")}.
                  Số liệu tổng hợp theo hệ thống, chưa quy đổi giữa các loại
                  tiền.
                </p>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
