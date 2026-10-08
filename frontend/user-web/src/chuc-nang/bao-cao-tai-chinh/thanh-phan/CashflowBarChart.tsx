/**
 * ============================================================================
 * TÊN FILE: CashflowBarChart.tsx
 * MÀN HÌNH / PHÂN HỆ: Báo cáo tài chính
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Trực quan hóa xu hướng thu và chi theo kỳ.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất CashflowBarChart để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ trình bày dữ liệu tổng hợp; chưa tự quy đổi giữa các loại tiền.
 * ============================================================================
 */
"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Empty, Panel } from "@/dung-chung/UI-chung/ui";
import { money } from "@/dung-chung/tien-ich/finance";

export type CashflowPoint = { month: string; income: number; expense: number };

/** Biểu đồ xu hướng thu/chi; không sở hữu query hay khoảng thời gian báo cáo. */
export default function CashflowBarChart({ data, animate }: { data: CashflowPoint[]; animate: boolean }) {
  return (
    <Panel title="Xu hướng dòng tiền" description="6 kỳ có dữ liệu gần nhất">
      <div className="cf-panel-body">
        {!data.length ? <Empty title="Chưa có dữ liệu xu hướng" /> : (
          <div className="cf-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barGap={5} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e8edf5" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#647087" }} />
                <YAxis axisLine={false} tickLine={false} width={65} tick={{ fontSize: 12, fill: "#647087" }}
                  tickFormatter={(value) => new Intl.NumberFormat("vi-VN", { notation: "compact" }).format(value)} />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Legend />
                <Bar isAnimationActive={animate} animationDuration={400} dataKey="income" name="Thu nhập" fill="#2454e6" radius={[4, 4, 0, 0]} />
                <Bar isAnimationActive={animate} animationDuration={400} dataKey="expense" name="Chi tiêu" fill="#bccaf3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Panel>
  );
}
