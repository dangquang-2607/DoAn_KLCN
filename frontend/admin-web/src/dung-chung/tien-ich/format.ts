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

type ExcelReport = {
  title: string;
  scope: string;
  columns: { title: string; width: number; type?: "text" | "number" | "datetime" }[];
  rows: unknown[][];
};

// Chỉ nhận dữ liệu thuần, không nhận đối tượng formula/hyperlink từ API.
export async function createExcelWorkbook({ title, scope, columns, rows }: ExcelReport) {
  if (!columns.length || rows.length > 1048571) throw new Error("Dữ liệu vượt giới hạn Excel.");
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CapitalFlow";
  const sheet = workbook.addWorksheet("Báo cáo", {
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = columns.map((column) => ({ width: column.width }));
  sheet.getCell("A2").value = title;
  sheet.getCell("A2").font = { name: "Arial", size: 17, bold: true, color: { argb: "FF243047" } };
  sheet.getRow(2).height = 30;
  sheet.getCell("A3").value = scope;
  sheet.getCell("A3").font = { name: "Arial", size: 11, italic: true, color: { argb: "FF64748B" } };
  sheet.getRow(3).height = 24;
  sheet.getRow(5).values = columns.map((column) => column.title);
  sheet.getRow(5).height = 30;
  sheet.getRow(5).eachCell((cell) => {
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF243047" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { right: { style: "thin", color: { argb: "FFFFFFFF" } } };
  });
  rows.forEach((values, index) => {
    const row = sheet.getRow(index + 6);
    let lines = 1;
    columns.forEach((column, col) => {
      const cell = row.getCell(col + 1);
      const raw = values[col];
      if (raw == null || raw === "") cell.value = null;
      else if (column.type === "number") {
        const number = Number(raw);
        if (!Number.isFinite(number)) throw new Error("Số liệu xuất không hợp lệ.");
        cell.value = number;
        cell.numFmt = "0";
      } else if (column.type === "datetime") {
        const text = String(raw);
        // API lưu UTC; timestamp không có offset cũng được hiểu là UTC.
        const date = raw instanceof Date ? raw : new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text + "Z");
        if (Number.isNaN(date.getTime())) throw new Error("Ngày xuất không hợp lệ.");
        cell.value = date;
        cell.numFmt = "dd/mm/yyyy hh:mm:ss";
      } else {
        cell.value = String(raw);
        cell.numFmt = "@";
        lines = Math.max(lines, String(raw).split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / Math.max(1, column.width - 3))), 0));
      }
      cell.font = { name: "Arial", size: 11, color: { argb: "FF243047" } };
      cell.alignment = { vertical: "middle", horizontal: column.type === "number" ? "right" : "left", wrapText: true };
      if (index % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    });
    row.height = Math.min(409, Math.max(28, lines * 16 + 8));
  });
  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(5, rows.length + 5), column: columns.length } };
  sheet.pageSetup.printTitlesRow = "1:5";
  return workbook;
}

export async function exportExcel(name: string, report: ExcelReport) {
  const workbook = await createExcelWorkbook(report);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob(
    [new Uint8Array(buffer)],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/\.(csv|xlsx)$/i, "") + ".xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
