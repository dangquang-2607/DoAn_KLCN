import Link from "next/link";
import { useEffect, useState } from "react";
import { Files } from "lucide-react";
import type { UploadEntry } from "../xu-ly/InvoiceTypes";
import styles from "../CSS/invoice-density.module.css";

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
export default function InvoiceIntakeFeedback({ entries, progress, busy, checking, onRetry, onOpen, onOpenDuplicate, onRemove }: {
  entries: UploadEntry[]; progress: { name: string; index: number; total: number } | null; busy: boolean; checking: boolean;
  onRetry: (file: File, ticket?: string) => void; onOpen: (id: string) => void;
  onOpenDuplicate: (id: string) => void;
  onRemove: (file: File) => void;
}) {
  const duplicates = entries.flatMap(entry => entry.result && entry.result.outcome !== "CREATED" ? [{ file: entry.file, result: entry.result }] : []);
  const [duplicateIndex, setDuplicateIndex] = useState(0);
  const selectedIndex = Math.min(duplicateIndex, Math.max(0, duplicates.length - 1));
  const selectedDuplicate = duplicates[selectedIndex];
  return <>
    {checking && <p role="status">{progress ? `Đang nhận diện và đối chiếu ảnh ${progress.index}/${progress.total} · ${progress.name}` : "Đang kiểm tra ảnh hóa đơn…"}</p>}
    {entries.some(e => e.error) && <div className="cf-panel-body cf-stack" aria-label="Kết quả kiểm tra trước tải lên">
      {entries.filter(e => e.error).map((entry, index) => <section key={index} className="cf-duplicate-review">
        {entry.issue?.upload_ticket && <span className="cf-duplicate-label">Nghi trùng</span>}
        <p>{entry.file.name}: {entry.error}</p>
        {entry.issue?.transaction_id && entry.issue.matched_invoice_id && <Link className="cf-inline-link" href={`/transactions?invoice_id=${entry.issue.matched_invoice_id}`}>Xem khoản chi đã ghi sổ</Link>}
        {entry.issue?.upload_ticket && <LocalPreview file={entry.file} />}
        {entry.issue?.duplicate_check?.candidates.map(c => <p key={c.invoice_id}>
          {c.merchant_name || "Hóa đơn"} · {c.similarity_percent}% · {c.invoice_date}
          {c.purged ? <><span> · Chứng từ gốc đã xóa vĩnh viễn. </span><Link className="cf-inline-link" href={`/transactions?invoice_id=${c.invoice_id}`}>Đối chiếu khoản chi</Link></> : <button className="cf-btn cf-btn-sm" disabled={busy} onClick={() => onOpen(c.invoice_id)}>Đối chiếu hóa đơn nghi trùng</button>}
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
    {duplicates.length > 0 && <section className={styles.duplicates} aria-label="Ảnh trùng hóa đơn đã có">
      <div className={styles.duplicateHeading}>
        <Files size={18} aria-hidden="true" />
        <strong>{duplicates.length} ảnh trùng</strong>
      </div>
      <span className={styles.duplicateHint}>Không tạo thêm hóa đơn.</span>
      <select className={`cf-input ${styles.duplicatePicker}`} aria-label="Chọn ảnh trùng để mở hóa đơn" title={selectedDuplicate.file.name} disabled={busy} value={selectedIndex} onChange={event => setDuplicateIndex(Number(event.target.value))}>
        {duplicates.map(({ file, result }, index) => <option key={index} value={index}>
          {file.name} · {result.outcome === "RESTORE_REQUIRED" ? "Trong Thùng rác" : result.outcome === "ALREADY_CONFIRMED" ? "Đã ghi sổ" : result.match_kind === "DATA" ? "Khớp dữ liệu hóa đơn đã có" : "Đã tải lên trước đó"}
        </option>)}
      </select>
      <button type="button" className="cf-btn cf-btn-sm" disabled={busy} onClick={() => {
        setDuplicateIndex(0);
        onOpenDuplicate(selectedDuplicate.result.id);
      }}>Mở hóa đơn</button>
    </section>}
  </>;
}
