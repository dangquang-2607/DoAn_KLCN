"use client";
import Link from "next/link";
import { Wallet, ArrowLeftRight, ScanLine } from "lucide-react";
import { PageHead, Panel } from "@/components/ui";
const guides = [
  {
    title: "Bắt đầu với một tài khoản",
    icon: Wallet,
    description: "Tạo ví và nhập số dư ban đầu để theo dõi dòng tiền.",
    href: "/accounts",
    action: "Quản lý tài khoản",
  },
  {
    title: "Ghi lại khoản thu, chi",
    icon: ArrowLeftRight,
    description:
      "Chọn ví, danh mục và số tiền. Số dư được cập nhật khi bạn lưu.",
    href: "/transactions",
    action: "Mở sổ giao dịch",
  },
  {
    title: "Ghi nhận từ hóa đơn",
    icon: ScanLine,
    description:
      "Tải tệp, quét AI, kiểm tra kết quả và chọn tài khoản thanh toán.",
    href: "/ocr",
    action: "Quét hóa đơn",
  },
];
const faqs = [
  [
    "CapitalFlow có tự kết nối ngân hàng không?",
    "Các tài khoản hiện được theo dõi thủ công. Bạn tạo tài khoản, nhập số dư ban đầu và ghi nhận thu chi hoặc chuyển tiền trong hệ thống.",
  ],
  [
    "Quét hóa đơn có tự trừ tiền trong ví không?",
    "Chưa. Sau khi quét, bạn cần kiểm tra thông tin, chọn ví và xác nhận hóa đơn. Bước xác nhận mới tạo giao dịch chi tiêu và cập nhật số dư.",
  ],
  [
    "Có thể tải lên những loại tệp nào?",
    "Ảnh JPG, JPEG, PNG, WEBP và tài liệu PDF; mỗi tệp tối đa 10 MB. Bạn có thể chọn tối đa 5 hóa đơn để quét AI cùng lúc.",
  ],
  [
    "Làm gì khi muốn sửa một khoản chi?",
    "Mở Giao dịch, chọn nút sửa cạnh khoản chi và lưu thông tin mới. Hệ thống hoàn lại số dư cũ rồi áp dụng giá trị mới.",
  ],
  [
    "Xóa tài khoản có mất lịch sử không?",
    "Bạn cần đưa số dư về 0 trước khi ngừng sử dụng ví. Các giao dịch đã ghi nhận vẫn được giữ lại.",
  ],
  [
    "Làm thế nào để đổi mật khẩu?",
    "Mở Cài đặt & bảo mật, nhập mật khẩu hiện tại và mật khẩu mới. Nếu quên mật khẩu, dùng chức năng khôi phục tại trang đăng nhập.",
  ],
];
export default function Support() {
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="TRỢ GIÚP"
        title="Bạn muốn bắt đầu từ đâu?"
        description="Hướng dẫn những thao tác thường dùng trong CapitalFlow."
      />
      <div className="cf-grid">
        {guides.map((g) => (
          <Panel key={g.href}>
            <div className="cf-panel-body cf-stack" style={{ gap: 16 }}>
              <span className="cf-icon">
                <g.icon />
              </span>
              <h2>{g.title}</h2>
              <p className="cf-muted" style={{ fontSize: 14, margin: 0 }}>
                {g.description}
              </p>
              <Link className="cf-inline-link" href={g.href}>
                {g.action} →
              </Link>
            </div>
          </Panel>
        ))}
      </div>
      <h2 style={{ fontSize: 20, margin: 0 }}>Câu hỏi thường gặp</h2>
      <div className="cf-stack cf-help" style={{ gap: 12 }}>
        {faqs.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
