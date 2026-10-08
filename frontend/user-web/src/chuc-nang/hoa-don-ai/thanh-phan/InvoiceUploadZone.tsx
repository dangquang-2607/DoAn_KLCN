/**
 * ============================================================================
 * TÊN FILE: InvoiceUploadZone.tsx
 * MÀN HÌNH / PHÂN HỆ: Hóa đơn AI / OCR
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp vùng chọn và kéo thả tệp hóa đơn.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất InvoiceUploadZone để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Giới hạn định dạng/kích thước/số lượng tệp; chỉ tạo khoản chi sau bước người dùng xác nhận.
 * ============================================================================
 */
import type { RefObject } from "react";
import { Upload } from "lucide-react";

/** Vùng chọn/kéo thả file; validation và upload thực tế do page điều phối. */
export default function InvoiceUploadZone({ inputRef, busy, onUpload }: { inputRef: RefObject<HTMLInputElement | null>; busy: boolean; onUpload: (files: FileList | null) => void }) {
  return <>
    <input type="file" ref={inputRef} accept=".jpg,.jpeg,.png,.webp,.pdf,.xml" multiple hidden onChange={(event) => onUpload(event.target.files)} />
    <div className="cf-ocr-drop" onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add("is-dragging"); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) event.currentTarget.classList.remove("is-dragging"); }} onDrop={(event) => { event.preventDefault(); event.currentTarget.classList.remove("is-dragging"); onUpload(event.dataTransfer.files); }}>
      <Upload size={20} /><span>Kéo thả hóa đơn vào đây, hoặc</span><button className="cf-btn cf-btn-sm" disabled={busy} onClick={() => inputRef.current?.click()}>Chọn tệp</button><span className="cf-muted">JPG, PNG, WEBP, PDF · Tối đa 10 MB</span>
    </div>
  </>;
}
