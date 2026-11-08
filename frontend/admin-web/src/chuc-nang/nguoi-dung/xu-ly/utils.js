/** Kiểm tra tài khoản hệ thống được bảo vệ. */
const protectedAccount = (user) => user.is_system_account;

/** Presentation guards only; the API remains authoritative for permissions. */
export function rowActionKeys(user, meId, canManageRoles = false) {
  if (!meId || !user) return [];
  const keys = [];
  const self = user.id === meId;
  const admin = user.role?.toUpperCase() === "ADMIN";
  if (!self && !protectedAccount(user)) {
    if (canManageRoles) keys.push("role");
    keys.push("reset-password");
    if (!admin || !user.is_active) keys.push(user.is_active ? "ban" : "unban");
  }
  return keys;
}

export function selectableUsers(list, meId) {
  if (!meId) return [];
  return list.filter((user) => user.id !== meId && !protectedAccount(user) &&
    user.role?.toUpperCase() !== "ADMIN");
}

export function validSelection(selected, list, meId) {
  const allowed = new Set(selectableUsers(list, meId).map((user) => user.id));
  return [...new Set(selected)].filter((id) => allowed.has(id));
}

/** Chuẩn hóa trạng thái backend thành nhãn và tone hiển thị. */
export const accountStatus = (user) => {
  if (user.is_active) return { label: "Hoạt động", tone: "success" };
  return { label: "Đã khóa", tone: "danger" };
};

/** Ánh xạ mã hành động sang tiêu đề modal tiếng Việt. */
export const actionTitles = {
  role: "Thay đổi vai trò",
  ban: "Khóa tài khoản",
  unban: "Mở khóa tài khoản",
  "reset-password": "Cấp lại mật khẩu",
  "bulk-ban": "Khóa tài khoản đã chọn",
  "bulk-unban": "Mở khóa tài khoản đã chọn",
};

/** Tạo chữ cái viết tắt đại diện an toàn cho avatar người dùng. */
export function userInitials(user) {
  const name = (user?.full_name || user?.email || "?").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(-2).map((part) => part[0] || "").join("").toUpperCase();
}
