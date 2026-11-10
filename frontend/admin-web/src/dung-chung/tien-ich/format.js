

// Hiển thị ngày theo định dạng Việt Nam dd/mm/yyyy
export function formatDateForDisplay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || "";
}

// Chuẩn hóa ngày gõ/dán; giữ nguyên dữ liệu sai để bước kiểm tra từ chối.
export function formatDateForTyping(value) {
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
export function dateInputError(value) {
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

export function parseDateForApi(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((value || "").trim());
  if (!match) return null;
  const [, day, month, year] = match;
  if (dateInputError(`${day}/${month}/${year}`)) return null;
  return `${year}-${month}-${day}`;
}

export function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(date);
}

// Chuẩn hóa lỗi API thành thông báo an toàn, không lộ payload hoặc chi tiết nội bộ.
export function errorMessage(error) {
  const e = error;
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((d) => d.msg).join(". ");
  if (e?.response?.status === 429)
    return "Bạn thao tác quá nhanh. Vui lòng chờ một phút rồi thử lại.";
  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

// Chỉ nhận dữ liệu thuần, không nhận đối tượng formula/hyperlink từ API.
async function createExcelWorkbook({ title, scope, columns, rows }) {
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
        const text = String(raw);
        // Tránh Excel formula injection (CWE-1236) nếu chuỗi bắt đầu bằng =, +, -, @, tab, cr
        cell.value = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
        cell.numFmt = "@";
        lines = Math.max(lines, text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / Math.max(1, column.width - 3))), 0));
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

