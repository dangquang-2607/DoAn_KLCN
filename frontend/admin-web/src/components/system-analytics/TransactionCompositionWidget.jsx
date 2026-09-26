/**
 * ============================================================================
 * TÊN FILE: TransactionCompositionWidget.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Phân tích vận hành
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị số lượng và tỷ trọng giao dịch theo loại.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props transactions từ API phân tích và Panel dùng chung.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất widget cơ cấu giao dịch dạng thanh tiến trình.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Nhóm "khác" được chặn tối thiểu bằng 0 và tỷ lệ luôn chống chia cho 0.
 * ============================================================================
 */
import { Panel } from "../design";

export default function TransactionCompositionWidget({ transactions }) {
  const rows = [
    ["Thu nhập", transactions.income_count],
    ["Chi tiêu", transactions.expense_count],
    ["Chuyển tiền / khác", Math.max(0, transactions.total_all_time - transactions.income_count - transactions.expense_count)],
  ];
  return (
    <Panel title="Cơ cấu giao dịch" description="Tổng số giao dịch theo loại">
      <div className="cf-panel-body cf-stack">
        {rows.map(([label, value]) => (
          <div key={label}>
            <div className="cf-row cf-between" style={{ marginBottom: 10, fontSize: 14 }}><span>{label}</span><strong>{value.toLocaleString("vi-VN")}</strong></div>
            <div className="cf-progress"><span style={{ width: `${transactions.total_all_time ? (value / transactions.total_all_time) * 100 : 0}%` }} /></div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
