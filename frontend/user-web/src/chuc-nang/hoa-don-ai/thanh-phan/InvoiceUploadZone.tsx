import type { RefObject } from "react";
import { Upload } from "lucide-react";
import { INVOICE_IMAGE_ACCEPT } from "../xu-ly/invoiceUpload";

/** Vùng chọn/kéo thả file; validation và upload thực tế do page điều phối. */
export default function InvoiceUploadZone({ inputRef, busy, onUpload }: { inputRef: RefObject<HTMLInputElement | null>; busy: boolean; onUpload: (files: FileList | null) => void }) {
  return <>
    <input type="file" ref={inputRef} accept={INVOICE_IMAGE_ACCEPT} multiple hidden disabled={busy} onChange={(event) => { onUpload(event.target.files); event.target.value = ""; }} />
    <div className="cf-ocr-drop" onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add("is-dragging"); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) event.currentTarget.classList.remove("is-dragging"); }} onDrop={(event) => { event.preventDefault(); event.currentTarget.classList.remove("is-dragging"); onUpload(event.dataTransfer.files); }}>
      <Upload size={20} /><span>Kéo thả ảnh hóa đơn vào đây, hoặc</span><button className="cf-btn cf-btn-sm" disabled={busy} onClick={() => inputRef.current?.click()}>Chọn ảnh</button><span className="cf-muted">JPG, JPEG, PNG, WEBP · Tối đa 3 ảnh/lượt · 20 MB/ảnh · Tự động giảm dung lượng ảnh lớn</span>
    </div>
  </>;
}
