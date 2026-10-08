/**
 * ============================================================================
 * TÊN FILE: Motion.jsx
 * MÀN HÌNH / PHÂN HỆ: Thiết kế dùng chung
 * NHÓM VỆ TINH: dung-chung/UI-chung (UI dùng chung)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp hiệu ứng chuyển động dùng chung nhưng không làm sai lệch dữ liệu.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props React, icon Lucide và các design token CSS dùng chung.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất Motion để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không chứa secret hoặc tự thay đổi dữ liệu nghiệp vụ; luôn tôn trọng khả năng truy cập.
 * ============================================================================
 */
"use client";
import { ArrowRight, Check, FileText, ScanLine, Wallet, X } from "lucide-react";

// Luôn hiển thị giá trị có thẩm quyền; chỉ tạo hiệu ứng trình bày, không tự tạo số dư giả.
export function MotionValue({ children }) {
  return <span key={String(children)} className="cf-value-reveal">{children}</span>;
}

export function TransferFlow({ from, to, amount, confirmed = false, onClose = undefined }) {
  return <section className={`cf-transfer-flow${confirmed ? " is-confirmed" : ""}`} aria-label={confirmed ? "Chuyển tiền đã hoàn tất" : "Hướng chuyển tiền"}>
    <div className="cf-transfer-heading"><span>{confirmed ? <Check size={16} /> : <ArrowRight size={16} />}{confirmed ? "Chuyển tiền hoàn tất" : "Chuyển giữa hai ví của bạn"}</span>{onClose && <button className="cf-icon-btn" type="button" aria-label="Ẩn kết quả chuyển tiền" onClick={onClose}><X size={16} /></button>}</div>
    <div className="cf-transfer-pair">
      <div className="cf-transfer-wallet"><Wallet size={20} aria-hidden="true" /><small>Ví nguồn</small><strong>{from || "Chọn ví nguồn"}</strong></div>
      <div className="cf-transfer-path" aria-hidden="true"><ArrowRight size={20} /><span /></div>
      <div className="cf-transfer-wallet"><Wallet size={20} aria-hidden="true" /><small>Ví nhận</small><strong>{to || "Chọn ví nhận"}</strong></div>
    </div>
    {amount && <div className="cf-transfer-amount">{amount}</div>}
  </section>;
}

export function OcrSteps({ status }) {
  const failed = status === "FAILED";
  const index = status === "CONFIRMED" ? 3 : status === "REVIEW_REQUIRED" ? 2 : status === "PROCESSING" || failed ? 1 : 0;
  const steps = ["Đã tải lên", "Chờ / nhận diện", "Kiểm tra", "Đã ghi sổ"];
  return <div className="cf-ocr-stages" aria-label="Tiến trình hóa đơn">
    {steps.map((label, i) => <div key={label} className={`cf-ocr-stage ${i < index ? "is-done" : i === index ? "is-current" : ""} ${failed && i === index ? "is-failed" : ""}`} aria-current={i === index ? "step" : undefined}>
      <span aria-hidden="true">{i < index || status === "CONFIRMED" ? <Check size={15} /> : i === 1 ? <ScanLine size={15} /> : <FileText size={15} />}</span>
      <small>{failed && i === 1 ? "Cần thử lại" : label}</small>
    </div>)}
  </div>;
}
