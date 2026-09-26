/**
 * ============================================================================
 * TÊN FILE: TopCategoriesChart.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Phân tích vận hành
 * MỤC ĐÍCH CỤ THỂ:
 *   Vẽ biểu đồ năm danh mục có nhiều giao dịch nhất.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Dữ liệu top_categories, Recharts và tùy chọn giảm chuyển động của hệ điều hành.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất biểu đồ hoặc trạng thái rỗng trong Panel.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ dùng số liệu tổng hợp và tắt animation khi người dùng yêu cầu giảm chuyển động.
 * ============================================================================
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Empty, Panel } from "../design";

export default function TopCategoriesChart({ data, motionAllowed }) {
  return (
    <Panel title="Danh mục được sử dụng nhiều" description="5 danh mục theo số lượng giao dịch">
      {!data.length ? <Empty title="Chưa có dữ liệu danh mục" /> : (
        <div className="cf-panel-body cf-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke="#e8edf5" />
              <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={115} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar isAnimationActive={motionAllowed} animationDuration={400} animationBegin={0} dataKey="transaction_count" name="Số giao dịch" fill="#2454e6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
