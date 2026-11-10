import type { Money, Transaction } from "@/dung-chung/nghiep-vu/finance";

/** Giữ mã tự nhập; rút mã hóa đơn sinh tự động về 12 ký tự khi hiển thị. */
export function billReferenceLabel(reference: string) {
  return /^HD-(?:[0-9A-F]{32}|[A-Z2-7]{18}|[A-Z0-9]{8}-[0-9A-F]{8})$/.test(reference)
    ? `HD-${reference.slice(3).replace("-", "").slice(0, 9)}` : reference;
}

/** Hiển thị 12 ký tự cho mã hóa đơn mô phỏng trong danh sách giao dịch ví. */
export function transactionListDescription({ description, wallet_entry_id }: Pick<Transaction, "description" | "wallet_entry_id">) {
  if (!wallet_entry_id || !description) return description;
  return description.replace(/ · (HD-(?:[0-9A-F]{32}|[A-Z2-7]{18}|[A-Z0-9]{8}-[0-9A-F]{8}))$/, (_, reference: string) => {
    return ` · ${billReferenceLabel(reference)}`;
  });
}

// Định dạng để hiển thị; không làm tròn hoặc ghi ngược giá trị vào dữ liệu nguồn.
/**
 * Định dạng giá trị số thành chuỗi tiền tệ chuẩn Việt Nam (VND).
 * 
 * @param value - Giá trị số hoặc chuỗi số tiền.
 * @param currency - Mã tiền tệ (mặc định 'VND').
 * @returns Chuỗi tiền tệ đã định dạng kèm ký hiệu đơn vị.
 */
export function money(value: Money = 0, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(Number(value) || 0);
}

/** Giá trị đã là phần trăm (80.5 => 80,5); chỉ định dạng hiển thị. */
export function percent(value: Money, digits = 1) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(Number(value) || 0);
}

// Tạo ngày cục bộ thay vì UTC để tránh lệch một ngày theo múi giờ Việt Nam.
/**
 * Chuyển đổi đối tượng Date thành chuỗi ngày ISO (YYYY-MM-DD) theo giờ địa phương.
 */
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

