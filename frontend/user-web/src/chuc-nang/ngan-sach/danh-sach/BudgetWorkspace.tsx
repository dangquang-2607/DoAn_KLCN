import { useState } from "react";
import { CategoryIcon } from "@/dung-chung/UI-chung/CategoryIcon";
import ListDetailLayout, { RecordRow } from "@/dung-chung/UI-chung/ListDetailLayout";
import type { Budget, Category } from "@/dung-chung/nghiep-vu/finance";
import { dateLabel, money, percent } from "@/dung-chung/tien-ich/finance";
import BudgetCard from "./BudgetCard";
import styles from "../CSS/BudgetList.module.css";

// Một ngân sách có nhiều kỳ lịch sử; mỗi dòng phải có khóa riêng theo kỳ.
const recordKey = (budget: Budget) => `${budget.budget_id}:${budget.start_date}:${budget.end_date}`;

/**
 * Không gian quản lý và theo dõi tiến độ ngân sách chi tiêu trực quan.
 */
export default function BudgetWorkspace({ budgets, categories, history = false, onEdit, onDelete, onReuse }: {
  budgets: Budget[]; categories: Category[]; history?: boolean;
  onEdit?: (budget: Budget) => void; onDelete?: (budget: Budget) => void;
  onReuse?: (budget: Budget) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>();
  const selected = selectedKey === null ? undefined : budgets.find((budget) => recordKey(budget) === selectedKey) || budgets[0];
  const selectedCategory = categories.find((category) => category.id === selected?.category_id);
  const groups = history ? [{ title: "Các kỳ đã kết thúc", items: budgets }] : [
    { title: "Kỳ hiện tại", items: budgets.filter((budget) => budget.period_state !== "UPCOMING") },
    { title: "Sắp tới", items: budgets.filter((budget) => budget.period_state === "UPCOMING") },
  ];
  return <ListDetailLayout listTitle={history ? "Lịch sử ngân sách" : "Danh sách ngân sách"} count={budgets.length}
    selectedKey={selected && recordKey(selected)} title={selected?.budget_name || "Chi tiết ngân sách"}
    compactHeader
    header={selected && <CategoryIcon icon={selectedCategory?.icon || "piggy-bank"} color={selectedCategory?.color || "teal"} size={36} />}
    onClose={() => setSelectedKey(null)}
    list={<div className={styles.groups}>{groups.filter((group) => group.items.length).map((group) => <section key={group.title} className={styles.group} aria-label={group.title}>
      <h3>{group.title}<span>{group.items.length}</span></h3>
      <ul className={styles.list}>{group.items.map((budget) => {
        const category = categories.find((item) => item.id === budget.category_id);
        const state = budget.period_state === "UPCOMING" ? "Sắp tới" : budget.period_state === "PAUSED" && !history ? "Tạm dừng" : budget.progress_status === "EXCEEDED" ? "Vượt hạn mức" : budget.progress_status === "WARNING" ? "Đạt ngưỡng cảnh báo" : "Trong hạn mức";
        return <li key={recordKey(budget)}><RecordRow recordKey={recordKey(budget)} selected={!!selected && recordKey(selected) === recordKey(budget)} onSelect={() => setSelectedKey(recordKey(budget))}
          leading={<CategoryIcon icon={category?.icon || "piggy-bank"} color={category?.color || "teal"} size={38} />}
          title={budget.budget_name}
          description={<span className={styles.description}><span>{category?.name || "Tất cả danh mục"}</span><span>{dateLabel(budget.start_date)} – {dateLabel(budget.end_date)}</span></span>}
          trailing={<span className={styles.summary}><strong>{money(budget.spent_amount, budget.currency)}</strong><span data-status={budget.progress_status}>{percent(budget.usage_percent, 0)}% · {state}</span></span>} />
        </li>;
      })}</ul>
    </section>)}</div>}>
    {selected && <BudgetCard embedded budget={selected} category={selectedCategory} history={history}
      onEdit={!history && onEdit ? () => onEdit(selected) : undefined}
      onDelete={!history && onDelete ? () => onDelete(selected) : undefined}
      onReuse={history && onReuse ? () => onReuse(selected) : undefined} />}
  </ListDetailLayout>;
}
