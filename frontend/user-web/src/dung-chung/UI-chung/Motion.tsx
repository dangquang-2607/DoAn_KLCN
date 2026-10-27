/**
 * ============================================================================
 * TÊN FILE: Motion.tsx
 * MÀN HÌNH / PHÂN HỆ: Hiệu ứng chuyển động trực quan (Micro-Interactions)
 * NHÓM VỆ TINH: dung-chung (Thành phần giao diện dùng chung)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp các hiệu ứng chuyển động sống động: MotionValue làm nổi bật giá trị thay đổi,
 *   TransferFlow minh họa dòng tiền chuyển khoản giữa hai ví, InvoiceFlow minh họa quét OCR.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Biểu tượng Lucide (ArrowRight, Check, Wallet, ScanLine, v.v.), CSS animation.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Các component MotionValue, TransferFlow, InvoiceFlow.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Đảm bảo hiệu ứng nhẹ nhàng, không gây ảnh hưởng đến hiệu năng render chính.
 * ============================================================================
 */
"use client";

import { ReactNode } from "react";
import { ArrowRight, Check, FileText, ScanLine, Wallet, X } from "lucide-react";

/**
 * Làm nổi bật sự thay đổi của giá trị số hoặc văn bản bằng animation nhẹ.
 */
export function MotionValue({ children }: { children: ReactNode }) {
  return <span key={String(children)} className="cf-value-reveal">{children}</span>;
}

/**
 * Minh họa đồ họa dòng tiền chuyển giao dịch giữa ví nguồn và ví đích.
 */
export function TransferFlow({
  from,
  to,
  amount,
  confirmed = false,
  onClose,
}: {
  from: string;
  to: string;
  amount?: string;
  confirmed?: boolean;
  onClose?: () => void;
}) {
  return (
    <section
      className={`cf-transfer-flow${confirmed ? " is-confirmed" : ""}`}
      aria-label={confirmed ? "Chuyển tiền hoàn tất" : "Hướng chuyển tiền"}
    >
      <div className="cf-transfer-heading">
        <span>
          {confirmed ? <Check size={16} /> : <ArrowRight size={16} />}
          {confirmed ? "Chuyển tiền hoàn tất" : "Chuyển giữa hai ví của bạn"}
        </span>
        {onClose && (
          <button
            className="cf-icon-btn"
            type="button"
            aria-label="Ẩn kết quả chuyển tiền"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className="cf-transfer-pair">
        <div className="cf-transfer-wallet">
          <Wallet size={20} aria-hidden="true" />
          <small>Ví nguồn</small>
          <strong>{from || "Chọn ví nguồn"}</strong>
        </div>
        <div className="cf-transfer-path" aria-hidden="true">
          <ArrowRight size={20} />
          <span />
        </div>
        <div className="cf-transfer-wallet">
          <Wallet size={20} aria-hidden="true" />
          <small>Ví nhận</small>
          <strong>{to || "Chọn ví nhận"}</strong>
        </div>
      </div>
      {amount && <div className="cf-transfer-amount">{amount}</div>}
    </section>
  );
}

export function OcrSteps({ status }: { status: string }) {
  const failed = status === "FAILED";
  const index =
    status === "CONFIRMED"
      ? 3
      : status === "REVIEW_REQUIRED"
      ? 2
      : status === "PROCESSING" || failed
      ? 1
      : 0;
  const steps = ["Đã tải lên", "Chờ / nhận diện", "Kiểm tra", "Đã ghi sổ"];
  return (
    <div className="cf-ocr-stages" aria-label="Tiến trình hóa đơn">
      {steps.map((label, i) => (
        <div
          key={label}
          className={`cf-ocr-stage ${
            i < index ? "is-done" : i === index ? "is-current" : ""
          } ${failed && i === index ? "is-failed" : ""}`}
          aria-current={i === index ? "step" : undefined}
        >
          <span aria-hidden="true">
            {i < index || status === "CONFIRMED" ? (
              <Check size={15} />
            ) : i === 1 ? (
              <ScanLine size={15} />
            ) : (
              <FileText size={15} />
            )}
          </span>
          <small>{failed && i === 1 ? "Cần thử lại" : label}</small>
        </div>
      ))}
    </div>
  );
}
