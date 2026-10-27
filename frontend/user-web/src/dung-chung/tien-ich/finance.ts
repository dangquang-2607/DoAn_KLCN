import type { Money } from "@/dung-chung/nghiep-vu/finance";

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

// Hiển thị ngày theo thói quen Việt Nam, còn API lưu dạng ISO YYYY-MM-DD.
export function formatDateForDisplay(value?: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || "";
}

// Chỉ giữ 8 chữ số ngày/tháng/năm và tự chèn dấu / khi người dùng gõ hoặc dán.
export function formatDateForTyping(value: string) {
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(value.trim());
  if (iso) return `${iso[3].padStart(2, "0")}/${iso[2].padStart(2, "0")}/${iso[1]}`;
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

export function parseDateForApi(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return null;
  return `${year}-${month}-${day}`;
}

// Chuẩn hóa lỗi API thành thông báo an toàn, không lộ payload hoặc chi tiết nội bộ.
export function errorMessage(error: unknown) {
  const e = error as {
    response?: { status?: number; data?: { detail?: unknown } };
  };
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail && typeof detail.message === "string") return detail.message;
  if (Array.isArray(detail))
    return detail.map((d: { msg?: string }) => d.msg).join(". ");
  if (e?.response?.status === 429)
    return "Bạn thao tác quá nhanh. Vui lòng chờ một phút rồi thử lại.";
  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

export type ExcelTransaction = {
  include_in_reports?: boolean;
  transaction_date: string;
  type: string;
  kind?: string;
  account_name: string;
  category_name: string;
  amount: Money;
  currency: string;
  description: string;
  source: string;
};

type FinanceExport = { title: string; scope: string; transactions: ExcelTransaction[] };

// Only load the workbook library when exporting. Text cells never become formulas.
export async function createFinanceWorkbook({ title, scope, transactions }: FinanceExport) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CapitalFlow";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const sheet = workbook.addWorksheet("Báo cáo", { properties: { defaultRowHeight: 24, tabColor: { argb: "FF243047" } } });
  const widths = [16, 18, 28, 25, 23, 13, 54, 20, 22];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  const colors = { ink: "FF243047", muted: "FF687488", green: "FF087F5B", red: "FFC0394D", white: "FFFFFFFF" };
  const amounts = transactions.map((transaction) => {
    const amount = Number(transaction.amount);
    if (transaction.amount === "" || !Number.isFinite(amount)) throw new Error("Số tiền xuất không hợp lệ.");
    return amount;
  });
  const currencies = [...new Set(transactions.map((transaction) => transaction.currency))].sort();
  const headerRow = Math.max(9, 7 + currencies.length);
  const firstRow = headerRow + 1;
  const lastRow = headerRow + transactions.length;
  if (lastRow > 1_048_576) throw new Error("Dữ liệu vượt giới hạn Excel. Hãy chọn khoảng ngày ngắn hơn.");
  const numberFormat = (currency: string) => currency === "VND" ? '#,##0;[Red](#,##0);"—"' : '#,##0.00;[Red](#,##0.00);"—"';
  sheet.getCell("A2").value = title;
  sheet.getCell("A3").value = scope;
  sheet.getCell("A4").value = "Tổng thu/chi theo từng loại tiền, không gồm chuyển khoản, điều chỉnh và các khoản đã tắt tính thu chi.";
  sheet.getRow(5).values = ["Tiền tệ", "Tổng thu", "Tổng chi", "Thu trừ chi"];
  currencies.forEach((currency, index) => {
    const row = 6 + index;
    const income = transactions.reduce((sum, transaction, i) => sum + (transaction.include_in_reports !== false && transaction.currency === currency && (!transaction.kind || transaction.kind === "NORMAL") && transaction.type === "INCOME" ? amounts[i] : 0), 0);
    const expense = transactions.reduce((sum, transaction, i) => sum - (transaction.include_in_reports !== false && transaction.currency === currency && (!transaction.kind || transaction.kind === "NORMAL") && transaction.type === "EXPENSE" ? amounts[i] : 0), 0);
    sheet.getCell(row, 1).value = currency;
    const criteria = `$F$${firstRow}:$F$${lastRow},A${row},$I$${firstRow}:$I$${lastRow},"Thu/chi"`;
    sheet.getCell(row, 2).value = { formula: `SUMIFS($E$${firstRow}:$E$${lastRow},$B$${firstRow}:$B$${lastRow},"Thu nhập",${criteria})`, result: income };
    sheet.getCell(row, 3).value = { formula: `-SUMIFS($E$${firstRow}:$E$${lastRow},$B$${firstRow}:$B$${lastRow},"Chi tiêu",${criteria})`, result: expense };
    sheet.getCell(row, 4).value = { formula: `B${row}-C${row}`, result: income - expense };
    for (let col = 2; col <= 4; col++) sheet.getCell(row, col).numFmt = numberFormat(currency);
  });
  if (!currencies.length) sheet.getCell("A6").value = "Không có giao dịch trong phạm vi đã chọn.";
  sheet.getRow(headerRow).values = ["Ngày", "Loại", "Tài khoản", "Danh mục", "Số tiền", "Tiền tệ", "Diễn giải", "Nguồn", "Nghiệp vụ"];
  transactions.forEach((transaction, index) => {
    const date = new Date(`${transaction.transaction_date.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) throw new Error("Ngày giao dịch không hợp lệ.");
    const row = sheet.getRow(firstRow + index);
    row.values = [date, ({ INCOME: "Thu nhập", EXPENSE: "Chi tiêu" } as Record<string, string>)[transaction.type] || transaction.type,
      transaction.account_name, transaction.category_name, amounts[index], transaction.currency, transaction.description,
      ({ WALLET: "Thanh toán ví", MANUAL: "Nhập thủ công", OCR: "Hóa đơn AI", BANK: "Ngân hàng", IMPORT: "Nhập dữ liệu", SYSTEM: "Hệ thống" } as Record<string, string>)[transaction.source] || transaction.source,
      transaction.include_in_reports === false ? "Không tính thu chi" : ({ NORMAL: "Thu/chi", TRANSFER: "Chuyển khoản", ADJUSTMENT: "Điều chỉnh số dư" } as Record<string, string>)[transaction.kind || "NORMAL"] || transaction.kind];
    row.getCell(1).numFmt = "dd/mm/yyyy";
    row.getCell(5).numFmt = numberFormat(transaction.currency);
    const lines = Math.max(1, ...[transaction.account_name, transaction.category_name, transaction.description].map((text, i) =>
      String(text || "").split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / ([25, 22, 50][i]))), 0)));
    row.height = Math.min(409, Math.max(28, lines * 15 + 10));
  });
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.font = { name: "Arial", size: 11, color: { argb: colors.ink } };
      cell.alignment = { vertical: "middle", horizontal: typeof cell.value === "number" || cell.type === ExcelJS.ValueType.Formula ? "right" : "left", wrapText: rowNumber > headerRow };
      if (rowNumber > headerRow && (rowNumber - firstRow) % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F5F8" } };
    });
  });
  [5, headerRow].forEach((rowNumber) => {
    sheet.getRow(rowNumber).height = 28;
    sheet.getRow(rowNumber).eachCell((cell) => {
      cell.font = { name: "Arial", size: 11, bold: true, color: { argb: colors.white } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.ink } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
  });
  sheet.getCell("A2").font = { name: "Arial", size: 17, bold: true, color: { argb: colors.ink } };
  sheet.getRow(2).height = 32;
  for (const address of ["A3", "A4"]) sheet.getCell(address).font = { name: "Arial", size: 11, italic: true, color: { argb: colors.muted } };
  // Phạm vi có thể chứa nhiều bộ lọc; cho phép xuống dòng trong vùng trình bày.
  sheet.mergeCells("A3:I3");
  sheet.getCell("A3").alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(3).height = Math.max(24, Math.ceil(scope.length / 190) * 16 + 8);
  if (transactions.length) {
    sheet.autoFilter = `A${headerRow}:I${lastRow}`;
    sheet.addConditionalFormatting({ ref: `B${firstRow}:B${lastRow}`, rules: [
      { type: "containsText", operator: "containsText", text: "Thu nhập", priority: 1, style: { font: { color: { argb: colors.green }, bold: true } } },
      { type: "containsText", operator: "containsText", text: "Chi tiêu", priority: 2, style: { font: { color: { argb: colors.red }, bold: true } } },
    ] });
    sheet.addConditionalFormatting({ ref: `E${firstRow}:E${lastRow}`, rules: [
      { type: "cellIs", operator: "greaterThan", formulae: [0], priority: 3, style: { font: { color: { argb: colors.green } } } },
      { type: "cellIs", operator: "lessThan", formulae: [0], priority: 4, style: { font: { color: { argb: colors.red } } } },
    ] });
  }
  sheet.views = [{ state: "frozen", ySplit: headerRow, activeCell: `A${firstRow}`, showGridLines: false }];
  sheet.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${headerRow}:${headerRow}`, printArea: `A1:I${Math.max(lastRow, headerRow)}` };
  return workbook;
}

export async function exportFinanceExcel(name: string, report: FinanceExport) {
  const workbook = await createFinanceWorkbook(report);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.endsWith(".xlsx") ? name : `${name}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
