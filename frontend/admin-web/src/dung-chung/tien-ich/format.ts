import type { Money } from "../nghiep-vu/finance";

// Định dạng để hiển thị; không làm tròn hoặc ghi ngược giá trị vào dữ liệu nguồn.
export function money(value: Money = 0, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(Number(value) || 0);
}

// Tạo ngày cục bộ thay vì UTC để tránh lệch một ngày theo múi giờ Việt Nam.
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Gắn giờ giữa trưa cho chuỗi chỉ có ngày nhằm tránh dịch ngày khi trình duyệt đổi múi giờ.
export function dateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(date);
}

// Chuẩn hóa lỗi API thành thông báo an toàn, không lộ payload hoặc chi tiết nội bộ.
export function errorMessage(error: unknown) {
  const e = error as {
    response?: { status?: number; data?: { detail?: unknown } };
  };
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((d: { msg?: string }) => d.msg).join(". ");
  if (e?.response?.status === 429)
    return "Bạn thao tác quá nhanh. Vui lòng chờ một phút rồi thử lại.";
  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

// Escape ô CSV và chặn ký tự mở đầu có thể bị ứng dụng bảng tính thực thi như công thức.
export function exportCsv(name: string, rows: unknown[][]) {
  const escape = (value: unknown) => {
    let s = String(value ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
