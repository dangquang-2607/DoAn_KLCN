/**
 * ============================================================================
 * TÊN FILE: useAutomaticDuplicateCheck.ts
 * MÀN HÌNH / PHÂN HỆ: Nhận diện hóa đơn AI (OCR)
 * NHÓM VỆ TINH: xu-ly (Custom Hook nghiệp vụ)
 * MỤC ĐÍCH CỤ THỂ:
 *   Tự động kiểm tra phát hiện hóa đơn trùng lặp trong nền khi người dùng thay đổi dữ liệu
 *   với cơ chế debounce (trì hoãn 400ms) để tối ưu hiệu năng và tránh gửi request dư thừa.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   invoiceId, chuỗi payload JSON dữ liệu hóa đơn, cờ enabled, các hàm callback kết quả.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export custom hook useAutomaticDuplicateCheck.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Sử dụng AbortController hủy bỏ request trước đó khi có thay đổi mới liên tục.
 * ============================================================================
 */
"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/dung-chung/connect-api/api";
import type { DuplicateCheck } from "./InvoiceTypes";

/** Debounce edits and refresh while another invoice may be finishing OCR. */
/**
 * Hook tự động gửi yêu cầu kiểm tra trùng lặp hóa đơn có áp dụng debounce.
 */
export default function useAutomaticDuplicateCheck({ invoiceId, payload, enabled, onResult, onAccept }: {
  invoiceId: string; payload: string; enabled: boolean;
  onResult: (value: DuplicateCheck) => void; onAccept: (value: boolean) => void;
}) {
  const [failure, setFailure] = useState("");
  const lastToken = useRef("");
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const check = async () => {
      try {
        const { data } = await api.post<DuplicateCheck>(`/invoices/${invoiceId}/duplicate-check`, JSON.parse(payload), { signal: controller.signal });
        if (!active) return;
        if (lastToken.current !== data.review_token) onAccept(false);
        lastToken.current = data.review_token;
        onResult(data);
        setFailure("");
      } catch {
        if (active) setFailure("Chưa thể tự kiểm tra trùng. Hệ thống sẽ thử lại; dữ liệu vẫn được kiểm tra trước khi ghi sổ.");
      } finally {
        if (active) timer = setTimeout(check, 10000);
      }
    };
    timer = setTimeout(check, 600);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [invoiceId, payload, enabled, onResult, onAccept]);
  return enabled ? failure : "";
}
