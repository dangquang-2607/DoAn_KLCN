import axios from "axios";
import api from "@/dung-chung/connect-api/api";
import type { UploadIssue, UploadResult } from "./InvoiceTypes";

const prefix = "cf-pending-invoice:";
function owner() {
  if (typeof window === "undefined") return "";
  const token = sessionStorage.getItem("user_access_token");
  if (!token) throw new Error("Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.");
  const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  return String(payload.sub);
}
async function hash(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
}
// A retry keeps the same key, including after refresh/navigation. Never share
// pending operations across users; persist only hashes, not invoice content.
async function mutation<T>(path: string, body: unknown, signature: string, user: string): Promise<T> {
  if (owner() !== user) throw new Error("Phiên đăng nhập đã thay đổi.");
  const storageKey = `${prefix}${user}:${await hash(path + signature)}`;
  if (owner() !== user) throw new Error("Phiên đăng nhập đã thay đổi.");
  let key = sessionStorage.getItem(storageKey);
  if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(storageKey, key); }
  try {
    const response = await api.post<T>(path, body, { headers: { "Idempotency-Key": key } });
    sessionStorage.removeItem(storageKey);
    if (owner() !== user) throw new Error("Phiên đăng nhập đã thay đổi.");
    return response.data;
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status && status >= 400 && status < 500 && ![401, 408, 429].includes(status)) sessionStorage.removeItem(storageKey);
    throw error;
  }
}
export async function uploadInvoice(file: File, ticket?: string) {
  const user = owner();
  const digest = await hash(await file.arrayBuffer());
  const data = new FormData(); data.append("file", file); data.append("source", "UPLOAD");
  if (ticket) { data.append("upload_ticket", ticket); data.append("accept_distinct", "true"); }
  return mutation<UploadResult>("/invoices", data, digest + ":UPLOAD", user);
}
export function invoiceMutation<T>(id: string, action: string, payload: Record<string, unknown>) {
  if (action === "record") return mutation<T>(`/bookkeeping/invoices/${id}/confirm`, payload, JSON.stringify(payload), owner());
  return mutation<T>(`/invoices/${id}/${action}`, payload, JSON.stringify(payload), owner());
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
