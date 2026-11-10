"use client";
import { Search, Download, RotateCcw } from "lucide-react";
import styles from "../CSS/Transactions.module.css";
import { Field } from "@/dung-chung/UI-chung/ui";
import DateInput from "@/dung-chung/UI-chung/DateInput";
import { type Account, type Category } from "@/dung-chung/nghiep-vu/finance";

interface TransactionFiltersProps {
  independent?: boolean;
  filters: { type: string; account_id: string; category_id: string; start_date: string; end_date: string; origin?: string };
  search: string;
  selectedCount: number;
  exporting: boolean;
  exportDisabled: boolean;
  onExport: () => void;
  accounts: Account[];
  categories: Category[];
  onFilter: (key: string, value: string) => void;
  onSearch: (v: string) => void;
  onReset: () => void;
  resetKey: number;
}

// Chỉ xuất các giao dịch đã tick, không có phạm vi xuất ngầm theo trang/bộ lọc.
export default function TransactionFilters({
  independent = false,
  filters,
  search,
  selectedCount,
  exporting,
  exportDisabled,
  onExport,
  accounts,
  categories,
  onFilter,
  onSearch,
  onReset,
  resetKey,
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
      {independent ? (
        <Field label="Nguồn ghi nhận">
          <select
            className="cf-input"
            value={filters.origin || ""}
            onChange={(e) => onFilter("origin", e.target.value)}
          >
            <option value="">Tất cả nguồn</option>
            <option value="WALLET">Giao dịch ví</option>
            <option value="OCR">Quét hóa đơn</option>
            <option value="MANUAL">Nhập thủ công</option>
          </select>
        </Field>
      ) : (
        <Field label="Tài khoản">
          <select
            className="cf-input"
            value={filters.account_id}
            onChange={(e) => onFilter("account_id", e.target.value)}
          >
            <option value="">Tất cả tài khoản</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}> {a.name} </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Danh mục">
        <select
          className="cf-input"
          value={filters.category_id}
          onChange={(e) => onFilter("category_id", e.target.value)}
        >
          <option value="">Tất cả danh mục</option>
          <option value="uncategorized">Không phân loại</option>
          {categories.map((c) => ( <option key={c.id} value={c.id}> {c.name}{!c.is_active ? " (đã ẩn)" : ""} </option> ))}
        </select>
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
            aria-label="Tìm nhanh"
            placeholder="Tìm mọi giao dịch"
            value={search}
            maxLength={100}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </Field>
      <Field label="Từ ngày">
        <DateInput key={resetKey} value={filters.start_date} onChange={(value) => onFilter("start_date", value)} />
      </Field>
      <Field label="Đến ngày">
        <DateInput key={resetKey} value={filters.end_date} min={filters.start_date || undefined}
          onChange={(value) => onFilter("end_date", value)} />
      </Field>
      <div className={styles.filterActions}>
        <button
          className={`cf-btn ${styles.resetFilter}`}
          type="button"
          aria-label="Đặt lại bộ lọc"
          title="Đặt lại bộ lọc"
          // Giữ vị trí nút ổn định khi ô ngày đang nhập dở chuẩn bị báo lỗi lúc blur.
          onPointerDown={(event) => event.preventDefault()}
          onClick={(event) => { onReset(); event.currentTarget.focus(); }}
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
        <button
          className="cf-btn"
          type="button"
          disabled={exportDisabled || exporting}
          title={selectedCount ? `Xuất ${selectedCount} giao dịch đã tick` : "Tick ít nhất một giao dịch để xuất Excel"}
          onClick={onExport}
        >
          <Download size={14} />
          {exporting ? "Đang xuất…" : "Xuất Excel"}
        </button>
      </div>
    </div>
  );
}
