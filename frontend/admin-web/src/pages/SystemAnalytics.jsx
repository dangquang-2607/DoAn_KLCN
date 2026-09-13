import { useMotionAllowed } from "../components/Motion";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { RefreshCw } from "lucide-react";
import api from "../services/api";
import {
  PageHead,
  Panel,
  Stat,
  Loading,
  ErrorState,
  Empty,
} from "../components/design";
export default function SystemAnalytics() {
  const motionAllowed = useMotionAllowed();
  const query = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => (await api.get("/admin/system/analytics")).data,
  });
  const d = query.data;
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="VẬN HÀNH"
        title="Phân tích hệ thống"
        description="Số liệu sử dụng tổng hợp, không hiển thị nội dung giao dịch cá nhân."
        actions={
          <button
            className="cf-btn"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw />
            Làm mới
          </button>
        }
      />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : (
        <>
          <div className="cf-grid">
            <Stat
              label="Giao dịch tháng này"
              value={d.transactions.this_month.toLocaleString("vi-VN")}
              note={`Tháng ${d.period.month}/${d.period.year}`}
            />
            <Stat
              label="Người dùng có giao dịch"
              value={d.active_users_this_month.toLocaleString("vi-VN")}
              note="Trong tháng hiện tại"
            />
            <Stat
              label="Tổng giao dịch"
              value={d.transactions.total_all_time.toLocaleString("vi-VN")}
              note="Từ khi hệ thống hoạt động"
            />
          </div>
          <div className="cf-grid-2">
            <Panel
              title="Danh mục được sử dụng nhiều"
              description="5 danh mục theo số lượng giao dịch"
            >
              {!d.top_categories.length ? (
                <Empty title="Chưa có dữ liệu danh mục" />
              ) : (
                <div className="cf-panel-body cf-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={d.top_categories}
                      layout="vertical"
                      margin={{ left: 8, right: 24 }}
                    >
                      <CartesianGrid horizontal={false} stroke="#e8edf5" />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={115}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip />
                      <Bar isAnimationActive={motionAllowed} animationDuration={400} animationBegin={0}
                        dataKey="transaction_count"
                        name="Số giao dịch"
                        fill="#2454e6"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
            <Panel
              title="Cơ cấu giao dịch"
              description="Tổng số giao dịch theo loại"
            >
              <div className="cf-panel-body cf-stack">
                {[
                  ["Thu nhập", d.transactions.income_count],
                  ["Chi tiêu", d.transactions.expense_count],
                  [
                    "Chuyển tiền / khác",
                    Math.max(
                      0,
                      d.transactions.total_all_time -
                        d.transactions.income_count -
                        d.transactions.expense_count,
                    ),
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div
                      className="cf-row cf-between"
                      style={{ marginBottom: 10, fontSize: 14 }}
                    >
                      <span>{label}</span>
                      <strong>{value.toLocaleString("vi-VN")}</strong>
                    </div>
                    <div className="cf-progress">
                      <span
                        style={{
                          width: `${d.transactions.total_all_time ? (value / d.transactions.total_all_time) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
