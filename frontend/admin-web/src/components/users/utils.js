/**
 * utils.js - Shared utilities cho Users components
 */

/** Kiem tra tai khoan duoc bao ve (system account) */
export const protectedAccount = (u) => u.is_system_account;

/** Lay trang thai hien thi cua nguoi dung */
export const accountStatus = (u) => {
  if (u.deletion?.status === "FAILED")
    return { label: "Xoa bi loi", tone: "danger" };
  if (u.deletion_status === "PURGE_PENDING")
    return { label: "Dang xoa vinh vien", tone: "danger" };
  if (u.is_deleted) return { label: "Da xoa mem", tone: "warning" };
  if (u.is_active) return { label: "Hoat dong", tone: "success" };
  return { label: "Da khoa", tone: "danger" };
};

/** Map action -> tieu de modal */
export const actionTitles = {
  create: "Tao nguoi dung",
  role: "Thay doi vai tro",
  ban: "Khoa tai khoan",
  unban: "Mo khoa tai khoan",
  "reset-password": "Cap lai mat khau",
  "bulk-ban": "Khoa tai khoan da chon",
  "bulk-unban": "Mo khoa tai khoan da chon",
  delete: "Xoa tai khoan",
  restore: "Khoi phuc tai khoan",
  "bulk-delete": "Xoa mem tai khoan da chon",
  "retry-delete": "Thu lai tac vu xoa",
};