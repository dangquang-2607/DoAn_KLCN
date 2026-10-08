/**
 * ============================================================================
 * TÊN FILE: QuickActions.tsx
 * MÀN HÌNH / PHÂN HỆ: Tổng quan tài chính
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp các lối tắt tạo giao dịch, quét hóa đơn, xem ví và làm mới.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất QuickActions để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
/** Cụm thao tác nhanh: tạo giao dịch, quét hóa đơn, xem ví và làm mới. */
import Link from "next/link";
import { Plus, RefreshCw, ScanLine, Wallet } from "lucide-react";

export default function QuickActions({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  return (
    <>
      <button className="cf-btn" onClick={onRefresh} disabled={refreshing}><RefreshCw size={16} />Làm mới</button>
      <Link className="cf-btn" href="/ocr"><ScanLine size={17} />Quét hóa đơn</Link>
      <Link className="cf-btn" href="/accounts"><Wallet size={17} />Xem ví</Link>
      <Link className="cf-btn cf-btn-primary" href="/transactions?new=1"><Plus size={17} />Thêm giao dịch</Link>
    </>
  );
}
