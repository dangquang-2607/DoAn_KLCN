import Link from "next/link";
import { ArrowLeftRight, ArrowUpRight, ScanLine, Wallet } from "lucide-react";
import { Panel } from "@/dung-chung/UI-chung/ui";
import styles from "../CSS/support.module.css";

const guides = [
  { title: "Tạo ví của bạn", icon: Wallet, description: "Đặt tên ví, bắt đầu từ 0đ rồi nạp tiền hoặc nhận chuyển tiền từ ví khác.", href: "/accounts", action: "Quản lý ví" },
  { title: "Ghi lại khoản thu, chi", icon: ArrowLeftRight, description: "Ghi danh mục, số tiền và ngày phát sinh. Sổ thu chi độc lập với số dư ví.", href: "/transactions", action: "Mở sổ thu chi" },
  { title: "Ghi nhận từ hóa đơn", icon: ScanLine, description: "Tải tệp, quét AI, kiểm tra kết quả và xác nhận ghi sổ thu chi.", href: "/ocr", action: "Quét hóa đơn" },
];

/** Các kênh tự hỗ trợ theo nghiệp vụ; không phát sinh yêu cầu mạng ngoài ứng dụng. */
export default function ContactSupportCard() {
  return (
    <Panel title="Thao tác nhanh">
      <nav className={styles.guides} aria-label="Thao tác thường dùng">
        {guides.map((guide) => (
          <Link key={guide.href} href={guide.href} className={styles.guide} aria-label={`${guide.title} — ${guide.action}`}>
            <span className={styles.guideIcon}><guide.icon size={18} aria-hidden="true" /></span>
            <span className={styles.guideCopy}>
              <strong>{guide.title}</strong>
              <span>{guide.description}</span>
            </span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </Panel>
  );
}
