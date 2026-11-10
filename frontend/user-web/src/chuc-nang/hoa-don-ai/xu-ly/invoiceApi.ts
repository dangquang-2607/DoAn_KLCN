import axios from "axios";
import api, { sessionOwner } from "@/dung-chung/connect-api/api";
import { newRequestId, sha256Hex } from "@/dung-chung/tien-ich/browserCrypto";
import type { UploadIssue, UploadResult } from "./InvoiceTypes";

const prefix = "cf-pending-invoice:";
// A retry keeps the same key, including after refresh/navigation. Never share
// pending operations across users; persist only hashes, not invoice content.
/**
 * Gửi request biến đổi dữ liệu hóa đơn với khóa Idempotency và ghi nhật ký chờ.
 */
async function mutation<T>(path: string, body: unknown, signature: string, user: string): Promise<T> {
  if (sessionOwner() !== user) throw new Error("Phiên đăng nhập đã thay đổi.");
  const storageKey = `${prefix}${user}:${await sha256Hex(path + signature)}`;
  if (sessionOwner() !== user) throw new Error("Phiên đăng nhập đã thay đổi.");
  let key = sessionStorage.getItem(storageKey);
  if (!key) { key = newRequestId(); sessionStorage.setItem(storageKey, key); }
  try {
    const response = await api.post<T>(path, body, { _moneyOwner: user, headers: { "Idempotency-Key": key } });
    sessionStorage.removeItem(storageKey);
    if (sessionOwner() !== user) throw new Error("Phiên đăng nhập đã thay đổi.");
    return response.data;
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status && status >= 400 && status < 500 && ![401, 408, 429].includes(status)) sessionStorage.removeItem(storageKey);
    throw error;
  }
}
export async function uploadInvoice(file: File, ticket?: string, queued?: {
  owner: string; requestKey: string; signal: AbortSignal;
}) {
  const user = queued?.owner ?? sessionOwner();
  const data = new FormData(); data.append("file", file); data.append("source", "UPLOAD");
  if (ticket) { data.append("upload_ticket", ticket); data.append("accept_distinct", "true"); }
  if (queued) {
    if (sessionOwner() !== user) throw new Error("Phiên đăng nhập đã thay đổi.");
    return (await api.post<UploadResult>("/invoices", data, {
      _moneyOwner: user, signal: queued.signal, timeout: 120000,
      headers: { "Idempotency-Key": queued.requestKey },
    })).data;
  }
  const digest = await sha256Hex(await file.arrayBuffer());
  return mutation<UploadResult>("/invoices", data, digest + ":UPLOAD", user);
}
export function invoiceMutation<T>(id: string, action: string, payload: Record<string, unknown>) {
  if (action === "record") return mutation<T>(`/bookkeeping/invoices/${id}/confirm`, payload, JSON.stringify(payload), sessionOwner());
  return mutation<T>(`/invoices/${id}/${action}`, payload, JSON.stringify(payload), sessionOwner());
}
export function invoiceError(error: unknown): UploadIssue {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) return detail;
    if (typeof detail === "string") return { message: detail };
    if (Array.isArray(detail)) return { message: detail.map(x => x.msg).join(". ") };
    if (!error.response || error.response.status >= 500) return { code: "INVOICE_RETRY_REQUIRED", message: "Chưa xác định kết quả. Giữ nguyên thông tin và thử lại; hệ thống sẽ kiểm tra khoản chi đã ghi." };
  }
  return { message: error instanceof Error ? error.message : "Không thể hoàn tất thao tác." };
}
