const actionLabels = {
  CREATE_LOGIN: "Đăng nhập", CREATE_LOGOUT: "Đăng xuất", CREATE_REFRESH: "Làm mới phiên",
  CREATE_SUGGEST: "Đề xuất danh mục", CREATE_USER: "Tạo tài khoản", USER_CREATE: "Tạo tài khoản",
  USER_BAN: "Khóa tài khoản", USER_UNBAN: "Mở khóa tài khoản", USER_RESTORE: "Khôi phục tài khoản",
  USER_SOFT_DELETE: "Xóa mềm tài khoản", USER_HARD_DELETE: "Yêu cầu xóa vĩnh viễn",
  UPDATE_SMTP_SETTINGS: "Cập nhật SMTP", SEND_TEST_EMAIL: "Gửi thư kiểm thử", OCR_RETRY: "Thử lại OCR",
  CATEGORY_CREATE: "Tạo danh mục", CATEGORY_UPDATE: "Sửa danh mục", CATEGORY_REORDER: "Sắp xếp danh mục",
  BAN_USER: "Khóa tài khoản", UNBAN_USER: "Mở khóa tài khoản", RESET_USER_PASSWORD: "Cấp lại mật khẩu",
  UPDATE_USER_ROLE: "Đổi vai trò", BULK_BAN_USER: "Khóa tài khoản hàng loạt", BULK_UNBAN_USER: "Mở khóa hàng loạt",
  SOFT_DELETE_USER: "Xóa mềm tài khoản", HARD_DELETE_USER_REQUESTED: "Yêu cầu xóa vĩnh viễn",
  RESTORE_USER: "Khôi phục tài khoản", RETRY_USER_PURGE: "Thử lại xóa dữ liệu", RETRY_USER_FILE_PURGE: "Thử lại xóa tệp",
};

export const actionLabel = (action) => actionLabels[action] || action?.replaceAll("_", " ") || "Không xác định";

export function auditResult(code) {
  return code == null ? { label: "Chưa ghi mã HTTP", tone: "slate" } : code >= 400
    ? { label: `Lỗi · ${code}`, tone: "coral" } : { label: `HTTP ${code}`, tone: "teal" };
}
