"use client";
import { Search, Download } from "lucide-react";
import { Field } from "@/components/ui";
import { exportCsv, type Account, type Category, type Transaction } from "@/lib/finance";

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
      <Field label="Loai giao dich">
        <select
          className="cf-input"
          value={filters.type}
          onChange={(e) => onFilter("type", e.target.value)}
        >
          <option value="">Tat ca</option>
          <option value="INCOME">Thu nhap</option>
          <option value="EXPENSE">Chi tieu</option>
        </select>
      </Field>
      <Field label="Tai khoan">
        <select
          className="cf-input"
          value={filters.account_id}
          onChange={(e) => onFilter("account_id", e.target.value)}
        >
          <option value="">Tat ca tai khoan</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Danh muc">
        <select
          className="cf-input"
          value={filters.category_id}
          onChange={(e) => onFilter("category_id", e.target.value)}
        >
          <option value="">Tat ca danh muc</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tu ngay">
        <input
          className="cf-input"
          type="date"
          value={filters.start_date}
          onChange={(e) => onFilter("start_date", e.target.value)}
        />
      </Field>
      <Field label="Den ngay">
        <input
          className="cf-input"
          type="date"
          value={filters.end_date}
          onChange={(e) => onFilter("end_date", e.target.value)}
        />
      </Field>
      <Field label="Tim nhanh">
        <div style={{ position: "relative" }}>
          <Search
            size={14}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
          />
          <input
            className="cf-input"
            style={{ paddingLeft: 32 }}
            placeholder="Mo ta giao dich"
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
            ["Ngay", "Mo ta", "Tai khoan", "Danh muc", "So tien", "Tien te"],
            ...list.map((t) => [
              t.transaction_date,
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
        Xuat trang nay
      </button>
    </div>
  );
}