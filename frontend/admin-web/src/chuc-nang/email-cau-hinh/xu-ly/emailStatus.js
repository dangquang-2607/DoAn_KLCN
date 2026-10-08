export function emailStatus(status) {
  return ({ SENT: { label: "Đã gửi", tone: "teal" }, LOGGED_DEV: { label: "Lưu xem trước", tone: "violet" },
    FAILED: { label: "Thất bại", tone: "coral" }, QUEUED: { label: "Đang chờ", tone: "amber" },
    PENDING: { label: "Đang chờ", tone: "amber" } })[status] || { label: status || "Chưa ghi nhận", tone: "slate" };
}
