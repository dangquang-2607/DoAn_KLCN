/**
 * ============================================================================
 * TÊN FILE: TransactionFilters.tsx
 * MÀN HÌNH / PHÂN HỆ: Giao dịch
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp tìm kiếm, bộ lọc và xuất CSV cho sổ giao dịch.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất TransactionFilters để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Validate tài khoản, tiền tệ và số tiền; mọi ghi/xóa phải làm mới các cache tài chính liên quan.
 * ============================================================================
 */
"use client";
import { Search, Download } from "lucide-react";
import { Field } from "@/dung-chung/UI-chung/ui";
import DateInput from "@/dung-chung/UI-chung/DateInput";
import { dateLabel, exportCsv } from "@/dung-chung/tien-ich/finance";
import { type Account, type Category, type Transaction } from "@/dung-chung/nghiep-vu/finance";

interface TransactionFiltersProps {
  filters: { type: string; account_id: string; category_id: string; start_date: string; end_date: string };
  search: string;
  page: number;
  list: Transaction[];
  accounts: Account[];
  categories: Category[];
  onFilter: (key: string, value: string) => void;
  onSearch: (v: string) => void;
  getAccount: (id: string) => Account | undefined;
  getCategory: (id: string | null) => Category | undefined;
}

// Khi xuất CSV, chỉ xuất danh sách đang hiển thị và dùng helper chống CSV injection.
export default function TransactionFilters({
  filters,
  search,
  page,
  list,
  accounts,
  categories,
  onFilter,
  onSearch,
  getAccount,
  getCategory,
}: TransactionFiltersProps) {
  return (
    <div className="cf-toolbar">
      <Field label="Loại giao dịch">
        <select
          className="cf-input"
          value={filters.type}
          onChange={(e) => onFilter("type", e.target.value)}
        >
          <option value="">Tất cả</option>
          <option value="INCOME">Thu nhập</option>
          <option value="EXPENSE">Chi tiêu</option>
        </select>
      </Field>
      <Field label="Tài khoản">
        <select
          className="cf-input"
          value={filters.account_id}
          onChange={(e) => onFilter("account_id", e.target.value)}
        >
          <option value="">Tất cả tài khoản</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Danh mục">
        <select
          className="cf-input"
          value={filters.category_id}
          onChange={(e) => onFilter("category_id", e.target.value)}
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{!c.is_active ? " (đã ẩn)" : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Từ ngày">
        <DateInput value={filters.start_date} onChange={(value) => onFilter("start_date", value)} />
      </Field>
      <Field label="Đến ngày">
        <DateInput value={filters.end_date} min={filters.start_date || undefined}
          onChange={(value) => onFilter("end_date", value)} />
      </Field>
      <Field label="Tìm nhanh">
        <div style={{ position: "relative" }}>
          <Search
            size={14}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
          />
          <input
            className="cf-input"
            style={{ paddingLeft: 32 }}
            placeholder="Tìm mọi giao dịch"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </Field>
      <button
        className="cf-btn"
        disabled={!list.length}
        onClick={() =>
          exportCsv("giao-dich-trang-" + page + ".csv", [
            ["Ngày", "Mô tả", "Tài khoản", "Danh mục", "Số tiền", "Tiền tệ"],
            ...list.map((t) => [
              dateLabel(t.transaction_date),
              t.description,
              getAccount(t.account_id)?.name,
              getCategory(t.category_id)?.name,
              t.amount,
              getAccount(t.account_id)?.currency || "VND",
            ]),
          ])
        }
      >
        <Download size={14} />
        Xuất trang này
      </button>
    </div>
  );
}
