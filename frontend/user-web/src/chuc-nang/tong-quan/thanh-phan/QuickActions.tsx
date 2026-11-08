/** Cụm thao tác nhanh: tạo giao dịch, quét hóa đơn. */
import Link from "next/link";
import { Plus, ScanLine } from "lucide-react";

export default function QuickActions() {
  return (
    <>
      <Link className="cf-btn" href="/ocr">
        <ScanLine size={17} />
        Quét hóa đơn
      </Link>
      <Link className="cf-btn cf-btn-primary" href="/transactions?new=1">
        <Plus size={17} />
        Thêm giao dịch
      </Link>
    </>
  );
}
