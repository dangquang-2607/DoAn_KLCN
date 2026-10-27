/**
 * ============================================================================
 * TÊN FILE: InvoiceDuplicateReview.tsx
 * MÀN HÌNH / PHÂN HỆ: Nhận diện hóa đơn AI (OCR)
 * NHÓM VỆ TINH: thanh-phan (Thành phần giao diện con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị hộp thoại cảnh báo khi hệ thống AI phát hiện hóa đơn có khả năng bị trùng lặp
 *   (cùng cửa hàng, ngày, số tiền hoặc trùng file) với một hóa đơn đã ghi sổ trước đó.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Đối tượng DuplicateCheck từ backend, modal UI primitive, định dạng tiền tệ.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export InvoiceDuplicateReview component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Ngăn chặn việc ghi trùng giao dịch tài chính nhiều lần làm sai lệch số dư tài khoản.
 * ============================================================================
 */
import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/dung-chung/UI-chung/ui";
import { money } from "@/dung-chung/tien-ich/finance";
import type { DuplicateCheck } from "../xu-ly/InvoiceTypes";

const reasons: Record<string, string> = {
  SIMILAR_DATA: "Nhiều trường thông tin tương đồng — cần đối chiếu",
  SAME_FILE: "Cùng nội dung tệp",
  SAME_IDENTITY: "Cùng định danh hóa đơn",
  IDENTITY_DATA_CONFLICT: "Cùng định danh nhưng ngày hoặc số tiền khác — cần sửa thông tin",
  SAME_MERCHANT_DATE_AMOUNT: "Cùng cửa hàng, ngày và số tiền",
  SAME_RECEIPT_NUMBER_ADDRESS_DATE_AMOUNT: "Cùng số phiếu, địa chỉ, ngày và số tiền",
  SAME_RETAIL_RECEIPT_TIME: "Cùng cửa hàng, số phiếu, địa chỉ, ngày, giờ và số tiền",
  SAME_RETAIL_RECEIPT_ITEMS: "Cùng cửa hàng, số phiếu, địa chỉ, ngày, số tiền và chi tiết mặt hàng",
  SAME_RETAIL_TIME_ITEMS: "Cùng cửa hàng, địa chỉ, ngày, giờ, số tiền và chi tiết mặt hàng; OCR thiếu số phiếu",
};
/**
 * Hộp thoại đối chiếu và xác nhận hóa đơn trùng lặp trước khi lưu.
 */
export default function InvoiceDuplicateReview({ check, busy, accepted, onAccept, onOpen, onSame }: {
  check: DuplicateCheck | null; busy: boolean; accepted: boolean;
  onAccept: (value: boolean) => void; onOpen: (id: string) => void; onSame: (id: string) => void;
}) {
  const [dismissed, setDismissed] = useState("");
  const strongest = check?.candidates.find(c => (c.similarity_percent ?? (c.level === "EXACT" ? 100 : 0)) > 80);
  const notificationKey = strongest ? `${strongest.invoice_id}:${strongest.similarity_percent}` : "";
  if (!check) return <p role="status" className="cf-muted">Đang tự đối chiếu thông tin hóa đơn…</p>;
  if (check.level === "NONE") return <p role="status" className="cf-muted">Chưa thấy hóa đơn trùng với thông tin hiện tại.</p>;
  return <section className="cf-duplicate-review" aria-label="Đối chiếu hóa đơn">
    <span className="cf-duplicate-label">{strongest ? "Trùng hóa đơn" : "Nghi trùng"}</span>
    {check.level === "EXACT" && <p>Hóa đơn đã có bằng chứng trùng; không thể ghi thêm khoản chi.</p>}
    <p>Kiểm tra bản cũ trước khi quyết định. {check.candidate_count > check.candidates.length && `Hiển thị ${check.candidates.length}/${check.candidate_count} hóa đơn.`}</p>
    {check.candidates.map(c => <article key={c.invoice_id} className="cf-duplicate-candidate">
      <strong>{c.merchant_name || "Hóa đơn"}</strong>
      {c.similarity_percent !== undefined && <p>Mức tương đồng dữ liệu: {c.similarity_percent}%</p>}
      <p>{c.invoice_date || "Chưa rõ ngày"} · {money(c.total_amount || 0, c.currency)} · {c.transaction_id ? "Đã ghi sổ" : "Bản nháp"}{c.deleted_at ? " · Thùng rác" : ""}</p>
      <p>{reasons[c.reason] || "Thông tin hóa đơn tương đồng"}</p>
      <div className="cf-row" style={{ flexWrap: "wrap" }}>
        <button type="button" className="cf-btn cf-btn-sm" disabled={busy} onClick={() => onOpen(c.invoice_id)}>{(c.similarity_percent ?? 0) > 80 ? "Mở hóa đơn trùng" : "Đối chiếu hóa đơn nghi trùng"}</button>
        {c.transaction_id && <Link className="cf-inline-link" href={`/transactions?invoice_id=${c.invoice_id}`}>Xem khoản chi</Link>}
        {check.level === "SUSPECTED" && <button type="button" className="cf-btn cf-btn-sm" disabled={busy} onClick={() => onSame(c.invoice_id)}>Đây là cùng hóa đơn</button>}
      </div>
    </article>)}
    {check.level === "SUSPECTED" && check.can_override && <label className="cf-row">
      <input type="checkbox" checked={accepted} disabled={busy} onChange={e => onAccept(e.target.checked)} />
      Tôi đã đối chiếu, đây là khoản chi khác
    </label>}
    <p className="cf-muted">Bạn có thể kiểm tra sau; chưa có khoản chi mới được tạo ở bước này.</p>
    {strongest && dismissed !== notificationKey && <Modal title="Phát hiện hóa đơn trùng" busy={busy} onClose={() => setDismissed(notificationKey)}>
      <div className="cf-form">
        <p>Thông tin đang xem tương đồng <strong>{strongest.similarity_percent ?? 100}%</strong> với hóa đơn <strong>{strongest.merchant_name || "đã tải trước đó"}</strong>.</p>
        <p>{strongest.invoice_date || "Chưa rõ ngày"} · {money(strongest.total_amount || 0, strongest.currency)}</p>
        <p>{reasons[strongest.reason] || "Nhiều trường dữ liệu trùng khớp"}. Hãy mở hóa đơn này để đối chiếu trước khi ghi sổ.</p>
        <div className="cf-form-actions">
          <button type="button" className="cf-btn" disabled={busy} onClick={() => setDismissed(notificationKey)}>Đóng</button>
          <button type="button" className="cf-btn cf-btn-primary" disabled={busy} onClick={() => onOpen(strongest.invoice_id)}>Mở hóa đơn trùng</button>
        </div>
      </div>
    </Modal>}
  </section>;
}
