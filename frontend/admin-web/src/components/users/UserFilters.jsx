/**
 * ============================================================================
 * TÊN FILE: UserFilters.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Quản lý người dùng
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp tìm kiếm, lọc vai trò/trạng thái và xuất CSV danh sách đang hiển thị.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Filter hiện tại, list/selection và callback do Users truyền xuống.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất toolbar lọc và export không tự gọi API.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   CSV dùng helper chống formula injection và chỉ xuất dữ liệu được phép hiển thị.
 * ============================================================================
 */
import { Download } from "lucide-react";
import { Field } from "../design";
import { exportCsv } from "../../services/format";
import { accountStatus } from "./utils";

export default function UserFilters({
  search,
  role,
  status,
  list,
  selected,
  page,
  onSearch,
  onRole,
  onStatus,
}) {
  return (
    <div className="cf-toolbar">
      <Field label="Tìm người dùng">
        <input
          className="cf-input"
          placeholder="Họ tên hoặc email."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </Field>
      <Field label="Vai trò">
        <select
          className="cf-input"
          value={role}
          onChange={(e) => onRole(e.target.value)}
        >
          <option value="">Tất cả vai trò</option>
          <option value="USER">Người dùng</option>
          <option value="ADMIN">Quản trị viên</option>
        </select>
      </Field>
      <Field label="Trạng thái">
        <select
          className="cf-input"
          value={status}
          onChange={(e) => onStatus(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="banned">Đã khóa</option>
          <option value="deleted">Đã xóa (Thùng rác)</option>
          <option value="purge_pending">Đang xóa vĩnh viễn</option>
        </select>
      </Field>
      <button
        className="cf-btn"
        disabled={!list.length}
        onClick={() =>
          exportCsv("nguoi-dung-trang-" + page + ".csv", [
            ["Họ tên", "Email", "Vai trò", "Trạng thái"],
            ...list
              .filter((u) => !selected.length || selected.includes(u.id))
              .map((u) => [u.full_name, u.email, u.role, accountStatus(u).label]),
          ])
        }
      >
        <Download />
        {selected.length ? "Xuất đã chọn" : "Xuất trang này"}
      </button>
    </div>
  );
}
