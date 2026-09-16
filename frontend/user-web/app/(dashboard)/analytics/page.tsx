"use client";
import { useMotionAllowed } from "@/hooks/useMotionAllowed";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Download } from "lucide-react";
import api from "@/lib/api";
import {
  PageHead,
  Panel,
  Stat,
  Loading,
  ErrorState,
  Empty,
  Field,
} from "@/components/ui";
import { money } from "@/lib/finance";
interface Analytics {
  period: { start_date: string; end_date: string };
  summary: { income: number; expense: number; net: number };
  previous_summary: { income: number; expense: number; net: number };
  expense_by_category: Record<string, number>;
  trend: Array<{ month: string; income: number; expense: number }>;
}
const palette = [
  "#2454e6",
  "#6787ee",
  "#90a8f4",
  "#31436b",
  "#8b98ae",
  "#c1cadb",
];
export default function Analytics() {
  const motionAllowed = useMotionAllowed();
  const [period, setPeriod] = useState(
    () =>
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
  );
  const [mode, setMode] = useState<"MONTH" | "CUSTOM">("MONTH");
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const query = useQuery<Analytics>({
    queryKey: ["analytics", mode, period, startDate, endDate],
    queryFn: async () =>
      (
        await api.get("/analytics", {
          params: mode === "MONTH" ? {
            year: Number(period.slice(0, 4)), month: Number(period.slice(5)),
          } : { start_date: startDate, end_date: endDate },
        })
      ).data,
    enabled: mode === "MONTH" ? !!period : Boolean(startDate && endDate && startDate <= endDate),
  });
  const data = query.data;
  const parts = Object.entries(data?.expense_by_category || {}).map(
    ([name, value]) => ({ name, value }),
  );
  const periodLabel = data ? `${data.period.start_date} → ${data.period.end_date}` : period;
  const exportReport = async () => {
    if (!data) return;
    const response = await api.get("/analytics/export.csv", {
      params: { start_date: data.period.start_date, end_date: data.period.end_date },
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url; link.download = `bao-cao-${data.period.start_date}-${data.period.end_date}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="BÁO CÁO"
        title="Phân tích tài chính"
        description="Hiểu cơ cấu chi tiêu và xu hướng dòng tiền."
        actions={<>
          <Field label="Phạm vi">
            <select className="cf-input" value={mode} onChange={(e) => setMode(e.target.value as "MONTH" | "CUSTOM")}>
              <option value="MONTH">Theo tháng</option><option value="CUSTOM">Khoảng ngày</option>
            </select>
          </Field>
          {mode === "MONTH" ? <Field label="Kỳ báo cáo">
            <input
              className="cf-input"
              type="month"
              required
              value={period}
              onChange={(e) => {
                if (e.target.value) setPeriod(e.target.value);
              }}
            />
          </Field> : <><Field label="Từ ngày"><input className="cf-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field><Field label="Đến ngày"><input className="cf-input" type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field></>}
          <button className="cf-btn" disabled={!data} onClick={exportReport}><Download />Xuất CSV</button>
        </>}
      />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : (
        data && (
          <>
            <div className="cf-grid">
              <Stat
                label="Tổng thu nhập"
                value={money(data.summary.income)}
                note={`Kỳ ${periodLabel} · kỳ trước ${money(data.previous_summary.income)}`}
              />
              <Stat
                label="Tổng chi tiêu"
                value={money(data.summary.expense)}
                note={`Kỳ ${periodLabel} · kỳ trước ${money(data.previous_summary.expense)}`}
              />
              <Stat
                label="Dòng tiền thuần"
                value={
                  <span
                    className={
                      data.summary.net >= 0 ? "cf-success" : "cf-danger"
                    }
                  >
                    {money(data.summary.net)}
                  </span>
                }
                note="Thu nhập trừ chi tiêu"
              />
            </div>
            <div className="cf-split">
              <Panel
                title="Xu hướng dòng tiền"
                description="6 kỳ có dữ liệu gần nhất"
              >
                <div className="cf-panel-body">
                  {!data.trend.length ? (
                    <Empty title="Chưa có dữ liệu xu hướng" />
                  ) : (
                    <div className="cf-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.trend}
                          barGap={5}
                          margin={{ left: 0, right: 8, top: 12, bottom: 0 }}
                        >
                          <CartesianGrid vertical={false} stroke="#e8edf5" />
                          <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: "#647087" }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            width={65}
                            tick={{ fontSize: 12, fill: "#647087" }}
                            tickFormatter={(v) =>
                              new Intl.NumberFormat("vi-VN", {
                                notation: "compact",
                              }).format(v)
                            }
                          />
                          <Tooltip formatter={(v) => money(Number(v))} />
                          <Legend />
                          <Bar isAnimationActive={motionAllowed} animationDuration={400} animationBegin={0}
                            dataKey="income"
                            name="Thu nhập"
                            fill="#2454e6"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar isAnimationActive={motionAllowed} animationDuration={400} animationBegin={0}
                            dataKey="expense"
                            name="Chi tiêu"
                            fill="#bccaf3"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </Panel>
              <Panel
                title="Cơ cấu chi tiêu"
                description={`Theo danh mục · ${periodLabel}`}
              >
                {!parts.length ? (
                  <Empty title="Chưa có khoản chi trong kỳ" />
                ) : (
                  <>
                    <div style={{ height: 230 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie isAnimationActive={motionAllowed} animationDuration={400} animationBegin={0}
                            data={parts}
                            dataKey="value"
                            innerRadius={66}
                            outerRadius={91}
                            paddingAngle={3}
                          >
                            {parts.map((p, i) => (
                              <Cell
                                key={p.name}
                                fill={palette[i % palette.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => money(Number(v))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {parts.map((p, i) => (
                      <div className="cf-list-row" key={p.name}>
                        <span className="cf-row">
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 2,
                              background: palette[i % palette.length],
                            }}
                          />
                          {p.name}
                        </span>
                        <strong className="cf-number">{money(p.value)}</strong>
                      </div>
                    ))}
                  </>
                )}
              </Panel>
            </div>
            <p className="cf-muted" style={{ fontSize: 12 }}>
              Số liệu tổng hợp từ các giao dịch đã ghi nhận; chưa quy đổi giữa
              các loại tiền.
            </p>
          </>
        )
      )}
    </div>
  );
}