export async function exportExcel(name, report) {
  const workbook = await createExcelWorkbook(report);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob(
    [new Uint8Array(buffer)],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/\.xlsx$/i, "") + ".xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Presentation-only helpers. No fixtures, requests or business mutations here.
export const number = new Intl.NumberFormat("vi-VN");

export const decimal = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

export function timestamp(value) {
  if (!value) return "Chưa ghi nhận";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa ghi nhận" : new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(date);
}

const actionLabels = {
  "CREATE_DUPLICATE_CHECK": "Kiểm tra hóa đơn trùng",
  CREATE_RESOLVE: "Đọc thông tin QR hóa đơn",
  "CREATE_DUPLICATE_RESOLUTION": "Cập nhật quyết định hóa đơn trùng",
  CREATE_CONFIRM: "Xác nhận hóa đơn", CREATE_RECORD: "Ghi sổ hóa đơn",
  CREATE_RESTORE: "Khôi phục dữ liệu", CREATE_OCR: "Yêu cầu nhận diện hóa đơn",
  "CREATE_BATCH_OCR": "Nhận diện nhiều hóa đơn", "CREATE_BATCH_DELETE": "Xóa nhiều bản ghi",
  "CREATE_CHANGE_PASSWORD": "Đổi mật khẩu", "CREATE_FIRST_TIME_PASSWORD": "Thiết lập mật khẩu",
  "CREATE_FORGOT_PASSWORD": "Yêu cầu đặt lại mật khẩu", "CREATE_RESET_PASSWORD": "Đặt lại mật khẩu",
  CREATE_LOGIN: "Đăng nhập", CREATE_LOGOUT: "Đăng xuất", CREATE_REFRESH: "Làm mới phiên",
  CREATE_SUGGEST: "Đề xuất danh mục", CREATE_USER: "Tạo tài khoản", USER_CREATE: "Tạo tài khoản",
  USER_BAN: "Khóa tài khoản", USER_UNBAN: "Mở khóa tài khoản",
  UPDATE_SMTP_SETTINGS: "Cập nhật SMTP", SEND_TEST_EMAIL: "Gửi thư kiểm thử", OCR_RETRY: "Thử lại OCR",
  CATEGORY_CREATE: "Tạo danh mục", CATEGORY_UPDATE: "Sửa danh mục", CATEGORY_REORDER: "Sắp xếp danh mục",
  BAN_USER: "Khóa tài khoản", UNBAN_USER: "Mở khóa tài khoản", RESET_USER_PASSWORD: "Cấp lại mật khẩu",
  UPDATE_USER_ROLE: "Đổi vai trò", BULK_BAN_USER: "Khóa tài khoản hàng loạt", BULK_UNBAN_USER: "Mở khóa hàng loạt",
  SUPPORT_CASE_CREATE: "Tạo yêu cầu hỗ trợ", SUPPORT_CASE_ESCALATED: "Chuyển yêu cầu cho admin gốc",
  SUPPORT_CASE_RESOLVED: "Hoàn tất yêu cầu hỗ trợ", SUPPORT_CASE_OPEN: "Mở yêu cầu hỗ trợ",
  SUPPORT_REPLY_QUEUED: "Gửi email phản hồi hỗ trợ",
  CREATE_ACCOUNT: "Tiếp nhận yêu cầu hỗ trợ tài khoản", CREATE_QR: "Tạo QR hóa đơn mô phỏng",
  CREATE_WALLET: "Tạo ví", UPDATE_WALLET: "Cập nhật ví", DELETE_WALLET: "Đóng ví",
  CREATE_BOOKKEEPING: "Ghi khoản thu chi", UPDATE_BOOKKEEPING: "Sửa khoản thu chi", DELETE_BOOKKEEPING: "Xóa khoản thu chi",
  CREATE_BUDGET: "Tạo ngân sách", UPDATE_BUDGET: "Cập nhật ngân sách", DELETE_BUDGET: "Xóa ngân sách",
};

export const actionLabel = (action) => actionLabels[action?.replaceAll("-", "_")] || action?.replace(/[_-]/g, " ") || "Không xác định";

export function auditResult(code) {
  return code == null ? { label: "Chưa ghi mã HTTP", tone: "slate" } : code >= 400
    ? { label: `Lỗi · ${code}`, tone: "coral" } : { label: `HTTP ${code}`, tone: "teal" };
}

// Old request-only events can contain null snapshots or empty query-key arrays.
// Preserve false/zero, which are meaningful changes, and omit empty sections.
export function auditSections(log) {
  const meaningful = (value) => value != null && value !== "" &&
    (typeof value !== "object" || Object.values(value).some(meaningful));
  const fields = {
    is_active: "Trạng thái truy cập", role: "Vai trò", support_only: "Phạm vi admin hỗ trợ",
    sessions_revoked: "Thu hồi phiên đăng nhập", temporary_access_issued: "Cấp mật khẩu tạm thời",
    name: "Tên danh mục", type: "Loại danh mục", sort_order: "Thứ tự",
    status: "Trạng thái", issue: "Vấn đề hỗ trợ", queued: "Đã xếp hàng gửi thư", retry_queued: "Đã xếp hàng nhận diện lại",
    smtp_port: "Cổng SMTP", smtp_tls: "Dùng STARTTLS", smtp_ssl: "Dùng SSL / TLS",
    authentication_updated: "Cập nhật thông tin xác thực gửi thư", query_keys: "Tham số đi kèm",
  };
  const codes = { USER: "Người dùng", ADMIN: "Quản trị viên", INCOME: "Thu nhập", EXPENSE: "Chi tiêu",
    OPEN: "Đang mở", ESCALATED: "Chờ admin gốc", RESOLVED: "Đã xử lý", FAILED: "Thất bại",
    PENDING: "Đang chờ", PROCESSING: "Đang xử lý", NO_EMAIL: "Mất quyền truy cập email đăng ký", LOCKED: "Tài khoản bị khóa" };
  const display = (key, value) => {
    if (key === "is_active") return value ? "Có thể truy cập" : "Đã khóa";
    if (typeof value === "boolean") return value ? "Có" : "Không";
    if (typeof value === "string") return codes[value] || value;
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  };
  return [["Trước thay đổi", log?.before], ["Sau thay đổi", log?.after], ["Thông tin bổ sung", log?.metadata]]
    .filter(([, value]) => meaningful(value))
    .map(([label, value]) => ({ label, rows: Object.entries(typeof value === "object" ? value : { value })
      .filter(([, item]) => meaningful(item))
      .map(([key, item]) => [fields[key] || key, display(key, item)]) }));
}
