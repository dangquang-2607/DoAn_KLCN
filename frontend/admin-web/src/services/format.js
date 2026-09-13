export function money(value = 0, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(Number(value) || 0);
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function dateLabel(value) {
  return value
    ? new Date(
        value.length === 10 ? `${value}T12:00:00` : value,
      ).toLocaleDateString("vi-VN")
    : "—";
}
export function errorMessage(error) {
  const e = error;
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(". ");
  if (e?.response?.status === 429)
    return "Bạn thao tác quá nhanh. Vui lòng chờ một phút rồi thử lại.";
  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}
export const accountTypes = {
  CASH: "Tiền mặt",
  BANK: "Ngân hàng",
  E_WALLET: "Ví điện tử",
  CREDIT_CARD: "Thẻ tín dụng",
  SAVINGS: "Tiết kiệm",
  INVESTMENT: "Đầu tư",
  CRYPTO: "Tài sản số",
  OTHER: "Khác",
};
export function exportCsv(name, rows) {
  const escape = (value) => {
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
