import { Download } from "lucide-react";
import { Field } from "../design";
import { exportCsv } from "../../services/format";
import { accountStatus } from "./utils";

/**
 * UserFilters — Toolbar tim kiem, loc vai tro/trang thai va xuat CSV.
 */
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
      <Field label="Tim nguoi dung">
        <input
          className="cf-input"
          placeholder="Ho ten hoac email."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </Field>
      <Field label="Vai tro">
        <select
          className="cf-input"
          value={role}
          onChange={(e) => onRole(e.target.value)}
        >
          <option value="">Tat ca vai tro</option>
          <option value="USER">Nguoi dung</option>
          <option value="ADMIN">Quan tri vien</option>
        </select>
      </Field>
      <Field label="Trang thai">
        <select
          className="cf-input"
          value={status}
          onChange={(e) => onStatus(e.target.value)}
        >
          <option value="">Tat ca trang thai</option>
          <option value="active">Dang hoat dong</option>
          <option value="banned">Da khoa</option>
          <option value="deleted">Da xoa (Thung rac)</option>
          <option value="purge_pending">Dang xoa vinh vien</option>
        </select>
      </Field>
      <button
        className="cf-btn"
        disabled={!list.length}
        onClick={() =>
          exportCsv("nguoi-dung-trang-" + page + ".csv", [
            ["Ho ten", "Email", "Vai tro", "Trang thai"],
            ...list
              .filter((u) => !selected.length || selected.includes(u.id))
              .map((u) => [u.full_name, u.email, u.role, accountStatus(u).label]),
          ])
        }
      >
        <Download />
        {selected.length ? "Xuat da chon" : "Xuat trang nay"}
      </button>
    </div>
  );
}