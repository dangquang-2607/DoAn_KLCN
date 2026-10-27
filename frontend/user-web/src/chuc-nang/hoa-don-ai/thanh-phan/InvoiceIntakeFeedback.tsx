/**
 * ============================================================================
 * TÊN FILE: InvoiceIntakeFeedback.tsx
 * MÀN HÌNH / PHÂN HỆ: Nhận diện hóa đơn AI (OCR)
 * NHÓM VỆ TINH: thanh-phan (Thành phần giao diện con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị phản hồi tức thì về tiến trình tiếp nhận hóa đơn tải lên, bao gồm
 *   trạng thái xử lý OCR, cảnh báo trùng lặp tệp và các nút hành động (thử lại, mở xem).
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Danh sách UploadEntry, kết quả UploadResult, trạng thái busy/checking.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export InvoiceIntakeFeedback component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Giải phóng bộ nhớ URL đối tượng xem trước (revokeObjectURL) khi unmount.
 * ============================================================================
 */
import { Modal } from "@/dung-chung/UI-chung/ui";
import { useEffect, useState } from "react";
import type { UploadEntry, UploadResult } from "../xu-ly/InvoiceTypes";

/**
 * Tạo và dọn dẹp URL cục bộ để người dùng xem nhanh ảnh hóa đơn đối chiếu.
 */
function LocalPreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const local = URL.createObjectURL(file);
    queueMicrotask(() => setUrl(local));
    return () => URL.revokeObjectURL(local);
  }, [file]);
  return url ? <a className="cf-inline-link" href={url} target="_blank" rel="noreferrer">Xem tệp mới để đối chiếu</a> : null;
}

/**
 * Hộp phản hồi trạng thái tiếp nhận và xử lý hóa đơn tải lên.
 */
export default function InvoiceIntakeFeedback({ entries, match, busy, checking, onRetry, onOpen, onRemove, onDismiss }: {
  entries: UploadEntry[]; match: UploadResult | null; busy: boolean; checking: boolean;
  onRetry: (file: File, ticket?: string) => void; onOpen: (id: string) => void;
  onRemove: (file: File) => void; onDismiss: () => void;
}) {
  return <>
    {checking && <p role="status">Đang kiểm tra hóa đơn… Tệp được nhận diện và đối chiếu trước khi thêm vào danh sách.</p>}
    {entries.some(e => e.error) && <div className="cf-panel-body cf-stack" aria-label="Kết quả kiểm tra trước tải lên">
      {entries.filter(e => e.error).map((entry, index) => <section key={index} className="cf-duplicate-review">
        {entry.issue?.upload_ticket && <span className="cf-duplicate-label">Nghi trùng</span>}
        <p>{entry.file.name}: {entry.error}</p>
        {entry.issue?.upload_ticket && <LocalPreview file={entry.file} />}
        {entry.issue?.duplicate_check?.candidates.map(c => <p key={c.invoice_id}>
          {c.merchant_name || "Hóa đơn"} · {c.similarity_percent}% · {c.invoice_date}
          <button className="cf-btn cf-btn-sm" disabled={busy} onClick={() => onOpen(c.invoice_id)}>Đối chiếu hóa đơn nghi trùng</button>
        </p>)}
        {entry.issue?.blockers?.map(c => <p key={c.id}>
          {c.filename || "Hóa đơn cũ"}
          <button className="cf-btn cf-btn-sm" disabled={busy} onClick={() => onOpen(c.id)}>Mở bản cần kiểm tra</button>
        </p>)}
        <div className="cf-row" style={{ flexWrap: "wrap" }}>
          <button className="cf-btn cf-btn-sm" disabled={busy} onClick={() => onRetry(entry.file, entry.issue?.upload_ticket)}>
            {entry.issue?.upload_ticket ? "Đã đối chiếu: đây là hóa đơn khác" : "Thử lại tệp này"}
          </button>
          <button className="cf-btn cf-btn-sm" disabled={busy} onClick={() => onRemove(entry.file)}>Bỏ tệp chờ</button>
        </div>
      </section>)}
    </div>}
    {match && <Modal title="Hóa đơn đã tồn tại" onClose={onDismiss}>
      <div className="cf-form">
        <p>{match.match_kind === "DATA" ? "Đã nhận diện và tìm thấy hóa đơn trùng dữ liệu." : "Tệp này đã được tải lên trước đó."} Không tạo thêm bản mới.</p>
        {match.outcome === "RESTORE_REQUIRED" && <p>Bản cũ đang trong Thùng rác. Mở bản cũ để khôi phục nếu cần.</p>}
        {match.outcome === "ALREADY_CONFIRMED" && <p>Hóa đơn đã ghi sổ; không tạo thêm khoản chi.</p>}
        <button className="cf-btn cf-btn-primary" onClick={() => { onOpen(match.id); onDismiss(); }}>Mở hóa đơn đã có</button>
      </div>
    </Modal>}
  </>;
}
