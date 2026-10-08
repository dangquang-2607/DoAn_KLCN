/**
 * ============================================================================
 * TÊN FILE: utils.js
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Quản lý người dùng
 * MỤC ĐÍCH CỤ THỂ:
 *   Tập trung helper trạng thái và nhãn hành động dùng chung trong feature Users.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Đối tượng user và mã action từ UI quản trị.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất protectedAccount, accountStatus và actionTitles.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Tài khoản hệ thống phải luôn được nhận diện để chặn thao tác nguy hiểm.
 * ============================================================================
 */

/** Kiểm tra tài khoản hệ thống được bảo vệ. */
export const protectedAccount = (user) => user.is_system_account;

/** Presentation guards only; the API remains authoritative for permissions. */
export function rowActionKeys(user, meId) {
  const keys = [];
  const self = user.id === meId;
  const admin = user.role?.toUpperCase() === "ADMIN";
  if (!self && !protectedAccount(user) && !user.is_deleted) {
    keys.push("role", "reset-password");
    if (!admin || !user.is_active) keys.push(user.is_active ? "ban" : "unban");
    keys.push("delete");
  }
  if (!self && !protectedAccount(user) && !admin && user.is_deleted && user.deletion_status !== "PURGE_PENDING") {
    keys.push("restore", "delete");
  }
  if (user.deletion?.status === "FAILED") keys.push("retry-delete");
  return keys;
}

/** Chuẩn hóa trạng thái backend thành nhãn và tone hiển thị. */
export const accountStatus = (user) => {
  if (user.deletion?.status === "FAILED") return { label: "Xóa bị lỗi", tone: "danger" };
  if (user.deletion_status === "PURGE_PENDING") return { label: "Đang xóa vĩnh viễn", tone: "danger" };
  if (user.is_deleted) return { label: "Đã xóa mềm", tone: "warning" };
  if (user.is_active) return { label: "Hoạt động", tone: "success" };
  return { label: "Đã khóa", tone: "danger" };
};

/** Ánh xạ mã hành động sang tiêu đề modal tiếng Việt. */
export const actionTitles = {
  create: "Tạo người dùng",
  role: "Thay đổi vai trò",
  ban: "Khóa tài khoản",
  unban: "Mở khóa tài khoản",
  "reset-password": "Cấp lại mật khẩu",
  "bulk-ban": "Khóa tài khoản đã chọn",
  "bulk-unban": "Mở khóa tài khoản đã chọn",
  delete: "Xóa tài khoản",
  restore: "Khôi phục tài khoản",
  "bulk-delete": "Xóa mềm tài khoản đã chọn",
  "retry-delete": "Thử lại tác vụ xóa",
};