// Chuẩn hóa ngày gõ/dán; giữ nguyên dữ liệu sai để bước kiểm tra từ chối.
export function formatDateForTyping(value: string) {
  const text = (value || "").trim();
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (iso) return `${iso[3].padStart(2, "0")}/${iso[2].padStart(2, "0")}/${iso[1]}`;
  const local = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(text);
  if (local) return `${local[1].padStart(2, "0")}/${local[2].padStart(2, "0")}/${local[3]}`;
  // Do not silently truncate a pasted date or turn arbitrary text into a date.
  if (/[^\d/]/.test(text)) return text;
  const digits = text.replace(/\D/g, "");
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

// Validate completed segments while still allowing a date to be typed/deleted.
// February permits 29 until the year is complete, then applies Gregorian rules.
export function dateInputError(value: string) {
  if (!value) return "";
  const match = /^(\d{1,2})(?:\/(\d{1,2})(?:\/(\d{1,4}))?)?$/.exec(value);
  if (!match) return "Nhập ngày theo định dạng dd/mm/yyyy.";
  const [, day, month = "", year = ""] = match;
  if (Number(day) > 31 || (day.length === 1 && Number(day) > 3) || day === "00")
    return "Ngày phải từ 01 đến 31.";
  if (Number(month) > 12 || (month.length === 1 && Number(month) > 1) || month === "00")
    return "Tháng phải từ 01 đến 12.";
  if (year === "0000") return "Năm phải từ 0001 đến 9999.";
  if (month.length === 2) {
    const leap = year.length < 4 || Number(year) % 400 === 0 || (Number(year) % 4 === 0 && Number(year) % 100 !== 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(month) - 1];
    if (Number(day) > days) return `Tháng ${month}${year.length === 4 ? ` năm ${year}` : ""} chỉ có ${days} ngày.`;
  }
  return "";
}

export function parseDateForApi(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  if (dateInputError(`${day}/${month}/${year}`)) return null;
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
  note?: string | null;
  source: string;
};

type FinanceExport = { title: string; scope: string; transactions: ExcelTransaction[] };

// API money is Decimal(19,2). Sum integer cents before deciding whether Excel's
// approximately 15 significant digits can represent a value as a numeric cell.
function exportCents(value: Money): bigint {
  const text = String(value).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error('Số tiền xuất không hợp lệ.');
  const cents = BigInt(match[2]) * 100n + BigInt((match[3] || '').padEnd(2, '0'));
  return match[1] === '-' ? -cents : cents;
}

function exportDecimal(cents: bigint): string {
  const absolute = cents < 0n ? -cents : cents;
  const fraction = absolute % 100n;
  return `${cents < 0n ? '-' : ''}${absolute / 100n}${fraction ? `.${String(fraction).padStart(2, '0')}` : ''}`;
}

function excelMoney(cents: bigint): number | string {
  const text = exportDecimal(cents);
  const digits = text.replace(/[-.]/g, '').replace(/^0+/, '');
  return digits.length <= 15 ? Number(text) : text;
}

function exportNumberFormat(currency: string, cents: bigint): string {
  return currency !== 'VND' || cents % 100n !== 0n
    ? '#,##0.00;[Red](#,##0.00);"—"'
    : '#,##0;[Red](#,##0);"—"';
}

// Only load the workbook library when exporting. Text cells never become formulas.
export async function createFinanceWorkbook({ title, scope, transactions }: FinanceExport) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CapitalFlow";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const sheet = workbook.addWorksheet("CapitalFlow", { properties: { defaultRowHeight: 24, tabColor: { argb: "FF243047" } } });
  const widths = [16, 16, 26, 24, 26, 12, 52, 40, 22, 23];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  const colors = { ink: "FF243047", muted: "FF687488", green: "FF087F5B", red: "FFC0394D", white: "FFFFFFFF" };
  const cents = transactions.map(transaction => exportCents(transaction.amount));
  const amounts = cents.map(excelMoney);
  const currencies = [...new Set(transactions.map((transaction) => transaction.currency))].sort();
  const summaries = currencies.map(currency => {
    let income = 0n, expense = 0n, numericRows = true;
    transactions.forEach((transaction, index) => {
      if (transaction.include_in_reports === false || transaction.currency !== currency || (transaction.kind && transaction.kind !== 'NORMAL')) return;
      if (transaction.type === 'INCOME') income += cents[index];
      else if (transaction.type === 'EXPENSE') expense -= cents[index];
      else return;
      if (typeof amounts[index] === 'string') numericRows = false;
    });
    const totals = [income, expense, income - expense];
    return { currency, totals, formulas: numericRows && totals.every(value => typeof excelMoney(value) === 'number') };
  });
  const headerRow = Math.max(9, 7 + currencies.length);
  const firstRow = headerRow + 1;
  const lastRow = headerRow + transactions.length;
  if (lastRow > 1_048_576) throw new Error("Dữ liệu vượt giới hạn Excel. Hãy chọn khoảng ngày ngắn hơn.");
  sheet.getCell("A2").value = title;
  sheet.getCell("A3").value = scope;
  sheet.getCell("A4").value = "Tổng thu/chi theo từng loại tiền, không gồm chuyển khoản, điều chỉnh và các khoản đã tắt tính thu chi.";
  if (amounts.some(value => typeof value === 'string') || summaries.some(summary => !summary.formulas)) {
    sheet.getCell('A4').value += ' Số tiền dài được lưu dạng văn bản để giữ chính xác. Nhóm có số tiền hoặc tổng quá lớn dùng tổng cố định tại thời điểm xuất, không tự tính lại khi sửa dòng.';
  }
  sheet.mergeCells('A4:J4');
  sheet.getCell('A4').alignment = { vertical: 'middle', wrapText: true };
  sheet.getRow(4).height = sheet.getCell('A4').text.length > 180 ? 44 : 28;
  sheet.getRow(5).values = ["Tiền tệ", "Tổng thu", "Tổng chi", "Thu trừ chi"];
  summaries.forEach(({ currency, totals, formulas }, index) => {
    const row = 6 + index;
    sheet.getCell(row, 1).value = currency;
    const criteria = `$F$${firstRow}:$F$${lastRow},A${row},$J$${firstRow}:$J$${lastRow},"Thu/chi"`;
    const expressions = [
      `ROUND(SUMIFS($E$${firstRow}:$E$${lastRow},$B$${firstRow}:$B$${lastRow},"Thu nhập",${criteria}),2)`,
      `-ROUND(SUMIFS($E$${firstRow}:$E$${lastRow},$B$${firstRow}:$B$${lastRow},"Chi tiêu",${criteria}),2)`,
      `ROUND(B${row}-C${row},2)`,
    ];
    totals.forEach((total, index) => {
      const cell = sheet.getCell(row, index + 2);
      const value = excelMoney(total);
      cell.value = formulas ? { formula: expressions[index], result: Number(value) } : value;
      cell.numFmt = typeof value === 'string' ? '@' : exportNumberFormat(currency, total);
    });
  });
  if (!currencies.length) sheet.getCell("A6").value = "Không có giao dịch trong phạm vi đã chọn.";
  sheet.getRow(headerRow).values = ["Ngày", "Loại", "Tài khoản", "Danh mục", "Số tiền", "Tiền tệ", "Diễn giải", "Ghi chú", "Nguồn", "Nghiệp vụ"];
  transactions.forEach((transaction, index) => {
    const date = new Date(`${transaction.transaction_date.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) throw new Error("Ngày giao dịch không hợp lệ.");
    const row = sheet.getRow(firstRow + index);
    row.values = [date, ({ INCOME: "Thu nhập", EXPENSE: "Chi tiêu" } as Record<string, string>)[transaction.type] || transaction.type,
      transaction.account_name, transaction.category_name, amounts[index], transaction.currency, transaction.description, transaction.note || '',
      ({ WALLET: "Thanh toán ví", MANUAL: "Nhập thủ công", OCR: "Hóa đơn AI", XML: "Hóa đơn điện tử", BANK: "Ngân hàng", IMPORT: "Nhập dữ liệu", SYSTEM: "Hệ thống" } as Record<string, string>)[transaction.source] || transaction.source,
      transaction.include_in_reports === false ? "Không tính thu chi" : ({ NORMAL: "Thu/chi", TRANSFER: "Chuyển khoản", ADJUSTMENT: "Điều chỉnh số dư" } as Record<string, string>)[transaction.kind || "NORMAL"] || transaction.kind];
    row.getCell(1).numFmt = "dd/mm/yyyy";
    row.getCell(5).numFmt = typeof amounts[index] === 'string' ? '@' : exportNumberFormat(transaction.currency, cents[index]);
    const lines = Math.max(1, ...[transaction.account_name, transaction.category_name, transaction.description, transaction.note].map((text, i) =>
      String(text || "").split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / ([24, 22, 50, 38][i]))), 0)));
    row.height = Math.min(409, Math.max(28, lines * 15 + 10));
  });
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, columnNumber) => {
      cell.font = { name: "Arial", size: 11, color: { argb: colors.ink } };
      const moneyCell = (rowNumber > headerRow && columnNumber === 5) || (rowNumber >= 6 && rowNumber < 6 + currencies.length && columnNumber >= 2 && columnNumber <= 4);
      cell.alignment = { vertical: "middle", horizontal: moneyCell || typeof cell.value === "number" || cell.type === ExcelJS.ValueType.Formula ? "right" : "left", wrapText: rowNumber > headerRow || rowNumber === 4 };
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
  sheet.mergeCells("A3:J3");
  sheet.getCell("A3").alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(3).height = Math.max(24, Math.ceil(scope.length / 190) * 16 + 8);
  if (transactions.length) {
    sheet.autoFilter = `A${headerRow}:J${lastRow}`;
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
  sheet.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${headerRow}:${headerRow}`, printArea: `A1:J${Math.max(lastRow, headerRow)}` };
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
