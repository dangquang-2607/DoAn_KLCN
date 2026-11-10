"use client";

import { ReactNode } from "react";
import { Check, FileText, ScanLine } from "lucide-react";

/**
 * Làm nổi bật sự thay đổi của giá trị số hoặc văn bản bằng animation nhẹ.
 */
export function MotionValue({ children }: { children: ReactNode }) {
  return <span key={String(children)} className="cf-value-reveal">{children}</span>;
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
