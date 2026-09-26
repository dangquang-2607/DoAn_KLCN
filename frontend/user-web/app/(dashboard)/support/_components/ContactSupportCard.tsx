/**
 * ============================================================================
 * TÊN FILE: ContactSupportCard.tsx
 * MÀN HÌNH / PHÂN HỆ: Trung tâm hỗ trợ
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp các lối tắt tự hỗ trợ theo nghiệp vụ.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất ContactSupportCard để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
import Link from "next/link";
import { ArrowLeftRight, ScanLine, Wallet } from "lucide-react";
import { Panel } from "@/components/ui/ui";
import { supportStyles } from "../_styles/support.styles";

const guides = [
  { title: "Bắt đầu với một tài khoản", icon: Wallet, description: "Tạo ví và nhập số dư ban đầu để theo dõi dòng tiền.", href: "/accounts", action: "Quản lý tài khoản" },
  { title: "Ghi lại khoản thu, chi", icon: ArrowLeftRight, description: "Chọn ví, danh mục và số tiền. Số dư được cập nhật khi bạn lưu.", href: "/transactions", action: "Mở sổ giao dịch" },
  { title: "Ghi nhận từ hóa đơn", icon: ScanLine, description: "Tải tệp, quét AI, kiểm tra kết quả và chọn tài khoản thanh toán.", href: "/ocr", action: "Quét hóa đơn" },
];

/** Các kênh tự hỗ trợ theo nghiệp vụ; không phát sinh yêu cầu mạng ngoài ứng dụng. */
export default function ContactSupportCard() {
  return <div className="cf-grid">{guides.map((guide) => <Panel key={guide.href}><div className="cf-panel-body cf-stack" style={{ gap: supportStyles.cardGap }}><span className="cf-icon"><guide.icon /></span><h2>{guide.title}</h2><p className="cf-muted" style={{ fontSize: 14, margin: 0 }}>{guide.description}</p><Link className="cf-inline-link" href={guide.href}>{guide.action} →</Link></div></Panel>)}</div>;
}
