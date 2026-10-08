/**
 * ============================================================================
 * TÊN FILE: CategoryExpensePie.tsx
 * MÀN HÌNH / PHÂN HỆ: Báo cáo tài chính
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Trực quan hóa cơ cấu chi tiêu theo danh mục.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất CategoryExpensePie để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ trình bày dữ liệu tổng hợp; chưa tự quy đổi giữa các loại tiền.
 * ============================================================================
 */
"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Empty, Panel } from "@/dung-chung/UI-chung/ui";
import { money } from "@/dung-chung/tien-ich/finance";

const palette = ["#2454e6", "#6787ee", "#90a8f4", "#31436b", "#8b98ae", "#c1cadb"];

/** Biểu đồ cơ cấu chi tiêu theo danh mục trong kỳ đã chọn. */
export default function CategoryExpensePie({ values, periodLabel, animate }: {
  values: Record<string, number>;
  periodLabel: string;
  animate: boolean;
}) {
  const parts = Object.entries(values).map(([name, value]) => ({ name, value }));
  return (
    <Panel title="Cơ cấu chi tiêu" description={`Theo danh mục · ${periodLabel}`}>
      {!parts.length ? <Empty title="Chưa có khoản chi trong kỳ" /> : <>
        <div style={{ height: 230 }}><ResponsiveContainer width="100%" height="100%"><PieChart>
          <Pie isAnimationActive={animate} animationDuration={400} data={parts} dataKey="value" innerRadius={66} outerRadius={91} paddingAngle={3}>
            {parts.map((part, index) => <Cell key={part.name} fill={palette[index % palette.length]} />)}
          </Pie><Tooltip formatter={(value) => money(Number(value))} />
        </PieChart></ResponsiveContainer></div>
        {parts.map((part, index) => <div className="cf-list-row" key={part.name}>
          <span className="cf-row"><span style={{ width: 8, height: 8, borderRadius: 2, background: palette[index % palette.length] }} />{part.name}</span>
          <strong className="cf-number">{money(part.value)}</strong>
        </div>)}
      </>}
    </Panel>
  );
}
